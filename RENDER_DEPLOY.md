# Deploy to Render

## Prerequisites

1. **PostgreSQL database** – Render's free tier doesn't persist SQLite. Add a PostgreSQL database in Render:
   - Dashboard → New → PostgreSQL
   - Copy the **Internal Database URL**.

2. **Environment variables** – In your web service settings, add:
   - `DATABASE_URL` – Your PostgreSQL connection string (from step 1)
   - `NEXTAUTH_SECRET` – Generate a random string (e.g. `openssl rand -base64 32`)
   - `NEXTAUTH_URL` – Your app URL (e.g. `https://your-app.onrender.com`)

## Steps

1. Connect your GitHub repo: https://github.com/alihur22/company-accounting
2. Create a **Web Service** from the repo
3. **Build command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
4. **Start command:** `npm start`
5. Add the environment variables above
6. Deploy

## Database migration

Before first deploy, the app uses SQLite locally. For Render you need PostgreSQL:

1. In Render, create a PostgreSQL database first
2. Set `DATABASE_URL` to the PostgreSQL URL
3. Update `prisma/schema.prisma` to use `postgresql` instead of `sqlite` when `DATABASE_URL` contains `postgres`
4. Or create a separate `schema.prisma` for production - the simplest approach is to change the datasource provider to `postgresql` and add a migration

**Quick fix:** Change `prisma/schema.prisma` line 6 from `provider = "sqlite"` to `provider = "postgresql"` before deploying, then run `npx prisma migrate dev --name init` locally to create migrations, commit and push.
