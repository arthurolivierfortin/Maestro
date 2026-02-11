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

  // Build compact shortcuts
  const shortcuts = [];

  if (currentPage && !focusedPanel && !zoomedPanel) {
    // Global page navigation mode — show page shortcuts
    shortcuts.push(h(Shortcut, { key: 'sc-h', keyChar: 'H', labelText: 'ome', active: currentPage === 'home' }));
    shortcuts.push(h(Shortcut, { key: 'sc-s', keyChar: 'S', labelText: 'paces', active: currentPage === 'spaces' }));
    shortcuts.push(h(Shortcut, { key: 'sc-f', keyChar: 'F', labelText: 'oundry', active: currentPage === 'foundry' }));
    shortcuts.push(h(Shortcut, { key: 'sc-c', keyChar: 'C', labelText: 'atalog', active: currentPage === 'catalog' }));
    shortcuts.push(h(Shortcut, { key: 'sc-m', keyChar: 'M', labelText: 'odels', active: currentPage === 'models' }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
  } else {
    // Session detail mode — show panel shortcuts
    shortcuts.push(h(Shortcut, { key: 'sc-tab', keyChar: 'Tab', labelText: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', keyChar: 'z', labelText: 'oom', active: !!focusedPanel }));
    shortcuts.push(h(Shortcut, { key: 'sc-r', keyChar: 'r', labelText: '', active: true }));
    if (hasBackOption) {
      shortcuts.push(h(Shortcut, { key: 'sc-esc', keyChar: 'Esc', labelText: '', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-?', keyChar: '?', labelText: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', keyChar: 'q', labelText: 'uit', active: true }));
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
