# Deploy to Surge

Surge hosts **static files only**. Your app has a backend (FastAPI), so you need to deploy both:

1. **Backend** → Railway, Render, or Fly.io (see [DEPLOY.md](DEPLOY.md))
2. **Frontend** → Surge

## Step 1: Deploy the backend

Deploy the backend first and note the URL (e.g. `https://your-app.railway.app`).

Example with Railway:
- New project → Deploy from GitHub
- Add PostgreSQL (optional) or use SQLite
- Deploy the Dockerfile from this repo
- Copy the public URL

## Step 2: Build the frontend with the backend URL

```bash
cd frontend
VITE_API_URL=https://your-backend-url.railway.app/api npm run build:surge
```

Replace `https://your-backend-url.railway.app` with your actual backend URL. Include `/api` at the end (e.g. `https://your-app.railway.app/api`).

## Step 3: Deploy to Surge

```bash
cd frontend
npx surge dist
```

No global install needed – `npx` runs Surge on demand. On first run, Surge will prompt for login.

On first run, Surge will ask for:
- Email (create a free account)
- Password
- Project path: `dist` (or `./dist`)
- Domain: e.g. `my-accounting.surge.sh`

## Step 4: Enable CORS on the backend

Your backend must allow requests from your Surge domain. In `backend/main.py`, the CORS middleware currently has `allow_origins=["*"]`, so all origins are allowed. If you restrict this later, add your Surge URL (e.g. `https://my-accounting.surge.sh`).

## One-liner (after backend is deployed)

```bash
cd frontend
VITE_API_URL=https://YOUR_BACKEND_URL/api npm run build:surge && npx surge dist
```

## Custom domain

After deploying, run `surge` again and enter your custom domain when prompted. Surge provides free SSL.
