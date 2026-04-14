# VPS Deployment Design — OVH d2-4

## Overview
Deploy OpAuto (Angular frontend + NestJS backend + PostgreSQL) on an OVH d2-4 VPS (4GB RAM, 2 vCores) using Docker Compose, with GitHub webhook auto-deploy on push to main.

## Architecture

```
[GitHub] --push--> [Webhook on VPS :9000] ---> pulls + rebuilds containers
                         |
              [Docker Compose on VPS]
              ┌─────────────────────┐
              │  Nginx (port 80/443)│ ← serves Angular static + reverse proxy /api
              │  NestJS (port 3000) │ ← backend API
              │  PostgreSQL (5432)  │ ← database (Docker volume)
              └─────────────────────┘
```

## VPS Setup (from scratch)

### SSH Access
1. OVH provisions VPS with root password via email
2. SSH in as root, create deploy user with sudo
3. Add SSH key for passwordless access
4. Disable root login + password auth

### Prerequisites installed via setup script
- Docker + Docker Compose
- Git
- webhook (adnanh/webhook) for GitHub auto-deploy
- UFW firewall (allow 22, 80, 443, 9000)

## Docker Compose Stack

### Services
1. **nginx** — Alpine-based, serves Angular `dist/` as static files, proxies `/api` to backend
2. **backend** — Node 20 Alpine, runs NestJS in production mode
3. **db** — PostgreSQL 16 Alpine, data persisted in Docker volume

### Volumes
- `pg_data` — PostgreSQL data (survives container restarts)
- Angular dist is built on the VPS and mounted into nginx

### Environment
- `.env` file on VPS with: `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY` (if AI features needed)
- Not committed to git

## Deploy Flow

### Initial Setup (one-time)
1. Clone repo on VPS
2. Create `.env` with production values
3. `docker compose up -d` — starts all 3 services
4. `docker compose exec backend npx prisma migrate deploy` — run migrations
5. `docker compose exec backend npx prisma db seed` — seed initial data

### Auto-Deploy (on every push to main)
1. GitHub webhook sends POST to `http://VPS_IP:9000/hooks/deploy`
2. Webhook handler runs `deploy.sh`:
   - `git pull origin main`
   - `docker compose build --no-cache backend`
   - `cd frontend && npm ci && npm run build` (builds Angular on VPS)
   - `docker compose up -d` (restarts changed containers)
   - `docker compose exec backend npx prisma migrate deploy` (apply new migrations)

### Why build Angular on VPS (not in Docker)?
- Angular build is memory-intensive (~1.5GB)
- Building in Docker doubles memory usage (build layer + runtime)
- Building on host and mounting dist into nginx keeps memory low

## Files to Create

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines all 3 services |
| `opauto-backend/Dockerfile` | Backend production image |
| `deploy/nginx.conf` | Nginx config (static + reverse proxy) |
| `deploy/deploy.sh` | Auto-deploy script (git pull + build + restart) |
| `deploy/hooks.json` | Webhook configuration |
| `deploy/setup-vps.sh` | One-time VPS setup script |
| `docs/DEPLOYMENT.md` | Step-by-step deployment guide |

## Security
- UFW firewall: only 22, 80, 443, 9000 open
- PostgreSQL not exposed externally (Docker internal network only)
- SSH key-only auth, no root login
- Webhook uses a secret token to verify GitHub payloads
- `.env` file with 600 permissions, owned by deploy user

## Resource Budget (d2-4: 4GB RAM)
- PostgreSQL: ~200MB
- NestJS (Node): ~150MB
- Nginx: ~20MB
- OS + buffers: ~500MB
- Angular build (temporary): ~1.5GB
- **Available after build**: ~3.1GB idle, plenty of headroom
