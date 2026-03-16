import { useState } from 'react'
import ChartOfAccounts from './components/ChartOfAccounts'
import Ledger from './components/Ledger'
import SetupWizard from './components/SetupWizard'

type Tab = 'setup' | 'accounts' | 'ledger'

function App() {
  const [tab, setTab] = useState<Tab>('setup')

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 py-4">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-xl font-semibold text-slate-800">Company Accounting</h1>
          <nav className="flex gap-4 mt-3">
            <button
              type="button"
              onClick={() => setTab('setup')}
              className={`text-sm font-medium ${
                tab === 'setup' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Setup
            </button>
            <button
              type="button"
              onClick={() => setTab('accounts')}
              className={`text-sm font-medium ${
                tab === 'accounts' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Chart of Accounts
            </button>
            <button
              type="button"
              onClick={() => setTab('ledger')}
              className={`text-sm font-medium ${
                tab === 'ledger' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ledger
            </button>
          </nav>
        </div>
      </header>
      <main>
        {tab === 'setup' && <SetupWizard onComplete={() => setTab('ledger')} />}
        {tab === 'accounts' && <ChartOfAccounts />}
        {tab === 'ledger' && <Ledger onGoToChartOfAccounts={() => setTab('accounts')} />}
      </main>
    </div>
  );
}

export default App
