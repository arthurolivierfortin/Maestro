// @ts-nocheck
/**
 * MascotteOverlay — Floating mini-panel overlay.
 *
 * Appears when agent is ACTIVE and on the SAME page as the user.
 * Shows compact mascotte face + status text + control hints.
 *
 * Dimensions: ~40 cols × 5 rows (compact, bordered).
 * Position: absolute, bottom-right of content area.
 *
 * Phase 41-F.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { useAnimationTick } from '@maestro/tui/hooks';
import type { AgentState } from '../types.ts';

// ── Spinner frames ────────────────────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const STATE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  idle: { color: 'cyan', icon: '●', label: 'Agent ready' },
  working: { color: 'green', icon: '◉', label: 'Agent working' },
  navigating: { color: 'blue', icon: '→', label: 'Agent navigating' },
  'waiting-input': { color: 'yellow', icon: '?', label: 'Waiting for input' },
};

// ── Props ─────────────────────────────────────────────────────

export interface MascotteOverlayProps {
  agentState: AgentState;
  taskSummary?: string;
  currentNode?: string;
  visible: boolean;
}

// ── Component ─────────────────────────────────────────────────

const MascotteOverlay = ({ agentState, taskSummary, currentNode, visible }: MascotteOverlayProps) => {
  const tick = useAnimationTick(150);

  if (!visible) return null;

  const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle;
  const spinnerChar = agentState === 'working'
    ? SPINNER[tick % SPINNER.length]
    : config.icon;

  const summary = taskSummary
    ? (taskSummary.length > 30 ? taskSummary.substring(0, 27) + '...' : taskSummary)
    : '';

  const node = currentNode
    ? (currentNode.length > 30 ? currentNode.substring(0, 27) + '...' : currentNode)
    : '';

  return h(Box, {
    position: 'absolute',
    marginLeft: 2,
    marginTop: 0,
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: config.color,
    paddingX: 1,
    width: 42,
  },
    // Line 1: mascotte face + status
    h(Box, { gap: 1 },
      h(Text, { color: config.color, bold: true }, `${spinnerChar} ${config.label}`),
    ),
    // Line 2: task summary (if any)
    summary
      ? h(Text, { color: 'white', dimColor: true }, summary)
      : null,
    // Line 3: current node (if any)
    node
      ? h(Text, { color: 'gray', dimColor: true }, `  ${node}`)
      : null,
    // Line 4: control hints
    h(Box, { gap: 2 },
      h(Text, { color: 'gray', dimColor: true }, 'Esc'),
      h(Text, { color: 'gray', dimColor: true }, 'detach'),
      h(Text, { color: 'gray', dimColor: true }, '  Enter'),
      h(Text, { color: 'gray', dimColor: true }, 'focus'),
    ),
  );
};

export { MascotteOverlay };
