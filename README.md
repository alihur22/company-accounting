# Company Accounting Tool

Simple double-entry accounting and bookkeeping for your company.

## Quick Start

### Backend

```bash
cd accounting-tool
pip install -r backend/requirements.txt
python3 -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

API runs at http://127.0.0.1:8000

### Frontend

```bash
cd accounting-tool/frontend
npm install
npm run dev
```

App runs at http://localhost:5173

### Docker (production build)

```bash
docker-compose up --build
```

App runs at http://localhost:8000

## Features

- **Setup Wizard**: Xero-style guided flow (Bank → Expense heads → Revenue)
- **Chart of Accounts**: Create accounts with category and currency (PKR, USD, AED)
- **Ledger**: Record double-entry transactions, transfers, split expenses
- **Attachments**: Attach invoices, receipts, or evidence to any transaction (PDF, images)
- **Statement Import**: Upload Bank Al Habib CSV, review, split entries, create transactions
- **Filters**: Date range and account filter for transactions

## Deploy Online

- **Full stack (Docker)**: [DEPLOY.md](DEPLOY.md) – Railway, Render, Fly.io
- **Frontend on Surge**: [SURGE_DEPLOY.md](SURGE_DEPLOY.md) – static frontend on Surge; backend on Railway/Render
