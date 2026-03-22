/**
 * WorkspacesWidget — Workspace list.
 *
 * Extracted from SpacesScreen (workspaces tab). Compact inline version.
 * Interactive: j/k navigate, Enter opens workspace detail.
 */

import { createElement as h, useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  truncate,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface WorkspacesWidgetProps {
  apiClient: any;
  focused: boolean;
  onWorkspaceSelect?: (id: string) => void;
  maxItems?: number;
}

const WorkspacesWidget = ({ apiClient, focused, onWorkspaceSelect, maxItems = 10 }: WorkspacesWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: workspaces } = useApiData(
    useCallback((): Promise<any[]> => apiClient.get('/api/workspaces').catch((): any[] => []), [apiClient]),
    focused ? 10000 : 0
  );

  const workspaceList: any[] = (workspaces as any[]) || [];

  useEffect(() => {
    if (selectedIndex >= workspaceList.length && workspaceList.length > 0) {
      setSelectedIndex(Math.max(0, workspaceList.length - 1));
    }
  }, [workspaceList.length]);

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(workspaceList.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.return && workspaceList[selectedIndex] && onWorkspaceSelect) {
      onWorkspaceSelect(workspaceList[selectedIndex].id);
    }
  }, { isActive: focused });

  const visible = workspaceList.slice(0, maxItems);

  return h(Box, { flexDirection: 'column' },
    h(Box, { paddingLeft: 1 },
      muted(`${workspaceList.length} workspace(s)`),
    ),
    h(Text, null, ''),
    ...visible.map((ws: any, i: number) => {
      const name = ws.name || ws.id || 'Unknown';
      const id = ws.id ? ws.id.substring(0, 8) : '--------';
      const type = ws.type || '';
      const isSelected = focused && i === selectedIndex;
      const selector = isSelected ? icons.arrow : ' ';

      return h(Box, { key: ws.id || `w-${i}`, flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
        h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
        h(Text, null, ' '),
        h(Text, { color: theme.status.running }, icons.running),
        h(Text, null, ' '),
        h(Text, { color: isSelected ? 'cyan' : 'white' },
          truncate(name, 30).padEnd(30)),
        h(Text, null, ' '),
        muted(id.padEnd(8)),
        h(Text, null, '  '),
        muted((type || '').padEnd(12)),
      );
    }),
    workspaceList.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no workspaces)'))
      : null,
    workspaceList.length > maxItems
      ? h(Box, { paddingLeft: 2 }, muted(`+${workspaceList.length - maxItems} more`))
      : null,
  );
};

export { WorkspacesWidget };
