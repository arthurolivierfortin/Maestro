# Dogfooding Session 2 — 2026-02-27 (Post-Methodology Update)

## Session Context
- **Branch**: main
- **Application**: maestro-code TUI
- **Mode**: real (backend connected)
- **Services**: Backend healthy (port 5000), LLM-Provider healthy (port 5010, 4 providers)
- **Target repo**: C:/Cantante
- **Terminal size**: 120x40 (TuiDriver default)
- **Previous issues**: BUG-7 (double footer on BlockDetail), BUG-8 (Foundry scroll overflow), BUG-9 (Agent J/K dead)
- **Focus**: Detail views, scroll boundaries, keyboard in full context — gaps from session 1

## Pre-Flight Results
- Level 1 (Observation): PASS — TuiDriver exists
- Level 2 (Interaction): PASS — press/typeText/captureFrame available
- Level 3 (State): PASS — Backend + LLM-Provider healthy, Cantante repo accessible

## Interface Inventory

### Pages (6 top-level)
| Page | Key | Renders | Content Visible | Lines Used |
|------|-----|---------|-----------------|------------|
| Agent | A | PASS | NavBar + AGENT STATUS + CONVERSATION + ACTIONS + TaskInputBar + StatusBar | 40/40 |
| Home | H | PASS | NavBar + SYSTEM STATUS + ACTIVE SESSIONS (124 sessions, page 1/13) + QUICK ACTIONS | 40/40 |
| Foundry | F | PASS | NavBar + MY BLOCKS (139 blocks, 8 types) + scroll indicator (1/139 ▼) | 40/40 |
| Catalog | C | PASS | NavBar + BLOCK CATALOG + type filter tabs + 139 blocks with descriptions | 40/40 |
| Models | M | PASS | NavBar + MODEL STATUS (Online) + AVAILABLE MODELS (0 models — see BUG-11) | 40/40 |
| Spaces | S | PASS | NavBar + tabs (Repos/Workspaces/Sessions) + session list with inline expand | 40/40 |

### Global Chrome (App.ts wrapper — present on ALL views)
- **TaskInputBar** (lines 35-37): `╭─ / Press / to type... ─╯` — 3 lines
- **StatusBar** (lines 38-40): `┌─ ● connected • Xms • HH:MM:SS [shortcuts] ─┘` — 3 lines
- **Total wrapper chrome**: 6 lines consumed on every view

### Detail Views (reached via Enter on list items)
| Source | Component | Tested |
|--------|-----------|--------|
| Foundry → Block | BlockDetail | YES — see BUG-7 |
| Catalog → Block | BlockDetail | YES — same bugs |
| Home → Session | SessionMonitor | SKIPPED (sessions all "idle", Enter may not open) |

## Test Log

### Visual Tests (V)
| # | Page | Element | Observation | Expected | Verdict |
|---|------|---------|-------------|----------|---------|
| V1 | Agent | Full layout | NavBar + Status + Conversation + Actions + Input + StatusBar | All zones visible | PASS |
| V2 | Home | Sessions list | 124 sessions, paginated (1/13), status icons, fitness, shortIds | Data populated | PASS |
| V3 | Foundry | Block list | 139 blocks sorted by type, scroll indicator ▼ | Block list visible | PASS |
| V4 | Catalog | Block list + filter | 139 blocks, type filter tabs, descriptions, IDs | Catalog visible | PASS |
| V5 | Models | Status + models | Online status, but 0 models listed | Models listed | **FAIL** (BUG-11) |
| V6 | Spaces | Session list | Tabs + sessions + inline expand (▼) | Sessions visible | PASS |
| V7 | StatusBar | All pages | `● connected • Xms • HH:MM:SS` + shortcuts | Real data | PASS |

### Detail View Tests (D) — NEW per methodology
| # | Path | Observation | Expected | Verdict | Notes |
|---|------|-------------|----------|---------|-------|
| D1 | Foundry → Enter → BlockDetail | Lines 32-34: INNER StatusBar (tronqué). Lines 35-37: TaskInputBar. Lines 38-40: OUTER StatusBar. | Single StatusBar, no TaskInputBar | **FAIL** (BUG-7) | Double footer + parasite input |
| D2 | Catalog → Enter → BlockDetail | Same as D1: inner StatusBar + TaskInputBar + outer StatusBar | Single StatusBar, no TaskInputBar | **FAIL** (BUG-7) | Identical issue |
| D3 | BlockDetail → Esc → Foundry | Returns to Foundry with selection preserved (item 1/139, same scroll pos) | List restored | PASS | |
| D4 | BlockDetail content | BLOCK header with name/version/fitness + INFO + FITNESS + SESSIONS + ACTIONS panels | Correct layout | PASS | Inner layout is correct |
| D5 | BlockDetail inner StatusBar | `connecte • 4ms • 13:20:2[Ctrl+←→]panel...` — TEXT TRUNCATED and OVERLAPPING | Clean single-line status | **FAIL** | StatusBar content overflows, "connecte" (not "connected"), shortcuts overlap |

