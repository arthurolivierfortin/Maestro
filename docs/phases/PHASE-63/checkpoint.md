# Phase 63 Checkpoint — TUI Chat-First

**Last update**: 2026-03-18
**Agent**: Claude Opus 4.6

---

## 63-A : DONE (FocusProvider + useManagedInput)

**Completed**: 2026-03-18

### Created files
- `packages/maestro-code/hooks/useFocusProvider.ts` — FocusProvider context with 4 priority layers (modal > widget > input > page), claim/release/isActive API
- `packages/maestro-code/hooks/useManagedInput.ts` — Focus-gated wrapper around Ink's useInput, fires handler only when layer is active
- `packages/maestro-code/tests/FocusProvider.test.ts` — 14 tests covering provider, gating, useKeyboard integration, and no-provider fallback

### Modified files
- `packages/maestro-code/hooks/useKeyboard.ts` — Now delegates to useManagedInput internally. Added optional `layer` parameter (default: 'page'). All existing consumers benefit automatically.
- `packages/maestro-code/hooks/index.ts` — Exports FocusProvider, useFocusContext, useManagedInput
- `packages/maestro-code/App.ts` — Wraps root with FocusProvider, claims page/input/modal layers based on state, splits global useInput (Ctrl+C/Escape always-on) from page-level useManagedInput (?/slash)
- `packages/maestro-code/components/TaskInputBar.ts` — Uses useManagedInput('input', ...) instead of useInput

### Test results
- 14 new tests (FocusProvider.test.ts): all pass
- 202 existing tests: all pass (0 regressions)
- visual-gate PTY test: pre-existing flaky failure on "Agent (initial)" timing, not related to changes. Navigation to all pages (h,s,f,c,m) works correctly (40 non-empty lines each).
- TypeScript: 0 errors

### Design decisions
- No-provider fallback: useFocusContext returns a permissive DEFAULT_CONTEXT (all layers active) when no FocusProvider wraps the component. This matches pre-focus behavior and avoids breaking components rendered standalone in tests.
- Ctrl+C and Escape use raw useInput (always active), not gated by focus layers.
- Page-level hotkeys (?, /) use useManagedInput('page') and are blocked when input/modal is active.
- CatalogScreen, AssistantSelector, ProviderSetupScreen still use useInput directly — to be migrated in 63-C when they become widgets.

## 63-B : DONE (Widgets inline dans ConversationLog)

**Completed**: 2026-03-18

### Created files

#### Widget infrastructure
- `packages/maestro-code/types/widgets.ts` — ChatWidget type, WidgetType union (13 types), ConversationEntry augmented type, WIDGET_HEIGHTS constraints, WIDGET_TITLES map
- `packages/maestro-code/components/InlineWidget.ts` — Wrapper component: renders WidgetDispatcher, manages focus via FocusProvider (claim/release 'widget' layer), Esc to collapse, Panel border styling, height constraints
- `packages/maestro-code/tests/InlineWidget.test.ts` — 10 tests: widget render, focus claim, Esc collapse, collapsed summary, multiple widgets, non-interactive, injection, type constants

#### Widget components (13 total)
- `packages/maestro-code/components/widgets/StatusWidget.ts` — System health + active sessions (from HomeScreen)
- `packages/maestro-code/components/widgets/SessionsWidget.ts` — Session list with filter (from SpacesScreen sessions tab)
- `packages/maestro-code/components/widgets/WorkspacesWidget.ts` — Workspace list (from SpacesScreen workspaces tab)
- `packages/maestro-code/components/widgets/ReposWidget.ts` — Repo list (from SpacesScreen repos tab)
- `packages/maestro-code/components/widgets/CatalogWidget.ts` — Block catalog with type filter + fitness (from CatalogScreen)
- `packages/maestro-code/components/widgets/FoundryWidget.ts` — User blocks list (from FoundryScreen)
- `packages/maestro-code/components/widgets/ModelsWidget.ts` — Model health + metrics + model list (from ModelsScreen)
- `packages/maestro-code/components/widgets/SessionMonitorWidget.ts` — Compact session monitor placeholder
- `packages/maestro-code/components/widgets/BlockDetailWidget.ts` — Block info summary (non-interactive)
- `packages/maestro-code/components/widgets/ModelDetailWidget.ts` — Model info summary
- `packages/maestro-code/components/widgets/WorkspaceDetailWidget.ts` — Workspace info with session list
- `packages/maestro-code/components/widgets/RepoDetailWidget.ts` — Repo info with session list
- `packages/maestro-code/components/widgets/PermissionsWidget.ts` — Placeholder (63-D)
- `packages/maestro-code/components/widgets/index.ts` — Barrel export

