/**
 * AppStatusBar — Generic status bar with connection info and configurable shortcuts.
 *
 * Renders:
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ ● connected • 42ms • 14:23  │  Models (focused)  │ [1-4]tabs [q]uit │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Shortcuts are passed as data — zero hardcoded keys.
 * Replaces: Maestro StatusBar (hardcoded shortcuts), LLM-Provider StatusBar (hardcoded shortcuts).
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';
import { layout } from '../../theme/tokens.ts';
import { Shortcut } from './Shortcut.ts';
import type { ShortcutProps } from './Shortcut.ts';

export interface AppStatusBarProps {
  /** Whether the backend/service is connected */
  connected: boolean;
  /** Latency in ms. Shown as "42ms". */
  latency?: number;
  /** Last update time. Formatted as HH:MM:SS or displayed as-is if string. */
  lastUpdated?: string | Date | null;
  /** Keyboard shortcuts to display on the right side */
  shortcuts: ShortcutProps[];
  /** Optional center text: "Models (focused)", "ZOOMED" */
  centerText?: string;
  /** Optional center text color */
  centerColor?: string;
  /** Connection status icon override. Default: ● */
  connectedIcon?: string;
  /** Disconnected status icon override. Default: ✗ */
  disconnectedIcon?: string;
  /** Height of the status bar box. Default: layout.statusBarHeight */
  height?: number;
}

const formatTimeValue = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  try {
    return value.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '-';
  }
};

const AppStatusBar = ({
  connected,
  latency,
  lastUpdated,
  shortcuts,
  centerText,
  centerColor,
  connectedIcon = '\u25CF',
  disconnectedIcon = '\u2717',
  height = layout.statusBarHeight,
}: AppStatusBarProps) => {
  const connColor = connected ? semantic.status.success : semantic.status.error;
  const connIcon = connected ? connectedIcon : disconnectedIcon;
  const connText = connected ? 'connected' : 'disconnected';
  const latencyStr = latency != null && latency > 0 ? `${latency}ms` : '-';
  const timeStr = formatTimeValue(lastUpdated);

  // Build shortcut elements with spacing
  const shortcutElements: any[] = [];
  for (let i = 0; i < shortcuts.length; i++) {
    shortcutElements.push(
      h(Shortcut, { key: `sc-${i}`, ...shortcuts[i]! })
    );
    if (i < shortcuts.length - 1) {
      shortcutElements.push(h(Text, { key: `sp-${i}` }, ' '));
    }
  }

  return h(Box, {
    borderStyle: 'single',
    borderColor: semantic.ui.border,
    paddingLeft: 1,
    paddingRight: 1,
    height,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    // Left: connection + latency + time
    h(Box, { flexDirection: 'row' },
      h(Text, { color: connColor }, connIcon),
      h(Text, null, ' '),
      h(Text, { color: semantic.text.muted }, connText),
      h(Text, null, '  '),
      h(Text, { dimColor: true }, '\u2022'),
      h(Text, null, '  '),
      h(Text, { color: semantic.text.muted }, latencyStr),
      h(Text, null, '  '),
      h(Text, { dimColor: true }, '\u2022'),
      h(Text, null, '  '),
      h(Text, { color: semantic.text.muted }, timeStr),
    ),

    // Center: optional context info
    centerText
      ? h(Box, { flexDirection: 'row' },
          h(Text, { color: centerColor ?? semantic.panel.borderFocused, bold: !!centerColor }, centerText)
        )
      : null,

    // Right: shortcuts
    h(Box, { flexDirection: 'row', flexWrap: 'wrap' },
      ...shortcutElements,
    ),
  );
};

export { AppStatusBar };
