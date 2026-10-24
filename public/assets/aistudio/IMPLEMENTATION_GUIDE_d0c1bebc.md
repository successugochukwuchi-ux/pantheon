# TAKANO PAY - REPLICATION & IMPLEMENTATION GUIDE
**Automated Nigerian Bank/Wallet Transfer Verification Engine with Dynamic Kobo Slot Allocation & AI-Powered IMAP Agent**

---

## 1. System Overview & Architecture

Takano Pay is an automated verification and instant activation PIN dispensation system for direct Nigerian bank transfers (PalmPay, OPay, Kuda, GTBank, Zenith, Moniepoint, etc.).

### Core Problem Solved
Traditional bank transfers lack unique metadata or merchant order IDs. Takano Pay solves this with a **Dynamic Kobo Slot Allocation Engine**:
- When a customer starts checkout for a base price (e.g. ₦5,000), the system dynamically allocates an unreserved kobo increment between **₦0.01 and ₦5.99** (e.g. `₦5,002.30`).
- This slot is locked for **15 minutes**, enabling up to **600 concurrent checkouts** without collision.
- The customer transfers the exact amount (including kobo cents).
- A background Node.js IMAP worker checks the merchant's Gmail inbox every **5 seconds** for emails from the designated sender.
- When an email arrives, its Unique ID (UID) is verified to be new.
- The raw body is passed to a high-speed OpenAI-compatible LLM endpoint (`qwen/qwen3.8-omni-flash:free`), which executes the `approve_payment_transfer` tool schema.
- If verified, the webhook marks the order `PAID`, releases the slot, and dispenses a unique single-use activation PIN (`TKNO-XXXX-XXXX-XXXX`).

---

## 2. Configuration & Credentials

Add these variables to `.env` (or configure in AI Studio Secrets):

```bash
# IMAP Credentials
IMAP_HOST="imap.gmail.com"
IMAP_PORT=993
IMAP_USER="successugochukwuchi@gmail.com"
# Note: Gmail App Passwords may have spaces in UI; strip spaces in code: vgvvugojqnqpcfme
IMAP_PASSWORD="vgvv ugoj qnqp cfme"
TARGET_SENDER="successcugo@gmail.com"

# LLM API (OpenAI-compatible)
LLM_BASE_URL="https://api.xkiro.com/v1"
LLM_API_KEY="sk-xt-8efce7fdc46238b3456fafcf36713ce45ff83a0a52df9581"
LLM_MODEL="qwen/qwen3.8-omni-flash:free"

# Merchant Bank Details
DEFAULT_BANK_NAME="PalmPay"
DEFAULT_ACCOUNT_NUMBER="8123456789"
DEFAULT_ACCOUNT_NAME="Takano Activation Pins Ltd"
```

---

## 3. Required Dependencies & Scripts

In `package.json`:

```json
{
  "name": "takano-pay",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build",
    "start": "tsx server.ts",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.21.2",
    "dotenv": "^17.2.3",
    "imapflow": "^1.0.171",
    "mailparser": "^3.7.2",
    "openai": "^4.86.1",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "vite": "^8.3.0",
    "@tailwindcss/vite": "^4.3.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@types/mailparser": "^3.4.5",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2"
  }
}
```

---

## 4. Critical Engineering Fixes & Pitfalls Avoided

When implementing this architecture, standard implementations fail without these essential fixes:

### A. The `imapflow.fetchOne` Options Parameter Bug
- **Bug:** Calling `client.fetchOne(uid, { source: true, envelope: true, uid: true })` fails silently. `imapflow` expects `{ uid: true }` in the **3rd parameter (`options`)**, not in the 2nd parameter (`query`). When placed in `query`, `imapflow` treats large UIDs (e.g. `9700`) as sequence numbers and returns `null` or `false` because the mailbox has fewer messages.
- **Correction:** Always call:
  ```ts
  const message = await client.fetchOne(
    String(uid),
    { source: true, envelope: true, flags: true },
    { uid: true } // Must be 3rd parameter!
  );
  ```