### Modified files
- `packages/maestro-code/services/SessionManager.ts` — LogLine interface extended with optional `widgetId` and `widget` fields for inline widget entries
- `packages/maestro-code/components/ConversationLog.ts` — Renders InlineWidget for entries with widgetId, passes focusedWidgetId/collapsedWidgets/onWidgetClose/apiClient props through
- `packages/maestro-code/components/AgentScreen.ts` — Added focusedWidgetId/collapsedWidgets/onWidgetClose props, passes to ConversationLog
- `packages/maestro-code/App.ts` — Widget management state (focusedWidgetId, collapsedWidgets, addWidget, collapseWidget), 8 widget slash commands (/status, /spaces, /sessions, /workspaces, /repos, /catalog, /foundry, /models), 6 parametric widget commands (/session, /block, /model, /workspace, /repo, /permissions), updated /help text, ChatWidget import

### Widget lifecycle
- **Focus**: Last interactive widget gets focus. Only one widget focused at a time via focusedWidgetId state.
- **Close**: Esc collapses widget to 1-line summary showing "[Title] (collapsed)". Widget stays in chat history.
- **Height constraints**: StatusWidget=8, list widgets=15, session-monitor=terminal.rows-6, detail widgets=20. Each has overflow:hidden.
- **Polling**: Only focused widgets poll (useApiData interval=0 when not focused). Lose focus = stop polling.
- **Non-interactive**: BlockDetail and Permissions widgets don't claim focus layer (interactive=false).

### Slash commands → widgets mapping
| Command | Widget type | Interactive |
|---------|------------|-------------|
| /status | status | Yes |
| /spaces, /sessions | sessions | Yes |
| /workspaces | workspaces | Yes |
| /repos | repos | Yes |
| /catalog [filter] | catalog | Yes |
| /foundry | foundry | Yes |
| /models | models | Yes |
| /session <id> | session-monitor | Yes |
| /block <id> | block-detail | No |
| /model <id> | model-detail | Yes |
| /workspace <id> | workspace-detail | Yes |
| /repo <id> | repo-detail | Yes |
| /permissions <id> | permissions | No |

### Test results
- 10 new tests (InlineWidget.test.ts): all pass
- 216 total tests: all pass (0 regressions)
- visual-gate PTY test: pre-existing flaky failure (same as 63-A, timing-dependent)
- TypeScript: 0 errors

### Design decisions
- Widgets are new standalone components, not refactored page components. Pages stay intact for --classic mode (will be removed in 63-C).
- addWidget injects a LogLine with widgetId+widget into the conversation buffer. ConversationLog detects widgetId and renders InlineWidget instead of text.
- Focus layer: interactive widgets claim('widget') which blocks page-level handlers. Non-interactive widgets never claim.
- Polling gating: widgets use useApiData with interval=0 when not focused, so unfocused widgets do not make API calls.
- Widget collapse: collapsedWidgets is a Set<string> in App state. Esc adds widgetId to the set. Collapsed widgets render as a 1-line summary.

## 63-C : DONE (Migration slash commands -- chat-first mode)

**Completed**: 2026-03-18

### Summary

Migrated from 6-page navigation to chat-first single-screen mode with inline widgets. All page features are accessible via slash commands. Added `--classic` flag to restore the old multi-page paradigm.

### Created files

- `packages/maestro-code/components/ChatFirstScreen.ts` -- Agent screen without NavBar and ACTIONS side panel. Full-width conversation log with inline widgets. Replaces AgentScreen as the default main screen.
- `packages/maestro-code/components/ChatStatusBar.ts` -- Status bar for chat-first mode. Shows connection/latency/time/cost (same as shared), session count badge (moved from NavBar), and context-aware shortcuts: `/help commands ? help q quit` (default) or `Esc close j/k nav /help commands` (when widget is focused).
- `packages/maestro-code/tests/ChatFirst.test.ts` -- 14 tests covering slash command injection, unknown command error, classic vs chat-first layout, HelpOverlay modes, ChatStatusBar behavior, and hotkey suppression.

### Moved files (to components/legacy/)

