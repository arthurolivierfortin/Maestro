# Full Audit Report — 2026-02-27

> **PURPOSE: DISCOVERY ONLY.** ~195 findings across 5 layers. No fixes.
> Results feed into phase planning.
>
> **NOTE**: This audit was done via code analysis, NOT live TUI observation.
> A complementary live dogfooding session (TuiDriver/PTY) should validate UX findings.

## Context
- **Date**: 2026-02-27
- **Method**: 5 parallel deep-read agents, each covering one layer
- **Companion file**: `dogfood-notes-2026-02-27-v1-gaps.md` (user-observed issues + ADR)

## Architectural Decisions Made During This Session
- **ADR: Conversation Management** → `docs/system/design-decisions/ADR-CONVERSATION-MANAGEMENT.md`
  - Option B selected: Workflow-driven persistent conversations
  - One session per repo, conversation block as workflow node

---

## Summary Statistics

| Layer | Critical | High | Medium | Low | Total |
|-------|----------|------|--------|-----|-------|
| TUI Components | 5 | 7 | 12 | 8 | 52 |
| Backend API + Executors | 6 | 11 | 21 | 10 | 56* |
| CLI + SDK | 3 | 8 | 12 | 3 | 33 |
| Blocks + Templates | 8 | 0 | 6 | 3 | 17 |
| Tests + Build | 3 | 7 | 5 | 3 | 18 |
| **TOTAL** | **25** | **33** | **56** | **27** | **~176** |

*Backend includes 4 systemic + 4 dead code findings

---

# LAYER 1: TUI COMPONENTS (`packages/maestro-code/`)

## Dead Code (8)

| # | Finding | File | Lines |
|---|---------|------|-------|
| T-DC1 | `GlobalMonitor` component never imported | `components/GlobalMonitor.ts` | 1-215 |
| T-DC2 | `SessionList` only used by dead GlobalMonitor | `components/SessionList.ts` | 1-187 |
| T-DC3 | `PhaseList` component never imported | `components/PhaseList.ts` | 1-118 |
| T-DC4 | `LLMMonitorScreen` component never imported | `components/LLMMonitorScreen.ts` | 1-119 |
| T-DC5 | `createDemoApiClient` factory never called | `mocks/demo-data.ts` | 62-84 |
| T-DC6 | `getCursorInfo` always returns null, never called | `components/SessionMonitor.ts` | 228-234 |
| T-DC7 | Unnecessary `path` alias in SessionManager | `services/SessionManager.ts` | 84 |
| T-DC8 | `ink-table.ts` / `ink-table-launcher.ts` not integrated | Root files | - |

## Type Safety (5)

| # | Finding | Severity |
|---|---------|----------|
| T-TS1 | **33 files** use `// @ts-nocheck` — entire package has zero type safety | CRITICAL |
| T-TS2 | `require()` in ESM-parsed files (LLMMonitorScreen, headless.ts) — crash risk | HIGH |
| T-TS3 | `launcher.ts` uses `module.exports` (CJS in TS file) | MEDIUM |
| T-TS4 | `headless.ts` has 4 `require()` calls — works via CJS but fragile | MEDIUM |
| T-TS5 | SessionManager client typed as `any` — no type checking | LOW |

## API/Type Contract Mismatches (10) — CRITICAL

| # | Finding | Impact |
|---|---------|--------|
| T-API1 | **`LLMHealth` has `model` but components read `activeModel`** — always undefined | Model name never shown correctly |
| T-API2 | **`LLMModel` has `id` but components use `modelId`** — always undefined | Models show as "Unknown", Enter never opens detail |
| T-API3 | `DemoApiClient.getLLMHealth()` returns `model`, components expect `activeModel` | Demo mode also broken |
| T-API4 | `DemoApiClient` doesn't implement `_fetch` for non-trivial paths | Agent invoke silently returns `{}` in demo |
| T-API5 | `SessionManager` relies on undocumented `_fetch` method not in `IApiClient` | Will crash with different client impl |
| T-API6 | `DemoApiClient.getLLMStatus()` `activeModel` read from wrong source | ModelsScreen reads health, not status |
| T-API7 | `ActiveSessionCard` `onSelect` prop declared but never called | Dead parameter |
| T-API8 | `StatusBar` receives `currentPage: 'session'` — not a valid PageName | No tab highlighted in detail views |
| T-API9 | `ModelDetail`, `WorkspaceDetail`, `RepoDetail` render own StatusBar + App renders another | **Double status bars** |
| T-API10 | `importSessionTemplate` not passed from App.ts to SessionManager — defaults to no-op | **Templates never imported** |