### B. Mailbox Lock Deadlocks During IDLE
- **Bug:** Holding a lock obtained via `getMailboxLock('INBOX')` while calling `await client.idle()` deadlocks the entire connection. When a new email arrives or a scheduled poller executes, any attempt to acquire a second lock on the mailbox hangs indefinitely.
- **Correction:** Keep operations atomic: acquire lock -> run scan -> release lock -> enter idle/sleep.

### C. Unique ID (UID) Tracking to Prevent Redundant AI Model Invocations
- **Bug:** If messages from `TARGET_SENDER` are scanned without tracking processed UIDs, past emails in the inbox get re-sent to the LLM on every poll cycle, burning tokens and causing duplicate processing.
- **Correction:** Maintain a persistent set of processed UIDs (`server/processedUids.ts`). Compute:
  $$\text{newUids} = \text{currentUids} \setminus \text{processedUids}$$
  If `newUids.length === 0`, do NOT invoke the model.

### D. IMAP Server State Sync (`NOOP`)
- **Bug:** Without calling `NOOP` or active IDLE, Gmail IMAP caches mailbox results and does not report newly arrived messages.
- **Correction:** Issue `await client.noop()` at the start of each scan to force synchronization.

### E. LLM Prompt Tuning for Minimalist & Test Emails
- **Bug:** When users send test emails with simple bodies like `5002.30\nTAKANOPAYMENTTEST`, strict prompts reject them as `is_legitimate: false` due to a lack of bank header boilerplate.
- **Correction:** Enforce in code:
  ```ts
  const containsTestKeyword = /TAKANOPAYMENTTEST/i.test(fullContent);
  const isTest = Boolean(parsedArgs.is_test) || containsTestKeyword;
  const isLegitimate = containsTestKeyword ? true : (Boolean(parsedArgs.is_legitimate) || /credit|deposit|alert/i.test(subject));
  ```

### F. Race-Condition Buffer (`recentUnmatchedCredits`)
- **Bug:** If a customer sends money first before opening checkout, or if bank latency causes a delay, the webhook cannot match an active order.
- **Correction:** Buffer incoming legitimate credits in `recentUnmatchedCredits` with a 20-minute TTL. When `createOrder` runs, check if a matching credit was already received. If so, fulfill immediately and dispense the PIN upon checkout load!

---

## 5. Backend Implementation

### A. Processed UID Tracker (`server/processedUids.ts`)

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_PATH = path.resolve(__dirname, 'processed_uids.json');

export class ProcessedUidsTracker {
  private uids: Set<number> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const raw = fs.readFileSync(FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.uids = new Set(data.map(Number));
        }
      }
    } catch (e) {
      console.warn('[UID Tracker] Initializing fresh set.');
    }
  }

  public save() {
    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify(Array.from(this.uids)), 'utf-8');
    } catch (e) {
      console.warn('[UID Tracker] Could not save processed_uids.json:', e);
    }
  }

  public has(uid: number): boolean {
    return this.uids.has(Number(uid));
  }

  public add(uid: number) {
    this.uids.add(Number(uid));
    this.save();
  }

  public addMany(uids: number[]) {
    for (const uid of uids) {
      this.uids.add(Number(uid));
    }
    this.save();
  }

  public size(): number {
    return this.uids.size;
  }
}

export const uidTracker = new ProcessedUidsTracker();
```

---

### B. LLM Tool Calling Service (`server/llmService.ts`)

```typescript
import OpenAI from 'openai';
import { store } from './store.ts';

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.xkiro.com/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || 'sk-xt-8efce7fdc46238b3456fafcf36713ce45ff83a0a52df9581';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen/qwen3.8-omni-flash:free';

const openaiClient = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY,
});

export interface ExtractionResult {
  toolCalled: boolean;
  amount: number | null;
  senderName: string;
  isLegitimate: boolean;
  isTest: boolean;
  executionMethod: 'LLM_TOOL_CALL' | 'FALLBACK_HEURISTIC';
  error?: string;
}

