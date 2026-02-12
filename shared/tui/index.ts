/**
 * Shared TUI — Barrel export for reusable TUI infrastructure.
 *
 * Safe to import from anywhere (no React/Ink dependency):
 * - Keybindings system (load, save, resolve, match)
 * - createActionKeyboardHandler factory
 *
 * Requires React/Ink in module path (import from hooks/ or components/ directly):
 * - usePanelFocus, useScroll, useTreeNav, useApiData, useMouse
 * - Panel, NavBar, StatusBar
 */

// Keybindings (no React dependency)
export {
  DEFAULT_KEYBINDINGS,
  loadKeybindings,
  resetKeybindings,
  saveKeybindings,
  flattenBindings,
  getKeybindingsPath,
} from './keybindings.ts';
export type { KeybindingMap } from './keybindings.ts';

// Keybinding resolver (no React dependency)
export {
  parseBinding,
  resolveBindings,
  matchInput,
  bindingLabel,
} from './keybinding-resolver.ts';
export type { KeyDescriptor, ResolvedBindings, InkKey } from './keybinding-resolver.ts';

// Action keyboard factory (no React dependency)
export { createActionKeyboardHandler } from './hooks/useKeyboard.ts';
export type { ActionHandlers, KeyboardContext } from './hooks/useKeyboard.ts';
