# Simple Deployment Guide

## Option 1: Full app on Render (easiest – one deployment)

The Dockerfile includes both frontend and backend. Deploy once and everything works.

1. **Push your code to GitHub** (if not already)
2. Go to [render.com](https://render.com) → Sign up (free)
3. **New** → **Web Service**
4. Connect your GitHub and select the `accounting-tool` repo
5. Render detects `render.yaml` – click **Deploy**
6. Wait ~5 min. Your app will be at `https://company-accounting-xxxx.onrender.com`

No Surge needed – the app serves both the UI and API.

---

## Option 2: Frontend on Surge + Backend elsewhere

**Frontend is already deployed:** https://company-accounting.surge.sh

The frontend expects the API at `https://accounting-api.railway.app/api`. If that URL returns 404:

1. Deploy the backend using Option 1 (Render) or [Railway](https://railway.app)
2. Note your backend URL (e.g. `https://company-accounting-xxx.onrender.com`)
3. Rebuild and redeploy the frontend:

```bash
cd accounting-tool/frontend
VITE_API_URL=https://YOUR-BACKEND-URL/api npm run deploy:surge
```

---

## Redeploy frontend to Surge

```bash
cd accounting-tool/frontend
VITE_API_URL=https://YOUR-BACKEND-URL/api npm run deploy:surge
```

This deploys to **company-accounting.surge.sh**.
