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

# Build Angular frontend on host (saves Docker memory).
#
# Build into dist.new so the running nginx keeps serving the previous build
# until we atomically swap at the end. This eliminates the 500 redirection-
# cycle window users used to hit DURING the deploy: the old script did
# `rm -rf dist` BEFORE the build, which left nginx's bind mount pointing
# at a stale (empty) inode for the duration of `npm ci` + `ng build` +
# backend rebuild — anyone loading the SPA in that window saw 500s on every
# client-side route because `try_files /<route> $uri/ /index.html` could
# not find /index.html.
#
# nginx still references the OLD inode of dist/ even after the mv (Linux
# bind mounts hold the inode, not the path), so it keeps serving the
# previous build until `--force-recreate nginx` later in this script.
echo "Building frontend into dist.new..." | tee -a "$LOG_FILE"
sudo rm -rf dist.new
npm ci --prefix . 2>&1 | tee -a "$LOG_FILE"
npx ng build --configuration=production \
  --output-path dist.new/OpAuto-front 2>&1 | tee -a "$LOG_FILE"

# Sanity-check the build actually produced index.html before swapping.
# Without this gate, a silently-broken build would clobber the working
# dist/ and leave the previous version unrecoverable.
if [ ! -f dist.new/OpAuto-front/browser/index.html ]; then
  echo "ERROR: dist.new/OpAuto-front/browser/index.html missing after build — aborting deploy" \
    | tee -a "$LOG_FILE"
  exit 1
fi

# Atomic swap. dist.old is retained until the SPA reachability check at
# the end passes — gives an instant rollback path if --force-recreate or
# the new build is broken: `mv dist dist.failed && mv dist.old dist`.
echo "Swapping dist atomically..." | tee -a "$LOG_FILE"
sudo rm -rf dist.old
# Use `if` rather than `&&` because `set -e` treats a non-zero return from
# the compound as a fatal error — and on the very first deploy `dist/`
# does not exist yet, so `[ -d dist ]` would abort the script.
if [ -d dist ]; then sudo mv dist dist.old; fi
sudo mv dist.new dist

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

# Force-recreate nginx so the bind mount re-resolves against the freshly
# swapped dist/. `docker compose restart` would keep the existing container
# bound to the OLD inode (now under dist.old/); recreate destroys + re-binds
# so the mount picks up the current dist/ inode.
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

# Deploy verified healthy — safe to drop the previous build. Kept until
# now so a failed --force-recreate or a broken new build could be rolled
# back manually with `mv dist dist.failed && mv dist.old dist` followed
# by another `docker compose up -d --force-recreate nginx`.
sudo rm -rf dist.old

echo "=== Deploy completed at $(date) ===" | tee -a "$LOG_FILE"
