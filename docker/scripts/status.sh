#!/bin/bash
# Show status of both containers
echo "=== Maestro Docker Status ==="
echo ""

# maestro-main
MAIN_STATE=$(docker inspect -f '{{.State.Status}}' maestro-main 2>/dev/null || echo "not found")
echo "maestro-main (backend+deployer): ${MAIN_STATE}"
if [ "$MAIN_STATE" = "running" ]; then
    docker stats maestro-main --no-stream --format "  CPU: {{.CPUPerc}} | Memory: {{.MemUsage}}" 2>/dev/null
    echo "  Backend health:"
    curl -s http://localhost:5000/ 2>/dev/null | head -c 80 || echo "  Backend not responding"
    echo ""
    echo "  LLM Provider health:"
    curl -s http://localhost:5010/api/v1/health/ 2>/dev/null | head -c 80 || echo "  LLM Provider not responding"
    echo ""
    echo "  Deploy state:"
    docker exec maestro-main bash -c 'cat /app/data/.deploy_state.json 2>/dev/null || echo "  No deploy state yet"'
fi

echo ""

# maestro-dev
DEV_STATE=$(docker inspect -f '{{.State.Status}}' maestro-dev 2>/dev/null || echo "not found")
echo "maestro-dev (Claude Code): ${DEV_STATE}"
if [ "$DEV_STATE" = "running" ]; then
    docker stats maestro-dev --no-stream --format "  CPU: {{.CPUPerc}} | Memory: {{.MemUsage}}" 2>/dev/null
fi

echo ""
echo "Attach to dev: docker attach maestro-dev"
echo "Main logs:     docker logs -f maestro-main"