const APPROVE_PAYMENT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'approve_payment_transfer',
    description: 'Approve and record a verified Nigerian bank or wallet transfer credit alert after checking authenticity and amount.',
    parameters: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'The exact floating-point credit amount transferred in Naira (e.g. 5003.42). Must retain all kobo decimal precision.',
        },
        sender_name: {
          type: 'string',
          description: 'The detected sender name, payer name, or source institution from the alert.',
        },
        is_legitimate: {
          type: 'boolean',
          description: 'True if this is a genuine incoming credit notification/transfer receipt. False if it is a debit alert, spam, marketing, or phishing.',
        },
        is_test: {
          type: 'boolean',
          description: 'Set strictly to true if the exact string "TAKANOPAYMENTTEST" appears anywhere in the email body or subject.',
        },
      },
      required: ['amount', 'sender_name', 'is_legitimate', 'is_test'],
    },
  },
};

export async function analyzeEmailWithLLM(
  rawBody: string,
  subject: string = '',
  fromAddress: string = ''
): Promise<ExtractionResult> {
  const fullContent = `SUBJECT: ${subject}\nFROM: ${fromAddress}\n\nEMAIL BODY:\n${rawBody}`;
  const containsTestKeyword = /TAKANOPAYMENTTEST/i.test(fullContent);

  try {
    store.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'INFO',
      from: fromAddress,
      subject,
      bodyPreview: rawBody.slice(0, 160).trim(),
      message: `Passing incoming email to LLM (${LLM_MODEL}) for credit alert tool call...`,
    });

    const completion = await openaiClient.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an automated Nigerian banking credit alert parser for Takano Pay.
Your task is to analyze incoming bank and wallet credit alert emails (e.g., PalmPay, OPay, Moniepoint, Kuda, GTBank, Zenith, Access, or direct test notifications).
Instructions:
1. Identify if this is a credit or deposit alert crediting the merchant's account. Note: Notifications with amounts and subjects like "Credit alert", or containing payment test text, ARE valid credit alerts.
2. Extract the EXACT floating-point amount credited in Naira (e.g. "5002.30", "₦5,003.42", "NGN 5003.42" -> 5002.30). You MUST retain all decimal kobo precision!
3. Check if the string "TAKANOPAYMENTTEST" exists anywhere in the body or subject. If found, you MUST set is_test: true and is_legitimate: true.
4. Invoke the tool "approve_payment_transfer" with amount, sender_name, is_legitimate, and is_test. Only set is_legitimate: false if this is an explicit debit/withdrawal alert or contains no amount.`,
        },
        { role: 'user', content: fullContent },
      ],
      tools: [APPROVE_PAYMENT_TOOL],
      tool_choice: 'auto',
      temperature: 0.1,
    });

    const message = completion.choices[0]?.message;
    const toolCalls = message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const matchCall = toolCalls.find(
        (t): t is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { function: { name: string; arguments: string } } =>
          t.type === 'function' && 'function' in t && t.function.name === 'approve_payment_transfer'
      );
      if (matchCall && matchCall.function) {
        const parsedArgs = JSON.parse(matchCall.function.arguments);
        const amount = typeof parsedArgs.amount === 'number' ? parsedArgs.amount : parseFloat(parsedArgs.amount);
        const isTest = Boolean(parsedArgs.is_test) || containsTestKeyword;
        const isLegitimate = containsTestKeyword ? true : (Boolean(parsedArgs.is_legitimate) || /credit|deposit|received|alert/i.test(subject));
        const senderName = String(parsedArgs.sender_name || fromAddress || 'Detected Payer');

        store.addAuditLog({
          source: 'IMAP_WORKER',
          status: isLegitimate ? 'SUCCESS' : 'REJECTED',
          from: fromAddress,
          subject,
          extractedAmount: amount,
          extractedSender: senderName,
          isLegitimate,
          isTest,
          message: `LLM Tool Call "approve_payment_transfer" executed: Amount=₦${amount}, Legitimate=${isLegitimate}, Test=${isTest}, Sender="${senderName}"`,
        });

        return {
          toolCalled: true,
          amount,
          senderName,
          isLegitimate,
          isTest,
          executionMethod: 'LLM_TOOL_CALL',
        };
      }
    }

    return fallbackExtraction(fullContent, containsTestKeyword, 'LLM did not invoke tool call');
  } catch (error: any) {
    return fallbackExtraction(fullContent, containsTestKeyword, error.message);
  }
}

function fallbackExtraction(content: string, containsTestKeyword: boolean, contextReason: string): ExtractionResult {
  let match = content.match(/(?:NGN|₦|Naira|Credit(?:\s+Amount)?|Amt:?)\s*[:=]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i);
  if (!match) match = content.match(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{1,2}|[0-9]{2,7}\.[0-9]{1,2})\b/);
  if (!match) match = content.match(/\b([0-9]{3,7}\.[0-9])\b/);

  const senderMatch = content.match(/(?:From|Sender|Payer|Depositor|by)\s*[:=]?\s*([A-Za-z\s]{3,35})(?:\n|\r|\.|;|,)/i);
  const detectedSender = senderMatch ? senderMatch[1].trim() : 'Bank Payer';
  const isCredit = /credit|credited|received|deposit|payment alert|transfer from|TAKANOPAYMENTTEST/i.test(content) && !/debit alert|withdrawn|charged/i.test(content);

  if (match && match[1]) {
    const rawNumberStr = match[1].replace(/,/g, '');
    const amount = parseFloat(rawNumberStr);
    if (!isNaN(amount) && amount > 0) {
      return {
        toolCalled: true,
        amount,
        senderName: detectedSender,
        isLegitimate: isCredit,
        isTest: containsTestKeyword,
        executionMethod: 'FALLBACK_HEURISTIC',
      };
    }
  }

  return {
    toolCalled: false,
    amount: null,
    senderName: detectedSender,
    isLegitimate: false,
    isTest: containsTestKeyword,
    executionMethod: 'FALLBACK_HEURISTIC',
    error: 'No recognizable credit amount found in email body',
  };
}
```

