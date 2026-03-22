#!/bin/bash
# Run a one-off headless Claude Code command in the container
# Usage: ./docker/scripts/run-headless.sh "your prompt here"
#        ./docker/scripts/run-headless.sh /health

if [ $# -eq 0 ]; then
    echo "Usage: $0 \"prompt\""
    echo "Example: $0 /health"
    exit 1
fi

docker exec -u node maestro-dev claude --dangerously-skip-permissions -p "$*"
