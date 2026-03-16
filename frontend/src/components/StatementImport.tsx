import { useState } from 'react';
import {
  listAccounts,
  parseStatement,
  createEntriesFromStatement,
  type Account,
  type StatementLineParsed,
  type StatementLineApproved,
} from '../api';

type SplitRow = { amount: number; account_id: number | null };

type EditableLine = StatementLineParsed & {
  counter_account_id: number | null;
  isSplit: boolean;
  splits: SplitRow[];
};

export default function StatementImport({
  onDone,
  onGoToChartOfAccounts,
}: {
  onDone: () => void;
  onGoToChartOfAccounts?: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [closingBalance, setClosingBalance] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const assetAccounts = (accounts ?? []).filter((a) =>
    ['cash', 'current', 'investment', 'real_estate', 'fixed_asset'].includes(a?.category ?? '')
  );
  const expenseAccounts = (accounts ?? []).filter((a) => a?.category === 'expense');
  const otherAccounts = (accounts ?? []).filter((a) =>
    !['cash', 'current', 'investment', 'real_estate', 'fixed_asset'].includes(a?.category ?? '')
  );
  const counterAccountOptions = [...assetAccounts, ...otherAccounts];
  const splitAccountOptions = [...expenseAccounts, ...assetAccounts, ...otherAccounts];

  const loadAccounts = async () => {
    const accs = await listAccounts();
    setAccounts(accs);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrors([]);
    setLines([]);
    setMessage(null);
    try {
      await loadAccounts();
      const result = await parseStatement(file);
      setLines(
        result.lines.map((l) => ({
          ...l,
          counter_account_id: null as number | null,
          isSplit: false,
          splits: [{ amount: l.debit || l.credit || 0, account_id: null }],
        }))
      );
      setOpeningBalance(result.opening_balance);
      setClosingBalance(result.closing_balance);
      setErrors(result.errors);
      if (result.lines.length > 0) setMessage(`Parsed ${result.lines.length} transactions`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to parse');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const updateLine = (idx: number, field: keyof EditableLine, value: string | number | null) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const toggleSplit = (idx: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const amt = l.debit || l.credit || 0;
        if (l.isSplit) {
          return { ...l, isSplit: false, splits: [{ amount: amt, account_id: null }], counter_account_id: null };
        }
        return { ...l, isSplit: true, counter_account_id: null, splits: [{ amount: amt, account_id: null }] };
      })
    );
  };

  const addSplitRow = (lineIdx: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== lineIdx || !l.isSplit) return l;
        return { ...l, splits: [...l.splits, { amount: 0, account_id: null }] };
      })
    );
  };

  const removeSplitRow = (lineIdx: number, splitIdx: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== lineIdx || !l.isSplit) return l;
        const newSplits = l.splits.filter((_, si) => si !== splitIdx);
        return { ...l, splits: newSplits.length > 0 ? newSplits : [{ amount: l.debit || l.credit || 0, account_id: null }] };
      })
    );
  };

  const updateSplitRow = (lineIdx: number, splitIdx: number, field: 'amount' | 'account_id', value: number | null) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== lineIdx || !l.isSplit) return l;
        return {
          ...l,
          splits: l.splits.map((s, si) =>
            si === splitIdx ? { ...s, [field]: value ?? (field === 'amount' ? 0 : null) } : s
          ),
        };
      })
    );
  };

  const handleCreateEntries = async () => {
    if (!bankAccountId) {
      setMessage('Select the bank account first');
      return;
    }
    const toCreate: StatementLineApproved[] = [];
    for (const l of lines) {
      if (l.isSplit) {
        const valid = l.splits.filter((s) => s.account_id != null && s.amount > 0);
        const total = l.splits.reduce((s, r) => s + r.amount, 0);
        const expected = l.debit || l.credit || 0;
        if (valid.length > 0 && Math.abs(total - expected) < 0.01) {
          toCreate.push({
            date: l.date,
            description: l.description,
            reference: l.reference || undefined,
            debit: l.debit,
            credit: l.credit,
            splits: valid.map((s) => ({ amount: s.amount, account_id: s.account_id! })),
          });
        }
      } else if (l.counter_account_id != null) {
        toCreate.push({
          date: l.date,
          description: l.description,
          reference: l.reference || undefined,
          debit: l.debit,
          credit: l.credit,
          counter_account_id: l.counter_account_id,
        });
      }
    }
    if (toCreate.length === 0) {
      setMessage('Select a counter account (or split with expense heads) for each line you want to import');
      return;
    }
    setImporting(true);
    setMessage(null);
    try {
      const { created } = await createEntriesFromStatement(bankAccountId, toCreate);
      setMessage(`Created ${created} transaction(s)`);
      onDone();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create entries');
    } finally {
      setImporting(false);
    }
  };

  const formatAmount = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Import Bank Statement</h1>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
        >
          Back
        </button>
      </div>

      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h2 className="text-lg font-medium text-slate-800 mb-2">Bank Al Habib CSV</h2>
        <p className="text-sm text-slate-600 mb-4">
          Upload your statement CSV. Review and assign a counter account for each line, then create
          entries.
        </p>
        <label className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium cursor-pointer">
          Choose CSV file
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {loading && <div className="text-slate-500 mb-4">Parsing…</div>}

      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
          <strong>Parse warnings:</strong>
          <ul className="list-disc list-inside mt-1">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 5 && <li>…and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}

      {openingBalance != null && closingBalance != null && (
        <div className="mb-4 text-sm text-slate-600">
          Opening: {formatAmount(openingBalance)} · Closing: {formatAmount(closingBalance)}
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 bg-indigo-50 text-indigo-800 rounded-lg text-sm">{message}</div>
      )}

      {lines.length > 0 && expenseAccounts.length === 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm mb-2">
            Add expense heads first to use split mode. Go to Chart of Accounts and create accounts
            with category &quot;Expense&quot; (e.g. Rent, Utilities).
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

      {lines.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Bank account:</span>
              <select
                value={bankAccountId ?? ''}
                onChange={(e) => setBankAccountId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[180px]"
              >
                <option value="">Select account</option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleCreateEntries}
              disabled={importing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
            >
              {importing ? 'Creating…' : 'Create entries'}
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-600 w-8"></th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Description</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 w-24">Reference</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 w-24">Debit</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 w-24">Credit</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 min-w-[200px]">
                    Counter account / Split
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSplit(idx)}
                          className={`text-xs px-2 py-1 rounded ${line.isSplit ? 'bg-violet-200 text-violet-800' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                          title={line.isSplit ? 'Use single account' : 'Split into multiple expense heads'}
                        >
                          {line.isSplit ? 'Single' : 'Split'}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={line.date}
                          onChange={(e) => updateLine(idx, 'date', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm min-w-[200px]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={line.reference}
                          onChange={(e) => updateLine(idx, 'reference', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {line.debit > 0 ? formatAmount(line.debit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {line.credit > 0 ? formatAmount(line.credit) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {line.isSplit ? (
                          <div className="space-y-2">
                            {line.splits.map((split, si) => (
                              <div key={si} className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={split.amount || ''}
                                  onChange={(e) =>
                                    updateSplitRow(idx, si, 'amount', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 px-2 py-1 border border-slate-200 rounded text-sm"
                                  placeholder="Amount"
                                />
                                <select
                                  value={split.account_id ?? ''}
                                  onChange={(e) =>
                                    updateSplitRow(
                                      idx,
                                      si,
                                      'account_id',
                                      e.target.value ? Number(e.target.value) : null
                                    )
                                  }
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                >
                                  <option value="">Expense head</option>
                                  {splitAccountOptions.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => removeSplitRow(idx, si)}
                                  className="text-red-600 hover:text-red-800 p-1 text-sm"
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addSplitRow(idx)}
                              className="text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              + Add expense head
                            </button>
                            <div className="text-xs text-slate-500">
                              Total: {formatAmount(line.splits.reduce((s, r) => s + r.amount, 0))} / {formatAmount(line.debit || line.credit)}
                            </div>
                          </div>
                        ) : (
                          <select
                            value={line.counter_account_id ?? ''}
                            onChange={(e) =>
                              updateLine(
                                idx,
                                'counter_account_id',
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                          >
                            <option value="">— Select —</option>
                            {counterAccountOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.category})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && lines.length === 0 && !message && (
        <div className="text-slate-500 py-8 text-center">
          Upload a Bank Al Habib CSV to get started.
        </div>
      )}
    </div>
  );
}