---

### C. 5-Second IMAP Email Worker (`server/emailWorker.ts`)

```typescript
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { analyzeEmailWithLLM } from './llmService.ts';
import { store } from './store.ts';
import { uidTracker } from './processedUids.ts';
import { WorkerStatus } from '../src/types/index.ts';

const IMAP_HOST = process.env.IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
const IMAP_USER = process.env.IMAP_USER || 'successugochukwuchi@gmail.com';
const IMAP_PASS = (process.env.IMAP_PASSWORD || 'vgvv ugoj qnqp cfme').replace(/\s+/g, '');
const TARGET_SENDER = (process.env.TARGET_SENDER || 'successcugo@gmail.com').toLowerCase().trim();

class EmailWorkerService {
  private client: ImapFlow | null = null;
  private isRunning: boolean = false;
  private isScanning: boolean = false;

  private status: WorkerStatus = {
    imapStatus: 'IDLE',
    mailbox: 'INBOX',
    targetSender: TARGET_SENDER,
    llmModel: 'qwen/qwen3.8-omni-flash:free',
    llmEndpoint: 'https://api.xkiro.com/v1',
    lastCheckedAt: null,
    lastProcessedEmail: null,
    totalEmailsScanned: uidTracker.size(),
    totalApprovedTransfers: 0,
  };

  public getStatus(): WorkerStatus {
    return { ...this.status, totalEmailsScanned: uidTracker.size() };
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.initiateWorker();
  }

  private async initiateWorker() {
    while (this.isRunning) {
      try {
        await this.connectClient();
        await this.runFiveSecondScanLoop();
      } catch (err: any) {
        console.warn('[IMAP Worker Warning]', err.message);
        this.status.imapStatus = 'ERROR';
        this.status.lastErrorMessage = err.message;
      }

      if (this.isRunning) {
        this.status.imapStatus = 'CONNECTING';
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async connectClient() {
    this.client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: { user: IMAP_USER, pass: IMAP_PASS },
      logger: false as const,
      emitLogs: false,
    });

    await this.client.connect();
    this.status.imapStatus = 'CONNECTED';
    this.status.lastCheckedAt = Date.now();

    // Baseline initialization: Seed any existing UIDs on first start
    let lock;
    try {
      lock = await this.client.getMailboxLock('INBOX');
      const existingUids = await this.client.search({ from: TARGET_SENDER }, { uid: true });
      const uidsArray = Array.isArray(existingUids) ? existingUids : [];
      if (uidTracker.size() === 0 && uidsArray.length > 0) {
        uidTracker.addMany(uidsArray);
      }
    } finally {
      if (lock) lock.release();
    }
  }

  private async runFiveSecondScanLoop() {
    this.status.imapStatus = 'LISTENING';

    while (this.isRunning && this.client && this.client.usable) {
      const startTime = Date.now();
      try {
        await this.scanForNewUniqueIdEmails();
      } catch (err: any) {
        console.warn('[Scan Cycle Error]', err.message);
        if (!this.client.usable) break;
      }

      this.status.lastCheckedAt = Date.now();
      const elapsed = Date.now() - startTime;
      const sleepMs = Math.max(1000, 5000 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  public async scanForNewUniqueIdEmails(): Promise<{ scanned: number; approved: number }> {
    if (!this.client || !this.client.usable || this.isScanning) {
      return { scanned: 0, approved: 0 };
    }

    this.isScanning = true;
    let scanned = 0;
    let approved = 0;

    let lock;
    try {
      lock = await this.client.getMailboxLock('INBOX');

      try { await this.client.noop(); } catch (e) {}

      // Get all message UIDs from target sender
      const searchResult = await this.client.search({ from: TARGET_SENDER }, { uid: true });
      const allCurrentUids: number[] = Array.isArray(searchResult) ? searchResult : [];

      // ONLY process UIDs that have NEVER been seen
      const newUids = allCurrentUids.filter((uid) => !uidTracker.has(uid));

      // Exit immediately if no new Unique ID exists -> ZERO LLM calls!
      if (newUids.length === 0) {
        return { scanned: 0, approved: 0 };
      }

      newUids.sort((a, b) => a - b);

      for (const uid of newUids) {
        // Track immediately so it is never analyzed twice
        uidTracker.add(uid);
        scanned++;
        this.status.totalEmailsScanned = uidTracker.size();

        // 3rd parameter options: { uid: true } is required!
        const message = await this.client.fetchOne(
          String(uid),
          { source: true, envelope: true, flags: true },
          { uid: true }
        );

        if (!message || typeof message !== 'object' || !message.source) {
          continue;
        }

        const parsed = await simpleParser(message.source);
        const subject = parsed.subject || '(No Subject)';
        const fromAddress = parsed.from?.value[0]?.address || TARGET_SENDER;
        const textBody = (parsed.text || parsed.html || '').trim();

        store.addAuditLog({
          source: 'IMAP_WORKER',
          status: 'INFO',
          from: fromAddress,
          subject,
          bodyPreview: textBody.slice(0, 150),
          message: `NEW EMAIL UNIQUE ID DETECTED (UID: ${uid}) from ${fromAddress}. Subject: "${subject}". Passing to AI agent for verification...`,
        });

        const result = await this.processEmailBody(textBody, subject, fromAddress, uid);

        if (result.approved) {
          approved++;
          this.status.totalApprovedTransfers++;
          try {
            await this.client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
          } catch (flagErr) {}
        }
      }
    } catch (err: any) {
      console.warn('[IMAP Scan Error]', err.message);
    } finally {
      if (lock) {
        try { lock.release(); } catch (e) {}
      }
      this.isScanning = false;
    }

    return { scanned, approved };
  }

  public async processEmailBody(
    body: string,
    subject: string = 'Payment Alert',
    fromAddress: string = TARGET_SENDER,
    uid?: number
  ): Promise<{ approved: boolean; amount?: number; orderId?: string; isTest?: boolean }> {
    const extraction = await analyzeEmailWithLLM(body, subject, fromAddress);

    if (extraction.toolCalled && extraction.isLegitimate && extraction.amount && extraction.amount > 0) {
      const matchResult = store.matchAndFulfillOrder(
        extraction.amount,
        extraction.isTest,
        extraction.senderName
      );

      if (matchResult.matched && matchResult.order) {
        return {
          approved: true,
          amount: extraction.amount,
          orderId: matchResult.order.id,
          isTest: extraction.isTest,
        };
      } else {
        store.addAuditLog({
          source: 'IMAP_WORKER',
          status: 'UNMATCHED',
          from: fromAddress,
          subject,
          extractedAmount: extraction.amount,
          extractedSender: extraction.senderName,
          isTest: extraction.isTest,
          message: `Legitimate alert for ₦${extraction.amount.toFixed(2)} (UID: ${uid || 'N/A'}) verified. Stored in active credit buffer awaiting customer checkout.`,
        });
        return { approved: false, amount: extraction.amount, isTest: extraction.isTest };
      }
    }
    return { approved: false };
  }
}

export const emailWorker = new EmailWorkerService();
```

