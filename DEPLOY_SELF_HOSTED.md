# Deploy to Your Own Server (Devrims, DigitalOcean, etc.)

This guide covers deploying the accounting app on a VPS/cloud server with your own domain (e.g. Devrims, DigitalOcean, Linode, AWS EC2).

## Prerequisites

- A server with Ubuntu 22.04 (or similar)
- SSH access
- A domain pointed to your server's IP (A record)
- At least 1 GB RAM, 2 GB recommended

---

## Option A: Docker (Recommended)

### 1. Install Docker on the server

```bash
# SSH into your server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### 2. Install Docker Compose

```bash
apt install docker-compose-plugin -y
```

### 3. Create a PostgreSQL database

**Option A – Same server (Docker):**

The project includes `docker-compose.yml`. Create a `.env` file:

```env
POSTGRES_PASSWORD=your-secure-password
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-from-openssl-rand-base64-32
```

Then run `docker compose up -d`.

**Option B – Managed PostgreSQL (Neon, Supabase, Render):**  
Use their connection string as `DATABASE_URL` and run only the app container (skip the `db` service in docker-compose).

### 4. Clone and deploy

```bash
cd /opt  # or your preferred directory
git clone https://github.com/alihur22/company-accounting.git
cd company-accounting
```

Create `.env` (or set env vars in docker-compose):

```
DATABASE_URL=postgresql://accounting:your-password@db:5432/accounting
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-from-openssl-rand-base64-32
```

```bash
docker compose up -d
```

### 5. Nginx reverse proxy + SSL

```bash
apt install nginx certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com
```

Nginx config (`/etc/nginx/sites-available/accounting`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/accounting /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Option B: PM2 + Node.js (no Docker)

### 1. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 2. Install PostgreSQL

```bash
apt install postgresql postgresql-contrib -y
sudo -u postgres createuser -s accounting
sudo -u postgres createdb accounting
sudo -u postgres psql -c "ALTER USER accounting WITH PASSWORD 'your-password';"
```

### 3. Install PM2

```bash
npm install -g pm2
```

### 4. Clone and build

```bash
cd /opt
git clone https://github.com/alihur22/company-accounting.git
cd company-accounting
```

Create `.env`:

```
DATABASE_URL=postgresql://accounting:your-password@localhost:5432/accounting
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret
```

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run build
```

### 5. Run with PM2

```bash
pm2 start npm --name "accounting" -- start
pm2 save
pm2 startup  # Enable on reboot
```

### 6. Nginx + SSL (same as Option A step 5)

---

## Devrims-specific notes

1. **Create a server** – Choose a plan (e.g. G-S: 1 vCPU, 2 GB RAM).
2. **SSH access** – Use the SSH/SFTP credentials from the Devrims dashboard.
3. **Database** – Create a PostgreSQL database in the dashboard, or install it on the server.
4. **Domain** – Add your domain and point it to the server IP.
5. **SSL** – Use the one-click Let's Encrypt SSL in the dashboard.
6. **Firewall** – Ensure ports 80 and 443 are open.

---

## Updating the app

```bash
cd /opt/company-accounting
git pull
# If using Docker:
docker compose build --no-cache && docker compose up -d

# If using PM2:
npm ci
npx prisma migrate deploy
npm run build
pm2 restart accounting
```

---

## Environment variables summary

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Full app URL (e.g. https://yourdomain.com) |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `EXCHANGE_RATE_API_KEY` | Optional, for exchange rate sync |
