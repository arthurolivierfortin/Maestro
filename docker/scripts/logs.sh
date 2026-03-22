#!/bin/bash
# View container logs
# Usage: ./docker/scripts/logs.sh [main|dev]
TARGET="${1:-main}"

case "$TARGET" in
    main)
        docker logs -f maestro-main
        ;;
    dev)
        docker logs -f maestro-dev
        ;;
    *)
        echo "Usage: $0 [main|dev]"
        ;;
esac
