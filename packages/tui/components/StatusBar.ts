// @ts-nocheck
/**
 * StatusBar — Connection status, latency, time, focus info, and keyboard shortcuts.
 *
 * Enhanced version with animation support and context-aware shortcut display.
 * Works in both simple mode (just connection + basic shortcuts) and
 * advanced mode (panel focus, zoom, tree navigation, mode-aware shortcuts).
 *
 * Props:
 *   connectionStatus  'connecting' | 'connected' | 'error'
 *   latency           number (ms)
 *   lastRefresh       Date | string | null
 *   mode              'idle' | 'execution' | 'descriptor'
 *   visiblePanels     { tree, files, widgets, vars, logs }
 *   hasBackOption     boolean
 *   focusedPanel      string | null
 *   zoomedPanel       string | null
 *   currentPage       string | null
 *   isDetailView      boolean
 *   dailyCost         number | null  (cost in USD for today, shown as "$X.XX today")
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { inkTheme as theme, muted, dim } from '../theme/ink.ts';
import { icons, layout } from '../theme/tokens.ts';
import { formatTime } from '../utils/format.ts';
import { spinnerFrame, breathingDot } from '../theme/animations.ts';
import { useAnimationTick } from '../hooks/useAnimationTick.ts';
import { Shortcut } from './Shortcut.ts';

// ── Panel-specific shortcut sets ───────────────────────────────

const TREE_PANEL_NAMES = new Set(['tree', 'phases', 'files']);

const getPanelShortcuts = (focusedPanel, zoomedPanel, hasBackOption, mode) => {
  const shortcuts = [];

  if (zoomedPanel) {
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '\u2191\u2193', label: 'scroll', active: true }));
    if (TREE_PANEL_NAMES.has(zoomedPanel)) {
      shortcuts.push(h(Shortcut, { key: 'sc-lr', k: '\u2190\u2192', label: 'expand', active: true }));
      shortcuts.push(h(Shortcut, { key: 'sc-enter', k: 'Enter', label: 'toggle', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-z', k: 'z', label: 'unzoom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'unzoom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'q', label: 'uit', active: true }));
    return shortcuts;
  }

  if (focusedPanel && TREE_PANEL_NAMES.has(focusedPanel)) {
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '\u2191\u2193', label: 'nav', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-lr', k: '\u2190\u2192', label: 'expand', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-enter', k: 'Enter', label: 'toggle', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', k: 'z', label: 'oom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-1-3', k: '1-3', label: 'jump', active: true }));
    if (hasBackOption) {
      shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'back', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'q', label: 'uit', active: true }));
    return shortcuts;
  }

  if (focusedPanel) {
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '\u2191\u2193', label: 'scroll', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', k: 'z', label: 'oom', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-1-3', k: '1-3', label: 'jump', active: true }));
    if (hasBackOption) {
      shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'back', active: true }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-r', k: 'r', label: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: '', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'q', label: 'uit', active: true }));
    return shortcuts;
  }

  // No panel focused — show global session shortcuts
  shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'focus', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-1-3', k: '1-3', label: 'panel', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-r', k: 'r', label: 'efresh', active: true }));
  if (mode !== 'descriptor') {
    shortcuts.push(h(Shortcut, { key: 'sc-tfwvl', k: 't/f/w/v/l', label: 'toggle', active: true }));
  }
  if (hasBackOption) {
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'back', active: true }));
  }
  shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'q', label: 'uit', active: true }));
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
  isDetailView: isDetailViewProp = false,
  dailyCost = null,
}) => {
  const tick = useAnimationTick(120);

  const connColor = connectionStatus === 'connected'
    ? theme.status.success
    : connectionStatus === 'error'
      ? theme.status.error
      : theme.status.warning;

  // Animated connection indicator
  const connIcon = connectionStatus === 'connecting'
    ? spinnerFrame(tick)
    : connectionStatus === 'connected'
      ? breathingDot(tick)
      : icons.connected;

  const latencyStr = latency > 0 ? `${latency}ms` : '-';
  const timeStr = lastRefresh ? formatTime(lastRefresh) : '-';

  // Build context-aware shortcuts
  const shortcuts = [];
  const isDetailView = isDetailViewProp || focusedPanel != null || zoomedPanel != null || (!currentPage);

  if (!isDetailView) {
    shortcuts.push(h(Shortcut, { key: 'sc-ctrl-lr', k: 'Ctrl+\u2190\u2192', label: 'page', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '\u2191\u2193', label: 'select', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-enter', k: 'Enter', label: 'open', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'back', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'q', label: 'uit', active: true }));
  } else {
    shortcuts.push(h(Shortcut, { key: 'sc-ctrl-lr', k: 'Ctrl+\u2190\u2192', label: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-jk', k: 'j/k', label: 'nav', active: true }));
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
    flexShrink: 0,
  },
    // Left: connection status + latency + time
    h(Box, { flexDirection: 'row' },
      h(Text, { color: connColor }, connIcon),
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
      dailyCost != null && dailyCost >= 0
        ? h(Box, { flexDirection: 'row' },
            h(Text, null, '  '),
            dim(icons.dot),
            h(Text, null, '  '),
            h(Text, { color: dailyCost > 0 ? 'yellow' : theme.text.muted }, `$${dailyCost.toFixed(2)} today`),
          )
        : null,
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
