import PaystackPop from '@paystack/inline-js';

export interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode?: string;
  gateway?: string;
  pay_with_bank?: boolean;
  active: boolean;
  is_deleted?: boolean;
  country?: string;
  currency?: string;
  type?: string;
}

export interface PaystackTransactionSuccess {
  reference: string;
  trans?: string;
  status?: string;
  message?: string;
  transaction?: string;
  trxref?: string;
  [key: string]: any;
}

export class PaystackService {
  static async getBanks(secretKey?: string): Promise<PaystackBank[]> {
    const headers: Record<string, string> = {};
    if (secretKey) headers['x-paystack-secret-key'] = secretKey.trim();
    const res = await fetch('/api/paystack/banks', { headers });
    const json = await res.json();
    return json.data || [];
  }

  static async resolveAccount(accountNumber: string, bankCode: string, secretKey?: string) {
    const headers: Record<string, string> = {};
    if (secretKey) headers['x-paystack-secret-key'] = secretKey.trim();
    const res = await fetch(
      `/api/paystack/resolve-account?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers }
    );
    return await res.json();
  }

  static async createTransferRecipient(name: string, accountNumber: string, bankCode: string, secretKey?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secretKey) headers['x-paystack-secret-key'] = secretKey.trim();
    const res = await fetch('/api/paystack/create-recipient', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, account_number: accountNumber, bank_code: bankCode }),
    });
    return await res.json();
  }

  static async initializeTransaction(email: string, amountInNaira: number, secretKey?: string, metadata?: Record<string, any>) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secretKey) headers['x-paystack-secret-key'] = secretKey.trim();
    const res = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        amount: Math.round(amountInNaira * 100),
        reference: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        metadata,
      }),
    });
    return await res.json();
  }

  static openInlinePayment(options: {
    publicKey: string;
    email: string;
    amountInNaira: number;
    reference?: string;
    accessCode?: string;
    metadata?: Record<string, any>;
    onSuccess: (res: PaystackTransactionSuccess) => void;
    onCancel?: () => void;
    onError?: (err: any) => void;
  }) {
    const popup = new PaystackPop();
    popup.newTransaction({
      key: options.publicKey.trim(),
      email: options.email.trim(),
      amount: Math.round(options.amountInNaira * 100),
      reference: options.reference || `colearn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      access_code: options.accessCode,
      metadata: options.metadata,
      onSuccess: (transaction: any) => options.onSuccess(transaction),
      onCancel: () => {
        if (options.onCancel) options.onCancel();
      },
      onError: (err: any) => {
        if (options.onError) options.onError(err);
      },
    });
  }

  static async verifyTransaction(reference: string, secretKey?: string) {
    const headers: Record<string, string> = {};
    if (secretKey) headers['x-paystack-secret-key'] = secretKey.trim();
    const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`, { headers });
    return await res.json();
  }

  static async initiateTransfer(amountInNaira: number, recipientCode: string, reason: string, secretKey?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secretKey) headers['x-paystack-secret-key'] = secretKey.trim();
    const res = await fetch('/api/paystack/transfer', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount: Math.round(amountInNaira * 100),
        recipient: recipientCode,
        reason,
      }),
    });
    return await res.json();
  }
}
