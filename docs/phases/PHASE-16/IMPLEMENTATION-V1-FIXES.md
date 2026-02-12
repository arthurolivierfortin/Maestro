# V1 Fixes Implementation — Phase 16b

**Date**: February 11, 2026
**Scope**: P0-P3 items from V1-ISSUES.md (items 1-37)
**Files Changed**: 18 files, +1603/-1039 lines

---

## Summary of Changes

### Files Modified

| File | Changes | Items Addressed |
|------|---------|-----------------|
| `maestro-cli/cli.ts` | Major rewrite of command routing, help, output | P0: 2-6, P1: 7-14, P2: 17,21,27, P3: 30,31,36 |
| `maestro-cli/shell.ts` | Full rewrite with new features | P1: 15, P2: 18-19, P3: 28-29 |
| `maestro-cli/output-formatter.ts` | Smart table formatting, no JSON dump | P1: 9, P2: 20 |
| `shared/utils/cli-colors.ts` | Added spinner utility | P3: 30 |
| `backend/src/Maestro.Api/Program.cs` | Block discovery startup check | P0: 1, P3: 37 |
| `backend/src/Maestro.Api/appsettings.json` | Fixed GlobalBlocks path | P0: 1 |
| `backend/.../ProjectSessionServer.cs` | Session state validation | P2: 16, 22 |
| `backend/.../Session.cs` | Session status enhancements | P2: 16 |
| `backend/.../SessionEnums.cs` | Added Idle status | P2: 16 |
| `monitor/ink/components/SessionMonitor.ts` | Nav bar, error states, small terminal | P2: 23, 26, P3: 35 |
| `monitor/ink/components/StatusBar.ts` | Dynamic context-aware shortcuts | P2: 24 |
| `monitor/ink/components/HomeScreen.ts` | Pagination support | P3: 33 |
| `monitor/ink/components/Header.ts` | Metrics always visible | P3: 34 |
| `monitor/ink/hooks/useScroll.ts` | Increased default max scroll | P2: 25 |
| `monitor/ink/hooks/usePanelFocus.ts` | Direct jump by index | P3: 32 |

---

## P0 — Critical Fixes

### 1. Block Discovery Startup Check
**Files**: `Program.cs`, `appsettings.json`
**How to see**: Start the backend. Look for log output:
```
Block discovery: found 93 blocks from C:\Meastro\content\system\blocks
```
If path is wrong or no blocks found, a WARNING is logged.

**How to test**: Change `GlobalBlocks` in appsettings.json to an invalid path, restart backend, verify WARNING appears.

### 2. Session Delete Confirmation
**File**: `cli.ts` (deleteSession function)
**How to see**:
```bash
# Without --force: prompts for confirmation
maestro session delete <id>
# → "Delete session f2e844...? This cannot be undone. [y/N]"

# With --force: deletes immediately
maestro session delete <id> --force

# Bulk delete with status filter
maestro session delete-all --status stopped --force
```

### 3. Fix --no-monitor Flag
**File**: `cli.ts` (startSession function)
**How to see**:
```bash
maestro session start <id> --no-monitor
# → No longer shows "Launching monitor in new window..." or "Monitor window opened!"
# → Just shows session started status
```

### 4. Fix --json Flag Before Command
**File**: `cli.ts` (main function)
**How to see**:
```bash
maestro --json sessions
# → Previously opened interactive shell
# → Now shows: "No command specified. Use: maestro <command> --json"
```

### 5. Fix --status Filter
**File**: `cli.ts` (minimist config)
**How to see**:
```bash
maestro session list --status running
# → Previously showed ALL sessions (status was parsed as boolean)
# → Now correctly filters to only running sessions
```
**Root cause**: `status` was in the `boolean` array in minimist config. Moved to `string` array.

### 6. Fix promoteAgent Call Mismatch
**File**: `cli.ts` (workspace promote routing)
**How to see**: `maestro workspace promote --source <ws> --target <ws> --agent <id>` no longer crashes.

---

## P1 — Critical UX

### 7. ID Prefix Matching
**File**: `cli.ts` (resolveId function + all session/project routes)
**How to see**:
```bash
# Use short IDs instead of full UUIDs
maestro session info f2e844
maestro session start f2e
maestro session vars f2e844 list

# Ambiguous prefix shows error
maestro session info f
# → "Ambiguous ID prefix 'f' — matches 3 sessions. Use more characters."
```

### 8. Streamlined Session Creation
**File**: `cli.ts` (createSession + session create routing)
**How to see**:
```bash
# One command instead of four:
maestro session create --project <id> --template foundry-default --start

# Previously required:
# 1. maestro session create --project <id>
# 2. maestro session import <id> --template foundry-default
# 3. maestro session start <id>
```

