import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { takanoStore, PaymentOrder, TakanoOrderEvent } from './takanoStore.js';
import { uidTracker } from './processedUids.js';
import { analyzeEmailWithLLM } from './llmService.js';

export type ScannerMode = 'STANDBY' | 'ACTIVE_SCANNING' | 'DISABLED';

export class EmailWorker {
  private client: ImapFlow | null = null;
  private isRunning: boolean = false;
  private isActivelyScanning: boolean = false;
  private activeScanTimer: NodeJS.Timeout | null = null;
  private standbyTimer: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;

  constructor() {
    // Automatically listen to vendor checkout/order events from takanoStore
    takanoStore.onOrderEvent((event: TakanoOrderEvent, order?: PaymentOrder) => {
      this.handleOrderEvent(event, order);
    });
  }

  private createClient(): ImapFlow {
    const config = takanoStore.getConfig();
    return new ImapFlow({
      host: config.imapHost || 'imap.gmail.com',
      port: config.imapPort || 993,
      secure: true,
      auth: {
        user: config.imapUser || 'successugochukwuchi@gmail.com',
        pass: (config.imapPassword || 'vgvvugojqnqpcfme').replace(/\s+/g, ''),
      },
      logger: false,
      // Optimize socket timeouts for rapid polling
      clientInfo: { name: 'TakanoPay-FastWorker', version: '2.0.0' },
    });
  }

  private async ensureConnectedClient(): Promise<ImapFlow> {
    if (this.client && this.client.usable) {
      return this.client;
    }
    if (this.client) {
      try {
        await this.client.logout();
      } catch (_) {}
      this.client = null;
    }
    this.client = this.createClient();
    await this.client.connect();
    return this.client;
  }

  /**
   * Called by takanoStore whenever an order lifecycle event occurs.
   * Ensures the IMAP scanner starts IMMEDIATELY when a vendor is given a slot and told to pay.
   */
  private handleOrderEvent(event: TakanoOrderEvent, order?: PaymentOrder) {
    if (!this.isRunning) return;

    const config = takanoStore.getConfig();
    if (config.scannerEnabled === false) {
      if (this.isActivelyScanning) {
        this.stopActiveScanning('Scanner disabled in configuration');
      }
      return;
    }

    if (event === 'ORDER_CREATED' && order && order.status === 'PENDING') {
      takanoStore.addAuditLog({
        source: 'IMAP_WORKER',
        status: 'INFO',
        matchedOrderId: order.id,
        extractedAmount: order.exactPayableAmount,
        message: `Vendor ${order.vendorStudentId || order.vendorId} actively making a purchase (Order: ${order.id}, Slot: ₦${order.koboSlot.toFixed(2)}, Payable: ₦${order.exactPayableAmount.toFixed(2)}). IMAP scanner ACTIVATED with rapid 2s cadence.`,
      });
      this.startActiveScanning();
      // Trigger an instant scan right away!
      this.scanOnce({ force: true }).catch(() => {});
    } else if (event === 'ORDER_FULFILLED' || event === 'ORDER_CANCELLED' || event === 'ORDERS_EXPIRED') {
      const activeOrders = takanoStore.getActivePendingOrders();
      if (activeOrders.length === 0) {
        this.stopActiveScanning(`No active vendor purchases remaining after ${event}`);
      } else {
        takanoStore.addAuditLog({
          source: 'IMAP_WORKER',
          status: 'INFO',
          message: `Order state changed (${event}). ${activeOrders.length} active purchase(s) still awaiting payment. Scanner remains active.`,
        });
      }
    }
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Check if there are active vendor purchases already pending from earlier
    const active = takanoStore.getActivePendingOrders();
    if (active.length > 0) {
      takanoStore.addAuditLog({
        source: 'IMAP_WORKER',
        status: 'INFO',
        message: `Takano Pay daemon started: Detected ${active.length} active vendor purchase(s). Beginning rapid IMAP scanning...`,
      });
      this.startActiveScanning();
    } else {
      takanoStore.addAuditLog({
        source: 'IMAP_WORKER',
        status: 'INFO',
        message: 'Takano Pay IMAP listener initialized in STANDBY. Scanner will only begin scanning when a vendor is actively making a purchase.',
      });
      this.startStandbyHeartbeat();
    }
  }

