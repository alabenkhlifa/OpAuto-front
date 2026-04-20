#!/bin/bash
set -e

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

# Restart nginx to pick up new backend (and to re-mount the new dist/)
docker compose restart nginx 2>&1 | tee -a "$LOG_FILE"

echo "=== Deploy completed at $(date) ===" | tee -a "$LOG_FILE"