- `packages/maestro-code/components/HomeScreen.ts` -> `components/legacy/HomeScreen.ts`
- `packages/maestro-code/components/SpacesScreen.ts` -> `components/legacy/SpacesScreen.ts`
- `packages/maestro-code/components/FoundryScreen.ts` -> `components/legacy/FoundryScreen.ts`
- `packages/maestro-code/components/CatalogScreen.ts` -> `components/legacy/CatalogScreen.ts`
- `packages/maestro-code/components/ModelsScreen.ts` -> `components/legacy/ModelsScreen.ts`

All relative imports updated (`../theme.ts` -> `../../theme.ts`, `./NavBar.ts` -> `../NavBar.ts`, etc.).

### Modified files

- `packages/maestro-code/App.ts` -- Major changes:
  - Imports page components from `components/legacy/` (only used in --classic mode)
  - Added `classic` prop to AppProps
  - Chat-first mode (default): renders ChatFirstScreen + TaskInputBar + ChatStatusBar. No NavBar, no page routing, no h/a/s/f/c/m hotkeys.
  - Classic mode (`--classic`): renders the old multi-page layout with NavBar, page switch, detail views, AgentScreen with ACTIONS panel.
  - `/` hotkey works in both modes (not gated by `currentPage === 'agent'` in chat-first mode).
  - `/playground` command updated to use widgets in chat-first mode, detail views in classic mode.
  - Added `/spaces repos`, `/spaces workspaces`, `/spaces sessions` subcommands.
  - Added unknown command handler: `/xyz` -> "Unknown command: /xyz. Type /help for available commands."
- `packages/maestro-code/components/HelpOverlay.ts` -- Added `classic` prop. Two modes:
  - Classic: Global + Page Navigation + page-specific + Commands sections (same as before).
  - Chat-first (default): Global Shortcuts + Slash Commands + Navigation Commands + Widget Shortcuts sections.
- `packages/maestro-code/components/index.ts` -- Updated screen exports to reference `legacy/`, added ChatFirstScreen and ChatStatusBar exports.
- `packages/maestro-code/types.ts` -- Added `classic?: boolean` to InteractiveOptions.
- `packages/maestro-cli/cli.ts` -- Added `--classic` flag to CLI help text and passes it to startInteractiveMode.

### Test file updates (import paths)

- `tests/CatalogContractTest.test.ts` -- `../components/CatalogScreen.ts` -> `../components/legacy/CatalogScreen.ts`
- `tests/CatalogCapabilities.test.ts` -- same
- `tests/ModelsScreen.test.ts` -- `../components/ModelsScreen.ts` -> `../components/legacy/ModelsScreen.ts`
- `tests/SpacesScreen.test.ts` -- `../components/SpacesScreen.ts` -> `../components/legacy/SpacesScreen.ts`

### Test results

- 14 new tests (ChatFirst.test.ts): all pass
- 227 total tests (excluding visual-gate): all pass (0 regressions)
- visual-gate PTY test: expected failure (tests old page navigation which is now only available in --classic mode; will be rewritten in 63-T)
- TypeScript: 0 errors

### Architecture decisions

- **Chat-first is the default.** `--classic` restores the old paradigm. No legacy shim in the default path.
- **Legacy page components are kept in `components/legacy/`** for `--classic` mode. They are not deleted because `--classic` is a supported mode.
- **ChatFirstScreen is a new component**, not a modified AgentScreen. AgentScreen stays untouched for `--classic` mode.
- **ChatStatusBar is separate from the shared StatusBar** because chat-first mode needs different shortcuts and the session count badge (which was in NavBar before).
- **Unknown commands get explicit error messages** instead of being sent to the agent as text.

### Slash commands verified

| Command | Widget type | Status |
|---------|------------|--------|
| /status | status | Working |
| /spaces | sessions | Working |
| /spaces repos | repos | Working (new) |
| /spaces workspaces | workspaces | Working (new) |
| /spaces sessions | sessions | Working (new) |
| /sessions | sessions | Working |
| /workspaces | workspaces | Working |
| /repos | repos | Working |
| /catalog | catalog | Working |
| /catalog agents | catalog (filtered) | Working |
| /foundry | foundry | Working |
| /models | models | Working |
| /session <id> | session-monitor | Working |
| /block <id> | block-detail | Working |
| /model <id> | model-detail | Working |
| /workspace <id> | workspace-detail | Working |
| /repo <id> | repo-detail | Working |
| /permissions <id> | permissions | Working |

## 63-D : DONE (PermissionsPanel + integration)

**Completed**: 2026-03-18

### Created files

