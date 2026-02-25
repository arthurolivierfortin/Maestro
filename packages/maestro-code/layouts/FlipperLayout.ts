// @ts-nocheck
/**
 * FlipperLayout — Flipper Zero-inspired cockpit layout for the Agent screen.
 *
 * Like the Flipper Zero with its dauphin: ONE hero panel with contextual
 * monitoring panels around it. The hero panel is the agent conversation.
 * Context panels show real-time session execution data.
 *
 * ── Idle (no session) ────────────────────────────────────────────
 * Full-screen hero panel with mascotte, conversation, and input.
 *
 * ── Active (session running) ─────────────────────────────────────
 * ┌────────────────────────────┬──────────────────────────────────┐
 * │  HERO (~65%)               │  EXECUTION TREE (~35%)           │
 * │  [Agent activity compact]  │  ✓ Prepare                       │
 * │  > Add login page          │  ▶ Plan ←                        │
 * │    Creating session...     │    ○ Implement                   │
 * │    ✓ Plan done             │────────────────────────────────── │
 * │                            │  METRICS                         │
 * │  > Describe your task...   │  Nodes: 2/8  Fitness: 52%        │
 * ├────────────────────────────┴──────────────────────────────────┤
 * │  LOG (50%)                  │  LLM ACTIVITY (50%)              │
 * │  [12:34:56] INFO Plan ok    │  ── plan-block (12:34) ──        │
 * │  [12:35:01] INFO Coding     │  → "Plan the implementation..."  │
 * └─────────────────────────────┴─────────────────────────────────┘
 *
 * Keyboard context:
 * - Hero focused → keys go to InputPrompt (typing mode)
 * - Panel focused → keys go to panel (navigation mode)
 * - Tab: cycle focus (hero → tree → log → llm → hero)
 * - Esc: return to hero focus / exit zoom
 * - z: zoom focused panel full-screen
 */

import { createElement as h, useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Panel, WorkflowTree, ExecutionLog, LLMActivity, MetricsPanel } from '@maestro/tui/components';
import { useApiData, useTreeNav, useMouse } from '@maestro/tui/hooks';
import { flattenExecutionTree, autoExpandRunningPath } from '@maestro/tui/utils';
import { inkTheme as theme } from '@maestro/tui/theme';
import { AgentActivity } from '../panels/AgentActivity.ts';
import type { AgentState, LogLine, Widget } from '../types.ts';

// ── Panel focus IDs ─────────────────────────────────────────────

type PanelId = 'hero' | 'tree' | 'log' | 'llm';
const PANEL_CYCLE: PanelId[] = ['hero', 'tree', 'log', 'llm'];

// ── OutputPanel (conversation lines) ────────────────────────────

const OutputPanel = ({ lines, height }) => {
  const maxLines = Math.max(height - 1, 1);
  const visible = lines.slice(-maxLines);

  return h(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
    ...visible.map((line, i) =>
      h(Box, { key: i },
        line.timestamp
          ? h(Text, { color: 'gray', dimColor: true }, `${line.timestamp} `)
          : null,
        h(Text, {
          color: (line.color || 'white'),
          bold: line.bold,
          dimColor: line.dim,
        }, line.text)
      )
    ),
    visible.length === 0
      ? h(Text, { color: 'gray', dimColor: true }, 'Waiting for input...')
      : null
  );
};

// ── InputPrompt (conversation input) ────────────────────────────

const InputPrompt = ({ onSubmit, disabled, placeholder, onUpArrow, onDownArrow }) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const valueRef = useRef('');
  const cursorRef = useRef(0);

  useInput((input, key) => {
    if (disabled) return;

    let v = valueRef.current;
    let c = cursorRef.current;

    if (key.return) {
      if (v.trim()) {
        onSubmit(v.trim());
        v = '';
        c = 0;
      }
    } else if (key.upArrow && !v && onUpArrow) {
      const hist = onUpArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.downArrow && onDownArrow) {
      const hist = onDownArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.backspace || key.delete) {
      if (c > 0) { v = v.slice(0, c - 1) + v.slice(c); c = c - 1; }
    } else if (key.leftArrow) {
      c = Math.max(0, c - 1);
    } else if (key.rightArrow) {
      c = Math.min(v.length, c + 1);
    } else if (input === 'a' && key.ctrl) {
      c = 0;
    } else if (input === 'e' && key.ctrl) {
      c = v.length;
    } else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
      v = v.slice(0, c) + input + v.slice(c);
      c = c + input.length;
    }

    valueRef.current = v;
    cursorRef.current = c;
    setValue(v);
    setCursor(c);
  });

  const prompt = disabled ? '...' : '>';
  const promptColor = disabled ? 'gray' : 'green';

  return h(Box, {
    borderStyle: 'round',
    borderColor: disabled ? 'gray' : 'cyan',
    paddingX: 1,
    flexShrink: 0,
  },
    h(Text, { color: promptColor, bold: true }, `${prompt} `),
    h(Text, null,
      value || h(Text, { color: 'gray', dimColor: true }, placeholder || 'Describe your task...')
    )
  );
};

