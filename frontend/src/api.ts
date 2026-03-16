// Use VITE_API_URL when deploying frontend separately (e.g. Surge); otherwise /api for same-origin
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export type Account = {
  id: number;
  created_at: string;
  name: string;
  category: string;
  currency: string;
};

export type AccountCreate = {
  name: string;
  category: string;
  currency: string;
};

export async function listAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/accounts`);
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json();
}

export async function createAccount(data: AccountCreate): Promise<Account> {
  const res = await fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create account');
  }
  return res.json();
}

export async function updateAccount(id: number, data: AccountCreate): Promise<Account> {
  const res = await fetch(`${API_BASE}/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update account');
  }
  return res.json();
}

export async function deleteAccount(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete account');
}

export async function getAccountCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/config/account-categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.categories;
}

export async function getCurrencies(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/config/currencies`);
  if (!res.ok) throw new Error('Failed to fetch currencies');
  const data = await res.json();
  return data.currencies;
}

export async function seedExpenseHeads(): Promise<{ created: number; names: string[] }> {
  const res = await fetch(`${API_BASE}/accounts/seed-expense-heads`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ') || 'Failed to add expense heads'
      : detail || res.statusText || 'Failed to add expense heads';
    throw new Error(msg);
  }
  return res.json();
}

// --- Transactions ---

export type EntryCreate = {
  account_id: number;
  debit: number;
  credit: number;
  currency?: string;
  exchange_rate?: number;
  memo?: string;
};

export type TransactionCreate = {
  date: string;
  description: string;
  reference?: string;
  entries: EntryCreate[];
};

export type EntryRead = {
  id: number;
  transaction_id: number;
  account_id: number;
  account_name: string;
  account_currency: string;
  debit: number;
  credit: number;
  currency: string;
  exchange_rate: number | null;
  memo: string | null;
};

export type Attachment = {
  id: number;
  transaction_id: number;
  filename: string;
  content_type: string;
  created_at: string;
};

export type Transaction = {
  id: number;
  created_at: string;
  date: string;
  description: string;
  reference: string | null;
  entries: EntryRead[];
  attachments?: Attachment[];
};

export async function listTransactions(params?: {
  from_date?: string;
  to_date?: string;
  account_id?: number;
}): Promise<Transaction[]> {
  const search = new URLSearchParams();
  if (params?.from_date) search.set('from_date', params.from_date);
  if (params?.to_date) search.set('to_date', params.to_date);
  if (params?.account_id) search.set('account_id', String(params.account_id));
  const qs = search.toString();
  const res = await fetch(`${API_BASE}/transactions${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function createTransaction(data: TransactionCreate): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ') || 'Failed to create transaction'
      : detail || res.statusText || 'Failed to create transaction';
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteTransaction(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

// --- Attachments ---

export function getAttachmentDownloadUrl(attachmentId: number): string {
  const base = typeof window !== 'undefined' ? '' : 'http://localhost:8000';
  return `${base}${API_BASE}/attachments/${attachmentId}/download`;
}

export async function uploadAttachment(transactionId: number, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/transactions/${transactionId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to upload attachment');
  }
  return res.json();
}

export async function deleteAttachment(attachmentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/attachments/${attachmentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete attachment');
}

// --- Statement Import ---

export type StatementLineParsed = {
  date: string;
  description: string;
  reference: string;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
};

export type StatementParseResult = {
  lines: StatementLineParsed[];
  errors: string[];
  opening_balance: number | null;
  closing_balance: number | null;
};

export type StatementLineSplit = {
  amount: number;
  account_id: number;
};

export type StatementLineApproved = {
  date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  counter_account_id?: number | null;
  splits?: StatementLineSplit[];
};

export async function parseStatement(file: File): Promise<StatementParseResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/statements/parse`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to parse statement');
  }
  return res.json();
}

export async function createEntriesFromStatement(
  bankAccountId: number,
  lines: StatementLineApproved[]
): Promise<{ created: number }> {
  const res = await fetch(`${API_BASE}/statements/create-entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bank_account_id: bankAccountId, lines }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create entries');
  }
  return res.json();
}
