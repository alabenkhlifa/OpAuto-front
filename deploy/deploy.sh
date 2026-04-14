#!/bin/bash
set -e

APP_DIR="/opt/opauto"
LOG_FILE="/var/log/opauto-deploy.log"

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

# Rebuild backend (--no-cache if package.json changed)
echo "Rebuilding backend..." | tee -a "$LOG_FILE"
docker compose build backend 2>&1 | tee -a "$LOG_FILE"
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for backend to be ready
echo "Waiting for backend..." | tee -a "$LOG_FILE"
sleep 15

# Restart nginx to pick up new backend IP
docker compose restart nginx 2>&1 | tee -a "$LOG_FILE"

echo "=== Deploy completed at $(date) ===" | tee -a "$LOG_FILE"
