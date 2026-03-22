/**
 * RepoDetailWidget — Repo info summary.
 *
 * Compact inline version of RepoDetail.
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

interface RepoDetailWidgetProps {
  apiClient: any;
  focused: boolean;
  repoId: string;
  onSessionSelect?: (id: string) => void;
}

const RepoDetailWidget = ({ apiClient, focused, repoId, onSessionSelect }: RepoDetailWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: project } = useApiData(
    useCallback((): Promise<any> => apiClient.getProject(repoId).catch((): null => null), [apiClient, repoId]),
    focused ? 10000 : 0
  );
  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions().catch((): any[] => []), [apiClient]),
    focused ? 5000 : 0
  );

  const sessionList: any[] = (sessions as any[]) || [];
  const repoSessions = sessionList.filter(s => s.repositoryPath && project?.rootPath && s.repositoryPath === project.rootPath);

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(repoSessions.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.return && repoSessions[selectedIndex] && onSessionSelect) {
      onSessionSelect(repoSessions[selectedIndex].id);
    }
  }, { isActive: focused });

  if (!project) {
    return h(Box, { paddingLeft: 1 }, muted(`Loading repo ${repoId.substring(0, 8)}...`));
  }

  const name = (project.name || project.rootPath || 'Unknown').padEnd(30);
  const status = (project.containerStatus || 'idle').padEnd(12);

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row', gap: 2 },
      T(statusColor(status), statusIcon(status)),
      primary(name),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Path: '),
      h(Text, { color: 'gray' }, project.rootPath || '-'),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted(`Sessions: ${repoSessions.length}`),
    ),
    ...repoSessions.slice(0, 8).map((s: any, i: number) => {
      const sName = s.name || 'Unnamed';
      const sStatus = (s.status || 'unknown').toLowerCase();
      const isSelected = focused && i === selectedIndex;
      const selector = isSelected ? icons.arrow : ' ';

      return h(Box, { key: s.id || `s-${i}`, flexDirection: 'row', paddingLeft: 1 },
        h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
        h(Text, null, ' '),
        T(statusColor(sStatus), statusIcon(sStatus)),
        h(Text, null, ' '),
        h(Text, { color: isSelected ? 'cyan' : 'white' },
          (sName.length > 28 ? sName.substring(0, 28) : sName).padEnd(28)),
        h(Text, null, ' '),
        muted(sStatus.padEnd(12)),
      );
    }),
    repoSessions.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no sessions for this repo)'))
      : null,
  );
};

export { RepoDetailWidget };
