#!/bin/bash
set -e
# pipefail catches failures in pipe members — without it, `git fetch | tee`
# masks git errors because tee always exits 0. Project memory documented
# this regression: stale images shipped because git failures were swallowed.
set -o pipefail

APP_DIR="/opt/opauto"
LOG_FILE="/var/log/opauto-deploy.log"
SEED_MARKER="$APP_DIR/.seeded"

echo "=== Deploy started at $(date) ===" | tee -a "$LOG_FILE"

cd "$APP_DIR"

# Force sync to exactly match remote (prevents stale refs)
echo "Syncing code..." | tee -a "$LOG_FILE"
git fetch origin main 2>&1 | tee -a "$LOG_FILE"
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"

# Build Angular frontend on host (saves Docker memory)
echo "Building frontend..." | tee -a "$LOG_FILE"
sudo rm -rf dist
npm ci --prefix . 2>&1 | tee -a "$LOG_FILE"
npx ng build --configuration=production 2>&1 | tee -a "$LOG_FILE"

# Rebuild backend image (uses migrate deploy on startup)
echo "Rebuilding backend..." | tee -a "$LOG_FILE"
docker compose build backend 2>&1 | tee -a "$LOG_FILE"
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for backend healthcheck to go green. Dockerfile CMD runs
# `prisma migrate deploy` before the server starts; if that fails the
# container crashes and this loop times out.
echo "Waiting for backend to be healthy..." | tee -a "$LOG_FILE"
for i in $(seq 1 24); do
  status=$(docker inspect --format='{{.State.Health.Status}}' opauto-backend 2>/dev/null || echo "none")
  if [ "$status" = "healthy" ]; then
    echo "Backend healthy after ${i}x5s" | tee -a "$LOG_FILE"
    break
  fi
  sleep 5
done

# First-time seeding only — creates the demo garage + owner so a fresh
# VPS isn't empty. Marker file ensures this never runs again.
if [ ! -f "$SEED_MARKER" ]; then
  echo "First deploy — running prisma db seed..." | tee -a "$LOG_FILE"
  docker compose exec -T backend npx prisma db seed 2>&1 | tee -a "$LOG_FILE" || true
  touch "$SEED_MARKER"
fi

# Force-recreate nginx so the bind mount re-evaluates against the freshly
# rebuilt dist/. `docker compose restart` keeps the existing container,
# which keeps the OLD inode of dist/OpAuto-front/browser/ — when the build
# step does `rm -rf dist`, the new dist sits at a new inode, but the running
# nginx container still serves from the deleted (empty) inode → SPA returns
# 500 with `directory index forbidden` until someone manually recreates it.
# `up -d --force-recreate nginx` destroys + recreates the container so the
# mount picks up the current dist directory.
echo "Recreating nginx with fresh bind mount..." | tee -a "$LOG_FILE"
docker compose up -d --force-recreate nginx 2>&1 | tee -a "$LOG_FILE"

# Verify the SPA actually loads. Without this, a broken bind mount /
# missing index.html / nginx config typo silently ships and the deploy log
# still says "completed". Fail loudly so the next person sees it.
echo "Verifying frontend serves..." | tee -a "$LOG_FILE"
for i in $(seq 1 12); do
  status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/ || echo "000")
  if [ "$status" = "200" ]; then
    echo "Frontend reachable (HTTP $status) after ${i}x2s" | tee -a "$LOG_FILE"
    break
  fi
  if [ "$i" = "12" ]; then
    echo "ERROR: frontend not reachable after 24s — last status=$status" \
      | tee -a "$LOG_FILE"
    exit 1
  fi
  sleep 2
done

echo "=== Deploy completed at $(date) ===" | tee -a "$LOG_FILE"
