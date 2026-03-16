import React, { useEffect, useState } from 'react';
import {
  listAccounts,
  listTransactions,
  createTransaction,
  deleteTransaction,
  uploadAttachment,
  deleteAttachment,
  getAttachmentDownloadUrl,
  type Account,
  type Transaction,
  type TransactionCreate,
} from '../api';
import ErrorBoundary from './ErrorBoundary';
import StatementImport from './StatementImport';
import TransactionForm from './TransactionForm';

type View = 'list' | 'form' | 'split' | 'transfer' | 'import';

type LedgerProps = {
  onGoToChartOfAccounts?: () => void;
};

export default function Ledger({ onGoToChartOfAccounts }: LedgerProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [fromDate, setFromDate] = useState('2025-01-01');
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountFilter, setAccountFilter] = useState<number | ''>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, txs] = await Promise.all([
        listAccounts(),
        listTransactions({
          from_date: fromDate,
          to_date: toDate,
          account_id: accountFilter || undefined,
        }),
      ]);
      setAccounts(accs);
      setTransactions(txs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, accountFilter]);

  useEffect(() => {
    if (view === 'form' || view === 'split' || view === 'transfer') {
      document.getElementById('transaction-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view]);

  if (view === 'import') {
    return (
      <StatementImport onDone={() => setView('list')} onGoToChartOfAccounts={onGoToChartOfAccounts} />
    );
  }

  const handleCreateTransaction = async (data: TransactionCreate) => {
    await createTransaction(data);
    setView('list');
    await loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    setError(null);
    try {
      await deleteTransaction(id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const [uploadingTxId, setUploadingTxId] = useState<number | null>(null);
  const fileInputRefs = React.useRef<Record<number, HTMLInputElement | null>>({});

  const handleAttachmentUpload = async (txId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTxId(txId);
    setError(null);
    try {
      await uploadAttachment(txId, file);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploadingTxId(null);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (_txId: number, attId: number) => {
    if (!confirm('Remove this attachment?')) return;
    setError(null);
    try {
      await deleteAttachment(attId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    }
  };

  const formatAmount = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Ledger</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setView('form')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            New Transaction
          </button>
          <button
            type="button"
            onClick={() => setView('transfer')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
          >
            Transfer
          </button>
          <button
            type="button"
            onClick={() => setView('split')}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium"
          >
            Split Expense
          </button>
          <button
            type="button"
            onClick={() => setView('import')}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
          >
            Import Statement
          </button>
        </div>
      </div>

      {(view === 'form' || view === 'split' || view === 'transfer') && (
        <div className="mb-6" id="transaction-form">
          <ErrorBoundary>
            <TransactionForm
              accounts={accounts}
              onSubmit={handleCreateTransaction}
              onCancel={() => setView('list')}
              splitMode={view === 'split'}
              transferMode={view === 'transfer'}
              onGoToChartOfAccounts={onGoToChartOfAccounts}
            />
          </ErrorBoundary>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Account</label>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[160px]"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : transactions.length === 0 ? (
        <div className="text-slate-500 py-8 text-center">
          No transactions in this period. Add one with &quot;New Transaction&quot; or &quot;Split
          Expense&quot;.
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="border border-slate-200 rounded-xl overflow-hidden bg-white"
            >
              <div className="px-4 py-3 bg-slate-50 flex justify-between items-start">
                <div>
                  <span className="font-medium text-slate-800">{tx.description}</span>
                  {tx.reference && (
                    <span className="ml-2 text-sm text-slate-500">Ref: {tx.reference}</span>
                  )}
                  <div className="text-sm text-slate-500 mt-0.5">
                    {tx.date} · #{tx.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(tx.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Account</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-600 w-28">
                      Debit
                    </th>
                    <th className="text-right py-2 px-4 font-medium text-slate-600 w-28">
                      Credit
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 px-4">
                        {e.account_name}
                        <span className="text-slate-400 ml-1">{e.account_currency}</span>
                      </td>
                      <td className="text-right py-2 px-4 font-mono">
                        {e.debit > 0 ? formatAmount(e.debit) : '—'}
                      </td>
                      <td className="text-right py-2 px-4 font-mono">
                        {e.credit > 0 ? formatAmount(e.credit) : '—'}
                      </td>
                      <td className="py-2 px-4 text-slate-500">{e.memo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                <div className="flex flex-wrap items-center gap-2">
                  {(tx.attachments ?? []).map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-sm"
                    >
                      <a
                        href={getAttachmentDownloadUrl(a.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline truncate max-w-[180px]"
                        title={a.filename}
                      >
                        {a.filename}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(tx.id, a.id)}
                        className="text-slate-400 hover:text-red-600 ml-1"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <label className="inline-flex items-center gap-1 px-2 py-1 text-sm text-slate-600 hover:text-indigo-600 cursor-pointer border border-dashed border-slate-300 rounded hover:border-indigo-400">
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[tx.id] = el; }}
                      onChange={(e) => handleAttachmentUpload(tx.id, e)}
                      disabled={uploadingTxId === tx.id}
                    />
                    {uploadingTxId === tx.id ? 'Uploading…' : '+ Add invoice/receipt'}
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
