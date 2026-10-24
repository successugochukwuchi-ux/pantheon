import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { serverDb } from './firebaseServer.js';

export interface TakanoConfig {
  bankName: string;
  accountNumber: string;
  accountName: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  targetSender: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  renderBackendUrl: string;
  scannerEnabled: boolean;
}

export interface PaymentOrder {
  id: string;
  vendorId: string;
  vendorStudentId: string;
  vendorName?: string;
  numStandard: number;
  numPlus: number;
  totalPins: number;
  ratePercentage: 50 | 60;
  baseAmount: number;
  koboSlot: number;
  exactPayableAmount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  payerName?: string;
  university: string;
  pins: { code: string; type: 'standard' | 'plus' }[];
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  source: string;
  status: 'INFO' | 'SUCCESS' | 'REJECTED' | 'ERROR';
  from?: string;
  subject?: string;
  bodyPreview?: string;
  extractedAmount?: number | null;
  extractedSender?: string;
  isLegitimate?: boolean;
  isTest?: boolean;
  matchedOrderId?: string;
  message: string;
}

export interface UnmatchedCredit {
  amount: number;
  sender: string;
  timestamp: number;
}

const DEFAULT_CONFIG: TakanoConfig = {
  bankName: process.env.DEFAULT_BANK_NAME || 'PalmPay',
  accountNumber: process.env.DEFAULT_ACCOUNT_NUMBER || '8123456789',
  accountName: process.env.DEFAULT_ACCOUNT_NAME || 'Takano Activation Pins Ltd',
  imapHost: process.env.IMAP_HOST || 'imap.gmail.com',
  imapPort: Number(process.env.IMAP_PORT) || 993,
  imapUser: process.env.IMAP_USER || 'successugochukwuchi@gmail.com',
  imapPassword: (process.env.IMAP_PASSWORD || 'vgvvugojqnqpcfme').replace(/\s+/g, ''),
  targetSender: process.env.TARGET_SENDER || 'successcugo@gmail.com',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.xkiro.com/v1',
  llmApiKey: process.env.LLM_API_KEY || 'sk-xt-8efce7fdc46238b3456fafcf36713ce45ff83a0a52df9581',
  llmModel: process.env.LLM_MODEL || 'qwen/qwen3.8-omni-flash:free',
  renderBackendUrl: 'https://colearn-backend-tzo9.onrender.com',
  scannerEnabled: true,
};

