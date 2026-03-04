// @ts-nocheck
/**
 * AgentScreen — The Agent page for maestro-code.
 *
 * Follows the same pattern as HomeScreen, SpacesScreen, etc.:
 *   NavBar → content panels
 *   useKeyboard for page hotkeys + quit confirmation
 *
 * Layout:
 *   ┌─ AGENT STATUS ──────────────────────────────────────────────┐
 *   │ ● working  session:abc123  ██░░░░░ 30%                     │
 *   └────────────────────────────────────────────────────────────┘
 *   ┌─ CONVERSATION ─────────────────────────────┐┌─ ACTIONS ────┐
 *   │ > Add login page                           ││ [Enter] Send  │
 *   │ Creating session...                        ││ [G] Go to     │
 *   │ Session started                            ││   session     │
 *   │ Invoking: dev                              ││ [Esc] Quit    │
 *   └────────────────────────────────────────────┘└──────────────┘
 */

import { createElement as h, useState, useRef, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import {
  theme, icons,
  T, muted, primary, bold,
  statusColor,
  prevPage, nextPage,
  breathingDot,
} from '../theme.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { useAnimationTick } from '../hooks/useAnimationTick.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';
import { ConversationLog } from './ConversationLog.ts';
import type { LogLine } from '../services/SessionManager.ts';

// ── State Display ─────────────────────────────────────────────

const STATE_DISPLAY = {
  idle:      { icon: '○', color: 'gray',  label: 'idle' },
  working:   { icon: '●', color: 'cyan',  label: 'working' },
  completed: { icon: '✓', color: 'green', label: 'completed' },
  error:     { icon: '✗', color: 'red',   label: 'error' },
};

// ── Agent Status Panel ────────────────────────────────────────

const AgentStatus = ({ agentState, sessionId, busy, tick = 0, lastOutput = null, repoPath = null }) => {
  const state = STATE_DISPLAY[agentState] || STATE_DISPLAY.idle;
  const shortId = sessionId ? sessionId.substring(0, 8) : null;

  const stateIcon = agentState === 'working' ? breathingDot(tick) : state.icon;

  // Truncate lastOutput to fit in status bar
  const outputPreview = lastOutput && agentState === 'completed'
    ? String(lastOutput).replace(/\n/g, ' ').slice(0, 60) + (String(lastOutput).length > 60 ? '...' : '')
    : null;

  // Truncate repo path — keep last 2 segments if too long
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
        : muted('No active session'),
      busy
        ? h(Text, null,
            muted('  '),
            T('cyan', icons.running + ' Processing...'),
          )
        : null,
    ),
    outputPreview
      ? h(Text, { wrap: 'truncate' },
          T('green', '  '),
          muted(outputPreview),
        )
      : null,
  );
};

// ── Quick Actions Panel ───────────────────────────────────────

const AgentActions = ({ sessionId, onSessionSelect }) => {
  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    // Scroll shortcuts
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'J'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '/'),
      h(Text, { color: theme.shortcut.key }, 'K'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Scroll'),
    ),
    sessionId
      ? h(Text, null,
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
          h(Text, { color: theme.shortcut.key }, 'G'),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
          muted('Go to session'),
        )
      : null,
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'H'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Home'),
    ),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'S'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Spaces'),
    ),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'C'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Catalog'),
    ),
  );
};

// ── Quit Confirmation ─────────────────────────────────────────

const QuitConfirmation = ({ onConfirm, onCancel }) => {
  useKeyboard({
    enter: onConfirm,
    escape: onCancel,
    q: onConfirm,
    n: onCancel,
  });

  return h(Box, {
    flexDirection: 'column',
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.status.warning,
    paddingLeft: 2,
    paddingRight: 2,
    width: 42,
    alignSelf: 'center',
    marginTop: 3,
  },
    h(Text, null, ''),
    h(Text, { color: theme.status.warning, bold: true }, '  Quit Maestro Code?'),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row', gap: 3, paddingLeft: 2 },
      h(Text, null,
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: theme.shortcut.key }, 'Enter'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '/'),
        h(Text, { color: theme.shortcut.key }, 'q'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
        muted(' Yes'),
      ),
      h(Text, null,
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: theme.shortcut.key }, 'Esc'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '/'),
        h(Text, { color: theme.shortcut.key }, 'n'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
        muted(' No'),
      ),
    ),
    h(Text, null, ''),
  );
};