### Scroll Boundary Tests (SB) — NEW per methodology
| # | Page | Action | Observation | Expected | Verdict |
|---|------|--------|-------------|----------|---------|
| SB1 | Foundry | 20x J (scroll to bottom) | **ENTIRE SCREEN BLANK** (0 non-empty lines) | Last block visible above global chrome | **FAIL** (BUG-8 WORSE) |

### Keyboard In Context Tests (KB) — NEW per methodology
| # | Page | Action | Observation | Expected | Verdict |
|---|------|--------|-------------|----------|---------|
| KB1 | Agent | 5x K (scroll up) | **ENTIRE SCREEN BLANK** (0 non-empty lines) | Conversation scrolls, earlier lines visible | **FAIL** (BUG-9) |
| KB2 | Agent | 5x J (scroll down) | Screen still blank (0 lines) | Returns to latest messages | **FAIL** (BUG-9) |

## Bugs Found

| ID | Description | Severity | Confirmed | Root Cause Hypothesis |
|----|-------------|----------|-----------|-----------------------|
| BUG-7 | BlockDetail shows double StatusBar + parasitic TaskInputBar | Major | YES (D1, D2) | App.ts renders TaskInputBar + StatusBar for ALL views including detail views. BlockDetail also renders its own StatusBar. Result: 3 extra elements at bottom. |
| BUG-8 | Foundry J scroll blanks entire screen | Critical | YES (SB1) | After scrolling with J, the entire frame becomes empty. Not just overflow — total blank. Likely the Foundry `visibleItems` calculation or the `scrollStart` produces negative/invalid slice when combined with App.ts global chrome consuming 6 lines. |
| BUG-9 | Agent K/J scroll blanks entire screen | Critical | YES (KB1, KB2) | Same blank-screen pattern as BUG-8. ConversationLog scroll was "fixed" in session 1 but the fix doesn't hold in the real app context. The PTY test in session 1 passed because it counted non-empty lines (which is "0 ≠ previous 0" = "changed" = pass) — a false positive. |
| BUG-11 | Models page shows 0 models despite LLM-Provider being healthy | Minor | YES (V5) | `listLLMModels()` API call returns empty array. LLM-Provider health shows 4 providers but the models listing endpoint may not be implemented or may require different config. |
| BUG-D5 | BlockDetail inner StatusBar text is truncated/overlapping | Minor | YES (D5) | StatusBar rendered inside BlockDetail has less width available (competing with SESSIONS and ACTIONS panels). Text overflows: "connecte" instead of "connected", shortcuts run into border characters. |

## UX Evaluation

| Criterion | Score (1-5) | Justification |
|-----------|-------------|---------------|
| Feedback | 4 | StatusBar shows connection + latency + time. Agent status clear. But Models page misleading (says "Is the LLM provider running?" when it IS running). |
| Clarity | 3 | Page layouts clear. But BlockDetail has garbled StatusBar text. Models page blame message is wrong. |
| Progression | N/A | Not tested (no agent task submitted in this session). |
| Response quality | N/A | Not tested. |
| Stability | 1 | **Critical**: J/K scroll causes TOTAL BLANK on Agent AND Foundry. Screen goes empty. Must Ctrl+C and restart. |
| Navigation | 3 | All 6 pages reachable. Back from detail works. But detail views are broken (double footer). |
| Error handling | N/A | Not tested. |
| Intuitiveness | 3 | Shortcuts visible in NavBar and StatusBar. But input bar on BlockDetail is confusing (can type a task from a block detail page?). |
| Performance | 5 | All pages render in <2.5s. StatusBar shows 2-24ms latency. No lag observed. |
| Consistency | 2 | Pages are consistent with each other. But detail views break consistency (different StatusBar format, extra elements). J/K behavior differs between pages (Home: works for selection, Agent/Foundry: blanks screen). |

**Overall UX Score: 2.6/5** — Performance excellent, page rendering correct, but critical stability issues (blank screens on scroll) and composition bugs (double footers on detail views) make the experience broken for real use.

## Summary
- **Tests performed**: 16 (7 visual + 5 detail view + 1 scroll boundary + 2 keyboard + 1 composition)
- **PASS**: 8
- **FAIL**: 8
- **Bugs found**: 5 (2 critical, 2 major, 1 minor)
- **Total session time**: ~39s (automated capture)
- **Verdict**: **FIX AND RE-TEST** — BUG-8 and BUG-9 (blank screen on scroll) are critical blockers.

## Post-Incident Mandatory Checks (methodology compliance)
```
[X] DETAIL VIEWS: Entered BlockDetail from both Foundry and Catalog
[X] COMPOSITION: Verified double StatusBar + parasitic TaskInputBar on detail views
[X] SCROLL BOUNDARIES: Scrolled to bottom on Foundry — screen went blank (BUG-8)
[X] KEYBOARD IN CONTEXT: Tested J/K on Agent in full app — screen went blank (BUG-9)
[X] WRAPPER AWARENESS: Documented App.ts adds TaskInputBar (3 lines) + StatusBar (3 lines) globally
```
