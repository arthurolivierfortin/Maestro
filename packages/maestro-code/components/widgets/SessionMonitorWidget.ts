/**
 * SessionMonitorWidget -- Compact session resume with permissions panel.
 *
 * Shows a useful session summary:
 * - Line 1: Session name + status icon + duration + cost
 * - Line 2: Active workflow or "idle"
 * - Line 3: Current iteration/phase (if running)
 * - Lines 4-6: Last 3 execution log entries (or "No activity")
 * - PermissionsPanel (keep)
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  statusColor, statusIcon,
  formatDuration,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { PermissionsPanel } from '../PermissionsPanel.ts';

interface SessionMonitorWidgetProps {
  apiClient: any;
  focused: boolean;
  sessionId: string;
}

const SessionMonitorWidget = ({ apiClient, focused, sessionId }: SessionMonitorWidgetProps) => {
  const shortId = sessionId ? sessionId.substring(0, 8) : '--------';

  // Fetch full session data
  const { data: session } = useApiData(
    useCallback(
      (): Promise<any> =>
        sessionId
          ? apiClient.getSession(sessionId).catch((): null => null)
          : Promise.resolve(null),
      [apiClient, sessionId],
    ),
    focused ? 5000 : 0,
  );

  // Fetch permissions
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

  // Extract session info
  const name = (session?.name || `Session ${shortId}`).padEnd(30);
  const status = (session?.status || 'unknown').toLowerCase();
  const sIcon = statusIcon(status);
  const sColor = statusColor(status);
  const duration = formatDuration(session?.startedAt, session?.completedAt);
  const variables = session?.variables || {};
  const cost = variables._accumulatedCost != null
    ? `$${Number(variables._accumulatedCost).toFixed(2)}`
    : '-';
  const activeWorkflow = variables._activeWorkflow || null;
  const executionLog: any[] = Array.isArray(variables._executionLog)
    ? variables._executionLog
    : [];
  const lastEntries = executionLog.slice(-3);

  // Permissions
  const effectiveBlocks: string[] = perms?.effective?.allowedBlocks || [];
  const parentBlocks: string[] = perms?.parentEffective?.allowedBlocks || [];
  const blockRules = (perms?.blockRules || []).map((r: any) => ({
    pattern: r.pattern,
    permission: r.permission,
    reason: r.reason,
  }));
  const hasParent = !!perms?.parentId;
  const parentName = hasParent
    ? (perms.parentName || `Session ${perms.parentId?.substring(0, 8)}`)
    : undefined;

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    // Line 1: Session name + status + duration + cost
    h(Box, { flexDirection: 'row' },
      T(sColor, sIcon),
      h(Text, null, ' '),
      primary(name),
      h(Text, null, '  '),
      muted('status:'.padEnd(8)),
      T(sColor, status.padEnd(12)),
      muted('duration:'.padEnd(10)),
      primary(duration.padEnd(10)),
      muted('cost: '),
      primary(cost.padEnd(8)),
    ),

    // Line 2: Active workflow or "idle"
    h(Box, { flexDirection: 'row' },
      muted('Workflow: '),
      activeWorkflow
        ? h(Text, { color: 'cyan' }, String(activeWorkflow).padEnd(30))
        : muted('idle'.padEnd(30)),
    ),

    // Line 3: Current phase (from execution tree status)
    session && variables._executionTree
      ? (() => {
          const tree: any[] = Array.isArray(variables._executionTree) ? variables._executionTree : [];
          const running = tree.find((n: any) => n.status === 'running');
          return running
            ? h(Box, { flexDirection: 'row' },
                muted('Current:  '),
                h(Text, { color: 'yellow' }, `${icons.running} ${String(running.name || running.id).padEnd(30)}`),
              )
            : h(Box, { flexDirection: 'row' },
                muted('Current:  '),
                muted('(none)'.padEnd(30)),
              );
        })()
      : null,

    h(Text, null, ''),

    // Lines 4-6: Last 3 execution log entries
    h(Text, { color: 'cyan', bold: true }, 'RECENT ACTIVITY'),
    lastEntries.length > 0
      ? h(Box, { flexDirection: 'column' },
          ...lastEntries.map((entry: any, i: number) =>
            h(Box, { key: `log-${i}`, flexDirection: 'row', paddingLeft: 1 },
              muted(`[${String(entry.source || '?').padEnd(6)}] `),
              h(Text, { color: 'white' },
                String(entry.message || '').slice(0, 60).padEnd(60),
              ),
            ),
          ),
        )
      : h(Box, { paddingLeft: 1 }, muted('No activity')),

    h(Text, null, ''),

    // Permissions panel (if data available)
    perms
      ? h(PermissionsPanel, {
          effectiveBlocks,
          parentBlocks,
          blockRules,
          title: hasParent ? 'PERMISSIONS' : 'PERMISSIONS (ceiling)',
          parentName,
        })
      : h(Text, { color: 'gray', dimColor: true }, 'Loading permissions...'),

    h(Text, null, ''),
    h(Text, { color: 'gray', dimColor: true },
      `Full monitor: /session ${shortId} --full`,
    ),
  );
};

export { SessionMonitorWidget };
