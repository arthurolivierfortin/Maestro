// @ts-nocheck
/**
 * SessionBrowser — Browse recent sessions.
 *
 * Lists sessions from the API with status, name, and duration.
 * Select a session → navigate to session detail.
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Panel } from '@maestro/tui/components';
import { useApiData, useSelectableList } from '@maestro/tui/hooks';
import { useActionKeyboard } from '@maestro/tui/hooks';
import { muted, bold } from '@maestro/tui/theme';
import { statusColor, statusIcon, formatDuration } from '@maestro/tui/utils';
import type { Screen } from '../types.ts';

interface SessionBrowserProps {
  apiClient: any;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onQuit: () => void;
  height: number;
}

const SessionBrowser = ({ apiClient, onNavigate, onBack, onQuit, height }: SessionBrowserProps) => {
  const { data: sessions } = useApiData(
    useCallback(() => apiClient?.listSessions?.() || apiClient?._fetch?.('GET', '/api/sessions').catch(() => []), [apiClient]),
    5000
  );

  const sessionList = sessions || [];

  const {
    selectedIndex,
    moveUp,
    moveDown,
    scrollStart,
    visibleCount,
    canScrollUp,
    canScrollDown,
    positionLabel,
  } = useSelectableList({ itemCount: sessionList.length, pageSize: height - 8 });

  useActionKeyboard({
    'cursor.up': moveUp,
    'cursor.down': moveDown,
    'cursor.upAlt': moveUp,
    'cursor.downAlt': moveDown,
    'tree.toggle': () => {
      const session = sessionList[selectedIndex];
      if (session) onNavigate({ type: 'session-detail', id: session.id });
    },
    'back': onBack,
    'quit': onQuit,
  }, 'detail');

  const visibleSessions = sessionList.slice(scrollStart, scrollStart + visibleCount);

  return h(Panel, {
    title: 'SESSIONS',
    focused: true,
    flexGrow: 1,
    cursorInfo: positionLabel,
    showScroll: true,
    canScrollUp,
    canScrollDown,
  },
    h(Box, { flexDirection: 'column', paddingLeft: 1 },
      h(Box, { marginBottom: 1 },
        muted(`${sessionList.length} session(s)`),
      ),

      sessionList.length === 0
        ? h(Box, { paddingLeft: 1 }, muted('(no sessions)'))
        : h(Box, { flexDirection: 'column' },
            ...visibleSessions.map((session, i) => {
              const globalIndex = scrollStart + i;
              const isSelected = globalIndex === selectedIndex;
              const selector = isSelected ? '→' : ' ';
              const status = (session.status || 'unknown').toLowerCase();
              const sColor = statusColor(status);
              const sIcon = statusIcon(status);
              const name = session.name || 'Unnamed';
              const duration = formatDuration(session.startedAt, session.completedAt);

              return h(Box, {
                key: session.id || `s-${i}`,
                flexDirection: 'row',
                paddingLeft: 1,
              },
                h(Text, { color: isSelected ? 'cyan' : 'gray' }, selector),
                h(Text, null, ' '),
                h(Text, { color: sColor }, sIcon),
                h(Text, null, ' '),
                h(Text, {
                  color: isSelected ? 'cyan' : 'white',
                  bold: isSelected,
                }, name.length > 35 ? name.slice(0, 35) + '...' : name.padEnd(38)),
                h(Text, null, ' '),
                h(Text, { color: sColor }, status.padEnd(10)),
                h(Text, { color: 'gray', dimColor: true }, duration),
              );
            }),
          ),
    ),
  );
};

export { SessionBrowser };