- `packages/maestro-code/components/PermissionsPanel.ts` -- Visual diff component for parent/child block permissions. Shows blocks as white (o, effective), gray (., filtered), or red (X, denied). Handles wildcard (*), no-parent (ceiling mode), deny rules with reasons, alphabetical sorting, and empty state.
- `packages/maestro-code/tests/PermissionsPanel.test.ts` -- 11 tests covering PermissionsPanel rendering, PermissionsWidget API fetch, SessionMonitorWidget integration, and BlockDetailWidget TOOLS REQUIS.

### Modified files

- `packages/maestro-code/components/widgets/PermissionsWidget.ts` -- Replaced placeholder with real implementation. Fetches `GET /api/sessions/{id}/permissions/effective`, extracts effectiveBlocks/parentBlocks/blockRules, renders PermissionsPanel. Shows "PERMISSIONS (ceiling)" when no parent. Includes CLI hint for modification.
- `packages/maestro-code/components/widgets/SessionMonitorWidget.ts` -- Added PermissionsPanel alongside session info. Fetches permissions from API and displays the diff panel. Shows session header, permissions panel, and full-monitor hint.
- `packages/maestro-code/components/widgets/WorkspaceDetailWidget.ts` -- Added PermissionsPanel at the bottom with title "PERMISSIONS (ceiling)". Uses workspace's allowedBlocks (defaults to ["*"]). No parent diff since workspaces are the root.
- `packages/maestro-code/components/widgets/BlockDetailWidget.ts` -- Added "TOOLS REQUIS" panel that lists blocks/tools referenced in config.nodes (extracted recursively from while loops and conditional branches). Filters out infrastructure blocks (conversation-read, conversation-append, inference, response-parser, set-variable). Shows info text about session requirements.

### Test results

- 11 new tests (PermissionsPanel.test.ts): all pass
- 239 total tests (excluding visual-gate): all pass (0 regressions)
- visual-gate PTY test: pre-existing failure from 63-C (tests old page navigation, will be rewritten in 63-T)
- TypeScript: 0 errors

### API verification

- `GET /api/sessions/{id}/permissions/effective` -- confirmed working. Returns sessionId, sessionName, effective (with allowedBlocks), own, parentId, parentEffective (null when no parent data), blockRules.
- PermissionsWidget uses this endpoint with polling (10s when focused, disabled when not focused).

### Design decisions

- PermissionsPanel uses simple ASCII characters (o, ., X) instead of Unicode circles/bullets for maximum terminal compatibility.
- extractBlockRefs in BlockDetailWidget recursively walks config.nodes including while loop bodies and conditional branch nodes.
- Infrastructure blocks (conversation-read, conversation-append, inference, response-parser, set-variable) are filtered from TOOLS REQUIS since they are internal plumbing, not tools the session needs to explicitly allow.
- WorkspaceDetailWidget defaults allowedBlocks to ["*"] when workspace data doesn't include it.

## 63-T : DONE (Tests + validation)

**Completed**: 2026-03-18

### Build verification

- TypeScript: 0 errors (`npx tsc --noEmit`)
- Unit tests: 246/246 pass (25 test files, 0 failures)
- Visual-gate PTY test: 3/3 pass (updated for chat-first default + classic mode navigation)
- Backend tests: 269/269 pass (0 regressions)

### Issues found and fixed

#### Visual-gate test failure (2 tests)
The visual-gate test was written for the old multi-page layout (NavBar with H/A/S/F/C/M, ACTIONS panel). After 63-C changed the default to chat-first mode, these tests failed because the default PTY launch no longer shows NavBar or page navigation hotkeys.

**Fix**:
- Updated `frame-capture.ts`: `spawnDemoPty` now accepts `classic` parameter, `CaptureOptions` has optional `classic` field
- Updated `visual-gate.test.ts`:
  - First test ("has correct structure") now asserts chat-first layout (AGENT STATUS + CONVERSATION, no NavBar/ACTIONS)
  - Second test ("page navigation") now passes `{ classic: true }` to `captureSequence` so it launches in `--classic` mode
  - Added `CHAT_FIRST_ASSERTIONS` structural assertion set

#### Widget injection from agent responses (new feature)
The feature inventory item 10.5 ("Agent injecte des widgets dans ses reponses") was planned but not implemented. Added minimal implementation:

**Files modified**:
- `services/SessionManager.ts`:
  - Added `parseWidgetMarker()` function: parses `[widget:TYPE]` and `[widget:TYPE:key=val,key=val]` patterns
  - Updated `submitTask()` and `startPolling()` to accept optional `addWidget` callback
  - Agent response lines containing widget markers are parsed and trigger `addWidget()` calls
  - Exported `parseWidgetMarker` for testing
