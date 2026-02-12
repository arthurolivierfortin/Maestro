# V1 Issues — Prioritized Action List

**Generated**: February 11, 2026
**Source**: UX Audit (Phase 16b)

---

## P0 — Must Fix Before Any User Touches This

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 1 | **Fix block discovery config** — `appsettings.json` GlobalBlocks path was wrong. Already fixed, but add a startup check that verifies blocks are found | `appsettings.json`, `Program.cs` | 1h |
| 2 | **Add confirmation to session delete** — require `--force` or interactive prompt | `cli.ts` (session delete handler) | 30min |
| 3 | **Fix `--no-monitor` flag** — session start ignores it, always prints "Monitor window opened!" | `cli.ts` (startSession) | 30min |
| 4 | **Fix `--json` flag before command** — `maestro --json sessions` should not open shell | `cli.ts` (command routing) | 1h |
| 5 | **Fix session list `--status` filter** — currently silently ignored | `cli.ts` (listSessions) | 30min |
| 6 | **Fix `promoteAgent` call mismatch** — 4 args vs 2 params | `cli.ts` (~line 5847) | 15min |

---

## P1 — Critical for V1 UX

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 7 | **ID prefix matching** — allow `f2e844` instead of full UUID for all commands | `cli.ts` (all ID lookups) | 2h |
| 8 | **Streamline session creation** — `--template` and `--start` flags on create | `cli.ts` (createSession) | 2h |
| 9 | **Remove redundant JSON dump** — text mode shows summary + full JSON. Only show JSON with `--json` | `cli.ts` (throughout) | 3h |
| 10 | **Progressive help** — `session --help` shows session commands, not global help | `cli.ts` (help handler) | 3h |
| 11 | **Add `templates list/show`** — discover templates dynamically from filesystem | `cli.ts` (new commands) | 2h |
| 12 | **Session cleanup** — `session list --recent 5`, `session delete-all --status stopped --force` | `cli.ts` (new subcommands) | 3h |
| 13 | **All output through OutputFormatter** — remove raw console.log/error calls | `cli.ts` (throughout) | 4h |
| 14 | **Remove emoji from CLI** — use `cli-colors` semantic helpers consistently | `cli.ts` (throughout) | 2h |
| 15 | **Fix shell session context** — inject context for ALL session subcommands, not just exec | `shell.ts` (~line 221) | 1h |
| 16 | **Session completion status** — distinguish "running (workflow active)" from "running (workflow done)" | Backend: `ProjectSessionServer.cs` | 2h |

---

## P2 — Important for Quality

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 17 | **Exit code convention** — 0=success, 1=user, 2=not found, 3=server, 4=timeout | `cli.ts` (all error paths) | 3h |
| 18 | **Tab completion in shell** — command names, session IDs, block IDs | `shell.ts` | 4h |
| 19 | **Persist shell history** — load/save `.maestro_history` | `shell.ts` | 1h |
| 20 | **Smart table formatting** — max column width, truncation with `...` | `output-formatter.ts` | 3h |
| 21 | **Clarify execute/run/invoke** — better help text or consolidate | `cli.ts` (help text) | 1h |
| 22 | **Validate session state transitions** — can't pause already-completed workflows | Backend: session state machine | 2h |
| 23 | **Monitor: visible navigation bar** — always show `[H]ome [S]paces [F]oundry [C]atalog [M]odels` | `monitor/ink/App.ts` | 3h |
| 24 | **Monitor: dynamic status bar** — show all active shortcuts for current context | `monitor/ink/components/StatusBar.ts` | 3h |
| 25 | **Monitor: fix scroll limits** — compute from content size, not hardcoded 50 | `monitor/ink/hooks/useScroll.ts` | 2h |
| 26 | **Monitor: error state clarity** — gray out stale data, show specific error types | `monitor/ink/components/SessionMonitor.ts` | 3h |
| 27 | **Resolve `--json` flag conflict** — use `--json-value` for input, `--json` for output only | `cli.ts` | 2h |

---

## P3 — Polish to Stand Out

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 28 | **Multi-line JSON input in shell** — quote-aware continuation or `@file` syntax | `shell.ts` (parseArgs) | 3h |
| 29 | **Monitor from shell** — `monitor` command launches for current context | `shell.ts` | 2h |
| 30 | **Progress indicators** — spinners during API calls, phase progress in CLI | `cli.ts`, `shared/utils/` | 3h |
| 31 | **Session `last` command** — show/act on most recently created session | `cli.ts` | 1h |
| 32 | **Monitor: panel direct jump** — number keys 1-5 to focus specific panel | `monitor/ink/hooks/usePanelFocus.ts` | 2h |
| 33 | **Monitor: Home screen pagination** — scroll session list, show 20+ sessions | `monitor/ink/components/HomeScreen.ts` | 2h |
| 34 | **Monitor: metrics always visible** — fitness/iteration in header regardless of mode | `monitor/ink/components/Header.ts` | 2h |
| 35 | **Monitor: small terminal support** — stack panels below 80 cols, min-width check | `monitor/ink/components/SessionMonitor.ts` | 4h |
| 36 | **Startup health check** — on first command, verify backend is reachable; suggest `dev-start.ps1` | `cli.ts` | 1h |
| 37 | **Block discovery startup log** — log number of blocks found, warn if 0 | Backend: `Program.cs` | 30min |

---

## P4 — Feature Requests (Post-V1)

| # | Feature | Source | Effort |
|---|---------|--------|--------|
| 38 | **Cost tracking per session** — aggregate tokens, estimate cost, spending cap | User request | 1-2d |
| 39 | **Dynamic workflow visualization** — animated tree growth during execution | User request | 2-3d |
| 40 | **Session search & filtering** — `sessions --name "foundry*"`, `--template`, `--date` | Audit finding | 1d |
| 41 | **Log export & replay** — `session export <id>`, `session replay <id>` | Audit finding | 2d |
| 42 | **Monitor command palette** — press `:` to run CLI commands from monitor | Audit finding | 3d |
| 43 | **Unified CLI/Monitor** — split-pane with monitor on top, shell on bottom | Audit finding | 5d+ |
| 44 | **`@ts-nocheck` removal** — fully type `cli.ts` (6,600 lines) | Code quality | 3-5d |

---

## Implementation Order Recommendation

### Sprint 1: Make It Not Break (P0)
Items 1-6. Estimated: 1 day. All quick fixes that prevent bad UX on first contact.

### Sprint 2: Make It Usable (P1, top half)
Items 7-11. Estimated: 2 days. ID prefixes, streamlined creation, progressive help.

### Sprint 3: Make It Clean (P1, bottom half + P2 quick wins)
Items 12-16, 19, 21. Estimated: 2 days. Cleanup, consistent output, shell fixes.

### Sprint 4: Make It Polished (P2 remaining)
Items 17-18, 20, 22-27. Estimated: 3-4 days. Exit codes, tab completion, monitor improvements.

### Sprint 5: Make It Stand Out (P3)
Items 28-37. Estimated: 3-4 days. The features that make users say "this is well-made."

**Total estimated to V1-ready: ~10-12 days of focused work.**

---

## Verification Checklist

After implementing P0-P2:
- [ ] New user can create and run a session from `--help` alone
- [ ] `--json` mode works consistently on ALL commands
- [ ] No session deleted without explicit confirmation
- [ ] Small terminal (80x24) doesn't break monitor
- [ ] Shell context works for all session commands
- [ ] Stale sessions can be cleaned up with one command
- [ ] Block discovery failure is visible (not silent passthrough)
- [ ] Error messages suggest next steps
