# Maestro — Troubleshooting

## Connection Issues

### "Cannot connect to backend" (ECONNREFUSED)

**Symptom**: CLI commands fail with `ECONNREFUSED` error.

**Cause**: Backend is not running.

**Fix**:
```powershell
# Start the backend
powershell -File dev-scripts/dev-start.ps1

# Or manually
cd apps/backend/src/Maestro.Api
dotnet run --urls http://localhost:5000
```

### Port 5000 already in use

**Symptom**: Backend fails to start with "address already in use".

**Fix**:
```powershell
# Kill the existing process
taskkill /F /IM Maestro.Api.exe

# Or find what's using port 5000
netstat -ano | findstr :5000
taskkill /F /PID <pid>
```

### Backend build fails with "file is locked"

**Symptom**: `dotnet build` fails with file lock errors on DLLs.

**Fix**:
```powershell
taskkill /F /IM Maestro.Api.exe
cd apps/backend
dotnet build
```

## LLM Issues

### "LLM server is not responding"

**Symptom**: Chat and inference operations fail.

**Causes & Fixes**:

1. **Local LLM not started**: Start with `dev-start.ps1` (includes LLM).
2. **GPU out of memory**: Try a smaller model (`SmolLM2-360M-Instruct`).
3. **No GPU available**: Use Azure OpenAI instead:
   ```bash
   node index.js config azure set --endpoint https://YOUR.openai.azure.com --api-key KEY --deployment gpt-4
   ```

### Azure OpenAI not working

**Symptom**: Azure test fails.

**Checklist**:
1. Verify endpoint URL (must include `https://` and `.openai.azure.com`)
2. Verify API key is correct
3. Verify deployment name exists in your Azure portal
4. Test connection: `node index.js config azure test`

## Session Issues

### "Session not found"

**Symptom**: Commands return 404 for a session ID.

**Fix**: Session IDs support prefix matching. Use enough characters:
```bash
# List all sessions to find the right ID
node index.js session list

# Use short prefix (8+ chars recommended)
node index.js session show abc12345
```

### Sessions stuck in "Running" after restart

**Symptom**: `session list` shows sessions as "Running" but nothing is executing.

**Fix**: The SessionRecoveryService automatically recovers zombie sessions on startup. Restart the backend:
```powershell
powershell -File dev-scripts/dev-start.ps1 -Stop
powershell -File dev-scripts/dev-start.ps1
```

### "Session has not been started"

**Symptom**: `session invoke` fails.

**Fix**: Start the session first:
```bash
node index.js session start <session-id>
node index.js session invoke <session-id> start
```

### "Entry point not found"

**Symptom**: `session invoke` returns entry point not found.

**Fix**: Check available entry points:
```bash
node index.js session show <session-id>
# Look at the "Entry Points" section

# Or import a template that defines entry points
node index.js session import-template <session-id> foundry-default
```

## Workspace Issues

### Phantom session references in workspace

**Symptom**: Workspace shows session IDs that no longer exist.

**Fix**: Session cascade delete now cleans up workspace refs automatically. For existing phantom refs:
```bash
# Remove the ref manually
node index.js workspace remove-session <workspace-id> <phantom-session-id>
```

### Force-deleting a workspace

To delete a workspace AND all its sessions:
```bash
# API: DELETE /api/workspaces/{id}?force=true
# Or via CLI:
node index.js workspace delete <workspace-id> --force
```

## Monitor Issues

### Monitor shows no data

**Symptom**: TUI monitor is blank.

**Checklist**:
1. Session must be started: `node index.js session start <id>`
2. A workflow must be running: `node index.js session invoke <id> start`
3. Session must have `_monitorDescriptor` variable (imported via template)

### Monitor crashes

**Symptom**: TUI throws an error and exits.

**Fix**: Try the legacy monitor:
```bash
node index.js monitor <session-id> --legacy
```

## Frontend Issues

### Frontend can't connect to backend

**Symptom**: Frontend shows connection errors.

**Checklist**:
1. Backend must be running on port 5000
2. Check CORS settings in `appsettings.json`
3. Check browser console for specific errors

### Frontend build fails

```powershell
cd apps/desktop
npm install    # Reinstall deps
npm run build  # Rebuild
```

## General Tips

- **Always check health first**: `node index.js health`
- **Enable debug logging**: `MAESTRO_DEBUG=true node index.js <command>`
- **Check backend logs**: Look at the terminal where the backend is running
- **Use short IDs**: The CLI supports prefix matching (8+ chars)
- **JSON output**: Add `--json` flag for machine-readable output
