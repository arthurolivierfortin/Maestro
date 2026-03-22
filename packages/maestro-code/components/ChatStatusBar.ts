/**
 * ChatStatusBar -- Status bar for the chat-first mode.
 *
 * Shows:
 * - Connection status + latency + time + daily cost (same as shared StatusBar)
 * - Session count badge (moved from NavBar)
 * - Context-aware shortcuts:
 *   - Default: /help commands  ? help  q quit
 *   - When widget open: [Esc] close  [j/k] nav  /help commands
 */

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  muted, dim,
  breathingDot, spinnerFrame,
} from '../theme.ts';
import { formatTime } from '@maestro/tui/utils';
import { useAnimationTick } from '../hooks/useAnimationTick.ts';

// -- ChatStatusBar --------------------------------------------------------

interface ChatStatusBarProps {
  connectionStatus?: string;
  latency?: number;
  lastRefresh?: Date | null;
  dailyCost?: number | null;
  costLimitStatus?: 'block' | 'warn' | null;
  focusedWidgetId?: string | null;
  apiClient?: any;
}

const ChatStatusBar = ({
  connectionStatus = 'connecting',
  latency = 0,
  lastRefresh = null,
  dailyCost = null,
  costLimitStatus = null,
  focusedWidgetId = null,
  apiClient = null,
}: ChatStatusBarProps) => {
  const tick = useAnimationTick(120);

  // -- Session count polling --
  const [sessionCount, setSessionCount] = useState(0);
  const [runningCount, setRunningCount] = useState(0);

  useEffect(() => {
    if (!apiClient) return;
    const fetchSessions = async () => {
      try {
        const sessions = await apiClient.listSessions();
        const list = Array.isArray(sessions) ? sessions : [];
        setSessionCount(list.length);
        setRunningCount(list.filter((s: any) => {
          const st = (s.status || '').toLowerCase();
          return st === 'running' || st === 'working' || st === 'active';
        }).length);
      } catch {
        // ignore
      }
    };
    fetchSessions();
    const timer = setInterval(fetchSessions, 10000);
    return () => clearInterval(timer);
  }, [apiClient]);

  // -- Connection indicator --
  const connColor = connectionStatus === 'connected'
    ? theme.status.success
    : connectionStatus === 'error'
      ? theme.status.error
      : theme.status.warning;

  const connIcon = connectionStatus === 'connecting'
    ? spinnerFrame(tick)
    : connectionStatus === 'connected'
      ? breathingDot(tick)
      : icons.connected;

  const latencyStr = latency > 0 ? `${latency}ms` : '-';
  const timeStr = lastRefresh ? formatTime(lastRefresh) : '-';

  // -- Context-aware shortcuts --
  const hasWidget = focusedWidgetId != null;

  return h(Box, {
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.ui.border,
    paddingLeft: 1,
    paddingRight: 1,
    height: (theme.layout as any).statusBarHeight || 3,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
    // Left: connection status + latency + time + cost
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
            costLimitStatus === 'block'
              ? h(Text, { color: 'red', bold: true }, `$${dailyCost.toFixed(2)} today (LIMIT)`)
              : costLimitStatus === 'warn'
                ? h(Text, { color: 'yellow', bold: true }, `$${dailyCost.toFixed(2)} today (!)`)
                : h(Text, { color: dailyCost > 0 ? 'yellow' : theme.text.muted }, `$${dailyCost.toFixed(2)} today`),
          )
        : null,
    ),

    // Center: session count badge
    sessionCount > 0
      ? h(Box, { flexDirection: 'row' },
          h(Text, { color: theme.status.success }, icons.dot),
          h(Text, null, ' '),
          h(Text, { color: theme.text.primary }, `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`),
          runningCount > 0
            ? h(Text, { color: theme.status.running }, ` (${runningCount} running)`)
            : null,
        )
      : null,

    // Right: context-aware shortcuts
    h(Box, { flexDirection: 'row' },
      hasWidget
        ? h(Box, { flexDirection: 'row' },
            h(Text, { color: theme.shortcut?.key || 'cyan' }, 'Esc'),
            h(Text, { color: 'gray' }, ' close  '),
            h(Text, { color: theme.shortcut?.key || 'cyan' }, 'j/k'),
            h(Text, { color: 'gray' }, ' nav  '),
            h(Text, { color: theme.shortcut?.key || 'cyan' }, '/help'),
            h(Text, { color: 'gray' }, ' commands'),
          )
        : h(Box, { flexDirection: 'row' },
            h(Text, { color: theme.shortcut?.key || 'cyan' }, '/help'),
            h(Text, { color: 'gray' }, ' commands  '),
            h(Text, { color: theme.shortcut?.key || 'cyan' }, '/quit'),
            h(Text, { color: 'gray' }, ' quit'),
          ),
    ),
  );
};

export { ChatStatusBar };
