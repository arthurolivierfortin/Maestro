# Dogfood Notes — 2026-02-27 — Deep Feature Audit V2

> **Methodology**: System Validator via TuiDriver PTY (direct observation)
> **Mode**: Demo (--demo --no-bell)
> **Terminal**: 120x40
> **Purpose**: Discovery only — feeds into phase planning

---

## Summary

| Category | Count |
|----------|-------|
| **P0 Bugs** (blocks usage) | 4 |
| **P1 Bugs** (major UX) | 5 |
| **P2 Bugs** (minor) | 3 |
| **P3 Bugs** (cosmetic) | 2 |
| **V1-Required features** | 12 |
| **V1-Nice features** | 8 |
| **Post-V1 features** | 7 |
| **Total findings** | **41** |

---

## P0 BUGS — Blocks Usage

### BUG-P0-1: Home page renders completely blank
- **Where**: Home page (H key)
- **Observed**: 0 content lines. No SYSTEM STATUS, no ACTIVE SESSIONS, no QUICK ACTIONS panels.
- **Expected**: Health indicators, session list, navigation shortcuts
- **Root cause**: Likely async data fetch timing. `useApiData` may not trigger render in demo mode fast enough before frame capture. But also confirmed in Phase 7-8 navigation consistency test: `H → home: PARTIAL (found: , missing: SYSTEM STATUS, ACTIVE SESSIONS, QUICK ACTIONS)`.
- **Impact**: Home page is the dashboard. If it's blank, users see nothing on launch if their default page were Home.
- **Confirmed via**: Phase 2 (frame capture), Phase 8.1 (navigation test)

### BUG-P0-2: Model detail view unreachable (modelId undefined)
- **Where**: Models page → Enter on model
- **Observed**: Enter does nothing. Stays on Models page.
- **Root cause**: `DemoApiClient.mapDemoModels()` returns `{ id, name, size, loaded }`. `ModelsScreen` line 158-159 checks `model?.modelId` — field doesn't exist. Even with real backend, if SDK returns `id` instead of `modelId`, same bug.
- **Code**: `ModelsScreen.ts:158` → `if (model?.modelId) onModelSelect(model.modelId, ...)`
- **Impact**: Models page is display-only. Cannot see any model detail.
- **Confirmed via**: Phase 6.2b (model detail: false)

### BUG-P0-3: Active model shows "-" on Models page
- **Where**: Models page → MODEL STATUS panel → "Active Model: -"
- **Observed**: Active model is dash even though `getLLMHealth()` returns `model: 'claude-sonnet-4-6'`
- **Root cause**: `ModelStatusPanel` reads `health?.activeModel` but `DemoApiClient.getLLMHealth()` returns `{ model: 'claude-sonnet-4-6', ... }`. Field name: `model` vs `activeModel`. Same mismatch probably exists with real backend.
- **Code**: `ModelsScreen.ts:36` → `const activeModel = health?.activeModel || '-'`
- **Also**: `ModelCard` line 198 → `model.modelId === activeModel` — both sides may be wrong
- **Impact**: No model shows as "(active)" in the list. No visual indicator of which model is being used.
- **Confirmed via**: Phase 6.2 ("Active Model: -")

### BUG-P0-4: No conversation memory between messages
- **Where**: Agent page → second message loses context
- **Observed**: Each `submitTask()` call invokes `message` entry point which creates a fresh conversation. Previous messages are not passed.
- **Root cause**: `AgentBlockExecutor` creates and destroys conversation per invocation. `conversationHistory` input declared but never wired. See ADR-CONVERSATION-MANAGEMENT.
- **Impact**: Agent is useless for multi-turn tasks. Every message starts from scratch.
- **Confirmed via**: Code analysis + Phase 1.5

---

## P1 BUGS — Major UX