## Edge Cases / Missing Guards (9)

| # | Finding | File |
|---|---------|------|
| T-EC1 | `navigateDown` allows index -1 when list empty | HomeScreen.ts:259 |
| T-EC2 | Same -1 index bug in FoundryScreen, CatalogScreen, ModelsScreen, SpacesScreen | Multiple |
| T-EC3 | `ConversationLog` slices with negative indices possible | ConversationLog.ts:26 |
| T-EC4 | No scroll windowing in ModelsScreen model list (renders ALL) | ModelsScreen.ts:197 |
| T-EC5 | No scroll windowing in BlockDetail sessions list | BlockDetail.ts:326 |
| T-EC6 | No scroll windowing in WorkspaceDetail/RepoDetail sessions | Multiple |
| T-EC7 | `AgentPanel` hardcodes height to 999 — renders far more lines than visible | AgentPanel.ts:47 |
| T-EC8 | `LLMMonitorScreen` uses React elements in template literals → `[object Object]` | Dead code, but shows pattern |
| T-EC9 | `SessionList` `padToFit/padRight` functions are no-ops → card borders misaligned | Dead code |

## Keyboard / Interaction Bugs (9)

| # | Finding | Severity |
|---|---------|----------|
| T-KB1 | **`A` key conflict on SpacesScreen** — filter overwritten by page nav | CRITICAL |
| T-KB2 | **QuitConfirmation in HomeScreen says "Quit Maestro Monitor?"** — wrong product name | HIGH |
| T-KB3 | `TaskInputBar` cursor position tracked but never shown visually | HIGH |
| T-KB4 | `AgentScreen` Escape triggers quit instead of navigating back | MEDIUM |
| T-KB5 | `HelpOverlay` in SessionMonitor says "Press any key" but only specific keys dismiss | MEDIUM |
| T-KB6 | `SpacesScreen` `R` key = "Running" filter, but convention is `R` = refresh | LOW |
| T-KB7 | `GlobalMonitor` `H` = help instead of Home (dead code, inconsistent) | Dead code |
| T-KB8 | `QuitConfirmation` duplicated in AgentScreen and HomeScreen | Design debt |
| T-KB9 | `SessionRow` component duplicated across 4 files | Design debt |

## Visual / UX Bugs (6)

| # | Finding | File |
|---|---------|------|
| T-VIS1 | No horizontal truncation for narrow terminals (<120 cols) | All screens |
| T-VIS2 | NavBar receives `currentPage: 'session'` — no active tab in detail views | SessionMonitor.ts |
| T-VIS3 | Double StatusBar in ModelDetail, WorkspaceDetail, RepoDetail | Multiple |
| T-VIS4 | `STATE_DISPLAY` duplicated in AgentScreen and AgentPanel | Code duplication |
| T-VIS5 | `SessionList` card borders broken (dead code) | SessionList.ts |
| T-VIS6 | Hardcoded `padEnd(30)`/`padEnd(35)` assumes 120-col terminal | All row components |

## Missing Error Handling (5)

| # | Finding | Impact |
|---|---------|--------|
| T-ERR1 | `ensureSession` no cleanup on failed template import — session left half-initialized | Session unusable |
| T-ERR2 | `startPolling` swallows ALL errors silently — backend down = user sees nothing | Infinite silent polling |
| T-ERR3 | `startWidgetPolling` swallows ALL errors silently | Same |
| T-ERR4 | `SpacesScreen` `listSessions` has no `.catch()` — unhandled rejection | Possible crash |
| T-ERR5 | `HomeScreen` calls `apiClient.getHealth()` without null check | Crash if no backend |

---

# LAYER 2: BACKEND API + EXECUTORS (`apps/backend/src/`)

## CRITICAL (6)

| # | Finding | Impact |
|---|---------|--------|
| B-C1 | **Path traversal in BlocksController** — `../../` in filePath reads/writes arbitrary files | SECURITY |
| B-C2 | **Shell command injection in ToolBlockExecutor** — user input to `cmd.exe /c` | SECURITY |
| B-C3 | **BlocksController.Update destroys all block data** — only id+name+type preserved | DATA LOSS |
| B-C4 | **DI scope mismatch** — Scoped services used in `Task.Run` that outlives HTTP request | CRASH/LEAK |
| B-C5 | **Fire-and-forget `Task.Run`** — no cancellation, unobserved exceptions lost | RELIABILITY |
| B-C6 | **WorkspacesController mutations not persisted** — 5 endpoints return 200 but don't save | DATA LOSS |

