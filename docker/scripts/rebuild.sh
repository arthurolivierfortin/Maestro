#!/bin/bash
# Rebuild Docker images and restart containers
# Usage: ./docker/scripts/rebuild.sh [main|dev|all]
set -e
cd "$(dirname "$0")/../.."
TARGET="${1:-all}"

echo "=== Rebuilding Maestro Docker ($TARGET) ==="

case "$TARGET" in
    main)
        docker compose -f docker/docker-compose.yml stop main 2>/dev/null
        docker compose -f docker/docker-compose.yml build main
        docker compose -f docker/docker-compose.yml up -d main
        ;;
    dev)
        docker compose -f docker/docker-compose.yml stop dev 2>/dev/null
        docker compose -f docker/docker-compose.yml build dev
        docker compose -f docker/docker-compose.yml up -d dev
        ;;
    all)
        docker compose -f docker/docker-compose.yml down 2>/dev/null
        docker compose -f docker/docker-compose.yml build
        docker compose -f docker/docker-compose.yml up -d
        ;;
    *)
        echo "Usage: $0 [main|dev|all]"
        exit 1
        ;;
esac

echo ""
echo "Done. Status: ./docker/scripts/status.sh"
