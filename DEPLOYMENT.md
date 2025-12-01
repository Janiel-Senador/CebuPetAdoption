# Cebu Animal Adoption — Deployment Guide

## Prerequisites
- A domain (optional but recommended)
- A cloud VM (Ubuntu 22.04+ recommended) or any server with public IP
- Docker and Docker Compose installed

## 1) Install Docker
```
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 2) Copy the project to the server
- `git clone` or upload the project folder to the server
- `cd adoption`

## 3) Start the stack
```
docker compose up --build -d
```

## 4) Open firewall
```
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # for TLS later
sudo ufw enable
sudo ufw status
```

## 5) Verify services
- Web: `http://<YOUR_SERVER_IP>/`
- API health: `http://<YOUR_SERVER_IP>/api/health`

## 6) Domain and DNS (optional)
- Point your domain `A` record to `<YOUR_SERVER_IP>`
- After DNS propagation, use `http://yourdomain/`

## 7) Enable HTTPS (optional)
The simplest approach is to terminate TLS at the host using Certbot and proxy to the container.

1. Install Nginx on host:
```
sudo apt-get install -y nginx
```
2. Create a host Nginx server block that proxies to the containerized Nginx on port 80:
```
sudo tee /etc/nginx/sites-available/adoption <<'CONF'
server {
  listen 80;
  server_name yourdomain;
  location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
CONF
sudo ln -s /etc/nginx/sites-available/adoption /etc/nginx/sites-enabled/adoption
sudo nginx -t && sudo systemctl reload nginx
```
3. Issue a certificate:
```
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain
```

## Data persistence
- SQLite DB file is stored in Docker volume `dbdata` mounted at `/data/data.db` inside the API container.
- Back up with: `docker run --rm -v adoption_dbdata:/data -v $(pwd):/backup busybox cp /data/data.db /backup/data.db`

## Configuration
- API base in frontend auto-detects:
  - Dev: `http://127.0.0.1:5000`
  - Deployed (nginx): `/api`
- Change ports by editing `docker-compose.yml`

## Free database options (PostgreSQL)
You can use a free managed Postgres and point the API to it via `DATABASE_URL`.

### Neon (free serverless Postgres)
1. Sign up at neon.tech and create a new project.
2. Get the connection string (Postgres URI). Example:
   `postgresql+psycopg2://user:password@host:5432/dbname`
3. Set the compose variable before starting:
```
export DATABASE_URL="postgresql+psycopg2://user:password@host:5432/dbname"
docker compose up --build -d
```
This replaces local SQLite with Neon; data persists on Neon.

Windows (PowerShell):
```
setx DATABASE_URL "postgresql+psycopg2://user:password@host:5432/dbname?sslmode=require"
# Restart your shell, then:
docker compose up --build -d
```

Tip: If your Neon URL includes `channel_binding=require` and the driver fails to connect,
set `channel_binding=disable` or omit it; `sslmode=require` is sufficient for most setups.

### Supabase (free Postgres)
1. Create a project on supabase.com
2. Get the `postgres` connection string (Project Settings → Database).
3. Use it as `DATABASE_URL` like above.

Alternatively, copy `.env.example` to `.env`, set `DATABASE_URL`, and run:
```
docker compose up --build -d
```

## Railway + Vercel (recommended free-friendly)
### Backend on Railway
Use Vercel Postgres for simplest setup.
1. In Vercel dashboard, add the “Vercel Postgres” integration to your project.
2. Vercel will provision a database and inject env vars including `POSTGRES_PRISMA_URL`.
3. Prisma datasource is configured to read `POSTGRES_PRISMA_URL` (see `prisma/schema.prisma`).

### Frontend on Vercel
1. Import this repo to Vercel.
2. Deploy; `/api/*` serverless functions connect via Prisma. The build runs `prisma generate` and `prisma db push`.
3. Validate connectivity with `GET /api/health`.

### Alternative: Client-side API base
If you prefer not to edit `vercel.json`, click the `API` button in the header of the site and paste your Railway API base. It will be validated and saved locally.

### MongoDB Atlas (alternative)
If you prefer MongoDB, you can deploy the API to use MongoDB. Contact to switch the backend to MongoDB driver.

## Operations
- Restart: `docker compose restart`
- Logs: `docker compose logs -f`
- Update: `git pull && docker compose up --build -d`

## Security notes
- Keep API unexposed publicly (already configured). Access via `/api` proxy.
- Add auth if you need private dashboards or admin functions.