  public stop() {
    this.isRunning = false;
    this.isActivelyScanning = false;
    if (this.activeScanTimer) {
      clearTimeout(this.activeScanTimer);
      this.activeScanTimer = null;
    }
    if (this.standbyTimer) {
      clearTimeout(this.standbyTimer);
      this.standbyTimer = null;
    }
    if (this.client) {
      this.client.logout().catch(() => {});
      this.client = null;
    }
    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'INFO',
      message: 'Takano Pay IMAP scanning daemon stopped.',
    });
  }

  public startActiveScanning() {
    if (this.isActivelyScanning) {
      if (!this.isScanning) {
        this.scanOnce().catch(() => {});
      }
      return;
    }

    this.isActivelyScanning = true;
    if (this.standbyTimer) {
      clearTimeout(this.standbyTimer);
      this.standbyTimer = null;
    }

    this.runActiveLoop();
  }

  public stopActiveScanning(reason?: string) {
    if (!this.isActivelyScanning) return;
    this.isActivelyScanning = false;

    if (this.activeScanTimer) {
      clearTimeout(this.activeScanTimer);
      this.activeScanTimer = null;
    }

    if (this.client) {
      this.client.logout().catch(() => {});
      this.client = null;
    }

    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'INFO',
      message: `IMAP scanner returned to STANDBY mode (${reason || 'No active purchases'}). IMAP polling and AI model calls paused.`,
    });

    this.startStandbyHeartbeat();
  }

  /**
   * Standby monitor: checks every 15 seconds if active vendor purchases exist.
   */
  private startStandbyHeartbeat() {
    if (this.standbyTimer) {
      clearTimeout(this.standbyTimer);
    }
    if (!this.isRunning || this.isActivelyScanning) return;

    this.standbyTimer = setTimeout(async () => {
      if (!this.isRunning || this.isActivelyScanning) return;

      takanoStore.purgeExpiredSlots();
      const active = takanoStore.getActivePendingOrders();
      if (active.length > 0) {
        takanoStore.addAuditLog({
          source: 'IMAP_WORKER',
          status: 'INFO',
          message: `Standby monitor detected ${active.length} active vendor purchase(s). Activating IMAP scanner...`,
        });
        this.startActiveScanning();
        return;
      }

      this.startStandbyHeartbeat();
    }, 15000);
  }

  private async runActiveLoop() {
    if (!this.isRunning || !this.isActivelyScanning) return;

    const activeOrders = takanoStore.getActivePendingOrders();
    if (activeOrders.length === 0) {
      this.stopActiveScanning('All active vendor purchases settled or expired');
      return;
    }

    try {
      await this.scanOnce();
    } catch (err: any) {
      console.warn('[EmailWorker] Active scan warning:', err.message);
    }

    if (this.isRunning && this.isActivelyScanning) {
      // Rapid 2-second loop for ultra-fast payment discovery
      this.activeScanTimer = setTimeout(() => this.runActiveLoop(), 2000);
    }
  }

  /**
   * Ultra-Fast IMAP Scan using Date-Restricted Search & Persistent Client Reuse
   */
  public async scanOnce(options?: { force?: boolean }): Promise<{
    newEmailsProcessed: number;
    errors: string[];
    status?: string;
    message?: string;
  }> {
    const config = takanoStore.getConfig();
    if (config.scannerEnabled === false && !options?.force) {
      return {
        newEmailsProcessed: 0,
        errors: ['Scanner disabled in configuration'],
        status: 'DISABLED',
      };
    }

    const activeOrders = takanoStore.getActivePendingOrders();
    const hasActiveOrders = activeOrders.length > 0;

    if (!hasActiveOrders && !options?.force) {
      return {
        newEmailsProcessed: 0,
        errors: [],
        status: 'STANDBY',
        message: 'Scan skipped: No vendor is actively making a purchase.',
      };
    }

    if (this.isScanning) {
      return { newEmailsProcessed: 0, errors: ['Scan already in flight'] };
    }
    this.isScanning = true;
    const errors: string[] = [];
    let processedCount = 0;

    try {
      // Reuse persistent client connection if active, avoiding 3-5 second SSL handshakes
      const client = await this.ensureConnectedClient();

      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.noop(); // Synchronize latest inbox state

        const targetSender = (config.targetSender || 'successcugo@gmail.com').toLowerCase().trim();

        // DATE-RESTRICTED SEARCH (LAST 1 DAY ONLY):
        // Prevents Gmail IMAP from searching years of email history, returning UIDs in milliseconds
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let searchUids: number[] = [];

        try {
          searchUids = await client.search({ from: targetSender, since: oneDayAgo }, { uid: true });
        } catch (searchErr) {
          // Fallback search: recent unseen messages from last 1 day
          searchUids = await client.search({ unseen: true, since: oneDayAgo }, { uid: true });
        }

        // If specific sender search returned nothing, fallback to checking unseen from last 1 day
        if (searchUids.length === 0) {
          try {
            searchUids = await client.search({ unseen: true, since: oneDayAgo }, { uid: true });
          } catch (_) {}
        }

        const newUids = searchUids.filter((uid) => !uidTracker.has(uid));

        if (newUids.length > 0) {
          takanoStore.addAuditLog({
            source: 'IMAP_WORKER',
            status: 'INFO',
            message: `Found ${newUids.length} new email(s) during rapid scan. Processing...`,
          });

          for (const uid of newUids) {
            try {
              const msg = await client.fetchOne(
                String(uid),
                { source: true, envelope: true, flags: true },
                { uid: true }
              );

              if (!msg || !msg.source) {
                uidTracker.add(uid);
                continue;
              }

              const parsed = await simpleParser(msg.source);
              const subject = parsed.subject || '';
              const fromAddress = parsed.from?.value[0]?.address || targetSender;
              const rawBody = parsed.text || parsed.html || '';

              const fullContent = `SUBJECT: ${subject}\nFROM: ${fromAddress}\n\n${rawBody}`;
              const containsTestKeyword = /TAKANOPAYMENTTEST/i.test(fullContent);

              // 1. Fast heuristic filter: Reject obvious debit alerts or random non-credit notices before touching AI model
              if (!containsTestKeyword) {
                const isDebitAlert =
                  /(?:debit alert|transaction alert \[debit\]|\bdr alert\b|account debited|funds debited|debited with|debited for|funds withdrawn|withdrawn from|you have spent|atm withdrawal|pos purchase|web purchase|card purchase|airtime purchase|transfer to\b|you sent\b|outward (?:transfer|nip|payment))\b/i.test(
                    subject
                  ) ||
                  /(?:debit alert|account debited|\bdr alert\b|your transfer of (?:ngn|₦)|you have sent|successfully sent to|funds sent to|transferred to|outward (?:transfer|payment))\b/i.test(
                    rawBody
                  );

                const isRandomBankNotice =
                  /(?:one[- ]time[- ]password|\botp\b|verification code|security code|login notification|new device|sign[- ]in detected|password reset|statement of account|monthly statement|e-statement|account statement|system maintenance|maintenance notice|scheduled downtime|service disruption|loan offer|kyc (?:update|verification)|happy new month|customer service survey)\b/i.test(
                    subject
                  );

                if (isDebitAlert || isRandomBankNotice) {
                  const reason = isDebitAlert
                    ? 'Alert rejected: Debit or outward withdrawal notification detected. Only incoming credit alerts are accepted.'
                    : 'Alert rejected: Random non-credit bank email (OTP, statement, security, maintenance, or marketing notice).';

                  takanoStore.addAuditLog({
                    source: 'IMAP_WORKER',
                    status: 'REJECTED',
                    from: fromAddress,
                    subject,
                    bodyPreview: rawBody.slice(0, 160).trim(),
                    isLegitimate: false,
                    isTest: false,
                    message: `${reason} (Subject: "${subject}")`,
                  });

                  uidTracker.add(uid);
                  processedCount++;
                  continue;
                }
              }

              // 2. CRITICAL GATE: Double-check that an active vendor purchase is still ongoing before calling AI model
              const currentPendingOrders = takanoStore.getActivePendingOrders();
              if (!containsTestKeyword && currentPendingOrders.length === 0 && !options?.force) {
                takanoStore.addAuditLog({
                  source: 'IMAP_WORKER',
                  status: 'INFO',
                  from: fromAddress,
                  subject,
                  message: `Skipping AI model evaluation for email "${subject}": No active vendor purchase awaiting credit.`,
                });
                uidTracker.add(uid);
                processedCount++;
                continue;
              }

              // 3. AMOUNT PRE-MATCH GATE: Fast text check for active order exact amount or kobo slot
              if (!containsTestKeyword && currentPendingOrders.length > 0 && !options?.force) {
                const normalizedText = (subject + ' ' + rawBody).replace(/,/g, '');
                const matchesAnyOrderAmount = currentPendingOrders.some((order) => {
                  const exactStr = order.exactPayableAmount.toFixed(2);
                  const baseStr = String(order.baseAmount);
                  const slotStr = order.koboSlot.toFixed(2);
                  return normalizedText.includes(exactStr) || normalizedText.includes(baseStr) || normalizedText.includes(slotStr);
                });

                if (!matchesAnyOrderAmount) {
                  takanoStore.addAuditLog({
                    source: 'IMAP_WORKER',
                    status: 'INFO',
                    from: fromAddress,
                    subject,
                    bodyPreview: rawBody.slice(0, 140).trim(),
                    message: `Skipping AI model evaluation: Email text does not match active vendor payable slot (${currentPendingOrders
                      .map((o) => '₦' + o.exactPayableAmount.toFixed(2))
                      .join(', ')}).`,
                  });
                  uidTracker.add(uid);
                  processedCount++;
                  continue;
                }
              }

              // 4. Analyze credit email with LLM
              const extraction = await analyzeEmailWithLLM(rawBody, subject, fromAddress);

              if (extraction.isLegitimate && extraction.amount && extraction.amount > 0) {
                // Attempt to match and fulfill order
                const result = await takanoStore.handleIncomingCredit(
                  extraction.amount,
                  extraction.senderName,
                  extraction.isTest
                );

                if (result.matched) {
                  takanoStore.addAuditLog({
                    source: 'IMAP_WORKER',
                    status: 'SUCCESS',
                    matchedOrderId: result.orderId,
                    extractedAmount: extraction.amount,
                    message: `Verified transfer of ₦${extraction.amount.toFixed(2)} from ${extraction.senderName}. Generated ${result.pinsCount} PINs for Order ${result.orderId}!`,
                  });
                }
              } else {
                takanoStore.addAuditLog({
                  source: 'IMAP_WORKER',
                  status: 'REJECTED',
                  from: fromAddress,
                  subject,
                  extractedAmount: extraction.amount || undefined,
                  extractedSender: extraction.senderName,
                  isLegitimate: false,
                  isTest: extraction.isTest,
                  message:
                    extraction.rejectionReason ||
                    'Alert rejected: Incoming alert lacks verified banking transaction details.',
                });
              }

              uidTracker.add(uid);
              processedCount++;
            } catch (err: any) {
              errors.push(`UID ${uid} processing error: ${err.message}`);
              uidTracker.add(uid);
            }
          }
        }
      } finally {
        lock.release();
      }
    } catch (err: any) {
      errors.push(`IMAP connection error: ${err.message}`);
      // Drop broken client connection so next loop cycle re-connects cleanly
      if (this.client) {
        try {
          await this.client.logout();
        } catch (_) {}
        this.client = null;
      }
      takanoStore.addAuditLog({
        source: 'IMAP_WORKER',
        status: 'ERROR',
        message: `IMAP connection check: ${err.message}`,
      });
    } finally {
      this.isScanning = false;
    }

    return { newEmailsProcessed: processedCount, errors };
  }

  public getStatus(): {
    isRunning: boolean;
    isActivelyScanning: boolean;
    activePendingCount: number;
    mode: ScannerMode;
  } {
    const config = takanoStore.getConfig();
    const activeCount = takanoStore.getActivePendingOrders().length;
    let mode: ScannerMode = 'STANDBY';
    if (config.scannerEnabled === false) {
      mode = 'DISABLED';
    } else if (this.isActivelyScanning) {
      mode = 'ACTIVE_SCANNING';
    }

    return {
      isRunning: this.isRunning,
      isActivelyScanning: this.isActivelyScanning,
      activePendingCount: activeCount,
      mode,
    };
  }
}

export const emailWorker = new EmailWorker();
