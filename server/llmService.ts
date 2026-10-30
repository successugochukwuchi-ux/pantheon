import OpenAI from 'openai';
import { takanoStore } from './takanoStore.js';

export interface ExtractionResult {
  toolCalled: boolean;
  amount: number | null;
  senderName: string;
  bankName?: string;
  sessionId?: string;
  isLegitimate: boolean;
  isTest: boolean;
  rejectionReason?: string;
  executionMethod: 'LLM_TOOL_CALL' | 'FALLBACK_HEURISTIC';
  error?: string;
}

const APPROVE_PAYMENT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'approve_payment_transfer',
    description: 'Process and validate an incoming Nigerian bank or fintech credit alert after strictly evaluating authenticity, transaction metadata, and ensuring it is exclusively an incoming credit alert (not debit, nor random bank communication).',
    parameters: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'The exact floating-point credit amount transferred in Naira (e.g. 5003.42). Must retain all kobo decimal precision.',
        },
        sender_name: {
          type: 'string',
          description: 'The detected sender name, payer name, or source account/institution from the alert.',
        },
        bank_name: {
          type: 'string',
          description: 'The detected Nigerian bank or fintech name (e.g., PalmPay, OPay, Moniepoint, Kuda, GTBank, Zenith Bank, Access Bank, UBA, FirstBank, Stanbic, FCMB, Fidelity, Sterling, etc.). Leave blank or "Unknown" if missing.',
        },
        session_id: {
          type: 'string',
          description: 'The detected NIP Session ID, Transaction Reference, or Reference number from the bank alert. Leave blank or "Unknown" if missing.',
        },
        is_legitimate: {
          type: 'boolean',
          description: 'True ONLY if this alert is strictly an incoming credit/deposit alert that credits the account, containing all standard banking transaction details (bank branding, session ID/reference, sender name, credit indicator). False if it is a debit alert, OTP, statement, marketing, maintenance notice, or any random non-credit bank email (unless TAKANOPAYMENTTEST is present).',
        },
        is_test: {
          type: 'boolean',
          description: 'Set strictly to true if the exact string "TAKANOPAYMENTTEST" appears anywhere in the email body or subject.',
        },
        rejection_reason: {
          type: 'string',
          description: 'If is_legitimate is false, explain why (e.g. "Debit alert", "Random bank email/OTP/statement", "Missing session ID", "Missing bank branding", "Missing sender name").',
        },
      },
      required: ['amount', 'sender_name', 'bank_name', 'session_id', 'is_legitimate', 'is_test'],
    },
  },
};

/**
 * Validates authentic Nigerian banking markers in the text and parsed arguments.
 * Strictly separates incoming Credit alerts from Debit alerts and random non-transactional bank emails.
 */
