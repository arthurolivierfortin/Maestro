#!/bin/bash
# Full clean rebuild — removes volumes
# WARNING: This resets claude-config volume (sessions, onboarding state)
set -e
cd "$(dirname "$0")/../.."

echo "=== Clean Rebuild Maestro Docker ==="
echo "WARNING: This will reset Claude config (sessions, onboarding state)"
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "[1/3] Stopping and removing volumes..."
docker compose -f docker/docker-compose.yml down -v 2>/dev/null || true

echo "[2/3] Building new images..."
docker compose -f docker/docker-compose.yml build

echo "[3/3] Starting containers..."
docker compose -f docker/docker-compose.yml up -d

echo ""
echo "Done. Attach with: ./docker/scripts/attach.sh"
