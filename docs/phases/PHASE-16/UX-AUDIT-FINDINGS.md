# UX Audit Findings — Phase 16b

**Date**: February 11, 2026
**Method**: Real end-to-end pipeline runs + systematic code audit
**Scope**: CLI, TUI Monitor, Shell (no frontend)

---

## Test Results Summary

| Scenario | Template | Result | Duration | Notes |
|----------|----------|--------|----------|-------|
| Foundry E2E | `foundry-default` | PASS | ~60s | 4 phases, fitness 0.95, 3 artifacts |
| Compliance E2E | `compliance-tester` | PASS | ~4min | 6 phases (5 models + docs), all reports generated |
| Error handling | N/A | MIXED | N/A | Some good, some missing (see below) |

---

## Findings by Category

### A. CRITICAL — Blockers Before V1

#### A1. Block discovery config was wrong (FIXED during audit)
- **`appsettings.json`** had `GlobalBlocks: "C:\\Meastro\\blocks"` (empty dir)
- Actual blocks are in `content/system/blocks/` (77 files)
- Result: workflows invoked but only ran passthrough nodes — no LLM, no phases
- **Fix applied**: Updated config to `"C:\\Meastro\\content\\system\\blocks"`
- **Impact**: Without this fix, the entire system appears broken to users. First-time setup would fail silently.

#### A2. Session delete has no confirmation
- `maestro session delete <id>` deletes immediately — even running sessions
- No `--force` flag required, no "Are you sure?" prompt
- Other destructive commands (projects delete, experiment delete) correctly require `--force`
- **Risk**: Accidental data loss

#### A3. `--no-monitor` flag doesn't work
- `maestro session start <id> --no-monitor` still outputs:
  ```
  Launching monitor in new window...
  Monitor window opened!
  ```
- Flag may be parsed but not respected in the spawn logic

#### A4. `--json` before command opens interactive shell
- `maestro --json sessions` opens the interactive shell instead of listing sessions in JSON
- `maestro sessions --json` works correctly
- The flag position matters but this isn't documented

#### A5. Session list `--status` filter doesn't work
- `maestro session list --status running` shows ALL sessions (running, paused, stopped)
- Filter is either not implemented or silently ignored

---

### B. HIGH — Major UX Friction

#### B1. Session info/pause dumps entire 90KB+ JSON
- Commands like `session info`, `session pause`, `session resume` output the full session JSON including all variables
- A session with `_workflowConfig` and `_executionTree` produces ~90KB of output
- Text mode output is already useful (summary at top), but the JSON blob underneath is overwhelming
- **Suggestion**: Only show summary in text mode. Add `--verbose` for full JSON dump.

#### B2. Table formatting breaks with complex data
- `_llmActivity` rendered as `console.table()` creates an extremely wide table (400+ chars)
- Each cell shows full prompt text, making the table unreadable
- Nested objects show as `[Object]` with no way to expand
- **Suggestion**: Smart column truncation, max column width, `--format compact|full`

#### B3. Help is 370 lines with no progressive disclosure
- `maestro --help` dumps everything at once
- `maestro session --help` shows the SAME global help (not session-specific)
- New users have no quick start guide
- **Suggestion**: Tiered help. `--help` = top commands. `session --help` = session subcommands only.

#### B4. Template list is hardcoded and incomplete
- Import error says "Available templates: foundry-default, foundry-training, foundry-sandbox"
- Missing: `compliance-tester`, `doc-generator`
- No `maestro templates list` command to discover available templates
- **Suggestion**: Scan template directory dynamically, add `templates list/show` commands

#### B5. 20 stale sessions, no cleanup mechanism
- 18 old "running" sessions from previous tests clutter the list
- No `session list --recent N` or `session cleanup --older-than 7d`
- No bulk operations (`session stop-all`, `session delete-all --force`)
- **Suggestion**: Add age/status filters and bulk cleanup commands

#### B6. Session creation requires 4 separate commands
- Create → Import → Start → Invoke is 4 commands with ID copy-paste
- No shorthand: `maestro session create --template foundry-default --start`
- **Suggestion**: `--template` and `--start` flags on create, `--invoke` to trigger entry point

#### B7. Project ID prefix matching doesn't work
- `maestro session create --project f2e84431` fails with "not found"
- Must provide full UUID: `f2e84431-14c3-48ad-a7b2-0fbce322cd80`
- The session list shows truncated IDs but these can't be used
- **Suggestion**: Support prefix matching for IDs (like git short hashes)

---

### C. MEDIUM — Significant Quality Gaps

