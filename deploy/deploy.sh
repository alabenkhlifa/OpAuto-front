#!/bin/bash
set -e

APP_DIR="/opt/opauto"
LOG_FILE="/var/log/opauto-deploy.log"

echo "=== Deploy started at $(date) ===" | tee -a "$LOG_FILE"

cd "$APP_DIR"

# Pull latest code
echo "Pulling latest code..." | tee -a "$LOG_FILE"
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# Build Angular frontend on host (saves Docker memory)
echo "Building frontend..." | tee -a "$LOG_FILE"
npm ci --prefix . 2>&1 | tee -a "$LOG_FILE"
npx ng build --configuration=production 2>&1 | tee -a "$LOG_FILE"

# Rebuild and restart backend container
echo "Rebuilding backend..." | tee -a "$LOG_FILE"
docker compose build backend 2>&1 | tee -a "$LOG_FILE"
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Run migrations
echo "Running migrations..." | tee -a "$LOG_FILE"
docker compose exec -T backend npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"

echo "=== Deploy completed at $(date) ===" | tee -a "$LOG_FILE"