---

### D. Store & Dynamic Slot Engine (`server/store.ts`)

```typescript
import crypto from 'crypto';
import { Order, ProductItem, BankConfig, AuditLogItem } from '../src/types/index.ts';

export const DEFAULT_BANK_CONFIG: BankConfig = {
  bankName: 'PalmPay',
  accountNumber: '8123456789',
  accountName: 'Takano Activation Pins Ltd',
  bankCode: '999991',
};

export const PRODUCTS: ProductItem[] = [
  { id: 'pin-1m', name: '1-Month Standard Activation PIN', category: 'Subscription', description: 'Instant license key for all standard streaming, VPN, and utility apps.', basePrice: 5000, validity: '30 Days' },
  { id: 'pin-3m', name: '3-Month Pro Activation PIN', category: 'Pro License', description: 'Quarterly pass with priority bandwidth and multi-device activation.', basePrice: 14000, validity: '90 Days' },
  { id: 'pin-1y', name: '1-Year Master Enterprise PIN', category: 'Enterprise', description: 'Annual unrestricted master key with guaranteed 365-day warranty.', basePrice: 50000, validity: '365 Days' },
  { id: 'pin-dev', name: 'Developer Sandbox PIN (Test)', category: 'Developer', description: 'Micro-tier activation token designed for rapid testing and integration.', basePrice: 200, validity: '7 Days' },
];

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function generateActivationPin(): string {
  const s1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const s2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const s3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TKNO-${s1}-${s2}-${s3}`;
}

