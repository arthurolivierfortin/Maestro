# Phase 41-PRE — Spatial TUI Changelog

## Overview

Phase 41-PRE transformed `maestro-code` from a minimal chat app into a **Flipper Zero-inspired spatial TUI** with 5 pages on a 2D grid, agent-in-the-cockpit system, command palette, and comprehensive mascotte personality.

## Sub-Phase Summary

### 41-PRE-A through 41-PRE-F (Foundation)
- Extracted 10 data panels from `@maestro/monitor` to `@maestro/tui`
- Created detail screens (Block, Session, Model)
- Created FlipperLayout cockpit (multi-panel layout)
- Added RichStatusBar, mouse support, session shortcut
- Simplified SessionManager to lifecycle-only
- Fixed demo mode (real mock client + auto-start)

### 41-A: Page Registry
- Created `PageRegistry` class with 2D grid positioning
- 5 built-in pages: Agent(0,0), Execution(0,-1), Catalog(-1,0), Spaces(1,0), Models(0,1)
- Direction hints auto-computed from occupied positions
- 13 tests

### 41-B: Spatial Navigation + SpatialStatusBar
- Created `useSpatialNav` hook: navigate, goHome, goTo, quickSwitch, rotateRing
- Created `SpatialStatusBar`: replaces both NavBar and RichStatusBar
- Created `TransitionWipe`: directional overlay during page changes
- Ctrl+Arrow navigation, Ctrl+Tab quick-switch
- Removed old NavBar, CODE_PAGES, screenToPageKey
- 17 tests

### 41-C: Agent Page Redesign
- Created `MascotteFull` (24x22 bitmap sprite), `MascotteCompact` (1-line header)
- Created `ConversationLog` (replaces OutputPanel)
- Created `AgentPage` with 3 visual states: idle, working, celebrating
- Extracted `SessionManager` to `services/`
- 21 tests

### 41-D: Execution Page
- Created `ExecutionPage` wrapping `@maestro/monitor/SessionMonitor`
- No-session fallback with navigation hint
- 5 tests

### 41-E: List Pages
- Created `CatalogPage`, `SpacesPage`, `ModelsPage` wrapping monitor screens
- Created 5 detail page wrappers in `pages/details/`
- Deleted 6 old screen stubs from `screens/`
- Internal detail navigation (within page, not at App level)
- 10 tests

### 41-F: Agent-in-the-Cockpit
- Created `MascotteOverlay` (floating mini-panel, position:absolute)
- Created `NotificationToast` (ephemeral cross-page notifications)
- Updated `SpatialStatusBar` with agent location hints + pulsing arrows
- J key to join agent, auto-detach on Ctrl+Arrow
- Integrated `useNavigation` hook for dual-position system
- 14 tests

### 41-G: Command Palette + Help + Demo Mode
- Created `CommandPalette` (Ctrl+K, fuzzy search, auto-populated from registry)
- Rewrote `HelpOverlay` with auto-generated spatial navigation section
- Created centralized demo mock data (`mocks/demo-data.ts`)
- Added demo views to CatalogPage, SpacesPage, ModelsPage
- 15 tests (6 + 9)

### 41-H: Polish, Cleanup, States, Bell
- Added `error` and `thinking` mascotte states (7 total)
- Added `THINKING_1`/`THINKING_2` bitmap frames to sprite sheet
- Added terminal bell (1x complete, 2x error, 3x needs-input)
- Added `--no-bell` CLI flag
- Deleted dead code: FlipperLayout, AgentScreen, AgentActivity, AgentBadge
- Updated barrel exports and removed stale tests

## Test Results (Final)

| Package | Tests |
|---------|-------|
| maestro-code | 156/156 |
| tui | 67/67 |
| maestro-monitor | 4/4 |
| real-demo-check | 5/5 |
| **Total** | **227** |

## Architecture (Final)

```
@maestro/tui (shared design system)
├── 10 data panels (WorkflowTree, ExecutionLog, LLMActivity, ...)
├── UI components (Panel, Shortcut, StatusBar, NavBar, PixelArt)
├── Hooks (useApiData, useTreeNav, useMouse, usePanelFocus, useSelectableList, useScroll, useAnimationTick)
├── Sprites (mascotte: 6 states + splash, renderBitmap)
└── Theme, utils

@maestro/code (spatial TUI app)
├── registry/ — PageRegistry (5 pages on 2D grid)
├── hooks/ — useSpatialNav, useNavigation, useInputHistory
├── components/ — SpatialStatusBar, CommandPalette, HelpOverlay, MascotteFull/Compact/Overlay, TransitionWipe, NotificationToast, ConversationLog, VoiceIndicator
├── pages/ — AgentPage, ExecutionPage, CatalogPage, SpacesPage, ModelsPage
├── pages/details/ — 5 detail wrappers (Block, Session, Workspace, Repo, Model)
├── services/ — SessionManager
├── mocks/ — demo data
├── screens/ — WelcomeScreen, SplashScreen
└── App.ts — routing, keyboard, layout, bell, demo mode

@maestro/monitor (standalone — re-exports from @maestro/tui)
└── SessionMonitor, CatalogScreen, SpacesScreen, ModelsScreen, detail screens
```

## Files Deleted (Total)

- `layouts/FlipperLayout.ts` (replaced by full-screen pages)
- `screens/AgentScreen.ts` (replaced by pages/AgentPage.ts)
- `screens/HelpOverlay.ts` (moved to components/)
- `screens/CatalogBrowser.ts` (replaced by pages/CatalogPage.ts)
- `screens/SessionBrowser.ts` (replaced by pages/SpacesPage.ts)
- `screens/ModelsBrowser.ts` (replaced by pages/ModelsPage.ts)
- `screens/BlockDetailScreen.ts` (replaced by pages/details/)
- `screens/SessionDetailScreen.ts` (replaced by pages/details/)
- `screens/ModelDetailScreen.ts` (replaced by pages/details/)
- `panels/AgentActivity.ts` (replaced by MascotteOverlay)
- `panels/AgentBadge.ts` (replaced by SpatialStatusBar)
