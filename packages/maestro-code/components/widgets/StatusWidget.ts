/**
 * StatusWidget — System health + active sessions summary.
 *
 * Extracted from HomeScreen. Shows backend/LLM status and a compact session list.
 * Interactive: j/k to navigate sessions.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  statusColor, statusIcon,
  breathingDot,
  truncate,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface StatusWidgetProps {
  apiClient: any;
  focused: boolean;
  onSessionSelect?: (id: string) => void;
}

const StatusWidget = ({ apiClient, focused, onSessionSelect }: StatusWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: health } = useApiData(
    useCallback((): Promise<any> => apiClient.getHealth().catch((): any => ({ error: true })), [apiClient]),
    focused ? 5000 : 0
  );
  const { data: llmHealth } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMHealth().catch((err: any): any => {
      console.error?.('[StatusWidget] getLLMHealth error:', err?.message || err);
      return { status: 'unknown', error: false };
    }), [apiClient]),
    focused ? 30000 : 0  // LLM health is slow (~5s) — poll infrequently
  );
  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions({ limit: 20 }).catch((err: any): any[] => {
      console.error?.('[StatusWidget] listSessions error:', err?.message || err);
      return [];
    }), [apiClient]),
    focused ? 5000 : 0
  );

  const sessionList: any[] = (sessions as any[]) || [];
  const runningCount = sessionList.filter((s: any) => s.status === 'running').length;
  const backendOk = health && !health.error;
  const llmOk = llmHealth && llmHealth.status !== 'unknown';
  const llmChecking = !llmHealth;  // Still waiting for first response
  const modelName = llmHealth?.activeModel || (llmHealth?.modelsLoaded ? `${llmHealth.modelsLoaded} models` : '-');

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(sessionList.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.return && sessionList[selectedIndex] && onSessionSelect) {
      onSessionSelect(sessionList[selectedIndex].id);
    }
  }, { isActive: focused });

  return h(Box, { flexDirection: 'column' },
    // Health row
    h(Box, { flexDirection: 'row', gap: 3, paddingLeft: 1 },
      h(Text, null,
        h(Text, { color: backendOk ? theme.status.success : theme.status.error }, backendOk ? icons.done : icons.failed),
        muted(' Backend: '),
        T(backendOk ? theme.status.success : theme.status.error, backendOk ? 'Connected' : 'Error'),
      ),
      h(Text, null,
        h(Text, { color: llmChecking ? 'yellow' : llmOk ? theme.status.success : theme.status.error },
          llmChecking ? '…' : llmOk ? icons.done : icons.failed),
        muted(' LLM: '),
        T(llmChecking ? 'yellow' : llmOk ? theme.status.success : theme.status.error,
          llmChecking ? 'Checking...' : llmOk ? String(modelName) : 'Offline'),
      ),
    ),
    // Summary
    h(Box, { paddingLeft: 1 },
      muted(`Providers: ${llmHealth?.providers ? Object.keys(llmHealth.providers).length : '-'}  Sessions: ${sessionList.length} (${runningCount} running)`),
    ),
    h(Text, null, ''),
    // Session list (compact)
    ...sessionList.slice(0, 5).map((session: any, i: number) => {
      const status = (session.status || 'unknown').toLowerCase();
      const name = session.name || 'Unnamed';
      const shortId = session.id ? session.id.substring(0, 8) : '--------';
      const isSelected = focused && i === selectedIndex;
      const selector = isSelected ? icons.arrow : ' ';

      return h(Box, { key: session.id || `s-${i}`, flexDirection: 'row', paddingLeft: 1 },
        h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
        h(Text, null, ' '),
        T(statusColor(status), statusIcon(status)),
        h(Text, null, ' '),
        h(Text, { color: isSelected ? 'cyan' : 'white' },
          truncate(name, 24).padEnd(24)),
        h(Text, null, ' '),
        muted(shortId.padEnd(8)),
        h(Text, null, '  '),
        T(statusColor(status), status.padEnd(12)),
      );
    }),
    sessionList.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('No active sessions'))
      : null,
    sessionList.length > 5
      ? h(Box, { paddingLeft: 2 }, muted(`+${sessionList.length - 5} more`))
      : null,
  );
};

export { StatusWidget };