// ── AgentScreen ───────────────────────────────────────────────

interface AgentScreenProps {
  apiClient: any;
  onNavigate: (page: string) => void;
  onSessionSelect?: (id: string) => void;
  onQuit: () => void;
  lines: LogLine[];
  agentState: 'idle' | 'working' | 'completed' | 'error';
  sessionId: string | null;
  busy: boolean;
  keyboardActive?: boolean;
  lastOutput?: string | null;
  repoPath?: string | null;
}

const AgentScreen = ({
  apiClient,
  onNavigate,
  onSessionSelect,
  onQuit,
  lines,
  agentState,
  sessionId,
  busy,
  keyboardActive,
  lastOutput = null,
  repoPath = null,
}: AgentScreenProps) => {
  const { stdout } = useStdout();
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const tick = useAnimationTick(120);

  // Compute available height for conversation: terminal - NavBar(3) - AgentStatus(6) - PanelBorders(2) - global chrome(6)
  const termRows = stdout.rows || 40;
  const termCols = stdout.columns || 80;
  const conversationHeight = Math.max(5, termRows - 17);
  // Conversation width: terminal width - ACTIONS panel (25) - panel borders (4)
  const conversationWidth = Math.max(20, termCols - 25 - 4);

  const askQuit = () => setShowQuitConfirm(true);

  // Auto-scroll to bottom when agent completes — ensures completion message is visible
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
    if (scrollOffset === 0) {
      // Already at bottom — stay there (no-op)
    }
    prevLineCount.current = lines.length;
  }

  const scrollUp = () => setScrollOffset(s => Math.min(s + 3, Math.max(0, lines.length - conversationHeight)));
  const scrollDown = () => setScrollOffset(s => Math.max(0, s - 3));

  // Keyboard — disabled when input bar is focused
  useKeyboard(showQuitConfirm ? {} : {
    ctrlLeft: () => onNavigate(prevPage('agent')),
    ctrlRight: () => onNavigate(nextPage('agent')),
    // Scroll conversation: j/k (vim-style, avoids conflict with TaskInputBar arrows)
    k: scrollUp,
    j: scrollDown,
    // Go to session detail
    g: () => {
      if (sessionId && onSessionSelect) onSessionSelect(sessionId);
    },
    h: () => onNavigate('home'),
    a: () => {}, // Already on agent, no-op
    s: () => onNavigate('spaces'),
    f: () => onNavigate('foundry'),
    c: () => onNavigate('catalog'),
    m: () => onNavigate('models'),
    q: askQuit,
    escape: askQuit,
  }, { isActive: keyboardActive !== false });

  // Quit confirmation
  if (showQuitConfirm) {
    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
      h(NavBar, { currentPage: 'agent' }),
      h(Box, { flexGrow: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
        h(QuitConfirmation, {
          onConfirm: onQuit,
          onCancel: () => setShowQuitConfirm(false),
        }),
      ),
    );
  }

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // NavBar
    h(NavBar, { currentPage: 'agent' }),

    // Agent Status (title + 2 content lines + borders = 6)
    h(Panel, { title: 'AGENT STATUS', height: 6, width: '100%' },
      h(AgentStatus, { agentState, sessionId, busy, tick, lastOutput, repoPath }),
    ),

    // Main content: Conversation | Actions
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Conversation log (left, fills space)
      h(Panel, {
        title: 'CONVERSATION',
        flexGrow: 1,
        anchor: 'bottom',
        showScroll: lines.length > conversationHeight,
        canScrollUp: scrollOffset < lines.length - conversationHeight,
        canScrollDown: scrollOffset > 0,
      },
        h(ConversationLog, { lines, height: conversationHeight, width: conversationWidth, scrollOffset }),
      ),

      // Actions (right, fixed width)
      h(Panel, { title: 'ACTIONS', width: 25 },
        h(AgentActions, { sessionId, onSessionSelect }),
      ),
    ),
  );
};

export { AgentScreen };
