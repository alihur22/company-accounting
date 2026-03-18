# Deploy to Fly.io

## Prerequisites

1. **Install flyctl**: https://fly.io/docs/hands-on/install-flyctl/
   ```bash
   brew install flyctl   # macOS
   ```

2. **Sign in**:
   ```bash
   fly auth login
   ```

## One-time setup

### 1. Create a PostgreSQL database

```bash
fly postgres create
```

- Choose a name (e.g. `company-accounting-db`)
- Select **Development** for a single-node setup (free tier)
- Pick a region (e.g. `iad` for Virginia)
- When prompted to attach to an app, say **No** for now (we'll attach after creating the app)

### 2. Create the app and attach the database

```bash
cd accounting-tool
fly launch --no-deploy
```

- When asked "Would you like to copy its configuration to an existing app?", choose **No**
- When asked to create a new app, choose **Yes**
- Pick an app name (e.g. `company-accounting`) or use the suggested one
- When asked to attach a Postgres database, choose **Yes** and select the one you created
- This will set the `DATABASE_URL` secret automatically

### 3. Set required secrets

```bash
# Generate a secret for NextAuth (run locally, copy the output)
openssl rand -base64 32

# Set secrets
fly secrets set NEXTAUTH_SECRET="<paste-the-generated-secret>"
fly secrets set NEXTAUTH_URL="https://<your-app-name>.fly.dev"
```

Replace `<your-app-name>` with your actual app name (e.g. `company-accounting`).

## Deploy

```bash
fly deploy
```

Your app will be live at `https://<your-app-name>.fly.dev`.

## Useful commands

| Command | Description |
|---------|-------------|
| `fly deploy` | Deploy the app |
| `fly logs` | View live logs |
| `fly status` | Check app status |
| `fly open` | Open app in browser |
| `fly ssh console` | SSH into the running container |
| `fly postgres connect -a <db-app-name>` | Connect to Postgres |

## Troubleshooting

- **Build fails**: Check `fly logs` during deploy
- **Migrations fail**: Ensure `DATABASE_URL` is set (`fly secrets list`)
- **App won't start**: Run `fly logs` to see startup errors
- **Database connection**: Verify the Postgres app is running (`fly status -a <db-app-name>`)
