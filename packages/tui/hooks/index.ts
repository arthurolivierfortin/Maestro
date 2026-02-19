/**
 * Shared TUI Hooks — Barrel export.
 *
 * NOTE: The actual React hooks (usePanelFocus, useScroll, etc.) live here
 * but require React to be in the module resolution path. They are consumed
 * by maestro-cli/monitor/ink/ which has react in its node_modules.
 *
 * The createActionKeyboardHandler factory has NO React/Ink dependency.
 */

export { createActionKeyboardHandler } from './useKeyboard.ts';
export type { ActionHandlers, KeyboardContext } from './useKeyboard.ts';
export { usePanelFocus } from './usePanelFocus.ts';
export type { UsePanelFocusReturn } from './usePanelFocus.ts';
export { useScroll } from './useScroll.ts';
export type { UseScrollReturn } from './useScroll.ts';
export { useTreeNav } from './useTreeNav.ts';
export type { UseTreeNavReturn } from './useTreeNav.ts';
export { useApiData } from './useApiData.ts';
export type { ConnectionStatus, UseApiDataReturn } from './useApiData.ts';
export { useMouse } from './useMouse.ts';
export type { UseMouseOptions, ScrollDirection } from './useMouse.ts';
export { useSelectableList } from './useSelectableList.ts';
export type { UseSelectableListOptions, UseSelectableListReturn } from './useSelectableList.ts';
export { useSinglePanelScroll } from './useSinglePanelScroll.ts';