### 9. Remove Redundant JSON Dump
**File**: `output-formatter.ts` (success method)
**How to see**: `session info`, `session pause`, etc. no longer dump the full 90KB JSON blob after the human-readable summary. JSON only appears with `--json` flag.

### 10. Progressive Help
**File**: `cli.ts` (help handler)
**How to see**:
```bash
# Top-level: concise overview
maestro --help

# Command-specific: only relevant commands
maestro session --help
maestro projects --help
```
Global help reduced from 370 lines to ~40 lines.

### 11. Templates List/Show Commands
**File**: `cli.ts` (new templates command)
**How to see**:
```bash
maestro templates
# → Shows table: Name, Entry Points, Variables, Description

maestro templates show foundry-default
# → Shows entry points, variables, widgets for template

maestro templates show nonexistent
# → "Template not found: nonexistent. Available: compliance-tester, doc-generator, ..."
```

### 12. Session Cleanup
**File**: `cli.ts` (session list --recent, delete-all)
**How to see**:
```bash
maestro session list --recent 5
# → Shows only 5 most recent sessions

maestro session delete-all --status stopped --force
# → Deletes all stopped sessions
```

### 13. All Output Through OutputFormatter
**File**: `cli.ts` (throughout)
**How to see**: All error messages now use `formatter.error()` instead of raw `console.error()` with emoji. This means `--json` mode now captures all errors as structured JSON.

### 14. Remove Emoji from CLI
**File**: `cli.ts` (throughout)
**How to see**: Compare output before and after. Example:
```
# Before: ❌ Session not found: abc123
# After:  ✗ Session not found: abc123 (using ANSI colors)

# Before: ✅ Session created!
# After:  ✓ Session created! (using ANSI colors)
```
196 emoji instances replaced with ANSI-colored semantic prefixes from `cli-colors.ts`.

### 15. Fix Shell Session Context
**File**: `shell.ts` (executeCommand)
**How to see**:
```bash
# In the interactive shell:
maestro
> use f2e844
> info          # → session info f2e844...
> vars list     # → session vars f2e844... list
> invoke start  # → session invoke f2e844... start
> events        # → session events f2e844...
> monitor       # → monitor f2e844...
```
Previously only `exec` got context injection. Now ALL session subcommands work.

### 16. Session Completion Status
**File**: `ProjectSessionServer.cs`, `Session.cs`, `SessionEnums.cs`
**How to see**: Sessions now distinguish between "running" (workflow active) and "idle" (started but no workflow running).

---

## P2 — Quality

### 17. Exit Code Convention
**File**: `cli.ts` (EXIT constants + handleApiError)
**How to see**:
```bash
maestro session info nonexistent; echo $?
# → Exit code 2 (NOT_FOUND) instead of 1

maestro session info; echo $?
# → Exit code 1 (USER_ERROR, missing param)
```
Convention: 0=success, 1=user error, 2=not found, 3=server error, 4=timeout.

### 18. Tab Completion in Shell
**File**: `shell.ts` (completer method)
**How to see**:
```bash
maestro
> sess<TAB>     # → session, sessions
> session cr<TAB> # → create
```
Completes top-level commands and session subcommands.

### 19. Persist Shell History
**File**: `shell.ts` (loadHistory, saveHistory)
**How to see**: Exit and re-enter the shell. Previous commands available via Up arrow.
History stored in `~/.maestro_history`.

### 20. Smart Table Formatting
**File**: `output-formatter.ts` (formatTable function)
**How to see**:
```bash
maestro templates
# → Columns auto-sized with max 50 chars, truncated with "..."
# → Previously used console.table() which created 400+ char wide tables
```

### 21. Clarify Execute/Run/Invoke
**File**: `cli.ts` (help text)
**How to see**: `maestro --help` now groups execution commands clearly:
- `execute <workflow>` — Execute a full workflow
- `run <block-id>` — Execute a single block
- `session invoke` — Trigger session entry point

### 22. Validate Session State Transitions
**File**: `ProjectSessionServer.cs`
**How to see**: `maestro session pause <id>` on a session with no active workflow returns an appropriate error instead of silently succeeding.

### 23. Monitor Visible Navigation Bar
**File**: `SessionMonitor.ts`
**How to see**: Launch monitor. A navigation bar showing `[H]ome [S]paces [F]oundry [C]atalog [M]odels` is visible at the top with the current page highlighted.

### 24. Dynamic Status Bar
**File**: `StatusBar.ts`
**How to see**: The status bar now shows context-aware shortcuts:
- When a panel is focused: shows panel-specific shortcuts (scroll, expand/collapse)
- When no panel focused: shows global navigation shortcuts
- When zoomed: shows zoom-related shortcuts