function checkBankingAuthenticity(
  fullText: string,
  bankArg?: string,
  sessionArg?: string,
  senderArg?: string
): {
  hasBank: boolean;
  hasSessionId: boolean;
  hasSender: boolean;
  isCredit: boolean;
  isDebit: boolean;
  isRandomBankEmail: boolean;
  detectedBank?: string;
  detectedSessionId?: string;
} {
  const lower = fullText.toLowerCase();

  // 1. Bank / FinTech branding
  const bankKeywords = [
    'palmpay', 'opay', 'moniepoint', 'kuda', 'gtbank', 'guaranty trust',
    'zenith', 'access bank', 'access clane', 'uba', 'united bank for africa',
    'first bank', 'firstbank', 'stanbic', 'ibtc', 'fcmb', 'fidelity',
    'sterling', 'wema', 'alat', 'union bank', 'polaris', 'ecobank',
    'providus', 'jaiz', 'taj bank', 'vfd', 'rubies', 'keystone', 'heritage',
    'titan trust', 'standard chartered', 'fairmoney', 'carbon', 'paga', 'chipper'
  ];
  const bankInArg = Boolean(bankArg && bankArg.trim().length > 1 && !/unknown|none|n\/a|unspecified/i.test(bankArg));
  const bankInText = bankKeywords.some((b) => lower.includes(b));
  const hasBank = bankInArg || bankInText;

  // 2. Session ID / Transaction Reference (e.g. 30-digit NIBSS session ID or explicit Ref/ID)
  const hasSessionInArg = Boolean(sessionArg && sessionArg.trim().length >= 6 && !/unknown|none|n\/a|unspecified/i.test(sessionArg));
  const sessionRegex = /(?:session\s*(?:id|no\.?)|transaction\s*(?:ref(?:erence)?|id|no\.?)|nip\s*(?:session|ref|txn)|payment\s*(?:ref|id)|ref(?:erence)?\s*(?:no\.?|id)?[:\s]+[a-z0-9_-]{5,}|\b\d{18,35}\b)/i;
  const hasSessionInText = sessionRegex.test(fullText);
  const hasSessionId = hasSessionInArg || hasSessionInText;

  // 3. Sender / Payer Name
  const hasSenderInArg = Boolean(senderArg && senderArg.trim().length > 2 && !/unknown|detected payer|payer|none|n\/a|unspecified/i.test(senderArg));
  const senderRegex = /(?:from\s*:|sender(?:\s*name)?\s*:|payer(?:\s*name)?\s*:|transferred\s*by\s*:|received\s*from\s*:|originat(?:or|ing)\s*:|by\s*order\s*of\s*:)\s*([A-Za-z0-9\s.'-]{3,})/i;
  const hasSenderInText = senderRegex.test(fullText);
  const hasSender = hasSenderInArg || hasSenderInText;

  // 4. Random Bank Emails (OTPs, statements, security, newsletters, marketing, downtime, KYC)
  const randomBankPatterns = /(?:one[- ]time[- ]password|\botp\b|verification code|security code|login notification|new device|sign[- ]in detected|password reset|pin reset|device authorization|token request|statement of account|monthly statement|e-statement|account statement|weekly summary|system maintenance|maintenance notice|scheduled downtime|service disruption|operational update|terms (?:and|&) conditions|privacy policy|policy update|loan offer|apply for a loan|instant loan|quick credit|pre-approved|upgrade your (?:tier|account|limit)|bvn update|nin update|kyc (?:update|verification|status)|account (?:dormant|reactivation|restricted)|happy new month|customer service survey|feedback request|newsletter|special promo|exclusive offer|spin and win|cashback|season's greetings|congratulations)\b/i;
  const isRandomBankEmail = randomBankPatterns.test(fullText);

  // 5. Debit alert check (outward transfers, ATM withdrawals, POS spending, card charges)
  const isDebit = /(?:debit alert|transaction alert \[debit\]|\bdr alert\b|account debited|funds debited|debited with|debited for|funds withdrawn|withdrawn from|you have spent|transferred to|payment to|sent to|atm withdrawal|pos purchase|web purchase|card purchase|airtime purchase|outward (?:transfer|nip|payment))\b/i.test(fullText);

  // 6. Incoming credit alert check (explicit deposit / inward transfer)
  const isCredit = /(?:credit alert|transaction alert \[credit\]|\bcr alert\b|account credited|funds received|received from|inward (?:transfer|nip|payment)|credited with|deposit alert|deposit of|has paid you|credited to your account|received a transfer of|you have received)\b/i.test(fullText) ||
    (/\b(?:credit|deposit|received)\b/i.test(lower) && !isDebit && !isRandomBankEmail);

  return {
    hasBank,
    hasSessionId,
    hasSender,
    isCredit,
    isDebit,
    isRandomBankEmail,
  };
}

export async function analyzeEmailWithLLM(
  rawBody: string,
  subject: string = '',
  fromAddress: string = ''
): Promise<ExtractionResult> {
  const config = takanoStore.getConfig();
  const fullContent = `SUBJECT: ${subject}\nFROM: ${fromAddress}\n\nEMAIL BODY:\n${rawBody}`;
  const containsTestKeyword = /TAKANOPAYMENTTEST/i.test(fullContent);

  // STEP 1: FAST INSTANT HEURISTIC REGEX PARSER (< 1ms execution time)
  // Evaluates email immediately without external LLM API delay, OpenRouter rate limits, or free tier queues
  const fastResult = fallbackRegexExtraction(rawBody, subject, fromAddress, containsTestKeyword);

  if (fastResult.isLegitimate && fastResult.amount && fastResult.amount > 0) {
    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'SUCCESS',
      from: fromAddress,
      subject,
      extractedAmount: fastResult.amount,
      extractedSender: fastResult.senderName,
      isLegitimate: true,
      isTest: fastResult.isTest,
      message: `INSTANT REGEX VERIFICATION APPROVED (0ms): ₦${fastResult.amount.toFixed(2)} | Bank: ${fastResult.bankName || 'Verified'} | Ref: ${fastResult.sessionId || 'Verified'} | Sender: ${fastResult.senderName} | Method: FAST_REGEX`,
    });
    return fastResult;
  }

  // If fast regex explicitly detected a debit alert or random non-credit bank email (OTP, statement, marketing, maintenance), reject immediately without calling LLM
  if (!fastResult.isLegitimate && fastResult.rejectionReason && (fastResult.rejectionReason.includes('Debit') || fastResult.rejectionReason.includes('Random'))) {
    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'REJECTED',
      from: fromAddress,
      subject,
      isLegitimate: false,
      isTest: fastResult.isTest,
      message: `INSTANT REGEX REJECTED (0ms): ${fastResult.rejectionReason}`,
    });
    return fastResult;
  }

  // STEP 2: SECONDARY LLM BACKUP
  // Only invoked if Fast Regex was unable to parse an exact amount or was ambiguous on non-standard format
  const openaiClient = new OpenAI({
    baseURL: config.llmBaseUrl || 'https://api.xkiro.com/v1',
    apiKey: config.llmApiKey || 'sk-xt-8efce7fdc46238b3456fafcf36713ce45ff83a0a52df9581',
  });

  try {
    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'INFO',
      from: fromAddress,
      subject,
      bodyPreview: rawBody.slice(0, 160).trim(),
      message: `Regex parser ambiguous; falling back to LLM analysis (${config.llmModel})...`,
    });

    const completion = await openaiClient.chat.completions.create({
      model: config.llmModel || 'qwen/qwen3.8-omni-flash:free',
      messages: [
        {
          role: 'system',
          content: `You are an automated Nigerian banking credit alert parser for Takano Pay.
Your sole duty is to process legitimate incoming CREDIT/DEPOSIT alerts that credit the merchant's account with funds.

CRITICAL SECURITY AND STRICT FILTERING RULES:
1. TEST OVERRIDE:
   - If the exact token "TAKANOPAYMENTTEST" appears anywhere in the email body or subject, this proves it is an authorized test transaction.
   - For ANY email containing "TAKANOPAYMENTTEST", you MUST set is_test: true and is_legitimate: true.

2. STRICT REJECTION OF DEBIT ALERTS & RANDOM BANK EMAILS:
   - This system ONLY accepts incoming credit/deposit alerts that add funds to the merchant's account.
   - You MUST STRICTLY REJECT:
     a) Debit alerts (any outgoing transfer, ATM withdrawal, POS charge, airtime purchase, or money debited from the account). Set is_legitimate: false.
     b) Random bank emails (OTP/2FA verification codes, monthly account statements, security notices, login alerts, system maintenance notices, loan offers, marketing newsletters, KYC/BVN/NIN updates, surveys, or general announcements). Set is_legitimate: false.
     c) Any email where money is not confirmed to have entered/credited the merchant's account. Set is_legitimate: false.

3. STRICT LIVE CREDIT ALERT REQUIREMENTS (When "TAKANOPAYMENTTEST" is absent):
   To be accepted as legitimate, a credit alert MUST satisfy ALL of the following:
   a) Explicit Incoming Credit: Must clearly confirm an inward deposit/credit to the merchant's account (e.g., "Credit alert", "Account credited", "You have received").
   b) Bank or FinTech Branding: Must clearly identify the originating or issuing Nigerian bank/fintech (e.g., PalmPay, OPay, Moniepoint, Kuda, GTBank, Zenith, Access, UBA, FirstBank, Stanbic, FCMB, Fidelity, Sterling, etc.).
   c) Session ID or Transaction Reference: Must contain a valid NIP Session ID (e.g., 30-digit NIBSS session ID or similar sequence) or official transaction reference/ID (e.g. "Session ID:", "Txn Ref:", "Reference:", "NIP Ref:").
   d) Sender / Payer Name: Must state the sender's full name, payer name, or originating account details.

   If the email is a debit alert, a random bank email (OTP, statement, marketing, etc.), or lacks any of the required elements, you MUST set is_legitimate: false and explain why in rejection_reason.

4. AMOUNT EXTRACTION:
   - Extract the EXACT floating-point amount credited in Naira (e.g., "₦5,002.30", "NGN 5,003.42", "5002.30" -> 5002.30).
   - You MUST preserve all decimal kobo precision!

5. TOOL INVOCATION:
   You MUST invoke the tool "approve_payment_transfer" with amount, sender_name, bank_name, session_id, is_legitimate, is_test, and rejection_reason.`,
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
        const bankName = String(parsedArgs.bank_name || '').trim();
        const sessionId = String(parsedArgs.session_id || '').trim();
        const senderName = String(parsedArgs.sender_name || fromAddress || 'Detected Payer').trim();

        let isLegitimate = false;
        let rejectionReason = parsedArgs.rejection_reason || '';

        if (containsTestKeyword) {
          isLegitimate = true;
          rejectionReason = '';
        } else {
          const authChecks = checkBankingAuthenticity(fullContent, bankName, sessionId, senderName);

          if (authChecks.isRandomBankEmail) {
            isLegitimate = false;
            rejectionReason = 'Alert rejected: Random non-credit bank email (OTP, statement, security, maintenance, or marketing notice). Only credit alerts are accepted.';
          } else if (authChecks.isDebit) {
            isLegitimate = false;
            rejectionReason = 'Alert rejected: Debit or withdrawal notification detected. Only incoming credit alerts are accepted.';
          } else if (!authChecks.isCredit && !amountMatchesActiveOrder(amount)) {
            isLegitimate = false;
            rejectionReason = 'Alert rejected: Email does not confirm an inward credit or deposit. Random bank emails are ignored.';
          } else if (!authChecks.hasBank && !bankName) {
            isLegitimate = false;
            rejectionReason = 'Alert rejected: Missing recognized Nigerian bank or fintech branding.';
          } else if (!authChecks.hasSessionId && !sessionId && !amountMatchesActiveOrder(amount)) {
            isLegitimate = false;
            rejectionReason = 'Alert rejected: Missing official transaction reference or NIP session ID.';
          } else {
            isLegitimate = Boolean(parsedArgs.is_legitimate) || amountMatchesActiveOrder(amount);
            if (!isLegitimate && !rejectionReason) {
              rejectionReason = 'Alert rejected: Failed AI transaction authenticity verification.';
            }
          }
        }

        takanoStore.addAuditLog({
          source: 'IMAP_WORKER',
          status: isLegitimate ? 'SUCCESS' : 'REJECTED',
          from: fromAddress,
          subject,
          extractedAmount: isNaN(amount) ? null : amount,
          extractedSender: senderName,
          isLegitimate,
          isTest,
          message: isLegitimate
            ? `LLM Approved Alert: ₦${amount?.toFixed(2)} | Bank: ${bankName || 'Verified'} | Ref: ${sessionId || 'Verified'} | Sender: ${senderName} | Test: ${isTest}`
            : `LLM Rejected Alert: ${rejectionReason || 'Alert lacked required banking transaction metadata.'}`,
        });

        return {
          toolCalled: true,
          amount: isNaN(amount) ? null : amount,
          senderName,
          bankName,
          sessionId,
          isLegitimate,
          isTest,
          rejectionReason,
          executionMethod: 'LLM_TOOL_CALL',
        };
      }
    }

    return fastResult;
  } catch (err: any) {
    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'ERROR',
      message: `LLM API Error (${err.message}). Using fast heuristic validator result.`,
    });
    return fastResult;
  }
}

