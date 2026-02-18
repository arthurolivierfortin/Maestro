// @ts-nocheck
/**
 * StatusBar — Connection status, latency, time, and keyboard shortcuts.
 *
 * Shared version that can be used by any TUI monitor.
 * Context-aware: shows different shortcuts based on whether we're
 * in a top-level page or a detail view (Schema A navigation).
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';
import { icons, layout } from '../../theme/tokens.ts';
import { formatTime } from '../../utils/format.ts';
import { Shortcut } from './Shortcut.ts';

const StatusBar = ({
  connectionStatus = 'connecting',
  latency = 0,
  lastRefresh = null,
  isDetailView = false,
  hasBackOption = false,
  focusedPanel = null,
  zoomedPanel = null,
}) => {
  const connColor = connectionStatus === 'connected'
    ? semantic.status.success
    : connectionStatus === 'error'
      ? semantic.status.error
      : semantic.status.warning;

  const latencyStr = latency > 0 ? `${latency}ms` : '-';
  const timeStr = lastRefresh ? formatTime(lastRefresh) : '-';

  const shortcuts = [];

  if (isDetailView) {
    shortcuts.push(h(Shortcut, { key: 'sc-ctrl-lr', k: 'Ctrl+\u2190\u2192', label: 'panel', active: true }));
    shortcuts.push(h(Shortcut, { key: 'sc-jk', k: 'j/k', label: 'nav', active: true }));
  } else {
    shortcuts.push(h(Shortcut, { key: 'sc-ctrl-lr', k: 'Ctrl+\u2190\u2192', label: 'page', active: true }));
  }

  if (hasBackOption) {
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'back', active: true }));
  }
  shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help', active: true }));
  shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'q', label: 'uit', active: true }));

  const shortcutElements = [];
  for (let i = 0; i < shortcuts.length; i++) {
    shortcutElements.push(shortcuts[i]);
    if (i < shortcuts.length - 1) {
      shortcutElements.push(h(Text, { key: `sp-${i}` }, ' '));
    }
  }

  const focusInfo = [];
  if (zoomedPanel) {
    focusInfo.push(h(Text, { key: 'zoom-icon', color: semantic.status.warning }, '\u25BC'));
    focusInfo.push(h(Text, { key: 'zoom-label', color: semantic.status.warning, bold: true }, ' ' + zoomedPanel.toUpperCase()));
  } else if (focusedPanel) {
    focusInfo.push(h(Text, { key: 'focus-icon', color: semantic.panel.borderFocused }, icons.focus));
    focusInfo.push(h(Text, { key: 'focus-label', color: semantic.panel.borderFocused }, ' ' + focusedPanel.toUpperCase()));
  }

  return h(Box, {
    borderStyle: 'single',
    borderColor: semantic.ui.border,
    paddingLeft: 1,
    paddingRight: 1,
    height: layout.statusBarHeight,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: connColor }, icons.connected),
      h(Text, null, ' '),
      h(Text, { color: semantic.text.muted }, connectionStatus),
      h(Text, null, '  '),
      h(Text, { dimColor: true }, icons.dot),
      h(Text, null, '  '),
      h(Text, { color: semantic.text.muted }, latencyStr),
      h(Text, null, '  '),
      h(Text, { dimColor: true }, icons.dot),
      h(Text, null, '  '),
      h(Text, { color: semantic.text.muted }, timeStr),
    ),
    focusInfo.length > 0
      ? h(Box, { flexDirection: 'row' }, ...focusInfo)
      : null,
    h(Box, { flexDirection: 'row', flexWrap: 'wrap' },
      ...shortcutElements,
    ),
  );
};

export { StatusBar };
