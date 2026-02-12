// @ts-nocheck
/**
 * StatusBar — Connection status, latency, time, focus info, and keyboard shortcuts.
 *
 * Ink equivalent of the blessed StatusBarComponent.
 *
 * Props:
 *   connectionStatus  'connecting' | 'connected' | 'error'
 *   latency           number (ms)
 *   lastRefresh       Date | string | null
 *   mode              'idle' | 'execution' | 'descriptor'
 *   visiblePanels     { tree, files, widgets, vars, logs }
 *   hasBackOption     boolean
 *   focusedPanel      string | null — currently focused panel name
 *   zoomedPanel       string | null — currently zoomed panel name
 *   currentPage       string | null — current page name (for global page navigation shortcuts)
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  muted, dim,
  formatTime,
} from '../theme.ts';

// ── Shortcut rendering ─────────────────────────────────────────

const Shortcut = ({ keyChar, labelText, active }) => {
  if (active === false) {
    return h(Text, { dimColor: true }, `[${keyChar}]${labelText}`);
  }
  return h(Text, null,
    h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
    h(Text, { color: theme.shortcut.key }, keyChar),
    h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
    h(Text, { color: theme.shortcut.label }, labelText),
  );
};

// ── Panel-specific shortcut sets ───────────────────────────────

const TREE_PANEL_NAMES = new Set(['tree', 'phases', 'files']);

const getPanelShortcuts = (focusedPanel, zoomedPanel, hasBackOption, mode) => {
  const shortcuts = [];

  if (zoomedPanel) {
    // Zoomed mode — show zoom-specific shortcuts
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', keyChar: '\u2191\u2193', labelText: 'scroll', active: true }));
    if (TREE_PANEL_NAMES.has(zoomedPanel)) {
      shortcuts.push(h(Shortcut, { key: 'sc-lr', keyChar: '\u2190\u2192', labelText: 'expand', active: true }));
      shortcuts.push(h(Shortcut, { key: 'sc-enter', keyChar: 'Enter', labelText: 'toggle', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-z', keyChar: 'z', labelText: 'unzoom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', keyChar: 'Esc', labelText: 'unzoom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
    return shortcuts;
  }

  if (focusedPanel && TREE_PANEL_NAMES.has(focusedPanel)) {
    // Tree panel focused — show tree navigation shortcuts
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', keyChar: '\u2191\u2193', labelText: 'nav', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-lr', keyChar: '\u2190\u2192', labelText: 'expand', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-enter', keyChar: 'Enter', labelText: 'toggle', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-tab', keyChar: 'Tab', labelText: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', keyChar: 'z', labelText: 'oom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-1-3', keyChar: '1-3', labelText: 'jump', active: true }));
    if (hasBackOption) {
      shortcuts.push(h(Shortcut, { key: 'sc-esc', keyChar: 'Esc', labelText: 'back', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-?', keyChar: '?', labelText: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
    return shortcuts;
  }

  if (focusedPanel) {
    // Non-tree panel focused — show scroll shortcuts
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', keyChar: '\u2191\u2193', labelText: 'scroll', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-tab', keyChar: 'Tab', labelText: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', keyChar: 'z', labelText: 'oom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-1-3', keyChar: '1-3', labelText: 'jump', active: true }));
    if (hasBackOption) {
      shortcuts.push(h(Shortcut, { key: 'sc-esc', keyChar: 'Esc', labelText: 'back', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-r', keyChar: 'r', labelText: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-?', keyChar: '?', labelText: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
    return shortcuts;
  }

  // No panel focused — show global session shortcuts
  shortcuts.push(h(Shortcut, { key: 'sc-tab', keyChar: 'Tab', labelText: 'focus', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-1-3', keyChar: '1-3', labelText: 'panel', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-r', keyChar: 'r', labelText: 'efresh', active: true }));
  if (mode !== 'descriptor') {
    shortcuts.push(h(Shortcut, { key: 'sc-tfwvl', keyChar: 't/f/w/v/l', labelText: 'toggle', active: true }));
  }
  if (hasBackOption) {
    shortcuts.push(h(Shortcut, { key: 'sc-esc', keyChar: 'Esc', labelText: 'back', active: true }));
  }
  shortcuts.push(h(Shortcut, { key: 'sc-?', keyChar: '?', labelText: 'help', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
  return shortcuts;
};

// ── StatusBar component ────────────────────────────────────────

const StatusBar = ({
  connectionStatus = 'connecting',
  latency = 0,
  lastRefresh = null,
  mode = 'idle',
  visiblePanels = {},
  hasBackOption = false,
  focusedPanel = null,
  zoomedPanel = null,
  currentPage = null,
}) => {
  const connColor = connectionStatus === 'connected'
    ? theme.status.success
    : connectionStatus === 'error'
      ? theme.status.error
      : theme.status.warning;

  const latencyStr = latency > 0 ? `${latency}ms` : '-';
  const timeStr = lastRefresh ? formatTime(lastRefresh) : '-';

  // Build context-aware shortcuts
  const shortcuts = [];
  // Determine if we're in a detail view (session, model, etc.) or a top-level page
  const isDetailView = focusedPanel != null || zoomedPanel != null || (!currentPage);

  if (currentPage && !focusedPanel && !zoomedPanel) {
    // Global page navigation mode — Ctrl+←/→ = page switch
    shortcuts.push(h(Shortcut, { key: 'sc-ctrl-lr', keyChar: 'Ctrl+\u2190\u2192', labelText: 'page', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', keyChar: '\u2191\u2193', labelText: 'select', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-enter', keyChar: 'Enter', labelText: 'open', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', keyChar: 'Esc', labelText: 'back', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
  } else {
    // Detail view mode — Ctrl+←/→ = panel switch (Schema A)
    shortcuts.push(h(Shortcut, { key: 'sc-ctrl-lr', keyChar: 'Ctrl+\u2190\u2192', labelText: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-jk', keyChar: 'j/k', labelText: 'nav', active: true }));
    shortcuts.push(...getPanelShortcuts(focusedPanel, zoomedPanel, hasBackOption, mode));
  }

  const shortcutElements = [];
  for (let i = 0; i < shortcuts.length; i++) {
    shortcutElements.push(shortcuts[i]);
    if (i < shortcuts.length - 1) {
      shortcutElements.push(h(Text, { key: `sp-${i}` }, ' '));
    }
  }

  // Focus/zoom info
  const focusInfo = [];
  if (zoomedPanel) {
    focusInfo.push(h(Text, { key: 'zoom-icon', color: theme.status.warning }, icons.expanded));
    focusInfo.push(h(Text, { key: 'zoom-label', color: theme.status.warning, bold: true }, ' ' + zoomedPanel.toUpperCase()));
  } else if (focusedPanel) {
    focusInfo.push(h(Text, { key: 'focus-icon', color: theme.panel.borderFocused }, icons.focus));
    focusInfo.push(h(Text, { key: 'focus-label', color: theme.panel.borderFocused }, ' ' + focusedPanel.toUpperCase()));
  }

  return h(Box, {
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.ui.border,
    paddingLeft: 1,
    paddingRight: 1,
    height: theme.layout.statusBarHeight,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    // Left: connection status + latency + time
    h(Box, { flexDirection: 'row' },
      h(Text, { color: connColor }, icons.connected),
      h(Text, null, ' '),
      muted(connectionStatus),
      h(Text, null, '  '),
      dim(icons.dot),
      h(Text, null, '  '),
      muted(latencyStr),
      h(Text, null, '  '),
      dim(icons.dot),
      h(Text, null, '  '),
      muted(timeStr),
    ),

    // Center: focus / zoom info
    focusInfo.length > 0
      ? h(Box, { flexDirection: 'row' }, ...focusInfo)
      : null,

    // Right: shortcuts
    h(Box, { flexDirection: 'row', flexWrap: 'wrap' },
      ...shortcutElements,
    ),
  );
};

export { StatusBar };