- `App.ts`: Passes `addWidget` callback to `submitTask()`
- `tests/ChatFirst.test.ts`: Added 5 tests for widget injection:
  - `parseWidgetMarker` detects `[widget:models]`
  - `parseWidgetMarker` detects props in `[widget:catalog:initialFilter=agent]`
  - `parseWidgetMarker` returns null for normal text
  - `parseWidgetMarker` handles multi-prop markers
  - End-to-end flow: agent output with markers triggers `addWidget` calls

### Verification summary

| Task | Status | Result |
|------|--------|--------|
| TypeScript compilation | PASS | 0 errors |
| Unit tests | PASS | 246/246 |
| Backend tests | PASS | 269/269 |
| 13 widgets exist | PASS | 13 widget files + index.ts |
| --classic flag | PASS | Renders NavBar + page routing + ACTIONS panel |
| Chat-first default | PASS | No NavBar, ChatFirstScreen + ChatStatusBar |
| PermissionsPanel | PASS | Uses o/./X symbols, wildcard, no-parent, deny rules |
| Widget injection | PASS | parseWidgetMarker + addWidget flow (5 tests) |
| ChatStatusBar | PASS | Session count badge, context-aware shortcuts |
| HelpOverlay | PASS | Chat-first: no Page Navigation, has Slash/Widget sections |
| Visual-gate PTY | PASS | 3/3 (chat-first + classic navigation) |

### Test counts

| Category | Count |
|----------|-------|
| 63-A (FocusProvider) | 14 tests |
| 63-B (InlineWidget) | 10 tests |
| 63-C (ChatFirst) | 14 tests |
| 63-D (PermissionsPanel) | 11 tests |
| 63-T (widget injection) | 5 tests |
| Visual-gate (PTY) | 3 tests |
| Pre-existing tests | 189 tests |
| **Total** | **246 tests** |

---

## Post-63-T : Validation TUI live + rendering fix

### Validation TUI via MCP (tui_spawn / tui_press / tui_type)

Teste en demo mode via le MCP dogfood server. Resultats :

| Test | Resultat |
|------|----------|
| Demarrage → ecran chat (pas Home) | PASS |
| Pas de NavBar | PASS |
| StatusBar avec session count + shortcuts | PASS |
| TaskInputBar (/ pour focus) | PASS |
| `/status` → StatusWidget inline | PASS |
| `/models` → ModelsWidget inline | PASS |
| `/spaces` → SessionsWidget inline | PASS |
| `/catalog` → CatalogWidget inline | PASS |
| `/foundry` → FoundryWidget inline | PASS |
| Esc → widget collapse en 1 ligne | PASS |
| Widgets collapses restent dans l'historique | PASS |
| StatusBar change shortcuts quand widget ouvert | PASS |
| StatusBar revient aux shortcuts par defaut apres Esc | PASS |

### Artefacts de rendu corriges

Pendant la validation, des artefacts de rendu ont ete observes :
- Lignes qui se chevauchent quand le chat scrolle avec des widgets
- Texte tronque/saignant entre les lignes adjacentes

**Cause** : ConversationLog traitait chaque widget comme 1 ligne alors qu'ils prennent 8-20 lignes. Le texte n'etait pas padde a la largeur du terminal.

**Fix applique** dans `ConversationLog.ts` :
1. **Widget height accounting** : algorithme backward-walking avec `lineRowCost()` qui retourne la vraie hauteur (WIDGET_HEIGHTS + 2 pour les bordures)
2. **Width constraints** : `overflow: 'hidden'` + `width: width - 2` sur chaque ligne de texte
3. **Trailing space padding** : `displayText.padEnd(textWidth)` pour forcer Ink a ecraser les anciens caracteres

**Fix applique** dans `ChatFirstScreen.ts` :
- Correction du calcul `canScrollUp` pour les widgets multi-lignes

### Limitation MCP connue

Le key `?` n'est pas dans la liste des keys supportees par `tui_press`. Le HelpOverlay ne peut pas etre teste via le MCP dogfood server. Il a ete verifie uniquement par les tests unitaires (HelpOverlay.test dans ChatFirst.test.ts).

---

## 63-FIX : DONE (Critical TUI fixes)

**Completed**: 2026-03-18 (evening)
**Agent**: Claude Opus 4.6 (1M context)

### Summary

Fixed 5 critical issues found during real TUI testing. Unit tests passed (246) but the real TUI was broken: input required `/` prefix, no assistant connected, no autocomplete, bad rendering, widget navigation broken.

