import { useEffect, useState } from 'react';
import {
  listAccounts,
  createAccount,
  seedExpenseHeads,
  type Account,
  type AccountCreate,
} from '../api';

type Step = 1 | 2 | 3;

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState<AccountCreate>({
    name: '',
    category: 'cash',
    currency: 'PKR',
  });

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const accs = await listAccounts();
      setAccounts(accs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const bankAccounts = accounts.filter((a) =>
    ['cash', 'current'].includes(a.category)
  );
  const expenseAccounts = accounts.filter((a) => a.category === 'expense');
  const revenueAccounts = accounts.filter((a) => a.category === 'revenue');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    try {
      await createAccount(form);
      setForm({ name: '', category: form.category, currency: form.currency });
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    }
  };

  const handleSeedExpenseHeads = async () => {
    setSeeding(true);
    setError(null);
    try {
      await seedExpenseHeads();
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add expense heads');
    } finally {
      setSeeding(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    1: 'Bank & Cash',
    2: 'Expense Heads',
    3: 'Revenue',
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Setup</h1>
        <p className="text-slate-600 mt-1">
          Set up your accounts in order, like Xero. Add bank accounts first, then expense heads, then
          revenue.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {([1, 2, 3] as Step[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              step === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {s}. {stepLabels[s]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <>
          {step === 1 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h2 className="text-lg font-medium text-slate-800 mb-2">Bank & Cash Accounts</h2>
              <p className="text-sm text-slate-600 mb-4">
                Where your money sits. Add Current Account, Cash in Hand, etc.
              </p>
              {bankAccounts.length > 0 && (
                <ul className="mb-4 space-y-1">
                  {bankAccounts.map((a) => (
                    <li key={a.id} className="text-slate-700">
                      {a.name} ({a.currency})
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleCreateAccount} className="space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Current Account, Cash in Hand"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
                <div className="flex gap-4">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="cash">Cash Account</option>
                    <option value="current">Current Account</option>
                  </select>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Add
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h2 className="text-lg font-medium text-slate-800 mb-2">Expense Heads</h2>
              <p className="text-sm text-slate-600 mb-4">
                Where money goes for expenses. Add Rent, Utilities, Payroll, etc.
              </p>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleSeedExpenseHeads}
                  disabled={seeding}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {seeding ? 'Adding…' : 'Add common expense heads'}
                </button>
                <span className="ml-2 text-xs text-slate-500">
                  (Rent, Utilities, Payroll, Office Supplies, Marketing, Insurance, Travel,
                  Miscellaneous)
                </span>
              </div>
              {expenseAccounts.length > 0 && (
                <ul className="mb-4 space-y-1">
                  {expenseAccounts.map((a) => (
                    <li key={a.id} className="text-slate-700">
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!form.name.trim()) return;
                  setError(null);
                  try {
                    await createAccount({ ...form, category: 'expense' });
                    setForm((f) => ({ ...f, name: '' }));
                    await loadAccounts();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to create');
                  }
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rent, Utilities"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Add expense head
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h2 className="text-lg font-medium text-slate-800 mb-2">Revenue Account</h2>
              <p className="text-sm text-slate-600 mb-4">
                Where income is recorded. Add Company Revenue or similar.
              </p>
              {revenueAccounts.length > 0 && (
                <ul className="mb-4 space-y-1">
                  {revenueAccounts.map((a) => (
                    <li key={a.id} className="text-slate-700">
                      {a.name} ({a.currency})
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!form.name.trim()) return;
                  setError(null);
                  try {
                    await createAccount({ ...form, category: 'revenue' });
                    setForm((f) => ({ ...f, name: '' }));
                    await loadAccounts();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to create');
                  }
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Company Revenue"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                  <option value="AED">AED</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Add revenue account
                </button>
              </form>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => (s > 1 ? (s - 1) as Step : 1))}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Done — Go to Ledger
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