class Store {
  private orders: Map<string, Order> = new Map();
  private auditLogs: AuditLogItem[] = [];
  private recentUnmatchedCredits: Map<number, { amount: number; isTest: boolean; senderName: string; timestamp: number }> = new Map();

  public getActivePendingOrders(): Order[] {
    const now = Date.now();
    const active: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.status === 'PENDING') {
        if (now > order.expiresAt) {
          order.status = 'EXPIRED';
        } else {
          active.push(order);
        }
      }
    }
    return active;
  }

  // 599-slot allocator (0.01 to 5.99)
  public allocateKoboSlot(baseAmount: number): number {
    const activePending = this.getActivePendingOrders().filter((o) => o.baseAmount === baseAmount);
    const lockedSlots = new Set<number>(activePending.map((o) => o.koboSlot));

    // Priority 1: Check if an unmatched credit alert was already received within 20 mins for this tier
    for (const [amount, credit] of this.recentUnmatchedCredits.entries()) {
      if (Date.now() - credit.timestamp < 20 * 60 * 1000) {
        const potentialSlot = round2(amount - baseAmount);
        if (potentialSlot >= 0.01 && potentialSlot <= 5.99 && !lockedSlots.has(potentialSlot)) {
          return potentialSlot;
        }
      }
    }

    // Priority 2: Pick from available slots
    const availableSlots: number[] = [];
    for (let i = 1; i <= 599; i++) {
      const slot = round2(i / 100);
      if (!lockedSlots.has(slot)) {
        availableSlots.push(slot);
      }
    }

    if (availableSlots.length === 0) {
      throw new Error('All 599 kobo allocation slots are currently in use. Please try again in a few minutes.');
    }

    const randomIndex = Math.floor(Math.random() * availableSlots.length);
    return availableSlots[randomIndex];
  }

  public createOrder(params: { productId: string; customerName: string; customerEmail: string; customBaseAmount?: number }): Order {
    let baseAmount = 5000;
    let productName = 'Activation PIN';
    const prod = PRODUCTS.find((p) => p.id === params.productId);
    if (prod) {
      baseAmount = prod.basePrice;
      productName = prod.name;
    } else if (params.customBaseAmount && params.customBaseAmount > 0) {
      baseAmount = round2(params.customBaseAmount);
      productName = `Custom PIN (${baseAmount} NGN)`;
    }

    const koboSlot = this.allocateKoboSlot(baseAmount);
    const exactPayableAmount = round2(baseAmount + koboSlot);
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;

    const order: Order = {
      id: 'ord_' + crypto.randomBytes(5).toString('hex'),
      productId: params.productId || 'custom',
      productName,
      baseAmount,
      koboSlot,
      exactPayableAmount,
      status: 'PENDING',
      customerName: params.customerName || 'Anonymous Customer',
      customerEmail: params.customerEmail || '',
      createdAt: now,
      expiresAt,
    };

    this.orders.set(order.id, order);

    // If an incoming credit alert was already received, match immediately!
    this.checkAndApplyBufferedCredit(order);

    return order;
  }

  public matchAndFulfillOrder(amount: number, isTest: boolean, senderName?: string): { matched: boolean; order?: Order; reason?: string } {
    const roundedAmount = round2(amount);
    const activePending = this.getActivePendingOrders();

    // 1. Look for active pending order matching exact payable amount
    let matchingOrder = activePending.find((o) => Math.abs(o.exactPayableAmount - roundedAmount) < 0.005);

    // 2. Check orders within 60m grace period
    if (!matchingOrder) {
      matchingOrder = Array.from(this.orders.values()).find(
        (o) => (o.status === 'PENDING' || o.status === 'EXPIRED') && Math.abs(o.exactPayableAmount - roundedAmount) < 0.005 && Date.now() - o.createdAt < 60 * 60 * 1000
      );
    }

    if (!matchingOrder) {
      this.recentUnmatchedCredits.set(roundedAmount, {
        amount: roundedAmount,
        isTest: Boolean(isTest),
        senderName: senderName || 'Verified Payer',
        timestamp: Date.now(),
      });
      return { matched: false, reason: `No pending active order found for ₦${roundedAmount.toFixed(2)}. Buffered into recent credits.` };
    }

    // Mark as PAID and generate activation PIN
    matchingOrder.status = 'PAID';
    matchingOrder.paidAt = Date.now();
    matchingOrder.activationPin = generateActivationPin();
    matchingOrder.isTest = Boolean(isTest);
    matchingOrder.senderName = senderName || 'Verified Payer';
    matchingOrder.matchLog = `Verified via automated alert extraction at ${new Date().toLocaleTimeString()}`;

    this.recentUnmatchedCredits.delete(roundedAmount);

    this.addAuditLog({
      source: 'WEBHOOK',
      status: 'SUCCESS',
      matchedOrderId: matchingOrder.id,
      activationPin: matchingOrder.activationPin,
      extractedAmount: roundedAmount,
      extractedSender: senderName,
      isTest: Boolean(isTest),
      message: `Order #${matchingOrder.id.slice(-6)} matched! Exact ₦${roundedAmount.toFixed(2)} received. Dispensed PIN: ${matchingOrder.activationPin}`,
    });

    return { matched: true, order: matchingOrder };
  }

  public checkAndApplyBufferedCredit(order: Order): boolean {
    const rounded = round2(order.exactPayableAmount);
    const buffered = this.recentUnmatchedCredits.get(rounded);
    if (buffered && Date.now() - buffered.timestamp < 20 * 60 * 1000) {
      order.status = 'PAID';
      order.paidAt = Date.now();
      order.activationPin = generateActivationPin();
      order.isTest = buffered.isTest;
      order.senderName = buffered.senderName;
      order.matchLog = `Instantly matched against buffered bank alert from ${new Date(buffered.timestamp).toLocaleTimeString()}`;
      this.recentUnmatchedCredits.delete(rounded);
      return true;
    }
    return false;
  }

  public getOrder(orderId: string): Order | undefined {
    const order = this.orders.get(orderId);
    if (order && order.status === 'PENDING' && Date.now() > order.expiresAt) {
      order.status = 'EXPIRED';
    }
    return order;
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public addAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'>) {
    const entry: AuditLogItem = {
      id: 'log_' + crypto.randomBytes(4).toString('hex'),
      timestamp: Date.now(),
      ...log,
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 150) this.auditLogs.pop();
  }

  public getAuditLogs(): AuditLogItem[] {
    return this.auditLogs;
  }
}

