import { useEffect, useState } from 'react';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountCategories,
  getCurrencies,
  seedExpenseHeads,
  type Account,
  type AccountCreate,
} from '../api';

const CATEGORY_LABELS: Record<string, string> = {
  cash: 'Cash Account',
  current: 'Current Account',
  investment: 'Investment Account',
  real_estate: 'Real Estate',
  fixed_asset: 'Company Assets',
  revenue: 'Revenue',
  expense: 'Expense',
};

// Setup phase order (like Xero): Bank & Cash, Expense Heads, Revenue, Other
const SETUP_PHASE_ORDER = [
  { phase: 'Bank & Cash', categories: ['cash', 'current'] },
  { phase: 'Expense Heads', categories: ['expense'] },
  { phase: 'Revenue', categories: ['revenue'] },
  { phase: 'Other', categories: ['investment', 'real_estate', 'fixed_asset'] },
];

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AccountCreate>({
    name: '',
    category: 'cash',
    currency: 'PKR',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, cats, currs] = await Promise.all([
        listAccounts(),
        getAccountCategories(),
        getCurrencies(),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setCurrencies(currs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({ name: '', category: 'cash', currency: 'PKR' });
    setEditingId(null);
    setFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    try {
      if (editingId) {
        await updateAccount(editingId, form);
      } else {
        await createAccount(form);
      }
      resetForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleEdit = (a: Account) => {
    setForm({ name: a.name, category: a.category, currency: a.currency });
    setEditingId(a.id);
    setFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return;
    setError(null);
    try {
      await deleteAccount(id);
      await loadData();
      if (editingId === id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const accountsByCategory = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  const handleSeedExpenseHeads = async () => {
    setSeeding(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await seedExpenseHeads();
      await loadData();
      if (result.created > 0) {
        setSuccessMessage(`Added ${result.created} expense head(s).`);
      } else {
        setSuccessMessage('All common expense heads already exist.');
      }
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add expense heads');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-slate-800">Chart of Accounts</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSeedExpenseHeads}
            disabled={seeding}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
          >
            {seeding ? 'Adding…' : 'Add common expense heads'}
          </button>
          <button
          type="button"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            + Create Account
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"
        >
          <h2 className="text-lg font-medium text-slate-800 mb-4">
            {editingId ? 'Edit Account' : 'Create Account'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Cash in Hand, Alfalah Investments"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              {editingId ? 'Save' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-slate-500">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="text-slate-500 py-8 text-center">
          No accounts yet. Click &quot;Create Account&quot; to add your first account.
        </div>
      ) : (
        <div className="space-y-6">
          {SETUP_PHASE_ORDER.map(({ phase, categories }) => {
            const list = categories.flatMap((cat) => accountsByCategory[cat] ?? []);
            if (list.length === 0) return null;
            return (
              <div key={phase} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 font-medium text-slate-700">
                  {phase}
                </div>
                <ul className="divide-y divide-slate-200">
                  {list.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                    >
                      <div>
                        <span className="font-medium text-slate-800">{a.name}</span>
                        <span className="ml-2 text-sm text-slate-500">{a.currency}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(a)}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
