// @ts-nocheck
/**
 * SpatialStatusBar — Bottom bar with page position, direction hints,
 * and context-aware shortcuts.
 *
 * Replaces both NavBar (top) and RichStatusBar (bottom) from the
 * pre-spatial navigation era.
 *
 * Layout:
 *   [icon PAGE_NAME] [conn] [session] [direction hints] [shortcuts]
 *
 * Direction hints are auto-generated from the Page Registry.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { Shortcut } from '@maestro/tui/components';
import { useAnimationTick } from '@maestro/tui/hooks';
import { spinnerFrame, breathingDot } from '@maestro/tui/theme';
import type { PageDefinition, DirectionHint, Direction } from '../registry/types.ts';
import type { AgentState } from '../types.ts';

// ── Direction arrow map ──────────────────────────────────────

const DIR_ARROW: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

// ── Direction display order (consistent visual ordering) ─────

const DIR_ORDER: Direction[] = ['left', 'up', 'down', 'right'];

// ── Props ────────────────────────────────────────────────────

type PanelId = 'hero' | 'tree' | 'log' | 'llm';

export interface SpatialStatusBarProps {
  currentPage: PageDefinition | undefined;
  directionHints: DirectionHint[];
  agentState: AgentState;
  sessionId: string | null;
  busy: boolean;
  connected: boolean | null;
  latency: number;
  voiceActive?: boolean;
  focusedPanel: PanelId | null;
  zoomedPanel: PanelId | null;
  demoMode?: boolean;
}

// ── Component ────────────────────────────────────────────────

export const SpatialStatusBar = ({
  currentPage,
  directionHints,
  agentState,
  sessionId,
  busy,
  connected,
  latency,
  voiceActive,
  focusedPanel,
  zoomedPanel,
  demoMode,
}: SpatialStatusBarProps) => {
  const tick = useAnimationTick(120);

  // Connection indicator
  const connStatus = connected === null ? 'connecting' : connected ? 'connected' : 'error';
  const connColor = connStatus === 'connected' ? 'green' : connStatus === 'error' ? 'red' : 'yellow';
  const connIcon = connStatus === 'connecting'
    ? spinnerFrame(tick)
    : connStatus === 'connected'
      ? breathingDot(tick)
      : '✗';

  const pageIcon = currentPage?.icon || '?';
  const pageLabel = currentPage?.label || 'UNKNOWN';
  const isAgent = currentPage?.id === 'agent';

  // Session label
  const sessionLabel = sessionId ? `session:${sessionId.slice(0, 8)}` : '';

  // ── Direction hints ──────────────────────────────────────
  const sortedHints = DIR_ORDER
    .map(dir => directionHints.find(h => h.direction === dir))
    .filter(Boolean) as DirectionHint[];

  const hintElements = sortedHints.map((hint, i) =>
    h(Box, { key: `hint-${i}`, flexDirection: 'row' },
      h(Text, { color: 'gray' }, `${DIR_ARROW[hint.direction]}`),
      h(Text, { color: 'gray', dimColor: true }, hint.page.shortLabel),
      h(Text, null, ' '),
    )
  );

  // ── Focus/zoom indicator ─────────────────────────────────
  const focusInfo = zoomedPanel
    ? h(Text, { color: 'yellow', bold: true }, `▣ ${zoomedPanel.toUpperCase()} `)
    : focusedPanel && focusedPanel !== 'hero'
      ? h(Text, { color: 'cyan' }, `◈ ${focusedPanel.toUpperCase()} `)
      : null;

  // ── Context-aware shortcuts ──────────────────────────────
  const shortcuts = [];

  if (zoomedPanel) {
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'unzoom' }));
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '↑↓', label: 'scroll' }));
    if (zoomedPanel === 'tree') {
      shortcuts.push(h(Shortcut, { key: 'sc-lr', k: '←→', label: 'expand' }));
    }
  } else if (isAgent && focusedPanel && focusedPanel !== 'hero') {
    shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'next' }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'input' }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', k: 'z', label: 'zoom' }));
  } else if (isAgent) {
    shortcuts.push(h(Shortcut, { key: 'sc-ctab', k: 'Ctrl+Tab', label: 'prev' }));
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help' }));
  } else {
    // Non-agent pages
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'home' }));
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help' }));
  }

  return h(Box, {
    paddingX: 1,
    height: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    // Left: page position + connection + session
    h(Box, { flexDirection: 'row', flexShrink: 0 },
      h(Text, { bold: true, color: 'cyan' }, `${pageIcon} ${pageLabel}`),
      h(Text, null, '  '),
      h(Text, { color: connColor }, connIcon),
      h(Text, null, ' '),
      sessionLabel ? h(Text, { color: 'gray', dimColor: true }, `${sessionLabel} `) : null,
      voiceActive ? h(Text, { color: 'magenta', bold: true }, 'VOICE ') : null,
      demoMode ? h(Text, { color: 'yellow', dimColor: true }, '[DEMO] ') : null,
    ),

    // Center: direction hints + focus info
    h(Box, { flexDirection: 'row', flexGrow: 1, justifyContent: 'center' },
      ...hintElements,
      focusInfo,
    ),

    // Right: context shortcuts
    h(Box, { flexDirection: 'row', flexShrink: 0 },
      ...shortcuts.map((sc, i) =>
        i < shortcuts.length - 1
          ? h(Box, { key: `sc-wrap-${i}`, flexDirection: 'row' }, sc, h(Text, null, ' '))
          : sc
      ),
    ),
  );
};
