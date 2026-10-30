import { getBackendCandidates } from '../lib/backendConfig';

export interface TakanoConfigResponse {
  success: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  renderBackendUrl: string;
  scannerEnabled: boolean;
  scannerStatus?: 'STANDBY' | 'ACTIVE_SCANNING' | 'DISABLED';
  isActivelyScanning?: boolean;
  activePendingCount?: number;
  retailPrices: {
    standard: number;
    plus: number;
  };
  wholesaleTiers: {
    tier1To4Percent: number; // 60
    tier5PlusPercent: number; // 50
  };
  imapUser?: string;
  targetSender?: string;
  llmModel?: string;
}

export interface RestockOrderResult {
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

export interface CreateOrderResponse {
  success: boolean;
  order: RestockOrderResult;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  error?: string;
}

export interface OrderStatusResponse {
  success: boolean;
  order: RestockOrderResult;
  error?: string;
}

export interface AuditLogEntry {
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

async function requestWithFallback<T>(path: string, options?: RequestInit): Promise<T> {
  const candidates = getBackendCandidates(path);
  let lastError: any = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });

      if (response.ok) {
        return (await response.json()) as T;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with HTTP status ${response.status}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`All candidate backend endpoints failed for ${path}`);
}

export const TakanoPayService = {
  async getConfig(): Promise<TakanoConfigResponse> {
    return requestWithFallback<TakanoConfigResponse>('/api/takano/config');
  },

  async createRestockOrder(params: {
    vendorId: string;
    vendorStudentId: string;
    vendorName?: string;
    numStandard: number;
    numPlus: number;
    university?: string;
  }): Promise<CreateOrderResponse> {
    return requestWithFallback<CreateOrderResponse>('/api/takano/order/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
    return requestWithFallback<OrderStatusResponse>(`/api/takano/order/status/${encodeURIComponent(orderId)}`);
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean }> {
    return requestWithFallback<{ success: boolean }>('/api/takano/order/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  },

  async simulateTestCredit(amount: number, senderName?: string): Promise<{ success: boolean; result: any }> {
    return requestWithFallback<{ success: boolean; result: any }>('/api/takano/simulate-test-credit', {
      method: 'POST',
      body: JSON.stringify({ amount, senderName }),
    });
  },

  async getAuditLogs(): Promise<{ success: boolean; logs: AuditLogEntry[] }> {
    return requestWithFallback<{ success: boolean; logs: AuditLogEntry[] }>('/api/takano/audit-logs');
  },

  async triggerScanNow(): Promise<{ success: boolean; result: any }> {
    return requestWithFallback<{ success: boolean; result: any }>('/api/takano/scan-now', {
      method: 'POST',
    });
  },

  async saveConfig(configData: Record<string, any>): Promise<{ success: boolean; config: any }> {
    return requestWithFallback<{ success: boolean; config: any }>('/api/takano/save-config', {
      method: 'POST',
      body: JSON.stringify(configData),
    });
  },

  async testEmailParser(payload: { body: string; subject?: string; from?: string }): Promise<{ success: boolean; result: any }> {
    return requestWithFallback<{ success: boolean; result: any }>('/api/takano/test-email-parser', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
