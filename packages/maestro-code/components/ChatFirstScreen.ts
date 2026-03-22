/**
 * ChatFirstScreen -- The default chat-first main screen for maestro-code.
 *
 * Replaces the old AgentScreen in non-classic mode. Renders:
 * - Agent status header (state, repo, session, model, processing indicator)
 * - Conversation log (full width, no ACTIONS side panel)
 * - Inline widgets rendered inside the conversation
 *
 * No NavBar, no page routing, no hotkeys for page switching.
 */

import { createElement as h, useState, useRef, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  breathingDot,
} from '../theme.ts';
import { useAnimationTick } from '../hooks/useAnimationTick.ts';
import { Panel } from './Panel.ts';
import { ConversationLog } from './ConversationLog.ts';
import type { LogLine } from '../services/SessionManager.ts';
import type { WidgetNavigateFn } from './InlineWidget.ts';

// -- State Display -------------------------------------------------------

const STATE_DISPLAY: Record<string, { icon: string; color: string; label: string }> = {
  idle:      { icon: '\u25CB', color: 'gray',  label: 'idle' },
  working:   { icon: '\u25CF', color: 'cyan',  label: 'working' },
  completed: { icon: '\u2713', color: 'green', label: 'completed' },
  error:     { icon: '\u2717', color: 'red',   label: 'error' },
};

// -- Agent Status (compact header) ----------------------------------------

interface AgentStatusProps {
  agentState: string;
  sessionId: string | null;
  busy: boolean;
  tick?: number;
  lastOutput?: string | null;
  repoPath?: string | null;
  activeAgent?: string | null;
}

const AgentStatus = ({ agentState, sessionId, busy, tick = 0, lastOutput = null, repoPath = null, activeAgent = null }: AgentStatusProps) => {
  const state = STATE_DISPLAY[agentState] || STATE_DISPLAY.idle;
  const shortId = sessionId ? sessionId.substring(0, 8) : null;

  const stateIcon = agentState === 'working' ? breathingDot(tick) : state.icon;

  const outputPreview = lastOutput && agentState === 'completed'
    ? String(lastOutput).replace(/\n/g, ' ').slice(0, 60) + (String(lastOutput).length > 60 ? '...' : '')
    : null;

  let displayPath = repoPath;
  if (displayPath && displayPath.length > 30) {
    const parts = displayPath.replace(/\\/g, '/').split('/');
    displayPath = '.../' + parts.slice(-2).join('/');
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row', gap: 3 },
      h(Text, null,
        h(Text, { color: state.color }, stateIcon),
        h(Text, null, ' '),
        muted('Agent: '),
        T(state.color, state.label),
      ),
      displayPath
        ? h(Text, null, muted(displayPath))
        : null,
      shortId
        ? h(Text, null,
            muted('Session: '),
            primary(shortId),
          )
        : muted('Ready — type a message to start'),
      activeAgent && activeAgent !== 'system:maestro-assistant'
        ? h(Text, null,
            muted('Model: '),
            T('magenta', activeAgent.replace(/^system:/, '')),
          )
        : null,
      busy
        ? h(Text, null,
            muted('  '),
            T('cyan', icons.running + ' Processing...'),
          )
        : null,
    ),
    outputPreview
      ? h(Text, { wrap: 'wrap' },
          T('green', '  '),
          muted(outputPreview),
        )
      : null,
  );
};

// -- ChatFirstScreen ------------------------------------------------------

interface ChatFirstScreenProps {
  apiClient: any;
  onQuit: () => void;
  lines: LogLine[];
  agentState: 'idle' | 'working' | 'completed' | 'error';
  sessionId: string | null;
  busy: boolean;
  lastOutput?: string | null;
  repoPath?: string | null;
  activeAgent?: string | null;
  focusedWidgetId?: string | null;
  collapsedWidgets?: Set<string>;
  onWidgetClose?: (widgetId: string) => void;
  onWidgetNavigate?: WidgetNavigateFn;
}

const ChatFirstScreen = ({
  apiClient,
  onQuit,
  lines,
  agentState,
  sessionId,
  busy,
  lastOutput = null,
  repoPath = null,
  activeAgent = null,
  focusedWidgetId = null,
  collapsedWidgets,
  onWidgetClose,
  onWidgetNavigate,
}: ChatFirstScreenProps) => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);
  const tick = useAnimationTick(120);

  // Compute available height: terminal - AgentStatus(6) - TaskInputBar(3) - StatusBar(3) - padding(2)
  const termRows = stdout.rows || 40;
  const termCols = stdout.columns || 80;
  const conversationHeight = Math.max(5, termRows - 14);
  const conversationWidth = Math.max(20, termCols - 4);

  // Auto-scroll to bottom when agent completes
  const prevAgentState = useRef(agentState);
  useEffect(() => {
    if (prevAgentState.current === 'working' && agentState === 'completed') {
      setScrollOffset(0);
    }
    prevAgentState.current = agentState;
  }, [agentState]);

  // Auto-snap to bottom when new lines arrive and user is at bottom
  const prevLineCount = useRef(lines.length);
  if (lines.length !== prevLineCount.current) {
    prevLineCount.current = lines.length;
  }

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Agent Status (compact header)
    h(Panel, { title: 'AGENT STATUS', height: 6, width: '100%' },
      h(AgentStatus, { agentState, sessionId, busy, tick, lastOutput, repoPath, activeAgent }),
    ),

    // Conversation log (full width, no side panel)
    h(Panel, {
      title: 'CONVERSATION',
      flexGrow: 1,
      anchor: 'bottom',
      showScroll: lines.length > conversationHeight,
      canScrollUp: scrollOffset < Math.max(0, lines.length - 1),
      canScrollDown: scrollOffset > 0,
    },
      h(ConversationLog, {
        lines,
        height: conversationHeight,
        width: conversationWidth,
        scrollOffset,
        focusedWidgetId,
        collapsedWidgets,
        onWidgetClose,
        onWidgetNavigate,
        apiClient,
      }),
    ),
  );
};

export { ChatFirstScreen };