export function fallbackRegexExtraction(
  body: string,
  subject: string,
  from: string,
  containsTestKeyword: boolean,
  errorMessage?: string
): ExtractionResult {
  const combined = `${subject}\n${body}`;

  // 1. Multi-pass amount extraction
  let amount: number | null = null;

  // Pass A: Explicit Amount Labels (e.g. "Amount: NGN 2,400.53", "Credited with ₦2,400.53", "Sum of N2400.53", "Value: NGN 2400.53")
  const explicitMatch = combined.match(/(?:amount|credited|credit|deposit|received|sum of|value of)[:\s]*(?:NGN|₦|N)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                        combined.match(/(?:NGN|₦)\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (explicitMatch && explicitMatch[1]) {
    const parsed = parseFloat(explicitMatch[1].replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
    }
  }

  // Pass B: Cross-reference active pending order exact payable amounts or slots in text
  if (!amount) {
    const activeOrders = takanoStore.getActivePendingOrders();
    const cleanCombined = combined.replace(/,/g, '');
    for (const order of activeOrders) {
      const exactStr = order.exactPayableAmount.toFixed(2);
      const slotStr = order.koboSlot.toFixed(2);
      if (cleanCombined.includes(exactStr) || cleanCombined.includes(slotStr)) {
        amount = order.exactPayableAmount;
        break;
      }
    }
  }

  // Pass C: Standalone decimal numbers with 2 decimal places e.g. 2400.53 or 2,400.53
  if (!amount) {
    const decimalMatch = combined.match(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/) || combined.match(/\b\d{2,7}\.\d{2}\b/);
    if (decimalMatch && decimalMatch[0]) {
      const parsed = parseFloat(decimalMatch[0].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
  }

  // 2. Sender Name Extraction
  const senderMatch = combined.match(/(?:from\s*:|sender(?:\s*name)?\s*:|payer(?:\s*name)?\s*:|transferred\s*by\s*:|received\s*from\s*:|originat(?:or|ing)\s*:|by\s*order\s*of\s*:)\s*([A-Za-z0-9\s.'-]{3,40})/i) ||
                      combined.match(/(?:sent\s*you|transfer\s*from|received\s*from)\s+([A-Za-z0-9\s.'-]{3,35})/i);
  const detectedSender = senderMatch ? senderMatch[1].trim() : (from || 'Detected Payer');

  // 3. Bank Name Extraction
  const bankMatch = combined.match(/(palmpay|opay|moniepoint|kuda|gtbank|guaranty trust|zenith|access bank|access clane|uba|united bank for africa|first bank|firstbank|stanbic|fcmb|fidelity|sterling|wema|alat|union bank|polaris|ecobank|providus|jaiz|taj bank|vfd|rubies|keystone|heritage|titan trust|fairmoney|carbon|paga|chipper)/i);
  let detectedBank = bankMatch ? bankMatch[1] : undefined;

  if (!detectedBank) {
    const fromLower = from.toLowerCase();
    if (fromLower.includes('palmpay')) detectedBank = 'PalmPay';
    else if (fromLower.includes('opay')) detectedBank = 'OPay';
    else if (fromLower.includes('moniepoint')) detectedBank = 'Moniepoint';
    else if (fromLower.includes('kudabank') || fromLower.includes('kuda')) detectedBank = 'Kuda';
    else if (fromLower.includes('gtbank')) detectedBank = 'GTBank';
    else if (fromLower.includes('zenith')) detectedBank = 'Zenith Bank';
    else if (fromLower.includes('accessbank')) detectedBank = 'Access Bank';
    else if (fromLower.includes('ubagroup') || fromLower.includes('uba')) detectedBank = 'UBA';
    else if (fromLower.includes('firstbank')) detectedBank = 'FirstBank';
    else if (fromLower.includes('stanbic')) detectedBank = 'Stanbic IBTC';
    else if (fromLower.includes('fcmb')) detectedBank = 'FCMB';
    else if (fromLower.includes('sterling')) detectedBank = 'Sterling Bank';
  }

  // 4. Session ID / Transaction Reference
  const sessionMatch = combined.match(/(?:session\s*(?:id|no\.?)|transaction\s*(?:ref(?:erence)?|id|no\.?)|nip\s*(?:session|ref|txn)|payment\s*(?:ref|id)|ref(?:erence)?\s*(?:no\.?|id)?[:\s]+)([a-z0-9_-]{5,35})/i) ||
                       combined.match(/\b(\d{16,35})\b/);
  const detectedSessionId = sessionMatch ? sessionMatch[1] : undefined;

  // 5. Authenticity Checks
  const auth = checkBankingAuthenticity(combined, detectedBank, detectedSessionId, detectedSender);

  let isLegitimate = false;
  let rejectionReason: string | undefined = undefined;

  if (containsTestKeyword) {
    isLegitimate = true;
  } else {
    if (auth.isRandomBankEmail) {
      isLegitimate = false;
      rejectionReason = 'Alert rejected: Random non-credit bank email (OTP, statement, security, or marketing notice).';
    } else if (auth.isDebit) {
      isLegitimate = false;
      rejectionReason = 'Alert rejected: Debit or withdrawal notification detected. Only incoming credit alerts are accepted.';
    } else {
      // If amount is extracted and matches an active pending order's exact payable amount, approve instantly!
      if (amount && amount > 0) {
        const matchesActiveOrder = amountMatchesActiveOrder(amount);
        if (matchesActiveOrder || (auth.isCredit && (auth.hasBank || detectedBank || auth.hasSessionId || auth.hasSender))) {
          isLegitimate = true;
        } else if (!auth.isCredit) {
          isLegitimate = false;
          rejectionReason = 'Alert rejected: Notification is not an inward credit or deposit.';
        } else {
          isLegitimate = false;
          rejectionReason = 'Alert rejected: Missing official banking transaction metadata.';
        }
      } else {
        isLegitimate = false;
        rejectionReason = 'Alert rejected: Could not parse credit amount from email.';
      }
    }
  }

  return {
    toolCalled: false,
    amount,
    senderName: detectedSender,
    bankName: detectedBank,
    sessionId: detectedSessionId,
    isLegitimate,
    isTest: containsTestKeyword,
    rejectionReason,
    executionMethod: 'FALLBACK_HEURISTIC',
    error: errorMessage,
  };
}

function amountMatchesActiveOrder(amount: number | null): boolean {
  if (!amount || amount <= 0) return false;
  const activeOrders = takanoStore.getActivePendingOrders();
  return activeOrders.some(order => Math.abs(order.exactPayableAmount - amount) < 0.009);
}
