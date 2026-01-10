/**
 * useKeyboardShortcuts Hook
 *
 * Provides keyboard shortcut handling for panel management.
 */

import { useEffect, useCallback } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

export interface KeyboardShortcutsConfig {
  leftPanelRef?: React.RefObject<ImperativePanelHandle>;
  rightPanelRef?: React.RefObject<ImperativePanelHandle>;
  bottomPanelRef?: React.RefObject<ImperativePanelHandle>;
  onFocusSidebar?: () => void;
  onFocusMain?: () => void;
  onFocusProperties?: () => void;
}

/**
 * Keyboard shortcuts:
 * - Ctrl+1: Focus sidebar (BlockExplorer)
 * - Ctrl+2: Focus main canvas
 * - Ctrl+3: Focus properties panel
 * - Ctrl+`: Toggle bottom panel
 * - Ctrl+J: Toggle bottom panel (alternative)
 * - Ctrl+B: Toggle sidebar
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    leftPanelRef,
    rightPanelRef,
    bottomPanelRef,
    onFocusSidebar,
    onFocusMain,
    onFocusProperties,
  } = config;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Ctrl (or Cmd on Mac)
      const isModifier = event.ctrlKey || event.metaKey;

      if (!isModifier) return;

      switch (event.key) {
        case '1':
          event.preventDefault();
          if (onFocusSidebar) {
            onFocusSidebar();
          }
          if (leftPanelRef?.current) {
            leftPanelRef.current.expand();
          }
          break;

        case '2':
          event.preventDefault();
          if (onFocusMain) {
            onFocusMain();
          }
          break;

        case '3':
          event.preventDefault();
          if (onFocusProperties) {
            onFocusProperties();
          }
          if (rightPanelRef?.current) {
            rightPanelRef.current.expand();
          }
          break;

        case '`':
          event.preventDefault();
          if (bottomPanelRef?.current) {
            if (bottomPanelRef.current.isCollapsed()) {
              bottomPanelRef.current.expand();
            } else {
              bottomPanelRef.current.collapse();
            }
          }
          break;

        case 'j':
        case 'J':
          event.preventDefault();
          if (bottomPanelRef?.current) {
            if (bottomPanelRef.current.isCollapsed()) {
              bottomPanelRef.current.expand();
            } else {
              bottomPanelRef.current.collapse();
            }
          }
          break;

        case 'b':
        case 'B':
          event.preventDefault();
          if (leftPanelRef?.current) {
            if (leftPanelRef.current.isCollapsed()) {
              leftPanelRef.current.expand();
            } else {
              leftPanelRef.current.collapse();
            }
          }
          break;

        default:
          break;
      }
    },
    [
      leftPanelRef,
      rightPanelRef,
      bottomPanelRef,
      onFocusSidebar,
      onFocusMain,
      onFocusProperties,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Get keyboard shortcut display string based on OS
 */
export function getShortcutKey(): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  return isMac ? '⌘' : 'Ctrl';
}