### BUG-P1-1: `A` key conflict on Spaces page
- **Where**: SpacesScreen — keyboard handler
- **Observed**: Pressing `A` on Spaces navigates to Agent page instead of filtering sessions by "All"
- **Root cause**: `SpacesScreen.ts` line 321 defines `a: () => setStatusFilter('all')`, then line 325 overwrites with `a: () => onNavigate('agent')` (in chrome block)
- **Impact**: Status filter "All" shortcut is broken. Users cannot use the filter without mouse (which doesn't exist in TUI).
- **Confirmed via**: Phase 3.2b — "BUG CONFIRMED: A key navigates to Agent instead of filtering 'All'"

### BUG-P1-2: Session pollution — new session per TUI launch
- **Where**: SessionManager
- **Observed**: `sessionReady` flag resets every TUI restart. No persistence of session ID.
- **Root cause**: No `.maestro/session.json` persistence. See ADR-CONVERSATION-MANAGEMENT.
- **Impact**: After N launches, Spaces > Sessions is full of dead sessions.
- **Confirmed via**: Code analysis + user report

### BUG-P1-3: Text overlap in SessionMonitor conversation panel
- **Where**: SessionMonitor detail view → AGENT panel
- **Observed**: Line 17: "❯ Add login pagepress Enter." — two strings merged
- **Root cause**: Conversation lines and welcome message overlap. Possibly ConversationLog rendering bug when scrollOffset=0 and lines are fewer than panel height.
- **Impact**: Agent conversation is unreadable in session monitor view
- **Confirmed via**: Phase 7.1 (session detail frame line 17)

### BUG-P1-4: Input bar doesn't clear after Escape
- **Where**: Agent page → TaskInputBar
- **Observed**: After typing "test message" and pressing Escape, then pressing / again and typing "/new", the result is "test message/new" — previous text persists
- **Root cause**: TaskInputBar doesn't clear its internal buffer on Escape.
- **Impact**: Users accumulate garbage text in the input bar
- **Confirmed via**: Phase 1.2 ("/new typed: test message/new")

### BUG-P1-5: Foundry and Catalog show identical blocks
- **Where**: FoundryScreen + CatalogScreen
- **Observed**: Both call `apiClient.listBlocks()` and display the same 12 blocks
- **Root cause**: No differentiation between "user blocks" (Foundry) and "system/catalog blocks" (Catalog). Same API endpoint, same data.
- **Impact**: Two pages that show the same thing. Users don't understand the difference.
- **Confirmed via**: Phase 4.1 (12 blocks) + Phase 5.1 (12 blocks)

---

## P2 BUGS — Minor

### BUG-P2-1: J/K selection indicator not always visible after navigation
- **Where**: Multiple pages (Spaces, Foundry)
- **Observed**: After pressing J on Spaces, selector (→) not found in frame
- **Root cause**: Timing issue or selector renders on a line the test didn't check. May not be visible in all cases.
- **Confirmed via**: Phase 3.2 ("After J (down): (no selector visible)")

### BUG-P2-2: Catalog type filter Tab doesn't visually change
- **Where**: Catalog page → Tab key
- **Observed**: "Type: All | Workflows | Agents | Tools" text doesn't change after Tab press
- **Root cause**: Filter likely cycles internally but the bold indicator isn't captured, or the cycle requires more than 2 presses to become visible
- **Confirmed via**: Phase 5.2 ("After Tab" and "After 2nd Tab" show same text)

### BUG-P2-3: Block expansion shows wrong version
- **Where**: Foundry page → Space to expand
- **Observed**: Expanded row shows "v3.1.0 atomic: no" but the selected block might not be the one at index 3 (Dev Orchestrator)
- **Root cause**: After J×3, selectedIndex is 3 (Dev Orchestrator v3.1.0) which is correct. Not a bug per se, but expansion happened after navigation — the expand state is tied to selectedIndex at expand time.
- **Confirmed via**: Phase 4.2b

---

## P3 BUGS — Cosmetic

### BUG-P3-1: Truncated block IDs in Foundry/Catalog
- **Where**: Block lists
- **Observed**: IDs show as "autonomous-d", "code-analyze", "dev-orchestr" — truncated to 12 chars
- **Root cause**: `id.substring(0, 12)` in BlockRow. By design, but makes it hard to distinguish blocks with similar prefixes.
- **Confirmed via**: Phase 4.1 frame

### BUG-P3-2: Duplicate StatusBar on detail views
- **Where**: SessionMonitor, WorkspaceDetail, RepoDetail, BlockDetail
- **Observed**: Two StatusBars visible (lines 36-37 + 38-40). The detail view renders its own StatusBar AND the parent App renders one.
- **Root cause**: Detail components include their own StatusBar, plus App.ts line 488 renders another one.
- **Impact**: Visual clutter, wasted screen space
- **Confirmed via**: Phase 7.1 (two status bar lines), Phase 7.2, 7.3, 7.4

---

## V1-REQUIRED MISSING FEATURES

### FEAT-V1-1: Conversation management (slash commands)
- **Need**: `/new` (new conversation), `/clear` (clear context), `/switch` (switch conversation)
- **Current**: Only `/quit` and `/q` exist
- **Design**: ADR-CONVERSATION-MANAGEMENT (Option B — workflow-driven)
- **Priority**: CRITICAL — without this, multi-turn conversation is impossible

### FEAT-V1-2: Session persistence across TUI restarts
- **Need**: One session per repo, persisted in `.maestro/session.json`
- **Current**: New session created every launch
- **Design**: ADR-CONVERSATION-MANAGEMENT section 1
- **Priority**: CRITICAL — session pollution makes Spaces unusable

### FEAT-V1-3: Block creation from Foundry
- **Need**: Create blocks directly in TUI (at minimum: type + name + template)
- **Current**: Empty state says "maestro block create" (CLI only). No in-TUI creation.
- **Priority**: CRITICAL — user's primary complaint. Foundry is the block development page but you can't develop blocks in it.

### FEAT-V1-4: Fix Home page rendering
- **Need**: Home page must show system status, active sessions, quick actions
- **Current**: Renders blank (0 content lines)
- **Priority**: HIGH — Home is the dashboard

### FEAT-V1-5: Fix Models page field mapping
- **Need**: modelId field must match between DemoApiClient, SDK, and backend
- **Current**: DemoApiClient uses `id`, ModelsScreen reads `modelId`, getLLMHealth returns `model`
- **Priority**: HIGH — Models page is 50% broken

### FEAT-V1-6: Differentiate Foundry vs Catalog
- **Need**: Foundry = user's blocks (with CRUD). Catalog = system/published blocks (read-only browse).
- **Current**: Both call `listBlocks()` and show identical content
- **Priority**: HIGH — two identical pages confuse users

### FEAT-V1-7: Block editing in BlockDetail
- **Need**: At minimum: edit name, description, system prompt from detail view
- **Current**: Only action is `[v] View source JSON`
- **Priority**: MEDIUM — needed for meaningful Foundry workflow

### FEAT-V1-8: Fix A key conflict on Spaces
- **Need**: `A` should filter "All" sessions, not navigate to Agent
- **Current**: Chrome nav keys overwrite tab-specific keys
- **Priority**: MEDIUM — filter is broken

### FEAT-V1-9: Fix duplicate StatusBar on detail views
- **Need**: Only one StatusBar per view
- **Current**: Detail views render their own + parent App renders another
- **Priority**: MEDIUM — wastes screen real estate

### FEAT-V1-10: Session creation/deletion from Spaces
- **Need**: Create new session from TUI (name + template + repo)
- **Current**: Must use CLI
- **Priority**: MEDIUM — core workflow for using Maestro

### FEAT-V1-11: Fix input bar text persistence
- **Need**: Input bar should clear on Escape, or preserve text intentionally with visual cue
- **Current**: Text accumulates silently
- **Priority**: MEDIUM — confusing UX

### FEAT-V1-12: Fix text overlap in SessionMonitor
- **Need**: Agent conversation panel should render lines correctly
- **Current**: "❯ Add login pagepress Enter." — merged strings
- **Priority**: MEDIUM — session monitoring is a core feature

---

## V1-NICE MISSING FEATURES

### FEAT-NICE-1: Block search/filter in Foundry and Catalog
- Text search by name, type, description

### FEAT-NICE-2: /help slash command
- Show available slash commands and keyboard shortcuts

### FEAT-NICE-3: Block deletion from Foundry
- Delete user-created blocks

### FEAT-NICE-4: Session stop/restart from Spaces
- Manage session lifecycle without CLI

### FEAT-NICE-5: Workspace creation from TUI
- Create workspaces without CLI

### FEAT-NICE-6: Model switching from Models page
- Switch active model by pressing Enter on a model

### FEAT-NICE-7: Session search/filter by name in Spaces
- Text search across sessions

### FEAT-NICE-8: Block publishing from Foundry
- Publish blocks to catalog after testing

---

## POST-V1 FEATURES

### FEAT-POST-1: Full Foundry workflow in TUI
- Workspace → Foundry session → develop → test → measure fitness → publish
- This is the complete block development lifecycle

### FEAT-POST-2: Block testing/fitness tracking from TUI
- Run tests, see fitness scores, compare model performance

### FEAT-POST-3: Model testing (send test prompt)
- Send a test prompt to a model directly from Models page

### FEAT-POST-4: Interactive widgets in demo mode
- DemoApiClient doesn't simulate confirmation/option-select widgets

### FEAT-POST-5: Pending blocks panel on Agent page
- Show blocks being executed, queued, completed during agent run

### FEAT-POST-6: Voice mode beyond NoopAudioAdapter
- Ctrl+V toggle exists but only NoopAudioAdapter

### FEAT-POST-7: Model download/install from TUI
- Download and configure local models

---

## Page-by-Page Frame Evidence

### Agent Page (Default)
```
AGENT STATUS:   ◉ Agent: working → ○ idle (lifecycle works)
CONVERSATION:   Welcome message + task submission + progress updates (works)
ACTIONS:        [J/K] Scroll, [G] Go to session, [H] Home, [S] Spaces, [C] Catalog
TaskInputBar:   / to focus, Escape to unfocus, Enter to submit (works)
StatusBar:      ● connected • 12ms • timestamp + shortcuts (works)
```
**Verdict**: Core flow works. Missing conversation persistence and slash commands.

### Home Page
```
(BLANK — 0 content lines)
```
**Verdict**: P0 bug. Page exists in code with 3 panels but doesn't render.

### Spaces Page
```
Tab 1 (Repos):      3 repos with name, path, status
Tab 2 (Workspaces): 2 workspaces with name, type, settings
Tab 3 (Sessions):   5 sessions with name, status, ID, fitness, duration
Filter:             [a] All [r] Running — but A key is broken (navigates to Agent)
```
**Verdict**: Display works well. All 3 tabs render. Missing CRUD and A key bug.

### Foundry Page
```
MY BLOCKS:          12 blocks sorted by type (workflow > agent > tool > inference > validator)
TypeBadge:          [workflow] [agent] [tool] [inference] [validator] — all render
Expand (Space):     version + atomic visible
Detail (Enter):     BlockDetail with INFO + FITNESS + SESSIONS + ACTIONS
```
**Verdict**: Read-only block browser works. Missing all CRUD operations (the user's primary complaint).

### Catalog Page
```
BLOCK CATALOG:      12 blocks with fitness %, descriptions
Type filter:        All | Workflows | Agents | Tools (Tab to cycle)
Expand (Space):     version + atomic + fitness bar
```
**Verdict**: Works as a browser. Identical to Foundry (same data source).

### Models Page
```
MODEL STATUS:       Online, Backend: Anthropic API, Device: cloud, Max Tokens: 4096, Temperature: 0.7
Active Model:       - (BUG — should show claude-sonnet-4-6)
AVAILABLE MODELS:   6 models listed (Claude Sonnet/Opus, GPT-4o, Qwen, SmolLM2, DeepSeek)
Model Detail:       BROKEN (Enter does nothing — modelId undefined)
```
**Verdict**: Display partially works but field name mismatches break active model display and detail navigation.

### Detail Views
```
SessionMonitor:     WORKS — execution tree, agent log, workflow tree, filesystem, log
                    BUG: text overlap in agent panel
BlockDetail:        WORKS — INFO, FITNESS, SESSIONS, ACTIONS
                    Only action: [v] View source JSON
WorkspaceDetail:    WORKS — sessions, settings (max concurrent, auto-promote, min fitness)
RepoDetail:         WORKS — sessions, .maestro info (blocks, artifacts, metrics, logs)
ModelDetail:        BROKEN — unreachable (modelId undefined)
```

---

## Priority Recommendations for Phase Planning

### Phase A (Critical — must fix before any real usage)
1. Conversation management (FEAT-V1-1 + FEAT-V1-2) — ADR already written
2. Fix Home page rendering (BUG-P0-1)
3. Fix Models page field mapping (BUG-P0-3 + FEAT-V1-5)
4. Fix A key conflict (FEAT-V1-8)
5. Fix input bar text persistence (FEAT-V1-11)
6. Fix text overlap in SessionMonitor (FEAT-V1-12)
7. Fix duplicate StatusBar (FEAT-V1-9)

### Phase B (Important — needed for V1 but not blocking basic usage)
1. Block creation from Foundry (FEAT-V1-3)
2. Differentiate Foundry vs Catalog (FEAT-V1-6)
3. Block editing in detail view (FEAT-V1-7)
4. Session CRUD from Spaces (FEAT-V1-10)

### Phase C (Nice to have)
1. Search/filter (FEAT-NICE-1, FEAT-NICE-7)
2. /help command (FEAT-NICE-2)
3. Model switching (FEAT-NICE-6)
4. Session lifecycle management (FEAT-NICE-4)
5. Block deletion + publishing (FEAT-NICE-3, FEAT-NICE-8)
