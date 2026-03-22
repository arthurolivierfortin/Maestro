#!/bin/bash
# Start containers
# Usage: ./docker/scripts/start.sh [main|dev|all]
cd "$(dirname "$0")/../.."
TARGET="${1:-all}"

case "$TARGET" in
    main|dev)
        docker compose -f docker/docker-compose.yml up -d "$TARGET"
        ;;
    all)
        docker compose -f docker/docker-compose.yml up -d
        ;;
esac

echo "Started ($TARGET). Status: ./docker/scripts/status.sh"