#### C1. Mixed output methods
- Some commands use `formatter.error()`, others use raw `console.error()` with emoji
- Emoji icons (📄 ❌ ✅ 🔧 ⚙️) used inconsistently
- CLI colors utility (`c.ok()`, `c.fail()`) not used everywhere
- **Impact**: `--json` mode doesn't capture errors from `console.error()` calls

#### C2. All errors return exit code 1
- Whether it's missing args, not found, server error, or timeout — all exit 1
- Agents/scripts can't distinguish failure types
- **Suggestion**: Exit code convention (0=success, 1=user error, 2=not found, 3=server error)

#### C3. `execute` vs `run` vs `invoke` confusion
- Three commands that sound similar with unclear differences
- Help text doesn't explain when to use each
- **Suggestion**: Consolidate or add clear descriptions in help

#### C4. Session state transitions not validated
- `session pause` succeeds on a session where workflow already completed
- Session shows as "paused" even though no workflow is running
- No "session completed" status — sessions stay "running" after workflow finishes

#### C5. Shell session context only works for `exec`
- `use <id>` sets context, but only `exec` commands get the ID injected
- `vars list`, `invoke start`, `info` — none get context injection
- **Impact**: Shell context feature is essentially broken for most commands

#### C6. No tab completion in shell
- Must type full command names, full session IDs
- Critical for CLI usability

#### C7. Shell history not persisted
- `historyFile` declared but never used
- History lost on shell exit

#### C8. Monitor navigation undiscoverable
- 5 pages (Home/Spaces/Foundry/Catalog/Models) with hidden hotkeys
- 35+ keyboard shortcuts, only 6-7 shown in status bar
- No visible tab bar or page indicator

#### C9. Monitor scroll limits hardcoded
- `MAX_OFFSET = 50` — can't scroll past 50 entries
- `MAX_DEPTH = 3`, `MAX_ITEMS = 15` in filesystem view — silently clipped

#### C10. Monitor error states ambiguous
- Stale data not visually distinguished from fresh data
- All API errors show same generic message

---

### D. LOW — Polish Items

#### D1. Double output (text + JSON) on some commands
- `session info`, `session create`, `session vars get` show formatted text AND raw JSON
- The JSON blob is redundant in text mode
- Only show JSON when `--json` flag is used

#### D2. Workflow list description column too wide
- `maestro workflows` table: Description column contains full paragraphs
- Table extends to 300+ chars wide, wraps badly in terminals

#### D3. Events show stale data
- `session events` shows "Block registry initialized with 16 blocks" (old count)
- Events are historical, but can be confusing when config has changed

#### D4. `promoteAgent` function call broken
- CLI calls `promoteAgent()` with 4 args but function takes 2
- Will crash at runtime

#### D5. `--json` flag conflict
- `--json` is boolean (output mode) AND string (value input)
- Two different semantics for the same flag

---

## What Works Well

1. **Session creation flow**: Clean output with next-step hints ("Start it with: maestro session start ...")
2. **Template import**: Visual feedback per variable/entry-point/widget — very satisfying
3. **Entry point invocation**: Returns immediately with invocation ID — async model is correct
4. **Execution engine**: Full pipeline runs reliably — for-each, while, phase, inference, validation, file-writer all work
5. **Phase tracking**: `_phases` variable updates in real-time with results, fitness, token counts
6. **Artifact generation**: Reports, metrics JSON, session tree docs all produced correctly
7. **Model switching**: SmolLM2-1.7B, distilgpt2, DeepSeek-Coder, DeepSeek-R1 all switch correctly
8. **Plateau detection**: Optimization phase correctly stops after 5 iterations at same fitness
9. **Variable management**: set/get/list works well with typed data
10. **Health check**: Clear, actionable output with service status

---

## User Experience Summary

### The Good
The core execution engine is **solid**. Both test scenarios ran to completion, produced artifacts, and the data pipeline (session variables, execution tree, LLM activity) works correctly. The template system is elegant — creating a new session type truly only requires JSON.

### The Friction
The **CLI wrapper** around the engine has significant UX debt. A new user would struggle to:
1. Figure out what commands exist (help wall)
2. Create their first session (4 commands, must know template names, copy-paste UUIDs)
3. Know if their workflow is running (no progress indicator, must poll variables manually)
4. Clean up after testing (no bulk delete, stale sessions pile up)

### The Gap
The biggest gap is **integration between CLI and Monitor**. Users need 2-3 terminal windows. There's no unified experience where you can watch a workflow and interact with it in the same interface.
