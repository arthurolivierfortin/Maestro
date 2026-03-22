/**
 * WorkspaceDetailWidget — Workspace info summary.
 *
 * Compact inline version of WorkspaceDetail.
 * Interactive: j/k navigate sessions.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  statusColor, statusIcon,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';
import { PermissionsPanel } from '../PermissionsPanel.ts';

interface WorkspaceDetailWidgetProps {
  apiClient: any;
  focused: boolean;
  workspaceId: string;
  onSessionSelect?: (id: string) => void;
}

const WorkspaceDetailWidget = ({ apiClient, focused, workspaceId, onSessionSelect }: WorkspaceDetailWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: workspace } = useApiData(
    useCallback((): Promise<any> => apiClient.get(`/api/workspaces/${workspaceId}`).catch((): null => null), [apiClient, workspaceId]),
    focused ? 10000 : 0
  );

  const name = (workspace?.name || workspace?.id || 'Unknown').padEnd(30);
  const sessions: any[] = workspace?.sessions || [];
  const allowedBlocks: string[] = workspace?.allowedBlocks || ['*'];

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(sessions.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.return && sessions[selectedIndex] && onSessionSelect) {
      onSessionSelect(sessions[selectedIndex].id || sessions[selectedIndex]);
    }
  }, { isActive: focused });

  if (!workspace) {
    return h(Box, { paddingLeft: 1 }, muted(`Loading workspace ${workspaceId.substring(0, 8)}...`));
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      primary(name),
      h(Text, null, '  '),
      muted(workspaceId.substring(0, 8)),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted(`Sessions: ${sessions.length}`),
    ),
    ...sessions.slice(0, 8).map((s: any, i: number) => {
      const sName = typeof s === 'string' ? s.substring(0, 8) : (s.name || s.id?.substring(0, 8) || '?');
      const sStatus = typeof s === 'object' ? (s.status || 'unknown') : 'unknown';
      const isSelected = focused && i === selectedIndex;
      const selector = isSelected ? icons.arrow : ' ';

      return h(Box, { key: `s-${i}`, flexDirection: 'row', paddingLeft: 1 },
        h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
        h(Text, null, ' '),
        T(statusColor(sStatus), statusIcon(sStatus)),
        h(Text, null, ' '),
        h(Text, { color: isSelected ? 'cyan' : 'white' }, sName.padEnd(28)),
        h(Text, null, ' '),
        muted(sStatus.padEnd(12)),
      );
    }),
    sessions.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no sessions)'))
      : null,
    h(Text, null, ''),
    h(PermissionsPanel, {
      effectiveBlocks: allowedBlocks,
      parentBlocks: [],
      title: 'PERMISSIONS (ceiling)',
    }),
  );
};

export { WorkspaceDetailWidget };
