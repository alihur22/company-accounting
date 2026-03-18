# Deploy to Render

The app is configured for PostgreSQL (required for Render – SQLite doesn't persist).

## 1. Create PostgreSQL database

- Render Dashboard → New → PostgreSQL
- Copy the **Internal Database URL**

## 2. Environment variables

In your web service settings, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string (from step 1) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app URL (e.g. `https://company-accounting-tkdm.onrender.com`) |

## 3. Deploy

- Connect GitHub repo
- Use Docker (render.yaml is configured)
- Migrations run automatically on container startup
- Seed runs to populate currencies

## Local development

Use PostgreSQL (e.g. [Neon](https://neon.tech) free tier) or switch schema to SQLite for local dev.
