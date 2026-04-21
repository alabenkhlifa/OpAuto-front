# OpAuto Deployment Runbook

Command-first operational guide for the OVH production box. Design context
lives in `docs/superpowers/specs/2026-04-14-vps-deployment-design.md`; this
file is the day-to-day reality.

**If something's on fire, read the "Recovery" section at the bottom first.**

---

## Environment

| Thing | Value |
|---|---|
| Public URL | http://152.228.229.150/ (no TLS yet) |
| SSH target | `almalinux@152.228.229.150` |
| OS | AlmaLinux |
| Repo path on VPS | `/opt/opauto` |
| App stack | Docker Compose — `opauto-db`, `opauto-backend`, `opauto-nginx` |
| Webhook | `http://152.228.229.150:9000/hooks/deploy` (systemd unit `webhook.service`) |
| Deploy script on box | `/opt/opauto/deploy/deploy.sh` |
| Deploy log | `/var/log/opauto-deploy.log` |
| `.env` on box | `/opt/opauto/.env` (chmod 600, owned by `almalinux`) |
| Uploads volume | Docker named volume `opauto_uploads` (mounted at `/app/uploads` in backend) |
| DB volume | Docker named volume `opauto_pg_data` |

Login as the seeded owner: `owner@autotech.tn / password123`.

---

## Normal deploy (auto)

1. Push to `main` on GitHub
2. GitHub webhook POSTs to `:9000/hooks/deploy`
3. `deploy.sh` runs: `git reset --hard origin/main` → Angular build on host →
   `docker compose build backend` → `docker compose up -d` → wait for backend
   healthcheck → `docker compose restart nginx`
4. On first-ever deploy, `deploy.sh` also runs `prisma db seed` and touches
   `/opt/opauto/.seeded` so subsequent deploys skip seeding

**GitHub's "delivery succeeded" 200 means nothing** — `adnanh/webhook` replies
200 the moment it accepts. Always verify via the smoke test below.

### Verify a deploy actually worked

```bash
# All three must look right
curl -sI http://152.228.229.150/ | head -1                 # 200 OK
curl -s -o /dev/null -w 'login=%{http_code}\n' \
  -X POST http://152.228.229.150/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@autotech.tn","password":"password123"}'   # 201
curl -s -o /dev/null -w 'prefs=%{http_code}\n' \
  http://152.228.229.150/api/users/me/preferences            # 401 (guard works, route exists)
```

If the frontend title is `OpAuto - Garage Management System` and login returns
201, deploy worked. If you see `403 Forbidden` from nginx, jump to
**Recovery → Frontend blank / 403**.

---

## Manual deploy

Use when the webhook's log shows success but the app doesn't reflect your
push, or when you need to apply something not in a git commit (env change,
etc.).

```bash
ssh almalinux@152.228.229.150
cd /opt/opauto
./deploy/deploy.sh                    # same script the webhook runs
tail -f /var/log/opauto-deploy.log    # in another shell
```

To skip the Angular rebuild (backend-only change):

```bash
cd /opt/opauto
git fetch origin main && git reset --hard origin/main
docker compose build backend
docker compose up -d                  # only recreates changed containers
```

---

## First-time VPS setup

Only do this on a fresh OVH VPS. Takes ~10 minutes.

```bash
# 1. SSH as root (from OVH email), create almalinux + add your key
adduser almalinux
usermod -aG wheel almalinux
mkdir -p /home/almalinux/.ssh && chmod 700 /home/almalinux/.ssh
# paste your public key:
echo "ssh-ed25519 AAAA...your-key..." > /home/almalinux/.ssh/authorized_keys
chmod 600 /home/almalinux/.ssh/authorized_keys
chown -R almalinux:almalinux /home/almalinux/.ssh
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

# 2. From now on, SSH as almalinux
# (reconnect)

# 3. Install Docker + git + webhook
sudo dnf install -y dnf-plugins-core git
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker almalinux   # log out + back in for group to take effect
curl -sL https://github.com/adnanh/webhook/releases/download/2.8.1/webhook-linux-amd64.tar.gz \
  | sudo tar -xz -C /usr/local/bin --strip-components=1 webhook-linux-amd64/webhook

# 4. Clone repo + create .env
sudo mkdir -p /opt/opauto && sudo chown almalinux:almalinux /opt/opauto
git clone https://github.com/alabenkhlifa/OpAuto-front.git /opt/opauto
cd /opt/opauto
cat > .env <<EOF
DB_USER=opauto
DB_PASSWORD=<strong-random-password>
DB_NAME=opauto
JWT_SECRET=<64-char-random-string>
# Leave LLM keys blank to fall back to mock/template responses
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
CORS_ORIGIN=*
WEBHOOK_SECRET=<github-webhook-secret>
EOF
chmod 600 .env

# 5. Patch webhook secret placeholder in deploy/hooks.json with your WEBHOOK_SECRET
sed -i "s/WEBHOOK_SECRET_CHANGE_ME/$(grep ^WEBHOOK_SECRET= .env | cut -d= -f2)/" deploy/hooks.json

# 6. systemd unit for the webhook
sudo tee /etc/systemd/system/webhook.service >/dev/null <<'EOF'
[Unit]
Description=GitHub Webhook for OpAuto auto-deploy
After=network.target

[Service]
Type=simple
User=almalinux
WorkingDirectory=/opt/opauto
ExecStart=/usr/local/bin/webhook -hooks /opt/opauto/deploy/hooks.json -port 9000 -verbose
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now webhook

# 7. Firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload

# 8. First deploy (runs migrations AND seeds because .seeded isn't present)
/opt/opauto/deploy/deploy.sh

# 9. Add the webhook in GitHub repo settings →
#    URL: http://<vps-ip>:9000/hooks/deploy  Content-type: application/json
#    Secret: <WEBHOOK_SECRET from step 4>     Events: push
```

