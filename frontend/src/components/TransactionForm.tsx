import { useState } from 'react';
import type { Account } from '../api';
import type { EntryCreate, TransactionCreate } from '../api';

type EntryRow = {
  account_id: number;
  debit: number;
  credit: number;
  memo: string;
};

type Props = {
  accounts: Account[];
  onSubmit: (data: TransactionCreate) => Promise<void>;
  onCancel: () => void;
  splitMode?: boolean;
  transferMode?: boolean;
  onGoToChartOfAccounts?: () => void;
};

export default function TransactionForm({
  accounts,
  onSubmit,
  onCancel,
  splitMode = false,
  transferMode = false,
  onGoToChartOfAccounts,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Transfer mode: from account (debit), to account (credit), amount
  const [fromAccountId, setFromAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(0);

  // Simple mode: list of entries (debit or credit)
  // Split mode: one credit account + multiple debit rows
  const [creditAccountId, setCreditAccountId] = useState<number | null>(null);
  const [splitRows, setSplitRows] = useState<EntryRow[]>([
    { account_id: 0, debit: 0, credit: 0, memo: '' },
  ]);
  const [entries, setEntries] = useState<EntryRow[]>([
    { account_id: 0, debit: 0, credit: 0, memo: '' },
  ]);

  const expenseAccounts = (accounts ?? []).filter((a) => a?.category === 'expense');
  const assetAccounts = (accounts ?? []).filter((a) =>
    ['cash', 'current', 'investment', 'real_estate', 'fixed_asset'].includes(a?.category ?? '')
  );

  const addEntry = () => {
    if (splitMode) {
      setSplitRows((r) => [...r, { account_id: 0, debit: 0, credit: 0, memo: '' }]);
    } else {
      setEntries((e) => [...e, { account_id: 0, debit: 0, credit: 0, memo: '' }]);
    }
  };

  const removeEntry = (idx: number) => {
    if (splitMode) {
      setSplitRows((r) => (r.length > 1 ? r.filter((_, i) => i !== idx) : r));
    } else {
      setEntries((e) => (e.length > 1 ? e.filter((_, i) => i !== idx) : e));
    }
  };

  const updateEntry = (idx: number, field: keyof EntryRow, value: number | string) => {
    if (splitMode) {
      setSplitRows((r) =>
        r.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
      );
    } else {
      setEntries((e) =>
        e.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
      );
    }
  };

  const buildEntries = (): EntryCreate[] => {
    if (transferMode && fromAccountId && toAccountId && amount > 0) {
      return [
        { account_id: fromAccountId, debit: amount, credit: 0 },
        { account_id: toAccountId, debit: 0, credit: amount },
      ];
    }
    if (splitMode) {
      const total = splitRows.reduce((s, r) => s + r.debit, 0);
      if (!creditAccountId || total <= 0) return [];
      const result: EntryCreate[] = splitRows
        .filter((r) => r.account_id && r.debit > 0)
        .map((r) => ({
          account_id: r.account_id,
          debit: r.debit,
          credit: 0,
          memo: r.memo || undefined,
        }));
      result.push({
        account_id: creditAccountId,
        debit: 0,
        credit: total,
      });
      return result;
    }

    return entries
      .filter((e) => e.account_id && (e.debit > 0 || e.credit > 0))
      .map((e) => ({
        account_id: e.account_id,
        debit: e.debit,
        credit: e.credit,
        memo: e.memo || undefined,
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (transferMode) {
      if (!fromAccountId || !toAccountId || amount <= 0) {
        setError('Select From and To accounts and enter amount.');
        return;
      }
      if (fromAccountId === toAccountId) {
        setError('From and To accounts must be different.');
        return;
      }
    }
    const built = buildEntries();
    if (built.length < 2) {
      setError('Add at least 2 entries (e.g. one debit, one credit). Debits must equal credits.');
      return;
    }
    const totalDebit = built.reduce((s, x) => s + x.debit, 0);
    const totalCredit = built.reduce((s, x) => s + x.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      setError(`Debits (${totalDebit}) must equal credits (${totalCredit})`);
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    try {
      await onSubmit({
        date,
        description: description.trim(),
        reference: reference.trim() || undefined,
        entries: built,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const accountList = accounts ?? [];
  const showExpenseHeadsGuidance = splitMode && expenseAccounts.length === 0 && accountList.length > 0;

  if (accountList.length === 0) {
    return (
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
        <h3 className="text-lg font-medium text-amber-800 mb-2">
          {transferMode ? 'Transfer' : splitMode ? 'Split Expense' : 'New Transaction'}
        </h3>
        <p className="text-amber-700 text-sm mb-4">
          Create accounts in Chart of Accounts first, then add transactions.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      {showExpenseHeadsGuidance && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm mb-2">
            Add expense heads first. Go to Chart of Accounts and create accounts with category
            &quot;Expense&quot; (e.g. Rent, Utilities).
          </p>
          {onGoToChartOfAccounts && (
            <button
              type="button"
              onClick={onGoToChartOfAccounts}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm"
            >
              Go to Chart of Accounts
            </button>
          )}
        </div>
      )}
      <h3 className="text-lg font-medium text-slate-800 mb-4">
        {transferMode ? 'Transfer Between Accounts' : splitMode ? 'Split Expense' : 'New Transaction'}
      </h3>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Reference</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            transferMode
              ? 'e.g. Transfer to Alfalah Investments'
              : splitMode
                ? 'e.g. Cash withdrawal for office'
                : 'e.g. Payment received'
          }
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          required
        />
      </div>

      {transferMode ? (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              From (Debit)
            </label>
            <select
              value={fromAccountId ?? ''}
              onChange={(e) => setFromAccountId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            >
              <option value="">Select account</option>
              {assetAccounts.map((a) => (
                <option key={a?.id} value={a?.id ?? ''}>
                  {a?.name} ({a?.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              To (Credit)
            </label>
            <select
              value={toAccountId ?? ''}
              onChange={(e) => setToAccountId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            >
              <option value="">Select account</option>
              {assetAccounts.map((a) => (
                <option key={a?.id} value={a?.id ?? ''}>
                  {a?.name} ({a?.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>
        </>
      ) : splitMode ? (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              From (Credit)
            </label>
            <select
              value={creditAccountId ?? ''}
              onChange={(e) => setCreditAccountId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            >
              <option value="">Select account</option>
              {assetAccounts.map((a) => (
                <option key={a?.id} value={a?.id ?? ''}>
                  {a?.name} ({a?.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2 flex justify-between items-center">
            <label className="text-sm font-medium text-slate-600">Expense splits</label>
            <button
              type="button"
              onClick={addEntry}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              + Add line
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {splitRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={row.account_id || ''}
                  onChange={(e) => updateEntry(idx, 'account_id', Number(e.target.value))}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Expense account</option>
                  {expenseAccounts.map((a) => (
                    <option key={a?.id} value={a?.id ?? ''}>
                      {a?.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.debit || ''}
                  onChange={(e) => updateEntry(idx, 'debit', parseFloat(e.target.value) || 0)}
                  placeholder="Amount"
                  className="w-28 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={row.memo}
                  onChange={(e) => updateEntry(idx, 'memo', e.target.value)}
                  placeholder="Memo"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-600 mb-4">
            Total: {splitRows.reduce((s, r) => s + r.debit, 0).toLocaleString()}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 flex justify-between items-center">
            <label className="text-sm font-medium text-slate-600">Entries</label>
            <button
              type="button"
              onClick={addEntry}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              + Add entry
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {entries.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center flex-wrap">
                <select
                  value={row.account_id || ''}
                  onChange={(e) => updateEntry(idx, 'account_id', Number(e.target.value))}
                  className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Account</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a?.id} value={a?.id ?? ''}>
                      {a?.name} ({a?.currency})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.debit || ''}
                  onChange={(e) => updateEntry(idx, 'debit', parseFloat(e.target.value) || 0)}
                  placeholder="Debit"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.credit || ''}
                  onChange={(e) => updateEntry(idx, 'credit', parseFloat(e.target.value) || 0)}
                  placeholder="Credit"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={row.memo}
                  onChange={(e) => updateEntry(idx, 'memo', e.target.value)}
                  placeholder="Memo"
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
