# Troubleshooting

Common issues and how to fix them.

---

## "maestro code" doesn't start

**Symptoms**: Command hangs or shows an error immediately.

**Check Node.js version**:
```bash
node --version   # Must be >= 18
```

**Check installation**:
```bash
maestro --help
```

If `maestro` is not found, ensure the npm global bin directory is in your PATH:
```bash
npm config get prefix   # Should show a directory
# On Linux/macOS, add {prefix}/bin to PATH
# On Windows, add {prefix} to PATH
```

---

## "Services failed to start"

**Symptoms**: "Starting Maestro services..." then error.

**Port conflict** — another process may be using ports 5000 or 5010:
```bash
# Linux/macOS
lsof -i :5000
lsof -i :5010

# Windows (PowerShell)
netstat -ano | Select-String ':5000|:5010'
```

Kill the conflicting process or set custom ports:
```bash
MAESTRO_API_URL=http://localhost:5001 maestro code
```

**Missing binaries** — if you built from source, ensure binaries exist:
```bash
ls node_modules/@maestro/cli/dist/   # Should contain win-x64/ or linux-x64/
```

**Debug logs**:
```bash
MAESTRO_DEBUG=true maestro code
```

This shows detailed startup logs from both the backend and LLM provider.

---

## "Agent doesn't respond"

**Symptoms**: You type a message, the agent status shows "Working", but nothing happens.

**Check your LLM provider config**:
```bash
maestro init   # Reconfigure if needed
```

**Check health**:
```bash
maestro health
```

If the LLM provider is unhealthy, verify your API key and endpoint are correct.

**Try a simple task**: Type "hello" to test basic connectivity.

---

## "Agent makes errors" or "task fails"

**Symptoms**: Agent attempts a task but operations fail (red errors in ACTIONS panel).

**Stop and retry**: Type `/stop`, then rephrase with more context:
```
/stop
Fix the TypeScript errors in src/api/. Run tsc --noEmit first to see them.
```

**Check repo permissions**: The agent needs read/write access to the repo directory.

**Check working directory**: Ensure `--repo` points to a valid git repository:
```bash
maestro code --repo /path/to/repo   # Must be a git repo
```

---

## Pages are blank or display incorrectly

**Terminal too small**: Maestro needs a terminal of at least 80 columns by 24 rows. Enlarge your terminal window.

**Unsupported terminal**: Maestro works best with modern terminals:
- Windows: Windows Terminal, PowerShell 7+
- Linux: gnome-terminal, kitty, alacritty
- macOS: iTerm2, Terminal.app

---

## How to reset everything

**Reset config** (start fresh with `maestro init`):
```bash
rm ~/.maestro/config.json
maestro init
```

**Reset all Maestro data**:
```bash
rm -rf ~/.maestro/
maestro init
```

**Reinstall**:
```bash
npm uninstall -g @maestro/cli
npm install -g @maestro/cli
```

---

## Debug mode

For any issue, run with debug logging enabled:

```bash
MAESTRO_DEBUG=true maestro code
```

This prints detailed logs from:
- Backend startup and API calls
- LLM provider requests and responses
- Sidecar process management

---

## Getting help

- Type `?` in the TUI for the keyboard shortcut overlay
- Type `/help` in the input bar for available commands
- Check the [CLI Reference](tools/cli/README.md) for all commands
- File issues at the project repository