---

## Database operations

### Take a backup (do this before every risky op)

```bash
ssh almalinux@152.228.229.150
docker exec opauto-db pg_dump -U opauto opauto > ~/backup-$(date +%Y%m%d-%H%M).sql
# Copy it off-box if the backup matters:
#   scp almalinux@152.228.229.150:~/backup-*.sql ./
```

### Apply a new migration

Already handled automatically — every backend container start runs
`prisma migrate deploy` before booting (Dockerfile CMD). Nothing to do on push.

### Baseline a fresh/non-empty DB (first time only)

If `docker logs opauto-backend` shows `P3005 The database schema is not empty`
or `_prisma_migrations` is empty despite tables existing, the DB was created
via `db push` and needs a one-time baseline:

```bash
cd /opt/opauto
# Mark ONLY the init migration as already-applied:
docker compose run --rm --entrypoint sh backend -c \
  "npx prisma migrate resolve --applied 20260421000000_init"
# Let deploy apply any post-init migrations (preferences, photos, …):
docker compose run --rm --entrypoint sh backend -c "npx prisma migrate deploy"
```

**Do NOT blanket-baseline all migrations as applied** — that's the trap from
2026-04-21. Only baseline what's already in the DB; let `migrate deploy` run
the rest.

### Roll back a bad migration

```bash
# 1. Restore last backup (see above) — this wipes current state
docker exec -i opauto-db psql -U opauto -d opauto < ~/backup-YYYYMMDD-HHMM.sql
# 2. Tell Prisma the migration is rolled back so it gets re-attempted on next deploy
docker compose run --rm --entrypoint sh backend -c \
  "npx prisma migrate resolve --rolled-back <migration_name>"
# 3. Push the fixed migration to main → auto-deploy applies it cleanly
```

### Reseed (DESTRUCTIVE — wipes all data)

The seeder does `deleteMany()` across every table before inserting demo data.
**Never run on prod with real user data.** Only the first deploy seeds
automatically (guarded by `/opt/opauto/.seeded`).

```bash
cd /opt/opauto
docker compose exec backend npx prisma db seed
```

---

## Secrets and environment

### Add or rotate an LLM key (no downtime)

```bash
ssh almalinux@152.228.229.150
cd /opt/opauto
vi .env          # edit GROQ_API_KEY / ANTHROPIC_API_KEY / etc.
docker compose up -d backend    # recreates backend container, reads new env
```

Verify it's picked up — the `provider` field in a churn response tells you
which backend the LLM call went to:

```bash
TOKEN=$(curl -s http://152.228.229.150/api/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@autotech.tn","password":"password123"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')

curl -s http://152.228.229.150/api/ai/predict-churn -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"language":"en"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["provider"])'
# "template" = no key set or all keys failed | "groq"/"openai"/... = live LLM
```

### Rotate JWT_SECRET

**This invalidates every active session.** Users have to re-login. OK to do
after a security incident; avoid casually.

```bash
cd /opt/opauto
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
docker compose up -d backend
```

### Rotate DB password

Harder — the app and Postgres both need the new password, and Postgres
persists the old one in the `pg_data` volume until we `ALTER USER`.

```bash
# 1. Change it in .env AND inside Postgres in the same beat
cd /opt/opauto
NEW=$(openssl rand -hex 24)
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$NEW/" .env
docker exec opauto-db psql -U opauto -d opauto -c "ALTER USER opauto WITH PASSWORD '$NEW';"
docker compose up -d backend   # backend reconnects with new creds
```

---

## SSH access

### Add a new person's key

```bash
ssh almalinux@152.228.229.150
# append their pubkey on a new line — do NOT overwrite the file
echo "ssh-ed25519 AAAA...new-person's-key... name@laptop" \
  | tee -a ~/.ssh/authorized_keys
```

### Remove a key

