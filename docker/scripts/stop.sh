#!/bin/bash
# Stop containers
# Usage: ./docker/scripts/stop.sh [main|dev|all]
cd "$(dirname "$0")/../.."
TARGET="${1:-all}"

case "$TARGET" in
    main|dev)
        docker compose -f docker/docker-compose.yml stop "$TARGET"
        ;;
    all)
        docker compose -f docker/docker-compose.yml down
        ;;
esac

echo "Stopped ($TARGET)."