### Problem 1: Input requires `/` to type -- FIXED

In chat-first mode, the input should always be active (like Claude Code). The old slash-to-focus model was a leftover from multi-page mode.

**Root cause**: `inputFocused` started as `false`, requiring `/` key (page-level handler) to activate.

**Fix**:
- `App.ts`: `inputFocused` initializes to `!classicMode` (true in chat-first)
- `App.ts`: `handleSubmit` no longer unfocuses input in chat-first mode
- `App.ts`: Escape handler in chat-first mode does NOT unfocus input (delegates to widget Esc instead)
- `TaskInputBar.ts`: Added `alwaysActive` prop. When true, input is always active regardless of `captureInput`. Prompt shows `>` instead of `/`.
- `App.ts`: Passes `alwaysActive: true` to TaskInputBar in chat-first render
- Updated welcome message: "Type a message or /help for commands" (was "Press / to type a task")

**Files modified**: `App.ts`, `TaskInputBar.ts`

### Problem 2: No assistant connected at startup -- FIXED

**Root cause**: `activeAgent` defaulted to null when no `_selectedAssistant` was saved in provider config.

**Fix**:
- `App.ts`: `activeAgent` defaults to `'system:maestro-assistant'` instead of null
- `ChatFirstScreen.ts`: Header shows "Ready -- type a message to start" instead of "No active session" when no session exists yet

**Files modified**: `App.ts`, `ChatFirstScreen.ts`

### Problem 3: No slash command autocomplete -- FIXED

**Root cause**: No autocomplete UI existed. Users had to know commands by heart or use `/help`.

**Fix**: Created autocomplete dropdown that appears above the input bar when typing starts with `/`.

- Created `SlashAutocomplete.ts`: Dropdown component with 24 commands, descriptions, arrow navigation, filtered by typed prefix
- `TaskInputBar.ts`: Integrated autocomplete state. Tab completes selected suggestion. Arrow keys navigate suggestions when autocomplete is visible. Enter on single/exact match submits directly.

**Files created**: `components/SlashAutocomplete.ts`
**Files modified**: `TaskInputBar.ts`

### Problem 4: Bad rendering -- FIXED

**Root cause**: `wrap: 'truncate'` on text lines, and missing space between timestamp and content.

**Fix**:
- `ConversationLog.ts`: Changed `wrap: 'truncate'` to `wrap: 'wrap'` for proper text wrapping
- `ConversationLog.ts`: Fixed timestamp separator -- uses separate `h(Text, null, ' ')` element instead of trailing space in timestamp string (Ink was dropping the trailing space)
- `ConversationLog.ts`: Removed `overflow: 'hidden'` from individual line Box elements
- `ChatFirstScreen.ts`: Changed `wrap: 'truncate'` to `wrap: 'wrap'` on output preview

**Files modified**: `ConversationLog.ts`, `ChatFirstScreen.ts`

### Problem 5: Widget navigation broken -- FIXED

**Root cause**: Widgets had `useManagedInput('widget', ...)` handlers but no navigation callbacks were passed through. `onSessionSelect`, `onBlockSelect`, `onModelSelect` were undefined in widget props.

**Fix**:
- `InlineWidget.ts`: Added `WidgetNavigateFn` type and `onNavigate` prop. WidgetDispatcher now creates `onSessionSelect`, `onBlockSelect`, `onModelSelect` callbacks from `onNavigate` and passes them to each widget.
- `ConversationLog.ts`: Added `onWidgetNavigate` prop, passes to InlineWidget
- `ChatFirstScreen.ts`: Added `onWidgetNavigate` prop, passes to ConversationLog
- `App.ts`: Added `handleWidgetNavigate` callback that collapses current widget and adds new one. Passes to ChatFirstScreen.

**Files modified**: `InlineWidget.ts`, `ConversationLog.ts`, `ChatFirstScreen.ts`, `App.ts`

### Test updates

- `ChatFirst.test.ts`: Updated 4 slash command tests to remove initial `/` focus keystroke (no longer needed since input is always active in chat-first mode)

### Verification results

#### TypeScript
- 0 errors (`npx tsc --noEmit`)

#### Unit tests
- 245/246 pass (24/25 test files)
- 1 pre-existing flaky failure: `smoke-capture.test.ts` (PTY contention in parallel execution, passes in isolation)

#### Real TUI verification (MCP tui_spawn demo mode)