```bash
ssh almalinux@152.228.229.150
# Copy the file, edit out their line, replace — keeps backup
cp ~/.ssh/authorized_keys{,.bak-$(date +%F)}
vi ~/.ssh/authorized_keys
```

---

## Recovery

### Backend crash-loop

Symptoms: `docker ps` shows `opauto-backend` restarting repeatedly, or
stuck at `unhealthy`.

```bash
docker logs --tail 50 opauto-backend
```

Common causes and fixes:

| Log snippet | Cause | Fix |
|---|---|---|
| `P3005 The database schema is not empty` | Migrations mismatch | See **Baseline a fresh/non-empty DB** |
| `The table "public.X" does not exist` | Migration was marked applied without being run | Delete the bogus row and redeploy: `docker exec opauto-db psql -U opauto -d opauto -c "DELETE FROM _prisma_migrations WHERE migration_name='<name>';"` then `docker compose restart backend` |
| `Can't reach database server` | DB container down or wrong password | `docker ps` shows db status; check `.env` DB_PASSWORD vs what `pg_data` stored |
| `EADDRINUSE :::3000` | Old backend still running | `docker compose down && docker compose up -d` |

### Frontend blank / 403

Symptoms: `curl http://152.228.229.150/` returns `403 Forbidden` or an
empty body from nginx.

```bash
docker logs opauto-nginx | tail -5
```

If you see `directory index of "/usr/share/nginx/html/" is forbidden`, the
Angular build didn't land in `dist/OpAuto-front/browser/`. Usually the
bind-mount auto-created the directory as root, blocking the next build:

```bash
ssh almalinux@152.228.229.150
cd /opt/opauto
docker compose stop nginx
sudo chown -R almalinux:almalinux dist
npx ng build --configuration=production
docker compose up -d nginx
```

### Webhook fires but nothing updates

```bash
# Recent deliveries from GitHub
gh api "repos/alabenkhlifa/OpAuto-front/hooks/606077712/deliveries?per_page=5"

# What the webhook service actually did
sudo journalctl -u webhook -n 30 --no-pager

# What deploy.sh logged
sudo tail -60 /var/log/opauto-deploy.log

# Is the repo really at origin/main?
cd /opt/opauto && git log --oneline -3 && git log --oneline origin/main -3
```

If `git log` shows the box is behind `origin/main`, run `./deploy/deploy.sh`
manually. If the webhook response is consistently 4xx, the `WEBHOOK_SECRET`
on the box and in the GitHub webhook settings have diverged — re-sync both.

### `_prisma_migrations` is wrong (bogus entries)

Happens when someone over-baselines (see 2026-04-21 post-mortem). Safe to
clean manually because Prisma treats rows as applied based on `finished_at`:

```bash
# See what's there
docker exec opauto-db psql -U opauto -d opauto \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;"

# Delete a single bogus row
docker exec opauto-db psql -U opauto -d opauto \
  -c "DELETE FROM _prisma_migrations WHERE migration_name='<name>';"

# Re-apply for real
cd /opt/opauto
docker compose run --rm --entrypoint sh backend -c "npx prisma migrate deploy"
```

### Everything on fire, we need the DB back NOW

```bash
# 1. Take a snapshot of the current state (even if broken) before you change anything
docker exec opauto-db pg_dump -U opauto opauto > ~/broken-$(date +%s).sql

# 2. Restore last known-good
docker exec -i opauto-db psql -U opauto -d opauto < ~/backup-<when>.sql

# 3. Revert the bad git commit
cd /opt/opauto && git revert HEAD && git push origin main
# (auto-deploy picks it up)
```

---

## Known gotchas (the ones that bit us, in chronological order)

1. **`prisma db push --accept-data-loss` in the Dockerfile CMD** silently
   applied schema changes without populating `_prisma_migrations`. Dockerfile
   now uses `prisma migrate deploy`. Do NOT revert.
2. **`docker compose` auto-creates bind-mount target directories as root**
   before the container starts. First `ng build` after `sudo rm -rf dist`
   will EACCES unless `dist/` is `chown`ed first.
3. **Migration timestamps have to be monotonic across merges.** If you
   create a migration locally while `main` has a newer one, Prisma's shadow
   DB will try to apply yours first and fail against an empty schema. Always
   rebase and bump the timestamp if needed.
4. **`curl -f http://localhost:3000/api`** returns non-zero because NestJS
   has no handler at bare `/api`. Healthcheck points at `/api/auth/login`.
5. **The `version:` key at the top of `docker-compose.yml` is obsolete** and
   spews a warning on every `docker compose` call. Cosmetic, remove when
   touching the file next.

---

## Quick links

- Design doc: `docs/superpowers/specs/2026-04-14-vps-deployment-design.md`
- Compose stack: `docker-compose.yml`
- Backend image: `opauto-backend/Dockerfile`
- Nginx conf: `deploy/nginx.conf`
- Deploy script: `deploy/deploy.sh`
- Webhook handler config: `deploy/hooks.json`
