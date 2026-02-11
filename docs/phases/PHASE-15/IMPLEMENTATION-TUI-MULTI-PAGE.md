# Phase 15 — Implementation: TUI Multi-Page Navigation

**Date**: 2026-02-11
**Status**: In Progress
**Source**: `docs/phases/PHASE-15/ANALYSIS-TUI-PAGE-ARCHITECTURE.md`

---

## Overview

Transform the TUI monitor from a 2-screen application (GlobalMonitor + SessionMonitor) into a 5-page application (Home, Spaces, Foundry, Catalog, Models) with unchanged SessionMonitor detail view.

## Files Created

| File | Purpose |
|------|---------|
| `hooks/useApiData.js` | Generic polling hook (replaces per-page useSessionData duplication) |
| `components/NavBar.js` | Top navigation bar with 5 page tabs |
| `components/HomeScreen.js` | Dashboard with system status, active sessions, quick actions |
| `components/SpacesScreen.js` | Repos/Workspaces/Sessions browser (replaces GlobalMonitor) |
| `components/FoundryScreen.js` | User blocks browser |
| `components/CatalogScreen.js` | System + user block catalog |
| `components/ModelsScreen.js` | LLM model management |

## Files Modified

| File | Changes |
|------|---------|
| `App.js` | Multi-page routing with `currentPage` state |
| `hooks/useKeyboard.js` | Added letter key handlers (s, c, m, n, a) |
| `components/StatusBar.js` | Page-aware shortcuts display |

## Navigation State Machine

```
currentSessionId !== null  →  SessionMonitor (unchanged)
currentSessionId === null  →  Render page by currentPage:
  'home'    → HomeScreen
  'spaces'  → SpacesScreen
  'foundry' → FoundryScreen
  'catalog' → CatalogScreen
  'models'  → ModelsScreen
```

## Page Navigation Keys

| Key | Action |
|-----|--------|
| `h` | Home |
| `s` | Spaces |
| `f` | Foundry |
| `c` | Catalog |
| `m` | Models |
| `Esc` | Back (sub-page → Home, or quit from Home) |
| `q` | Quit |

## Architecture Notes

- All screens use `NavBar` at top and `StatusBar` at bottom
- SessionMonitor is rendered regardless of currentPage when currentSessionId is set
- Each screen manages its own keyboard handlers via `useKeyboard`
- Data fetching via `useApiData` hook with configurable polling interval
- Follows existing conventions: `createElement as h`, no JSX, functional components, ESM
