// @ts-nocheck
/**
 * SessionDetailScreen — Full session monitoring view for maestro-code.
 *
 * Shows execution tree, log, LLM activity, metrics, and variables
 * using the shared data panel components from @maestro/tui.
 * This is the "cockpit" view into a running or completed session.
 *
 * Layout:
 * ┌─ SESSION ──────────────────────────────────────────────────────┐
 * │  [session name]  [status]  [id]                                │
 * ├───────────────────────────┬────────────────────────────────────┤
 * │  EXECUTION TREE (60%)     │  METRICS (40%)                     │
 * │  ✓ Prepare                │  Nodes: 5/8  Duration: 2m 15s      │
 * │  ✓ Plan                   │  Fitness: [████░░░░] 65%           │
 * │  ▶ Implement ←            │                                    │
 * │    ○ Test                 │                                    │
 * ├───────────────────────────┴────────────────────────────────────┤
 * │  LOG (50%)                 │  LLM ACTIVITY (50%)                │
 * │  [12:34:56] INFO Plan ok   │  ── plan (12:34) ──                │
 * │  [12:35:01] INFO Coding    │  → "Plan the steps..."             │
 * └────────────────────────────┴───────────────────────────────────┘
 */

import { createElement as h, useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Panel, WorkflowTree, ExecutionLog, LLMActivity, MetricsPanel } from '@maestro/tui/components';
import { useApiData, useActionKeyboard, useTreeNav, usePanelFocus } from '@maestro/tui/hooks';
import { flattenExecutionTree, autoExpandRunningPath } from '@maestro/tui/utils';
import {
  inkTheme as theme,
  T, muted, primary, bold,
} from '@maestro/tui/theme';
import { statusColor, statusIcon } from '@maestro/tui/utils';
import type { Screen } from '../types.ts';

// ── Panel IDs for focus cycling ──────────────────────────────

const PANEL_IDS = ['tree', 'metrics', 'log', 'llm'] as const;

// ── SessionDetailScreen component ────────────────────────────

interface SessionDetailScreenProps {
  sessionId: string;
  apiClient: any;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onQuit: () => void;
  height: number;
}

const SessionDetailScreen = ({
  sessionId,
  apiClient,
  onNavigate,
  onBack,
  onQuit,
  height,
}: SessionDetailScreenProps) => {
  // Poll session data
  const { data: session } = useApiData(
    useCallback(() =>
      apiClient?.getSession?.(sessionId) ||
      apiClient?._fetch?.('GET', `/api/sessions/${sessionId}`).catch(() => null),
      [apiClient, sessionId]),
    2000
  );

  const vars = session?.variables || {};
  const executionTree = vars._executionTree || [];
  const executionLog = vars._executionLog || [];
  const llmActivity = vars._llmActivity || [];
  const sessionStatus = (session?.status || session?.containerStatus || 'unknown').toLowerCase();
  const sessionName = session?.name || 'Unnamed';

  // Panel focus
  const { focusedPanel, cycleFocus, focusPanel } = usePanelFocus(PANEL_IDS as any);

  // Tree navigation state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand running nodes
  useEffect(() => {
    if (executionTree.length > 0) {
      const autoExpanded = autoExpandRunningPath(executionTree);
      if (autoExpanded.size > 0) {
        setExpanded(prev => {
          const merged = new Set(prev);
          for (const id of autoExpanded) merged.add(id);
          return merged;
        });
      }
    }
  }, [executionTree]);

  const flatNodes = flattenExecutionTree(executionTree, expanded);

  const treeNav = useTreeNav({
    flatNodes,
    expanded,
    setExpanded,
    enabled: focusedPanel === 'tree',
  });

  // Keyboard
  useActionKeyboard({
    'cursor.up': () => {
      if (focusedPanel === 'tree') treeNav.moveUp();
    },
    'cursor.down': () => {
      if (focusedPanel === 'tree') treeNav.moveDown();
    },
    'cursor.upAlt': () => {
      if (focusedPanel === 'tree') treeNav.moveUp();
    },
    'cursor.downAlt': () => {
      if (focusedPanel === 'tree') treeNav.moveDown();
    },
    'tree.toggle': () => {
      if (focusedPanel === 'tree') treeNav.toggle();
    },
    'panel.cycle': cycleFocus,
    'panel.next': cycleFocus,
    'back': onBack,
    'quit': onQuit,
  }, 'detail');

  // Compute metrics
  const allNodes = flattenExecutionTree(executionTree, new Set(
    executionTree.map(n => n.id || n.name)
  ));
  const completedNodes = allNodes.filter(n => n.status === 'completed' || n.status === 'done');
  const totalNodes = allNodes.length;
  const fitness = vars._currentFitness || vars.currentFitness;

  // Layout heights
  const topHeight = Math.max(Math.floor((height - 3) * 0.55), 6);
  const bottomHeight = Math.max(height - 3 - topHeight, 4);

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'SESSION', width: '100%' },
      h(Box, { flexDirection: 'row', paddingLeft: 1 },
        bold(sessionName.length > 40 ? sessionName.substring(0, 40) + '...' : sessionName),
        h(Text, null, '  '),
        T(statusColor(sessionStatus), statusIcon(sessionStatus)),
        h(Text, null, ' '),
        T(statusColor(sessionStatus), sessionStatus),
        h(Text, null, '  '),
        muted(sessionId.substring(0, 8)),
      ),
    ),

    // Top row: Execution Tree + Metrics
    h(Box, { flexDirection: 'row', height: topHeight, width: '100%' },
      h(Panel, {
        title: 'EXECUTION',
        focused: focusedPanel === 'tree',
        width: '60%',
      },
        h(WorkflowTree, {
          flatNodes,
          cursorIndex: treeNav.cursorIndex,
          focused: focusedPanel === 'tree',
        }),
      ),
      h(Panel, {
        title: 'METRICS',
        focused: focusedPanel === 'metrics',
        flexGrow: 1,
      },
        h(MetricsPanel, {
          fitness: fitness != null ? fitness : null,
          iteration: null,
          maxIterations: null,
          scoreHistory: vars._scoreHistory || [],
          nodesCompleted: completedNodes.length,
          nodesTotal: totalNodes,
        }),
      ),
    ),

    // Bottom row: Log + LLM Activity
    h(Box, { flexDirection: 'row', height: bottomHeight, width: '100%' },
      h(Panel, {
        title: 'LOG',
        focused: focusedPanel === 'log',
        anchor: 'bottom',
        width: '50%',
      },
        h(ExecutionLog, {
          entries: executionLog,
          maxLines: bottomHeight - 2,
        }),
      ),
      h(Panel, {
        title: 'LLM',
        focused: focusedPanel === 'llm',
        anchor: 'bottom',
        flexGrow: 1,
      },
        h(LLMActivity, {
          entries: llmActivity,
          maxLines: bottomHeight - 2,
        }),
      ),
    ),
  );
};

export { SessionDetailScreen };