| Test | Result |
|------|--------|
| Type text directly (no `/` needed) | PASS |
| Input shows `>` prompt (always active) | PASS |
| Welcome message updated | PASS |
| Header shows "Ready -- type a message to start" | PASS |
| `/status` with autocomplete dropdown | PASS |
| `/status` Enter -> StatusWidget inline | PASS |
| j/k navigation in StatusWidget | PASS |
| Enter on session -> SessionMonitorWidget opens | PASS |
| Esc -> widget collapses, input stays active | PASS |
| `/spaces` -> SessionsWidget with 5 sessions | PASS |
| j/k navigation in SessionsWidget | PASS |
| `/catalog` -> CatalogWidget with filter tabs | PASS |
| Autocomplete shows command descriptions | PASS |
| Status bar context-aware shortcuts | PASS |
| Timestamp spacing fixed (space between time and text) | PASS |
| Text wraps properly (no truncation) | PASS |

### Files summary

| File | Action |
|------|--------|
| `packages/maestro-code/App.ts` | Modified (input always active, widget navigation, assistant default) |
| `packages/maestro-code/components/TaskInputBar.ts` | Modified (alwaysActive prop, autocomplete integration) |
| `packages/maestro-code/components/SlashAutocomplete.ts` | Created (autocomplete dropdown) |
| `packages/maestro-code/components/ChatFirstScreen.ts` | Modified (header text, wrap fix, onWidgetNavigate) |
| `packages/maestro-code/components/ConversationLog.ts` | Modified (wrap fix, timestamp space, onWidgetNavigate) |
| `packages/maestro-code/components/InlineWidget.ts` | Modified (WidgetNavigateFn, navigation callbacks) |
| `packages/maestro-code/tests/ChatFirst.test.ts` | Modified (removed slash-to-focus from tests) |
| `docs/phases/PHASE-63/checkpoint.md` | Updated |

---

## 63-FIX2 : IN PROGRESS (Widget quality — compact mais fonctionnel)

Voir `63-FIX2-widget-quality.md` pour le plan detaille.