## HIGH (11)

| # | Finding |
|---|---------|
| B-H1 | `BlockDto.FromDomain` always sets `CreatedAt = DateTime.UtcNow` — timestamps always wrong |
| B-H2 | Duplicate event subscription in `ProjectSessionServer.StartAsync` |
| B-H3 | `IExecutionMonitor` registered twice, first dead |
| B-H4 | `FileSystemProjectSessionRepository` unbounded `_cache` dictionary — memory leak |
| B-H5 | `FileSystemBlockDiscoveryService` synchronous I/O in constructor blocks startup |
| B-H6 | Sync-over-async `.GetAwaiter().GetResult()` in `JsonSchemaBlockValidator` — deadlock risk |
| B-H7 | `BlockExecutorRegistry` case-sensitive lookup — `"Agent"` ≠ `"agent"` |
| B-H8 | `NormalizeObjectValue` returns empty string for null JsonElements — corrupts nulls |
| B-H9 | `ConvertJsonElement` uses `null!` — hides NRE potential |
| B-H10 | Permissions and BlockRegistry always Full/Empty on deserialization — restrictions lost |
| B-H11 | InferenceBlockExecutor streaming creates zero-token metrics |

## MEDIUM (21)

| # | Finding |
|---|---------|
| B-M1 | `WorkflowExecutionController` dynamic dispatch always fails (empty catch) |
| B-M2 | Duplicate Session APIs (`SessionsController` + `ProjectSessionsController`) |
| B-M3 | `FileSystemBlockDiscoveryService` swallows ALL exceptions (8 empty catch blocks) |
| B-M4 | `OnFileChanged` tries to load deleted files |
| B-M5 | `WatchForChangesAsync` is a no-op |
| B-M6 | `AgentBlockExecutor` mutable fields not thread-safe |
| B-M7 | `EntryPointExecutor` is 4,251 lines — god class |
| B-M8 | Three duplicate `ResolveTemplate` implementations with different behavior |
| B-M9 | `SystemController` uses Windows-only WMI — fails on Linux/macOS |
| B-M10 | InferenceBlockExecutor silently falls back from streaming |
| B-M11 | `LLMBlockExecutorBase` hardcoded pricing is stale |
| B-M12 | `ToolBlockExecutor` `disableNetwork` flag logged but never enforced |
| B-M13 | `ToolBlockExecutor` naive shell script conversion (`echo` → `Write-Output`) |
| B-M14 | **5 block executors NOT registered in DI** (decision, validator, trigger, composite, script) |
| B-M15 | `WorkspacesController.LoadFromPath` returns 501 |
| B-M16 | `BlockDefinition.AddCapabilities` adds duplicates |
| B-M17 | `CheckPauseAsync` race condition — session mutated from multiple threads |
| B-M18 | Duplicate `MonitorWidgetConfigDto` definitions |
| B-M19 | `ProjectSessionDto` missing config fields |
| B-M20 | `ContextBlockExecutor.GetConfigBool` convoluted pattern matching |
| B-M21 | `ConversationBlockExecutor` missing operations (truncate, summarize, list) |

## Systemic Issues (4)

| # | Issue | Locations |
|---|-------|-----------|
| B-S1 | **JsonElement vs native type confusion** — 5+ different normalization methods | 9 files |
| B-S2 | **Swallowed exceptions** — 20+ empty `catch { }` blocks | 6+ files |
| B-S3 | **Dual JSON serializer** (Newtonsoft API + System.Text.Json internal) — root cause of S1 | Program.cs |
| B-S4 | **Missing executor DI registrations** — 5 block types have no executor | Program.cs |

---

# LAYER 3: CLI + SDK

## CLI Bugs (9)

