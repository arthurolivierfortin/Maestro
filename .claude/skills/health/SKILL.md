---
name: health
description: Full system health check — backend, LLM provider, build status, deploy state.
user-invocable: true
allowed-tools: Bash, Read
---

Run the Maestro system health check.

## Instructions

### Step 0: Refresh GitHub App token if needed
```bash
python C:/Meastro/scripts/gh_app_auth.py --setup
```

### Step 1: Check services
```bash
curl -s http://localhost:5000/ | head -c 100 || echo "Backend DOWN"
curl -s http://localhost:5010/api/v1/health/ | head -c 100 || echo "LLM Provider DOWN"
```

### Step 2: Check deploy state
```bash
cat C:/Meastro/data/.deploy_state.json 2>/dev/null || echo "No deploy state"
tail -10 C:/Meastro/logs/deploy.log 2>/dev/null || echo "No deploy logs"
```

### Step 3: Check build
```bash
cd C:/Meastro/apps/backend && dotnet build --no-restore -v quiet 2>&1 | tail -3
```

### Step 4: Check git status
```bash
cd C:/Meastro && git status --short | head -10
git log --oneline -3
```

### Step 5: Report
- Backend: UP/DOWN
- LLM Provider: UP/DOWN (which providers available)
- Build: PASS/FAIL
- Deploy: last status, current commit
- Git: branch, uncommitted changes
