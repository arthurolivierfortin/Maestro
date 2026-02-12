# ADR: Shared Theme, Contextual Navigation, and Configurable Keybindings

**Status**: Accepted
**Date**: 2026-02-12
**Phase**: 17

## Context

The Maestro CLI shell and TUI monitor have evolved independently, resulting in:

1. **Visual inconsistency**: The shell uses default terminal colors while the monitor sets a custom `#1e1e1e` background via OSC escape codes. Switching between them creates a jarring visual experience.

2. **Navigation conflict**: `Ctrl+Arrow` keys are globally bound to page navigation, preventing their use for intra-page panel switching in detail views (SessionMonitor, ModelDetail, etc.).

3. **Hardcoded keybindings**: All keyboard shortcuts are hardcoded in `useKeyboard.ts` and individual components. Users cannot customize bindings.

4. **Duplicated code**: Colors, icons, and styling constants are defined both in `shared/utils/` and `maestro-cli/monitor/ink/theme.ts`, with slight divergences.

## Decision

### 1. Shared Theme (`shared/theme/`)

A single source of truth for all visual tokens:

- **`colors.ts`**: Palette (hex values) + semantic color mapping (status, panel, shortcut)
- **`brand.ts`**: ASCII logo, version string, tagline
- **`tokens.ts`**: Unicode border characters, icons, spacing constants
- **`terminal.ts`**: OSC escape helpers (`setTerminalBg`, `resetTerminalBg`)

Both the CLI shell and TUI monitor import from `shared/theme/`. The existing `ink/theme.ts` becomes a thin adapter that re-exports shared tokens with Ink-specific React helpers (`T()`, `Badge`, etc.).

**Background color**: `#1e1e1e` applied everywhere via `setTerminalBg()`:
- Shell: on startup, reset on exit
- Monitor: on startup (existing behavior), reset on exit

### 2. Contextual Navigation (Schema A)

`Ctrl+Arrow` behavior depends on context:

| Context | Ctrl+Left/Right | Ctrl+Up/Down |
|---------|----------------|--------------|
| Top-level pages (Home, Spaces, etc.) | Change page | Page up/down in list |
| Detail views (SessionMonitor, etc.) | Change panel | Scroll 5 lines |

Letter shortcuts `h/s/f/c/m` remain available everywhere for direct page jumps.

**Why Schema A over alternatives**:
- Schema B (always panel): Breaks existing muscle memory for page switching
- Schema C (modifier key): Adds complexity, no standard modifier available
- Schema D (mode toggle): Extra state to manage, confusing UX
- Schema A: Natural context switch, Ctrl+Arrow does "the obvious thing" based on where you are

### 3. Configurable Keybindings

Architecture:
- **Defaults** in `shared/tui/keybindings.ts` — Schema A bindings as the baseline
- **User overrides** in `~/.maestro/keybindings.json` — deep-merged with defaults
- **Resolution** via `shared/tui/keybinding-resolver.ts` — translates Ink input events to semantic action names

Components listen for **actions** (e.g., `'panel.next'`), not raw keys. The `useKeyboard` hook becomes an action dispatcher.

### 4. Shared TUI Components (`shared/tui/`)

Reusable hooks and components extracted from `maestro-cli/monitor/ink/`:
- Hooks: `useKeyboard`, `usePanelFocus`, `useScroll`, `useTreeNav`, `useApiData`, `useMouse`
- Components: `Panel`, `NavBar`, `StatusBar`

These become available for any future TUI application built on Ink.

## Consequences

- New TUI apps get consistent theming and navigation out of the box
- Users can customize keybindings via a single JSON file
- The shell and monitor share identical visual identity
- Breaking change: `useKeyboard` API changes from raw key handlers to action handlers (all existing components must update)
- The `ink/theme.ts` file shrinks to Ink-specific React helpers only

## File Structure

```
shared/
  theme/
    index.ts, colors.ts, brand.ts, tokens.ts, terminal.ts
  tui/
    index.ts, keybindings.ts, keybinding-resolver.ts
    components/ (Panel.ts, NavBar.ts, StatusBar.ts)
    hooks/ (useKeyboard.ts, usePanelFocus.ts, useScroll.ts, useTreeNav.ts, useApiData.ts, useMouse.ts)
```