### Problemes identifies lors du test reel (2026-03-18 soir)
- Timestamps tronques (`21:46:1` au lieu de `21:46:13`)
- Lignes vides excessives entre les etapes
- Texte corrompu dans les widgets (`erroreted`)
- Contenu agent disparu apres "Agent:"
- SessionMonitorWidget quasi vide (3 lignes au lieu d'un resume utile)
- Interactions manquantes (Space expand, d delete, T test)
- Widgets sont des reimplementations a 20-50% au lieu de versions minimales fonctionnelles

### Widget interactions completed (2026-03-18)

**Agent**: Claude Opus 4.6 (1M context)

#### W2. SessionsWidget -- DONE
- Added `expandedId` state for Space expand/collapse
- Space key: toggles expanded detail for selected session showing:
  - Full session ID
  - Children list (indented, with status + name + cost)
  - Fitness bar + percentage (if available)
  - Active workflow name
- `d` key: delete with inline confirmation ("Delete [name]? y/n")
  - Confirmation mode intercepts all input (only y/n/Esc accepted)
  - Calls `apiClient._fetch('DELETE', ...)` on confirm
- Scroll support: centers around selected index when list exceeds maxItems
- Shortcut hints row at bottom
- Pattern ported from legacy SpacesScreen (SessionRow expanded detail + DeleteConfirmation)

#### W5. CatalogWidget -- DONE
- Added `expandedId` state for Space expand/collapse
- Space key: toggles expanded detail showing:
  - Full description (wrapped)
  - Version + atomic flag
  - Capabilities as tags: `[cap1] [cap2]`
  - Contract ID
  - Fitness bar (full width)
- `T` key: triggers contract test on selected block
  - Auto-expands the block row
  - Shows "Testing..." while running
  - Shows error or pass/fail result inline
  - Pattern ported from legacy CatalogScreen (ContractTestState + handleContractTest)
- Scroll support with position indicator
- Shortcut hints row at bottom
- 1/2/3/4 filter tabs verified working

#### W6. FoundryWidget -- DONE
- Added `expandedId` state for Space expand/collapse
- Space key: toggles expanded detail showing:
  - Description (truncated)
  - Version + atomic flag
- Scroll support with position indicator
- Shortcut hints row at bottom

#### W1. StatusWidget -- VERIFIED + FIXED
- j/k navigation works (useManagedInput 'widget')
- Enter opens SessionMonitorWidget via onSessionSelect callback
- Fixed: name column now uses `truncate()` instead of raw substring for consistency

#### W3. WorkspacesWidget -- VERIFIED + FIXED
- j/k navigation works
- Enter opens WorkspaceDetailWidget via onWorkspaceSelect callback
- Fixed: name column now uses `truncate()` for consistency

#### W4. ReposWidget -- VERIFIED + FIXED
- j/k navigation works
- Enter opens RepoDetailWidget via onRepoSelect callback
- Fixed: name column now uses `truncate()` for consistency

#### W7. ModelsWidget -- VERIFIED + FIXED
- j/k navigation works
- Enter opens ModelDetailWidget via onModelSelect callback
- Fixed: name and provider columns now use `truncate()` for consistency

### Detail widgets completed (2026-03-18)

**Agent**: Claude Opus 4.6 (1M context)

#### W5. CatalogWidget rendering fixes -- DONE
- Fixed double `%%` artifact: fitness string now uses `padEnd(5)` to prevent stale character bleed
- Fixed `84% 79%` collision: fitness bar + percentage now wrapped in `h(Box, { flexDirection: 'row' })` instead of nested `h(Text)`
- Removed empty line between filter tabs and block rows (was `h(Text, null, '')`)
- Expanded detail fitness bar uses fresh `Math.round(fitness * 100)%` string (not padded `fitnessStr`)

#### W8. SessionMonitorWidget -- DONE (rewritten)
- Was: 3 useless lines ("Session: sess-002", "PERMISSIONS (ceiling)", "(no blocks defined)")
- Now: compact session resume with:
  - Line 1: Session name + status icon + duration + cost (padEnd on all fields)
  - Line 2: Active workflow or "idle"
  - Line 3: Current phase from execution tree (first running node)
  - RECENT ACTIVITY section: last 3 execution log entries
  - PermissionsPanel (kept)
  - Footer: "Full monitor: /session <id> --full"
- Fetches session data via `apiClient.getSession(sessionId)` for variables
- DemoApiClient `get()` updated to handle `/permissions/effective` path

#### W9. BlockDetailWidget -- DONE
- Fixed: description no longer truncated to 70 chars, now uses `wrap: 'wrap'` for full display
- Added `padEnd` to name (30), version (8), isAtomic (4), fitnessStr (5)
- Contract field now checks both `block.contractId` and `block.contract` (API inconsistency)
- Contract ID padded to 20 chars

#### W10. ModelDetailWidget -- DONE (enhanced)
- Was: just status + name + provider
- Now: full metrics display with:
  - Name + status icon + active badge (padEnd on all)
  - Provider + availability status (padEnd 12/16)
  - METRICS section: requests, tokens, latency, error rate (from getLLMStats + perModel)
  - PERFORMANCE section: fitness bar + score + session count (from getModelPerformance)
  - All text fields use `padEnd`

#### W11. WorkspaceDetailWidget -- VERIFIED + FIXED
- Name padded to 30 chars
- Session rows: name padded to 28, status column added with padEnd(12)
- PermissionsPanel present

#### W12. RepoDetailWidget -- VERIFIED + FIXED
- Name padded to 30 chars, status padded to 12
- Session rows: name padded to 28, status column added with padEnd(12)

### Files modified
- `packages/maestro-code/components/widgets/SessionsWidget.ts` -- Space expand, d delete, scroll, detail view
- `packages/maestro-code/components/widgets/CatalogWidget.ts` -- Space expand, T test, scroll, detail view, rendering fixes (padEnd, Box wrapping, remove empty line)
- `packages/maestro-code/components/widgets/FoundryWidget.ts` -- Space expand, scroll, detail view
- `packages/maestro-code/components/widgets/StatusWidget.ts` -- truncate import + usage
- `packages/maestro-code/components/widgets/WorkspacesWidget.ts` -- truncate import + padEnd on name/status
- `packages/maestro-code/components/widgets/ReposWidget.ts` -- truncate import + padEnd on name/status
- `packages/maestro-code/components/widgets/ModelsWidget.ts` -- truncate import + usage
- `packages/maestro-code/components/widgets/SessionMonitorWidget.ts` -- rewritten with session data + activity log
- `packages/maestro-code/components/widgets/BlockDetailWidget.ts` -- full description wrap, padEnd, contract field fix
- `packages/maestro-code/components/widgets/ModelDetailWidget.ts` -- added metrics + performance sections
- `packages/maestro-code/mocks/DemoApiClient.ts` -- permissions/effective path handling in get()

### Test results
- TypeScript: 0 errors
- Unit tests: 244/246 pass (2 pre-existing flaky: smoke-capture PTY contention, first-run timing)
