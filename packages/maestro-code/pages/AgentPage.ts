// @ts-nocheck
/**
 * AgentPage — Full-screen agent page with 3 visual states.
 *
 * States:
 * - **idle**: MascotteFull centered, system status, active sessions summary, input prompt
 * - **working**: MascotteCompact header, scrollable ConversationLog, widgets inline, input prompt
 * - **completed**: MascotteCompact celebrating, conversation + summary card, input prompt
 *
 * This is the CENTER page (0,0) in the spatial grid — the heart of Maestro Code.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { MascotteFull } from '../components/MascotteFull.ts';
import { MascotteCompact } from '../components/MascotteCompact.ts';
import { ConversationLog } from '../components/ConversationLog.ts';
import type { LogLine, Widget } from '../services/SessionManager.ts';
import type { AgentState } from '../types.ts';

export interface AgentPageProps {
  agentState: AgentState;
  lines: LogLine[];
  busy: boolean;
  connected: boolean | null;
  latency: number;
  sessionId: string | null;
  height: number;
  onSubmit: (value: string) => void;
  onUpArrow?: () => string | null;
  onDownArrow?: () => string | null;
  currentWidget?: Widget | null;
  pendingInteractive?: Widget | null;
  voiceMode?: boolean;
  widgetRenderer?: any;
  demoMode?: boolean;
}

// ── Visual state derivation ──────────────────────────────────

function deriveVisualState(agentState: AgentState, busy: boolean, lines: LogLine[]): 'idle' | 'working' | 'celebrating' {
  if (agentState === 'working' || busy) return 'working';
  // Check if we just completed (last non-empty line says "completed")
  const lastReal = [...lines].reverse().find(l => l.text.trim().length > 0);
  if (lastReal && /task completed/i.test(lastReal.text)) return 'celebrating';
  return 'idle';
}

// ── Idle state: big mascotte + system status ─────────────────

const IdleView = ({ connected, latency, height }: {
  connected: boolean | null;
  latency: number;
  height: number;
}) => {
  const backendStatus = connected === true ? '● Backend' : connected === false ? '✗ Backend' : '… Backend';
  const backendColor = connected === true ? 'green' : connected === false ? 'red' : 'gray';
  const llmStatus = connected === true ? '● LLM Provider' : '… LLM Provider';
  const llmColor = connected === true ? 'green' : 'gray';

  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    height,
  },
    // System status line
    h(Box, { flexDirection: 'row', justifyContent: 'center', marginBottom: 1 },
      h(Text, { color: 'gray' }, 'System: '),
      h(Text, { color: backendColor }, backendStatus),
      h(Text, null, '  '),
      h(Text, { color: llmColor }, llmStatus),
      latency > 0
        ? h(Text, { color: 'gray', dimColor: true }, `  ${latency}ms`)
        : null,
    ),

    // Centered mascotte
    h(MascotteFull, { state: 'idle' }),
  );
};

// ── Working state: compact header + conversation log ─────────

const WorkingView = ({ lines, sessionId, height, currentWidget, widgetRenderer }: {
  lines: LogLine[];
  sessionId: string | null;
  height: number;
  currentWidget?: Widget | null;
  widgetRenderer?: any;
}) => {
  // Reserve: 2 for compact header, 3 for input prompt, rest for log
  const logHeight = Math.max(height - 5, 3);

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    // Compact mascotte header
    h(MascotteCompact, {
      state: 'working',
      sessionId,
    }),

    // Conversation log
    h(ConversationLog, { lines, height: logHeight }),

    // Inline widget (if any)
    currentWidget && widgetRenderer
      ? h(widgetRenderer, { widget: currentWidget, onResponse: () => {} })
      : null,
  );
};

// ── Completed state: celebrating header + log + summary ──────

const CompletedView = ({ lines, sessionId, height, demoMode }: {
  lines: LogLine[];
  sessionId: string | null;
  height: number;
  demoMode?: boolean;
}) => {
  const logHeight = Math.max(height - 8, 3);

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    // Compact celebrating header
    h(MascotteCompact, {
      state: 'celebrating',
      sessionId,
    }),

    // Conversation log (scrolled to bottom shows summary)
    h(ConversationLog, { lines, height: logHeight }),

    // Summary card
    h(Box, {
      borderStyle: 'round',
      borderColor: 'green',
      paddingX: 1,
      marginX: 2,
      flexDirection: 'column',
    },
      h(Text, { color: 'green', bold: true }, '★ Task completed'),
      h(Text, { color: 'gray' }, '  ↑Execution to view full monitor'),
    ),
  );
};

// ── Main AgentPage ───────────────────────────────────────────

const AgentPage = (props: AgentPageProps) => {
  const {
    agentState, lines, busy, connected, latency,
    sessionId, height, currentWidget, widgetRenderer, demoMode,
  } = props;

  const visualState = deriveVisualState(agentState, busy, lines);

  switch (visualState) {
    case 'idle':
      return h(IdleView, { connected, latency, height });

    case 'working':
      return h(WorkingView, {
        lines, sessionId, height, currentWidget, widgetRenderer,
      });

    case 'celebrating':
      return h(CompletedView, {
        lines, sessionId, height, demoMode,
      });

    default:
      return h(IdleView, { connected, latency, height });
  }
};

export { AgentPage, deriveVisualState };
