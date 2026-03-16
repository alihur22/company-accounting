# Deploying Company Accounting Tool

## Quick Deploy (Docker)

```bash
docker-compose up --build
```

App runs at http://localhost:8000

## Deploy to Cloud

### Railway

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub (or upload)
3. Add environment variables:
   - `DATABASE_URL` – Railway provides PostgreSQL; use the connection string from "Add PostgreSQL" plugin
   - `UPLOAD_DIR` – `/app/uploads` (ephemeral; for persistent storage add Redis/S3 later)
   - `STATIC_DIR` – `/app/static`
4. Build: Dockerfile in repo root
5. Deploy

### Render

1. Create account at [render.com](https://render.com)
2. New → Web Service → Connect repo
3. Build: Docker
4. Add PostgreSQL database (optional; or use SQLite on ephemeral disk)
5. Environment: `STATIC_DIR=/app/static`, `UPLOAD_DIR=/app/uploads`

### Fly.io

```bash
fly launch
fly postgres create   # if using PostgreSQL
fly secrets set DATABASE_URL=postgresql://...
fly deploy
```

## Production Notes

- **Database**: Use PostgreSQL for production. SQLite works for small deployments but doesn't scale.
- **Attachments**: On ephemeral platforms (Railway, Render free tier), uploads are lost on restart. For persistence, add S3 or similar storage.
- **HTTPS**: Most platforms provide automatic HTTPS.
- **CORS**: Configure `allow_origins` in `main.py` for your domain in production.
