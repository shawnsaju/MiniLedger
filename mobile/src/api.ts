import { API_URL } from './config';

export type LoanStatus = 'pending' | 'overdue' | 'repaid';

export interface Loan {
  id: string;
  friendName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  repaidAt: string | null;
  hasReceipt: boolean;
  createdAt: string;
  status: LoanStatus;
}

export interface Summary {
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdueAmount: number;
  entryCount: number;
  repaidCount: number;
  overdueCount: number;
}

export interface ReceiptFile {
  uri: string;
  name: string;
  type: string;
}

export class ApiError extends Error {
  constructor(
    public status: number, // 0 = could not reach the server
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

const TIMEOUT_MS = 15_000;

async function request<T>(
  path: string,
  opts: { method?: string; json?: unknown; form?: FormData; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', json, form, auth = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  // For FormData we deliberately set no Content-Type: fetch adds it with the multipart boundary.

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Check that the backend is running.`);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 on a logged-in call means the token expired; on login calls it means a wrong code.
    if (res.status === 401 && auth) onUnauthorized?.();
    const fieldErrors: Record<string, string> = {};
    const details: { field: string; message: string }[] = Array.isArray(body.details) ? body.details : [];
    for (const d of details) if (d.field && !fieldErrors[d.field]) fieldErrors[d.field] = d.message;
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, fieldErrors);
  }
  return body as T;
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ message: string; phone: string }>('/auth/request-otp', {
      method: 'POST',
      json: { phone },
      auth: false,
    }),

  verifyOtp: (phone: string, otp: string) =>
    request<{ token: string; user: { id: string; phone: string } }>('/auth/verify-otp', {
      method: 'POST',
      json: { phone, otp },
      auth: false,
    }),

  listLoans: async () => (await request<{ loans: Loan[] }>('/loans')).loans,

  summary: () => request<Summary>('/loans/summary'),

  createLoan: (input: { friendName: string; amount: number; dueDate: string; receipt?: ReceiptFile }) => {
    const { receipt, ...fields } = input;
    if (!receipt) return request<Loan>('/loans', { method: 'POST', json: fields });
    const form = new FormData();
    form.append('friendName', fields.friendName);
    form.append('amount', String(fields.amount));
    form.append('dueDate', fields.dueDate);
    // React Native's FormData accepts a { uri, name, type } object as a file part.
    form.append('receipt', { uri: receipt.uri, name: receipt.name, type: receipt.type } as any);
    return request<Loan>('/loans', { method: 'POST', form });
  },

  repayLoan: (id: string) => request<Loan>(`/loans/${id}/repay`, { method: 'POST' }),

  deleteLoan: (id: string) => request<void>(`/loans/${id}`, { method: 'DELETE' }),

  /** Receipts are private, so <Image> must send the bearer token. */
  receiptSource: (id: string) => ({
    uri: `${API_URL}/loans/${id}/receipt`,
    headers: { Authorization: `Bearer ${authToken ?? ''}` },
  }),
};