export const store = new Store();
```

---

### E. Express Server & Webhook API (`server.ts`)

```typescript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { store, DEFAULT_BANK_CONFIG, PRODUCTS } from './server/store.ts';
import { emailWorker } from './server/emailWorker.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json());

  // 1. Config
  app.get('/api/config', (req, res) => {
    res.json({
      bankConfig: DEFAULT_BANK_CONFIG,
      products: PRODUCTS,
      slotRange: { min: 0.01, max: 5.99, maxConcurrentCheckouts: 599, lockWindowMinutes: 15 },
    });
  });

  // 2. Create Order & Allocate Slot
  app.post('/api/orders/create', (req, res) => {
    try {
      const { productId, customerName, customerEmail, customBaseAmount } = req.body;
      const order = store.createOrder({ productId, customerName, customerEmail, customBaseAmount });
      res.status(201).json({ success: true, order, bankDetails: DEFAULT_BANK_CONFIG });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 3. 5-Second Status Polling
  app.get('/api/orders/status/:id', (req, res) => {
    const order = store.getOrder(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    res.json({
      success: true,
      order: {
        id: order.id,
        productId: order.productId,
        productName: order.productName,
        baseAmount: order.baseAmount,
        koboSlot: order.koboSlot,
        exactPayableAmount: order.exactPayableAmount,
        status: order.status,
        expiresAt: order.expiresAt,
        remainingSeconds: Math.max(0, Math.floor((order.expiresAt - Date.now()) / 1000)),
        paidAt: order.paidAt,
        activationPin: order.status === 'PAID' ? order.activationPin : undefined,
        isTest: order.isTest,
        senderName: order.senderName,
      },
    });
  });

  // 4. Webhook Trigger Endpoint
  app.post('/api/payments/verify-email', (req, res) => {
    const { amount, is_test, sender_name } = req.body;
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    const match = store.matchAndFulfillOrder(amount, Boolean(is_test), sender_name);
    res.json({ success: true, ...match });
  });

  // 5. Worker Status
  app.get('/api/worker/status', (req, res) => res.json(emailWorker.getStatus()));
  app.get('/api/orders', (req, res) => res.json(store.getAllOrders()));
  app.get('/api/logs', (req, res) => res.json(store.getAuditLogs()));

  // 6. Vite middleware for React frontend
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    emailWorker.start();
  });
}

createServer();
```

---

## 6. How to Deploy in a Fresh AI Studio Project

1. **Paste Dependencies**: Update `package.json` with `imapflow`, `mailparser`, `openai`, `tsx`, and `express`. Run `npm install`.
2. **Copy Server Files**:
   - `server/processedUids.ts`
   - `server/processed_uids.json` (initialize with `[]` or historical UIDs)
   - `server/store.ts`
   - `server/llmService.ts`
   - `server/emailWorker.ts`
   - `server.ts`
3. **Copy React Client**:
   - `src/components/CheckoutView.tsx` (highlights kobo decimals, 15m timer, copy buttons, 5s polling)
   - `src/components/PinSuccessCard.tsx` (monospaced PIN box, test badge)
   - `src/components/OrdersTable.tsx`
   - `src/components/SlotVisualizer.tsx`
   - `src/components/AgentLogsView.tsx`
   - `src/App.tsx`
4. **Configure Dev Command**:
   In `package.json`, set `"dev": "tsx server.ts"`.
5. **Run the Server**:
   Start the dev server. The IMAP worker will connect to Gmail, index existing email UIDs, and begin silent 5-second polling for new Unique IDs.
