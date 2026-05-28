---
name: startup
description: Initialize the autonomous dev loop — GitHub auth, schedule health/improve/dev-cycle crons.
user-invocable: true
---

Initialize the Maestro autonomous development system.

## Instructions

1. Set up GitHub App authentication:
   ```bash
   python C:/Meastro/scripts/gh_app_auth.py --setup --force
   ```

2. Verify backend services:
   ```bash
   curl -s http://localhost:5000/ | head -c 80 || echo "Backend DOWN"
   curl -s http://localhost:5010/api/v1/health/ | head -c 80 || echo "LLM Provider DOWN"
   ```

3. Schedule **Health check** (every 5 min):
   ```
   /loop 5m /health
   ```

4. Schedule **Dev cycle** (every 15 min):
   ```
   /loop 15m /cycle
   ```

5. Run initial /health to show current state.

6. Report what was started:
   - Backend status (up/down, port 5000)
   - LLM Provider status (up/down, port 5010)
   - Loops scheduled: health (5m), dev-cycle (15m)
