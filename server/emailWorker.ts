import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { takanoStore } from './takanoStore.js';
import { uidTracker } from './processedUids.js';
import { analyzeEmailWithLLM } from './llmService.js';

export class EmailWorker {
  private client: ImapFlow | null = null;
  private isRunning: boolean = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;

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
    });
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    takanoStore.addAuditLog({
      source: 'IMAP_WORKER',
      status: 'INFO',
      message: 'Starting Takano Pay background IMAP scanning daemon (5-second cadence)...',
    });

    this.runLoop();
  }

  public stop() {
    this.isRunning = false;
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
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

  private async runLoop() {
    if (!this.isRunning) return;

    try {
      await this.scanOnce();
    } catch (err: any) {
      console.warn('[EmailWorker] Loop scan warning:', err.message);
    }

    if (this.isRunning) {
      this.scanTimer = setTimeout(() => this.runLoop(), 5000);
    }
  }

  public async scanOnce(): Promise<{ newEmailsProcessed: number; errors: string[] }> {
    if (this.isScanning) {
      return { newEmailsProcessed: 0, errors: ['Scan already in flight'] };
    }
    this.isScanning = true;
    const errors: string[] = [];
    let processedCount = 0;

    let client: ImapFlow | null = null;
    try {
      client = this.createClient();
      await client.connect();

      // Lock mailbox, perform scan, and release immediately to avoid deadlocks
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.noop(); // Force Gmail synchronization

        const config = takanoStore.getConfig();
        const targetSender = (config.targetSender || 'successcugo@gmail.com').toLowerCase().trim();

        // Search for recent unseen or all messages from the target sender
        // We track processed UIDs to never duplicate LLM tool calls
        let searchUids: number[] = [];
        try {
          searchUids = await client.search({ from: targetSender }, { uid: true });
        } catch (searchErr) {
          // Fallback search: recent messages
          searchUids = await client.search({ unseen: true }, { uid: true });
        }

        const newUids = searchUids.filter((uid) => !uidTracker.has(uid));

        if (newUids.length > 0) {
          takanoStore.addAuditLog({
            source: 'IMAP_WORKER',
            status: 'INFO',
            message: `Found ${newUids.length} new email(s) from "${targetSender}". Processing with AI tool calling...`,
          });

          for (const uid of newUids) {
            try {
              // CRITICAL: { uid: true } MUST be in 3rd parameter options of fetchOne!
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

              // Fast check: Reject obvious debit alerts or random non-credit communications
              if (!containsTestKeyword) {
                const isDebitAlert = /(?:debit alert|transaction alert \[debit\]|\bdr alert\b|account debited|funds debited|debited with|debited for|funds withdrawn|withdrawn from|you have spent|atm withdrawal|pos purchase|web purchase|card purchase|airtime purchase)\b/i.test(subject) ||
                                     /(?:debit alert|account debited|\bdr alert\b)\b/i.test(rawBody);

                const isRandomBankNotice = /(?:one[- ]time[- ]password|\botp\b|verification code|security code|login notification|new device|sign[- ]in detected|password reset|statement of account|monthly statement|e-statement|account statement|system maintenance|maintenance notice|scheduled downtime|service disruption|loan offer|kyc (?:update|verification)|happy new month|customer service survey)\b/i.test(subject);

                if (isDebitAlert || isRandomBankNotice) {
                  const reason = isDebitAlert
                    ? 'Alert rejected: Debit or withdrawal notification detected. Only incoming credit alerts are accepted.'
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

              // Analyze email with OpenAI tool schema
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
                  message: extraction.rejectionReason || 'Alert rejected: Incoming alert lacks verified banking transaction details (Session ID, Bank branding, Payer name) and does not contain TAKANOPAYMENTTEST.',
                });
              }

              // Mark UID as processed
              uidTracker.add(uid);
              processedCount++;
            } catch (err: any) {
              errors.push(`UID ${uid} processing error: ${err.message}`);
              uidTracker.add(uid); // avoid getting stuck on bad email
            }
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err: any) {
      errors.push(`IMAP connection error: ${err.message}`);
      takanoStore.addAuditLog({
        source: 'IMAP_WORKER',
        status: 'ERROR',
        message: `IMAP connection check: ${err.message}`,
      });
    } finally {
      if (client) {
        try {
          await client.close();
        } catch (_) {}
      }
      this.isScanning = false;
    }

    return { newEmailsProcessed: processedCount, errors };
  }
}

export const emailWorker = new EmailWorker();