// ── FlipperLayout ───────────────────────────────────────────────

interface FlipperLayoutProps {
  // Agent state
  sessionId: string | null;
  apiClient: any;
  lines: LogLine[];
  busy: boolean;
  agentState: AgentState;
  agentIsHere: boolean;
  taskSummary?: string;
  currentWidget: Widget | null;
  pendingInteractive: Widget | null;
  voiceMode?: boolean;
  // Input handlers
  onSubmit: (input: string) => void;
  onUpArrow?: () => string | null;
  onDownArrow?: () => string | null;
  // Widget renderer
  widgetRenderer?: any;
  // Layout
  height: number;
  // State reporting (for StatusBar in parent)
  onPanelFocus?: (panel: PanelId | null) => void;
  onZoom?: (panel: PanelId | null) => void;
}

const FlipperLayout = ({
  sessionId,
  apiClient,
  lines,
  busy,
  agentState,
  agentIsHere,
  taskSummary,
  currentWidget,
  pendingInteractive,
  voiceMode,
  onSubmit,
  onUpArrow,
  onDownArrow,
  widgetRenderer,
  height,
  onPanelFocus,
  onZoom,
}: FlipperLayoutProps) => {
  const [focusedPanel, setFocusedPanel] = useState<PanelId>('hero');
  const [zoomed, setZoomed] = useState<PanelId | null>(null);
  const hasSession = sessionId != null;

  // Report panel state changes to parent (for StatusBar)
  useEffect(() => { onPanelFocus?.(hasSession ? focusedPanel : null); }, [focusedPanel, hasSession]);
  useEffect(() => { onZoom?.(zoomed); }, [zoomed]);

  // ── Session data polling (only when session active) ────────
  const { data: sessionData } = useApiData(
    useCallback(() => {
      if (!sessionId || !apiClient) return Promise.resolve(null);
      return (apiClient.getSession?.(sessionId) ||
        apiClient._fetch?.('GET', `/api/sessions/${sessionId}`))?.catch(() => null) ||
        Promise.resolve(null);
    }, [apiClient, sessionId]),
    hasSession ? 2000 : 0
  );

  const vars = sessionData?.variables || {};
  const executionTree = vars._executionTree || [];
  const executionLog = vars._executionLog || [];
  const llmActivity = vars._llmActivity || [];
  const fitness = vars._currentFitness || vars.currentFitness;

  // ── Tree navigation ────────────────────────────────────────
  const treeNav = useTreeNav();

  // Auto-expand running nodes
  useEffect(() => {
    if (executionTree.length > 0) {
      const autoExpanded = autoExpandRunningPath(executionTree);
      if (autoExpanded.size > 0) {
        for (const id of autoExpanded) {
          treeNav.expand(id);
        }
      }
    }
  }, [executionTree]);

  // Flatten tree with current expansion state
  const flatNodes = flattenExecutionTree(executionTree, treeNav.expanded);

  // Keep tree nav in sync (use JSON hash to avoid infinite loop)
  const flatNodesHash = flatNodes.map(n => n.id).join(',');
  useEffect(() => {
    treeNav.setFlatNodes(flatNodes);
  }, [flatNodesHash]);

  // ── Keyboard handler ───────────────────────────────────────
  useInput((input, key) => {
    // Tab: cycle focus (only when session active and not zoomed)
    if (key.tab && hasSession && !zoomed) {
      setFocusedPanel(current => {
        const idx = PANEL_CYCLE.indexOf(current);
        return PANEL_CYCLE[(idx + 1) % PANEL_CYCLE.length];
      });
      return;
    }

    // Esc: return to hero from panel focus, or exit zoom
    if (key.escape) {
      if (zoomed) {
        setZoomed(null);
        return;
      }
      if (focusedPanel !== 'hero') {
        setFocusedPanel('hero');
        return;
      }
    }

    // z: zoom focused panel (only for context panels, not hero)
    if (input === 'z' && focusedPanel !== 'hero' && hasSession) {
      setZoomed(prev => prev ? null : focusedPanel);
      return;
    }

    // Panel-specific navigation (only when a context panel is focused)
    if (focusedPanel === 'tree' && hasSession) {
      if (key.upArrow) { treeNav.moveUp(); return; }
      if (key.downArrow) { treeNav.moveDown(); return; }
      if (key.leftArrow) { treeNav.moveLeft(); return; }
      if (key.rightArrow) { treeNav.moveRight(); return; }
      if (key.return || input === ' ') { treeNav.toggle(); return; }
    }
  });

  // ── Mouse support ────────────────────────────────────────────
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;

  useMouse({
    onClick: useCallback((x: number, y: number) => {
      if (!hasSession || zoomed) return;
      // Map click coordinates to panel regions
      // Layout: top row is ~60% height, hero is 65% width
      const topRowHeight = Math.max(Math.floor((height - 3) * 0.6), 6);
      const heroWidth = Math.floor(cols * 0.65);

      if (y <= topRowHeight + 2) {
        // Top row
        if (x <= heroWidth) {
          setFocusedPanel('hero');
        } else {
          setFocusedPanel('tree');
        }
      } else {
        // Bottom row
        const halfWidth = Math.floor(cols * 0.5);
        if (x <= halfWidth) {
          setFocusedPanel('log');
        } else {
          setFocusedPanel('llm');
        }
      }
    }, [hasSession, zoomed, height, cols]),

    onScroll: useCallback((_x: number, _y: number, direction: 'up' | 'down') => {
      if (!hasSession) return;
      // Scroll in tree panel
      if (focusedPanel === 'tree') {
        if (direction === 'up') treeNav.moveUp();
        else treeNav.moveDown();
      }
    }, [hasSession, focusedPanel]),
  });

  // Reset focus to hero when session ends
  useEffect(() => {
    if (!hasSession) {
      setFocusedPanel('hero');
      setZoomed(null);
    }
  }, [hasSession]);

  // ── Computed metrics ───────────────────────────────────────
  const allFlatNodes = flattenExecutionTree(executionTree, new Set(
    executionTree.map(n => n.id || n.name)
  ));
  const completedNodes = allFlatNodes.filter(n =>
    n.status === 'completed' || n.status === 'done'
  );

  // ── Placeholder for input prompt ──────────────────────────
  const inputPlaceholder = pendingInteractive
    ? 'Respond to the widget above...'
    : voiceMode
      ? 'Listening...'
      : busy
        ? 'Send a message to the agent...'
        : 'Describe your task...';

  // ── Idle layout (no session) ──────────────────────────────
  if (!hasSession) {
    // When agent is active (working/navigating/waiting), use compact mode
    // to maximize output space. Full mascotte only when truly idle.
    const agentActive = agentIsHere && agentState !== 'idle';
    const activityHeight = agentActive ? 1 : 0; // compact = 1 line
    const outputHeight = Math.max(height - 5 - activityHeight - (currentWidget ? 8 : 0), 3);

    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      // Agent activity (compact when active — full mascotte only when idle screen)
      agentActive
        ? h(AgentActivity, {
            agentState,
            taskSummary,
            sessionId,
            compact: true,
          })
        : null,

      // Conversation output
      h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'gray',
        paddingX: 1,
        height: outputHeight,
        overflow: 'hidden',
      },
        h(OutputPanel, { lines, height: outputHeight }),
      ),

      // Widget
      currentWidget && widgetRenderer
        ? h(widgetRenderer, { widget: currentWidget, onResponse: () => {} })
        : null,

      // Input
      h(InputPrompt, {
        onSubmit,
        disabled: false,
        placeholder: inputPlaceholder,
        onUpArrow,
        onDownArrow,
      }),
    );
  }

  // ── Active layout (session running) ───────────────────────

  // Zoomed mode: show single panel full-screen
  if (zoomed) {
    return renderZoomed(zoomed);
  }

  // Calculate layout proportions
  const topRowHeight = Math.max(Math.floor((height - 3) * 0.6), 6);
  const bottomRowHeight = Math.max(height - topRowHeight - 3, 4);
  const heroOutputHeight = Math.max(topRowHeight - 5 - 1, 2); // -input(3) -activity(1) -border(1)

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    // Top row: Hero (65%) + Right column (35%)
    h(Box, { flexDirection: 'row', height: topRowHeight, width: '100%' },

      // HERO panel (conversation + input)
      h(Box, { flexDirection: 'column', width: '65%' },
        // Compact agent activity (1 line when active)
        agentIsHere && agentState !== 'idle'
          ? h(AgentActivity, {
              agentState,
              taskSummary,
              sessionId,
              compact: true,
            })
          : null,

        // Conversation output
        h(Panel, {
          title: 'AGENT',
          focused: focusedPanel === 'hero',
          flexGrow: 1,
          anchor: 'bottom',
        },
          h(OutputPanel, { lines, height: heroOutputHeight }),
        ),

        // Widget (compact)
        currentWidget && widgetRenderer
          ? h(widgetRenderer, { widget: currentWidget, onResponse: () => {} })
          : null,

        // Input prompt
        h(InputPrompt, {
          onSubmit,
          disabled: focusedPanel !== 'hero',
          placeholder: focusedPanel !== 'hero'
            ? '[Tab] to type'
            : inputPlaceholder,
          onUpArrow: focusedPanel === 'hero' ? onUpArrow : undefined,
          onDownArrow: focusedPanel === 'hero' ? onDownArrow : undefined,
        }),
      ),

      // RIGHT column: Execution Tree + Metrics
      h(Box, { flexDirection: 'column', flexGrow: 1 },
        // Execution tree (top ~70% of right column)
        h(Panel, {
          title: 'EXECUTION',
          focused: focusedPanel === 'tree',
          flexGrow: 1,
        },
          executionTree.length > 0
            ? h(WorkflowTree, {
                flatNodes,
                cursorIndex: treeNav.cursor,
                focused: focusedPanel === 'tree',
              })
            : h(Text, { color: 'gray', dimColor: true }, '  (no execution data)'),
        ),

        // Metrics (bottom ~30% of right column)
        h(Panel, { title: 'METRICS' },
          h(MetricsPanel, {
            fitness: fitness != null ? fitness : null,
            iteration: null,
            maxIterations: null,
            scoreHistory: vars._scoreHistory || [],
            nodesCompleted: completedNodes.length,
            nodesTotal: allFlatNodes.length,
          }),
        ),
      ),
    ),

    // Bottom row: Log (50%) + LLM Activity (50%)
    h(Box, { flexDirection: 'row', height: bottomRowHeight, width: '100%' },
      h(Panel, {
        title: 'LOG',
        focused: focusedPanel === 'log',
        anchor: 'bottom',
        width: '50%',
      },
        h(ExecutionLog, {
          entries: executionLog,
          maxLines: bottomRowHeight - 2,
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
          maxLines: bottomRowHeight - 2,
        }),
      ),
    ),

    // Focus hint
    h(Box, { paddingX: 1, height: 1 },
      h(Text, { color: 'gray', dimColor: true },
        focusedPanel === 'hero'
          ? '[Tab]panels  [?]help'
          : `[Tab]next  [Esc]input  [z]zoom  focused: ${focusedPanel}`
      ),
    ),
  );

  // ── Zoomed panel renderer ─────────────────────────────────
  function renderZoomed(panel: PanelId) {
    const zoomHeight = height - 2;

    switch (panel) {
      case 'tree':
        return h(Box, { flexDirection: 'column', flexGrow: 1 },
          h(Panel, {
            title: 'EXECUTION (zoomed)',
            focused: true,
            flexGrow: 1,
          },
            h(WorkflowTree, {
              flatNodes,
              cursorIndex: treeNav.cursor,
              focused: true,
            }),
          ),
          h(Box, { paddingX: 1, height: 1 },
            h(Text, { color: 'gray', dimColor: true }, '[Esc]exit zoom  [z]exit zoom'),
          ),
        );

      case 'log':
        return h(Box, { flexDirection: 'column', flexGrow: 1 },
          h(Panel, {
            title: 'LOG (zoomed)',
            focused: true,
            anchor: 'bottom',
            flexGrow: 1,
          },
            h(ExecutionLog, {
              entries: executionLog,
              maxLines: zoomHeight,
            }),
          ),
          h(Box, { paddingX: 1, height: 1 },
            h(Text, { color: 'gray', dimColor: true }, '[Esc]exit zoom  [z]exit zoom'),
          ),
        );

      case 'llm':
        return h(Box, { flexDirection: 'column', flexGrow: 1 },
          h(Panel, {
            title: 'LLM ACTIVITY (zoomed)',
            focused: true,
            anchor: 'bottom',
            flexGrow: 1,
          },
            h(LLMActivity, {
              entries: llmActivity,
              maxLines: zoomHeight,
            }),
          ),
          h(Box, { paddingX: 1, height: 1 },
            h(Text, { color: 'gray', dimColor: true }, '[Esc]exit zoom  [z]exit zoom'),
          ),
        );

      default:
        setZoomed(null);
        return null;
    }
  }
};

export { FlipperLayout };
export type { FlipperLayoutProps, PanelId };
