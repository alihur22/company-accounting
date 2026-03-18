# Company Accounting

SaaS-style accounting application built with Next.js 14, Prisma, and PostgreSQL.

## Features

- **Authentication**: Register, login, session management
- **Company profile**: Business details, financial year, base currency
- **Chart of Accounts**: CRUD with 5 root types (Asset, Liability, Equity, Revenue, Expense), sub-accounts, unique codes
- **Multi-currency**: Currencies with exchange rates (ExchangeRate-API)
- **Dark/Light theme**: Toggle with persistent preference
- **Responsive layout**: Collapsible sidebar, searchable dropdowns

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL (or use [Neon](https://neon.tech) free tier for local dev)

### Local development

1. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` – PostgreSQL connection string
   - `NEXTAUTH_SECRET` – run `openssl rand -base64 32`
   - `NEXTAUTH_URL` – `http://localhost:3000`

2. Create database and run migrations:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

3. Start the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and register a new account.

### Deploy to Railway

See [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md) for step-by-step instructions. Add a Postgres database, set `DATABASE_URL` (via Variable Reference), `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.

### Deploy to Render

1. Push to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Connect your repo, select Docker
4. Add a PostgreSQL database (Render provides one)
5. Set environment variables:
   - `DATABASE_URL` – from your Render Postgres
   - `NEXTAUTH_SECRET` – generate a random string
   - `NEXTAUTH_URL` – your Render app URL (e.g. https://company-accounting-xxx.onrender.com)
6. Deploy. Run `prisma db push` manually once (or add to build) to create tables.
