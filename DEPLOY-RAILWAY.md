# Deploy to Railway

## Prerequisites

1. [Railway account](https://railway.app)
2. GitHub repo pushed and ready

## Steps

### 1. Create a new project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Select your `company-accounting` (or `accounting-tool`) repository
4. Railway will detect the Dockerfile and build from it

### 2. Add PostgreSQL database

1. In your project, click **+ New**
2. Select **Database** → **PostgreSQL**
3. Railway creates a Postgres instance and exposes `DATABASE_URL`

### 3. Link database to your app

1. Click on your **web service** (the app, not the database)
2. Go to **Variables** tab
3. Click **+ New Variable** → **Add Variable Reference**
4. Select your Postgres service and choose **DATABASE_URL**
   - This adds `DATABASE_URL` from the database to your app
5. Or manually add: **Variable** = `DATABASE_URL`, **Value** = (copy from Postgres service → Connect → `DATABASE_URL`)

### 4. Add required environment variables

In your app service **Variables**, add:

| Variable           | Value                                                                 |
|--------------------|-----------------------------------------------------------------------|
| `NEXTAUTH_SECRET`  | Run `openssl rand -base64 32` locally and paste the output            |
| `NEXTAUTH_URL`     | `https://<your-app-name>.up.railway.app` (Railway shows this in Settings → Domains) |

### 5. Set the public domain (optional)

1. Go to your app service → **Settings** → **Networking**
2. Click **Generate Domain** to get a public URL like `your-app.up.railway.app`
3. Use this URL for `NEXTAUTH_URL`

### 6. Deploy

Railway deploys automatically when you push to GitHub. For the first deploy:

1. Ensure all variables are set (especially `DATABASE_URL`)
2. Trigger a redeploy: **Deployments** → **Redeploy** (or push a new commit)

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Environment variable not found: DATABASE_URL` | Add Postgres, then add `DATABASE_URL` via Variable Reference in your app |
| `Prisma failed to detect libssl/openssl` | Ensure Railway is using your Dockerfile (it should auto-detect). Check build logs for "Using detected Dockerfile!" |
| App crashes on startup | Verify `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are all set |
| 502 Bad Gateway | App may be binding to wrong host. The Dockerfile sets `HOSTNAME=0.0.0.0` which is correct |

## Useful links

- [Railway Docs](https://docs.railway.app)
- [Railway + PostgreSQL](https://docs.railway.app/databases/postgresql)
