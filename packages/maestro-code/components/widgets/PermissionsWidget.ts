/**
 * PermissionsWidget -- Inline widget showing permissions diff for a session.
 *
 * Phase 63-D: Fetches permissions from API and renders PermissionsPanel.
 * Non-interactive (read-only).
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import { muted } from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { PermissionsPanel } from '../PermissionsPanel.ts';

interface PermissionsWidgetProps {
  apiClient: any;
  focused: boolean;
  sessionId?: string;
}

const PermissionsWidget = ({ apiClient, focused, sessionId }: PermissionsWidgetProps) => {
  const { data: perms } = useApiData(
    useCallback(
      (): Promise<any> =>
        sessionId
          ? apiClient.get(`/api/sessions/${sessionId}/permissions/effective`).catch((): null => null)
          : Promise.resolve(null),
      [apiClient, sessionId],
    ),
    focused ? 10000 : 0,
  );

  if (!sessionId) {
    return h(Box, { paddingLeft: 1 }, muted('No session ID provided.'));
  }

  if (!perms) {
    return h(Box, { paddingLeft: 1 }, muted(`Loading permissions for ${sessionId.substring(0, 8)}...`));
  }

  const effectiveBlocks: string[] = perms.effective?.allowedBlocks || [];
  const parentBlocks: string[] = perms.parentEffective?.allowedBlocks || [];
  const blockRules = (perms.blockRules || []).map((r: any) => ({
    pattern: r.pattern,
    permission: r.permission,
    reason: r.reason,
  }));

  const hasParent = !!perms.parentId;
  const title = hasParent ? 'PERMISSIONS' : 'PERMISSIONS (ceiling)';
  const parentName = hasParent
    ? (perms.parentName || `Session ${perms.parentId?.substring(0, 8)}`)
    : undefined;

  return h(Box, { flexDirection: 'column' },
    h(PermissionsPanel, {
      effectiveBlocks,
      parentBlocks,
      blockRules,
      title,
      parentName,
    }),
    h(Text, null, ''),
    h(Text, { color: 'gray', dimColor: true },
      `Pour modifier: maestro session restrict ${sessionId.substring(0, 8)} --allow ...`,
    ),
  );
};

export { PermissionsWidget };
