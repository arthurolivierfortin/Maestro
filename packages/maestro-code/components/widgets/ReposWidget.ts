/**
 * ReposWidget — Repo list.
 *
 * Extracted from SpacesScreen (repos tab). Compact inline version.
 * Interactive: j/k navigate, Enter opens repo detail.
 */

import { createElement as h, useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted,
  statusColor, statusIcon,
  truncate,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface ReposWidgetProps {
  apiClient: any;
  focused: boolean;
  onRepoSelect?: (id: string) => void;
  maxItems?: number;
}

const ReposWidget = ({ apiClient, focused, onRepoSelect, maxItems = 10 }: ReposWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: projects } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listProjects().catch((): any[] => []), [apiClient]),
    focused ? 10000 : 0
  );

  const projectList: any[] = (projects as any[]) || [];

  useEffect(() => {
    if (selectedIndex >= projectList.length && projectList.length > 0) {
      setSelectedIndex(Math.max(0, projectList.length - 1));
    }
  }, [projectList.length]);

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(projectList.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.return && projectList[selectedIndex] && onRepoSelect) {
      onRepoSelect(projectList[selectedIndex].id);
    }
  }, { isActive: focused });

  const visible = projectList.slice(0, maxItems);

  return h(Box, { flexDirection: 'column' },
    h(Box, { paddingLeft: 1 },
      muted(`${projectList.length} repo(s)`),
    ),
    h(Text, null, ''),
    ...visible.map((proj: any, i: number) => {
      const name = proj.name || proj.rootPath || 'Unknown';
      const id = proj.id ? proj.id.substring(0, 8) : '--------';
      const status = proj.containerStatus || 'idle';
      const isSelected = focused && i === selectedIndex;
      const selector = isSelected ? icons.arrow : ' ';

      return h(Box, { key: proj.id || `r-${i}`, flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
        h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
        h(Text, null, ' '),
        T(statusColor(status), statusIcon(status)),
        h(Text, null, ' '),
        h(Text, { color: isSelected ? 'cyan' : 'white' },
          truncate(name, 30).padEnd(30)),
        h(Text, null, ' '),
        muted(id.padEnd(8)),
        h(Text, null, '  '),
        muted(proj.rootPath || ''),
      );
    }),
    projectList.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no repos)'))
      : null,
    projectList.length > maxItems
      ? h(Box, { paddingLeft: 2 }, muted(`+${projectList.length - maxItems} more`))
      : null,
  );
};

export { ReposWidget };