| # | Finding | Severity |
|---|---------|----------|
| C-B1 | `client.getModels?.()` doesn't exist — `check` and `tiers` commands broken | CRITICAL |
| C-B2 | `--api-url` flag silently ignored (no writable `baseUrl` property) | CRITICAL |
| C-B3 | `discoverProjects(path)` — path argument silently dropped | HIGH |
| C-B4 | **`@ts-nocheck` on 8,877-line file** | HIGH |
| C-B5 | `handleApiError` reads orphan `client.baseUrl` property | MEDIUM |
| C-B6 | `launchInkTable` import may not exist — crashes at runtime | MEDIUM |
| C-B7 | `authStatus.enabled` doesn't exist in SDK type (should be `authenticated`) | MEDIUM |
| C-B8 | `block.type` instead of `block.blockType` in `getBlockInfoExtended` — shows undefined | HIGH |
| C-B9 | `commitSession` command injection via unescaped message | HIGH |

## CLI Missing Features (3)

| # | Feature |
|---|---------|
| C-M1 | No `session set-var` shortcut (CLAUDE.md documents it but doesn't exist) |
| C-M2 | Missing `workspace create`, `workspace add-session`, `workspace remove-session` |
| C-M3 | Hardcoded `v2.0.0` version in help text |

## SDK Bugs (8)

| # | Finding | Severity |
|---|---------|----------|
| S-B1 | `blocks.children()` wrong return type — backend returns hierarchy object | HIGH |
| S-B2 | **`blocks.updateContent()` double-serializes** — content corrupted | CRITICAL |
| S-B3 | `llm.complete()` endpoint may not match backend route | MEDIUM |
| S-B4 | `sessions.invoke()` exists but CLI adapter doesn't wrap it | MEDIUM |
| S-B5 | `variables` domain exists but CLI bypasses it entirely | MEDIUM |
| S-B6 | `workspaces` domain partially wrapped — create/add/remove missing from adapter | MEDIUM |
| S-B7 | No streaming support in HTTP transport | MEDIUM |
| S-B8 | 429 retry without `Retry-After` header | LOW |

## SDK Type Mismatches (8) — CRITICAL pattern

| Type | Typed Fields | Backend DTO Fields | Coverage |
|------|-------------|-------------------|----------|
| `BlockDefinition` | 6 | 17+ | **35%** |
| `Session` | 5 | 21 | **24%** |
| `Workspace` | 3 | 21 | **14%** |
| `Project` | 3 | 12 | **25%** |
| `LLMModel` | mixed | 3 different DTOs | Flat merge of 3 types |
| `HealthResponse` | 3 | 5 | **60%** |
| `BlockMetrics` | 4 | 17 | **Wrong structure** |
| `BlockRunData` | 0 | unknown | **0%** |

All missing fields only accessible via `[key: string]: unknown` catch-all — zero type safety.

## CLI Adapter `adapt-optimize.ts` Bugs (5)

| # | Finding |
|---|---------|
| AO-1 | `m.modelId || m.id` fallback chain (CLAUDE.md forbids this) |
| AO-2 | `response?.models || response` redundant (SDK already unwraps) |
| AO-3 | `costPerMillionInputTokens` field doesn't exist in any DTO |
| AO-4 | `parametersBillions` field doesn't exist (correct is `parametersB`) |
| AO-5 | `@ts-nocheck` on entire file |

---

# LAYER 4: BLOCKS + TEMPLATES

## Session Templates — 7 of 10 BROKEN

| Template | Entry Points | Status |
|----------|-------------|--------|
| `agent-dev` | 5/5 reference phantom blocks | **BROKEN** |
| `compliance-tester` | 2/2 reference draft-only blocks | **BROKEN** |
| `doc-generator` | 3/3 reference non-existent blocks | **BROKEN** |
| `foundry-default` | 5/5 reference draft-only blocks | **BROKEN** |
| `foundry-sandbox` | 2/2 path normalization produces wrong IDs | **BROKEN** |
| `foundry-training` | 3/3 path normalization produces wrong IDs | **BROKEN** |
| `project-autonomous` | 3/3 valid | OK |
| `project-v4` | 4/4 valid | OK |
| `jarvis` | 1/1 valid | OK |
| `maestro-assistant` | 1/1 valid | OK (minimal) |

## Block Issues (10)

| # | Finding | Severity |
|---|---------|----------|
| BL-1 | `directory-list` block only in `_drafts/` — referenced by 3 agent prompts | CRITICAL |
| BL-2 | `generate-commit-message` workflow: ALL 4 blockRefs use wrong path-style format | CRITICAL |
| BL-3 | `inference` blockRef in 3 composite agents — no block with id `inference` exists | MEDIUM |
| BL-4 | **15 agent blocks have `isAtomic: true`** — contradicts architecture (agents = composite) | MEDIUM |
| BL-5 | `implement-single-step` uses ambiguous `"model": "claude-sonnet"` | LOW |
| BL-6 | `foundry-sandbox` missing `_phases`, `_monitorDescriptor`, system variables | MEDIUM |
| BL-7 | `foundry-training` missing system variables + references non-existent allowed tools | MEDIUM |
| BL-8 | `doc-generator` missing `authority` field | LOW |
| BL-9 | `maestro-assistant` no `monitorWidgets` array | LOW |
| BL-10 | 10+ orphaned blocks (defined but never referenced by any workflow) | Info |

---

# LAYER 5: TESTS + BUILD HEALTH

## Critical Test Infrastructure Issues (3)

| # | Finding | Impact |
|---|---------|--------|
| TB-1 | **Backend solution includes only 1 of 6 test projects** — `dotnet test` runs Domain tests only | 5 test projects silently excluded |
| TB-2 | **2 test projects have NO .csproj** (`Maestro.Api.Tests`, `Maestro.Workflows.Tests`) — orphan code | Tests can never compile |
| TB-3 | **React 18 vs React 19 split** — `apps/desktop` React 18, all TUI packages React 19 | Semver-incompatible |

## Test Coverage Gaps (7)

| Area | Coverage |
|------|----------|
| maestro-code components | 2/33 have dedicated tests |
| maestro-code SessionManager | ZERO tests |
| Backend block executors | 3/13 tested (agent, conversation, memory, decision, etc. = 0) |
| Backend EntryPointExecutor | ZERO tests |
| SDK domain modules | 4/16 have surface-level tests |
| TUI design system components | 0/17 tested |
| maestro-monitor components | 1/28 tested |

## TypeScript Health

| Metric | Count |
|--------|-------|
| Files with `@ts-nocheck` | **83** |
| Packages affected | 5 (maestro-code, tui, maestro-monitor, maestro-cli, some tests) |

## Package Health

| Issue | Details |
|-------|---------|
| Vitest version split | Root `^4.0.18` vs client/sidecar `^3.0.0` |
| Missing `test` scripts | @maestro/cli, @maestro/tui, @maestro/monitor, provider-monitor, apps/mcp |
| Missing vitest configs | @maestro/client, provider-monitor |
| provider-monitor | Zero tests, zero scripts |
| apps/mcp | Single file, zero tests |

---

# CROSS-CUTTING: V1 FEATURES STILL MISSING

(From initial user-reported issues + code analysis)

## Must-Have (V1 blockers)

1. **Conversation persistence** — agent has amnesia between messages (ADR written)
2. **Session reuse** — new session on every TUI launch
3. **Slash commands** — only `/quit` exists. Need: `/help`, `/clear`, `/new`, `/switch`, `/stop`, `/model`, `/status`
4. **Task cancellation** — no way to stop a running agent
5. **Context/token visibility** — user has no idea how much context is used
6. **Error detail + retry** — single-line errors, no retry action
7. **Help overlay on all pages** — only SessionMonitor has `?`
8. **Working directory indicator** — user doesn't know which repo is active

## Expected (V1 quality bar)

9. Block creation/editing from TUI (Foundry page is read-only)
10. Block approval/publication panel
11. Multi-line input in TaskInputBar
12. Conversation switching UI
13. Diff view for file changes
14. Model switching from Models page
15. Git status integration
16. Cost/token tracking
17. Clipboard support

## Post-V1

18. Onboarding / first-run
19. File tree browser
20. Input autocomplete
21. Notifications/toasts
22. Theme switching
23. Session deletion/archiving
24. Voice mode UI
25. Conversation export
26. Agent interruption (human-in-the-loop)

---

# METHODOLOGY NOTE

This audit was conducted via **code analysis only** (5 parallel Explore agents reading source files). Per the dogfooding methodology (`docs/guides/ai-agents/dogfooding-methodology.md`), a proper dogfooding session should also include:

1. **Live TUI observation** via TuiDriver/PTY
2. **Visual verification** of each screen
3. **Interactive testing** of all keyboard shortcuts
4. **Flow testing** (multi-step user journeys)
5. **API state verification** (curl after each action)

The code analysis found ~176 issues, but some may not manifest in practice and others may only be visible in live interaction. A complementary live session is recommended.