### 25. Fix Scroll Limits
**File**: `useScroll.ts`
**How to see**: Default max scroll increased from 50 to 200. Dynamic `setMaxScroll()` called by components with actual content size.

### 26. Error State Clarity
**File**: `SessionMonitor.ts`
**How to see**: When API fails, shows specific error type (connection refused vs timeout). Stale data (>10s old) shows a visual indicator.

### 27. Resolve --json Flag Conflict
**File**: `cli.ts` (minimist config)
**How to see**:
```bash
# Boolean output mode:
maestro sessions --json

# JSON value input (legacy compatibility):
maestro session vars set <id> key --json-value '{"a":1}'
```
`--json` is now a boolean alias for `--json-output`. `--json-value` is for passing JSON data.

---

## P3 — Polish

### 28. Multi-line JSON Input in Shell
**File**: `shell.ts` (executeCommand, multiline detection)
**How to see**:
```bash
maestro
> session vars set <id> config {
...   "key": "value",
...   "nested": true
... }
# Automatically detects unbalanced braces and continues on next line
```
Also supports `@file` syntax: `session vars set <id> config @data.json`

### 29. Monitor from Shell
**File**: `shell.ts` (context injection for monitor)
**How to see**:
```bash
maestro
> use f2e844
> monitor      # → Launches monitor for current session context
```

### 30. Progress Indicators
**File**: `cli-colors.ts` (spinner function)
**How to see**: The spinner utility is available for API calls. Shows a braille-dot animation during long operations.

### 31. Session Last Command
**File**: `cli.ts` (session last routing)
**How to see**:
```bash
maestro session last
# → Shows details of most recently created session
```

### 32. Panel Direct Jump
**File**: `usePanelFocus.ts`, `SessionMonitor.ts`
**How to see**: In the monitor, press number keys 1-3 to directly jump to specific panels.

### 33. Home Screen Pagination
**File**: `HomeScreen.ts`
**How to see**: Launch monitor home screen. If you have >10 sessions, use PgUp/PgDown to navigate pages. Shows "Page X/Y" indicator.

### 34. Metrics Always Visible
**File**: `Header.ts`
**How to see**: The header now shows fitness/iteration metrics in any mode (idle, execution, descriptor) if the session has `currentFitness`, `scoreHistory`, or `_phases` variables.

### 35. Small Terminal Support
**File**: `SessionMonitor.ts`
**How to see**: Resize terminal below 80 columns — panels stack vertically. Below 60 columns — shows "terminal too small" message.

### 36. Startup Health Check
**File**: `cli.ts` (checkBackendOnce)
**How to see**: Run any command without the backend running:
```bash
maestro sessions
# → "⚠ Backend not reachable at http://localhost:5000"
# → "  Start services: powershell -File dev-scripts/dev-start.ps1"
```

### 37. Block Discovery Startup Log
**File**: `Program.cs`
**How to see**: Start backend, check logs for block count and path.

---

## Verification Checklist

After implementation, verify:

- [x] `maestro --help` shows streamlined help (< 50 lines)
- [x] `maestro session --help` shows session-specific help
- [x] `maestro templates` lists all 5 templates dynamically
- [x] `maestro session create --project <id> --template <name> --start` works
- [x] `maestro session list --status running` filters correctly
- [x] Short ID prefixes work: `maestro session info f2e8`
- [x] `maestro session delete <id>` prompts for confirmation
- [x] `maestro session delete-all --status stopped --force` works
- [x] `maestro session last` shows most recent session
- [x] No emoji in CLI output (replaced with ANSI colors)
- [x] Smart table formatting (max 50 char columns)
- [x] Backend builds with 0 warnings
- [x] CLI loads and runs without errors
- [x] Shell tab completion works
- [x] Shell session context works for all subcommands
- [x] Progressive exit codes (0/1/2/3/4)

---

## Architecture Notes

All changes follow the project's cardinal rules:

1. **No session-specific logic in infrastructure** — All fixes are generic (ID resolution, table formatting, help system)
2. **CLI-first** — All new features are CLI commands (templates, delete-all, session last)
3. **No silent failures** — Startup check logs warnings, error handling improved
4. **Self-describing sessions** — Template discovery is dynamic from filesystem

---

## Running the Tests

```bash
# Backend build
powershell -Command "cd C:\Meastro\backend; dotnet build"

# Backend tests
cd backend && dotnet test

# CLI verification
cd maestro-cli
node index.js --help
node index.js templates
node index.js session --help

# Frontend (unaffected)
cd frontend && npm test -- --run
```