class TakanoStore {
  private config: TakanoConfig = { ...DEFAULT_CONFIG };
  private orders: Map<string, PaymentOrder> = new Map();
  private auditLogs: AuditLogItem[] = [];
  private recentUnmatchedCredits: UnmatchedCredit[] = [];
  private isConfigLoaded = false;

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadConfig();
    await this.loadActiveOrdersFromFirestore();
  }

  public async loadConfig(): Promise<TakanoConfig> {
    try {
      const snap = await getDoc(doc(serverDb, 'system', 'takano_pay'));
      if (snap.exists()) {
        const data = snap.data();
        this.config = {
          ...DEFAULT_CONFIG,
          ...data,
          imapPassword: (data.imapPassword || DEFAULT_CONFIG.imapPassword).replace(/\s+/g, ''),
        };
      } else {
        // Save initial default configuration to Firestore
        await setDoc(doc(serverDb, 'system', 'takano_pay'), DEFAULT_CONFIG, { merge: true });
      }
      this.isConfigLoaded = true;
    } catch (e) {
      console.warn('[TakanoStore] Using default config (could not read system/takano_pay):', e);
    }
    return this.config;
  }

  public async saveConfig(newConfig: Partial<TakanoConfig>): Promise<TakanoConfig> {
    this.config = {
      ...this.config,
      ...newConfig,
      imapPassword: (newConfig.imapPassword || this.config.imapPassword).replace(/\s+/g, ''),
    };
    try {
      await setDoc(doc(serverDb, 'system', 'takano_pay'), this.config, { merge: true });
      this.addAuditLog({
        source: 'OVERSEER_CONFIG',
        status: 'SUCCESS',
        message: 'Updated Takano Pay and Bank credentials in Firestore.',
      });
    } catch (e) {
      console.error('[TakanoStore] Error saving system/takano_pay:', e);
    }
    return this.config;
  }

  public getConfig(): TakanoConfig {
    return this.config;
  }

  private async loadActiveOrdersFromFirestore() {
    try {
      const now = Date.now();
      const q = query(collection(serverDb, 'payment_orders'), where('status', '==', 'PENDING'));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const order = d.data() as PaymentOrder;
        if (new Date(order.expiresAt).getTime() > now) {
          this.orders.set(order.id, order);
        } else {
          // Expired
          updateDoc(doc(serverDb, 'payment_orders', order.id), { status: 'EXPIRED' }).catch(() => {});
        }
      });
    } catch (e) {
      console.warn('[TakanoStore] Could not load pending orders from Firestore:', e);
    }
  }

  public purgeExpiredSlots() {
    const now = Date.now();
    for (const [id, order] of this.orders.entries()) {
      if (order.status === 'PENDING' && new Date(order.expiresAt).getTime() <= now) {
        order.status = 'EXPIRED';
        this.orders.delete(id);
        updateDoc(doc(serverDb, 'payment_orders', id), { status: 'EXPIRED' }).catch(() => {});
      }
    }
    // Clean unmatched credits older than 20 minutes
    const twentyMinsAgo = now - 20 * 60 * 1000;
    this.recentUnmatchedCredits = this.recentUnmatchedCredits.filter(c => c.timestamp > twentyMinsAgo);
  }

  private getActiveSlots(): Set<number> {
    this.purgeExpiredSlots();
    const active = new Set<number>();
    for (const order of this.orders.values()) {
      if (order.status === 'PENDING') {
        const slotCents = Math.round(order.koboSlot * 100);
        active.add(slotCents);
      }
    }
    return active;
  }

  private allocateSlot(): number {
    const activeSlots = this.getActiveSlots();
    // 599 possible slots: 1 to 599 (₦0.01 to ₦5.99)
    const available: number[] = [];
    for (let i = 1; i <= 599; i++) {
      if (!activeSlots.has(i)) {
        available.push(i);
      }
    }

    if (available.length === 0) {
      // Force recycle the oldest slot
      return Math.floor(Math.random() * 599) + 1;
    }

    // Pick a random available slot to prevent predictable increments
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  }

  public async getRetailPrices(): Promise<{ standard: number; plus: number }> {
    try {
      const snap = await getDoc(doc(serverDb, 'system', 'config'));
      if (snap.exists()) {
        const data = snap.data();
        return {
          standard: Number(data.standardPrice) || 1000,
          plus: Number(data.plusPrice) || 2000,
        };
      }
    } catch (e) {
      console.warn('[TakanoStore] Error reading retail prices:', e);
    }
    return { standard: 1000, plus: 2000 };
  }

  public async createRestockOrder(params: {
    vendorId: string;
    vendorStudentId: string;
    vendorName?: string;
    numStandard: number;
    numPlus: number;
    university?: string;
  }): Promise<PaymentOrder> {
    const { vendorId, vendorStudentId, vendorName, numStandard, numPlus, university = 'futo' } = params;
    const totalPins = numStandard + numPlus;

    if (totalPins < 1) {
      throw new Error('Must specify at least 1 PIN to restock.');
    }

    const { standard: stdRetail, plus: plusRetail } = await this.getRetailPrices();

    // RESTOCK PRICING RULES:
    // 1 to 4 pins: sold at 60% of retail price
    // 5 or more pins: sold at 50% of retail price (wholesale rate)
    const ratePercentage: 50 | 60 = totalPins >= 5 ? 50 : 60;
    const stdRate = stdRetail * (ratePercentage / 100);
    const plusRate = plusRetail * (ratePercentage / 100);

    const baseAmount = Math.round(numStandard * stdRate + numPlus * plusRate);
    const slotInteger = this.allocateSlot();
    const koboSlot = Number((slotInteger / 100).toFixed(2));
    const exactPayableAmount = Number((baseAmount + koboSlot).toFixed(2));

    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString(); // 15 minutes lock
    const orderId = `TKNO_${now}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const order: PaymentOrder = {
      id: orderId,
      vendorId,
      vendorStudentId,
      vendorName: vendorName || 'Vendor',
      numStandard,
      numPlus,
      totalPins,
      ratePercentage,
      baseAmount,
      koboSlot,
      exactPayableAmount,
      status: 'PENDING',
      createdAt,
      expiresAt,
      university,
      pins: [],
    };

    // Save to Firestore & memory
    this.orders.set(orderId, order);
    await setDoc(doc(serverDb, 'payment_orders', orderId), order);

    this.addAuditLog({
      source: 'ORDER_ENGINE',
      status: 'INFO',
      matchedOrderId: orderId,
      extractedAmount: exactPayableAmount,
      message: `Created Restock Order ${orderId}: ${numStandard} Std + ${numPlus} PLUS (${ratePercentage}% tier). Payable: ₦${exactPayableAmount.toFixed(2)} (Slot ₦${koboSlot}). Expires in 15m.`,
    });

    // Check race condition buffer: was a matching credit already received in the last 20 minutes?
    const matchIndex = this.recentUnmatchedCredits.findIndex(
      (c) => Math.abs(c.amount - exactPayableAmount) < 0.009
    );

    if (matchIndex !== -1) {
      const match = this.recentUnmatchedCredits.splice(matchIndex, 1)[0];
      await this.fulfillOrder(order, match.sender, 'PRE_RECEIVED_BUFFER');
    }

    return order;
  }

  public async getOrder(orderId: string): Promise<PaymentOrder | null> {
    let order = this.orders.get(orderId);
    if (!order) {
      try {
        const snap = await getDoc(doc(serverDb, 'payment_orders', orderId));
        if (snap.exists()) {
          order = snap.data() as PaymentOrder;
          this.orders.set(orderId, order);
        }
      } catch (e) {
        console.warn(`[TakanoStore] Error fetching order ${orderId}:`, e);
      }
    }
    return order || null;
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    const order = await this.getOrder(orderId);
    if (order && order.status === 'PENDING') {
      order.status = 'CANCELLED';
      this.orders.delete(orderId);
      await updateDoc(doc(serverDb, 'payment_orders', orderId), { status: 'CANCELLED' });
      return true;
    }
    return false;
  }

  /**
   * Called by the email scanner or test simulator when a credit alert is verified.
   */
  public async handleIncomingCredit(
    amount: number,
    senderName: string,
    isTest: boolean = false
  ): Promise<{ matched: boolean; orderId?: string; pinsCount?: number }> {
    this.purgeExpiredSlots();

    // Look for a pending order matching exactPayableAmount within floating point tolerance
    let matchedOrder: PaymentOrder | null = null;
    for (const order of this.orders.values()) {
      if (order.status === 'PENDING' && Math.abs(order.exactPayableAmount - amount) < 0.009) {
        matchedOrder = order;
        break;
      }
    }

    if (!matchedOrder) {
      // Buffer in unmatched credits for 20 mins
      this.recentUnmatchedCredits.push({
        amount,
        sender: senderName,
        timestamp: Date.now(),
      });
      this.addAuditLog({
        source: 'PAYMENT_ENGINE',
        status: 'INFO',
        extractedAmount: amount,
        extractedSender: senderName,
        isTest,
        message: `Credit of ₦${amount.toFixed(2)} received from "${senderName}", but no active pending order matched. Buffered in race-condition pool for 20 minutes.`,
      });
      return { matched: false };
    }

    // Fulfill the order!
    const fulfilled = await this.fulfillOrder(matchedOrder, senderName, isTest ? 'TEST_SIMULATION' : 'IMAP_EMAIL_ALERT');
    return {
      matched: true,
      orderId: fulfilled.id,
      pinsCount: fulfilled.pins.length,
    };
  }

  private async fulfillOrder(
    order: PaymentOrder,
    senderName: string,
    verificationMethod: string
  ): Promise<PaymentOrder> {
    const nowStr = new Date().toISOString();
    const batch = writeBatch(serverDb);
    const generatedPins: { code: string; type: 'standard' | 'plus' }[] = [];

    // 1. Generate Standard PINs (12-digit format)
    for (let i = 0; i < order.numStandard; i++) {
      const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      generatedPins.push({ code, type: 'standard' });
      batch.set(doc(serverDb, 'activationCodes', code), {
        code,
        type: 'standard',
        isUsed: false,
        assignedTo: order.vendorId,
        assignedToStudentId: order.vendorStudentId || '',
        assignedToName: order.vendorName || 'Vendor',
        createdBy: order.vendorId,
        createdAt: nowStr,
        owner: order.vendorStudentId || order.vendorId,
        At: order.university || 'futo',
        isBulkRestocked: true,
        price: order.baseAmount / (order.totalPins || 1),
        paymentReference: order.id,
        paymentProvider: 'takano_pay',
        orderId: order.id,
        verificationMethod,
      });
    }

    // 2. Generate PLUS PINs
    for (let i = 0; i < order.numPlus; i++) {
      const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      generatedPins.push({ code, type: 'plus' });
      batch.set(doc(serverDb, 'activationCodes', code), {
        code,
        type: 'plus',
        isUsed: false,
        assignedTo: order.vendorId,
        assignedToStudentId: order.vendorStudentId || '',
        assignedToName: order.vendorName || 'Vendor',
        createdBy: order.vendorId,
        createdAt: nowStr,
        owner: order.vendorStudentId || order.vendorId,
        At: order.university || 'futo',
        isBulkRestocked: true,
        price: order.baseAmount / (order.totalPins || 1),
        paymentReference: order.id,
        paymentProvider: 'takano_pay',
        orderId: order.id,
        verificationMethod,
      });
    }

    // Commit generated PINs to Firestore
    await batch.commit();

    // 3. Mark Order as PAID & attach PINs
    order.status = 'PAID';
    order.paidAt = nowStr;
    order.payerName = senderName;
    order.pins = generatedPins;

    await updateDoc(doc(serverDb, 'payment_orders', order.id), {
      status: 'PAID',
      paidAt: nowStr,
      payerName: senderName,
      pins: generatedPins,
    });

    // Remove from active slot map (freeing the kobo slot)
    this.orders.delete(order.id);

    this.addAuditLog({
      source: 'PAYMENT_ENGINE',
      status: 'SUCCESS',
      matchedOrderId: order.id,
      extractedAmount: order.exactPayableAmount,
      extractedSender: senderName,
      message: `Order ${order.id} verified and fulfilled! Dispensed ${generatedPins.length} PINs (${order.numStandard} Std, ${order.numPlus} PLUS) to vendor ${order.vendorStudentId || order.vendorId}.`,
    });

    return order;
  }

  public addAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'>) {
    const item: AuditLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(item);
    if (this.auditLogs.length > 200) {
      this.auditLogs = this.auditLogs.slice(0, 200);
    }
    console.log(`[Takano Audit] [${item.status}] [${item.source}] ${item.message}`);
  }

  public getAuditLogs(): AuditLogItem[] {
    return this.auditLogs;
  }
}

export const takanoStore = new TakanoStore();
