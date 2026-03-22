/**
 * SessionsWidget — Session list with expandable detail.
 *
 * Extracted from SpacesScreen (sessions tab). Compact inline version.
 * Interactive: j/k navigate, Space expand/collapse, Enter opens session,
 * r toggle filter, d deletes with confirmation.
 */

import { createElement as h, useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  statusColor, statusIcon,
  formatDuration, truncate,
  progressBar, progressColor,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface SessionsWidgetProps {
  apiClient: any;
  focused: boolean;
  onSessionSelect?: (id: string) => void;
  maxItems?: number;
}

const SessionsWidget = ({ apiClient, focused, onSessionSelect, maxItems = 10 }: SessionsWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions({ limit: 50 }).catch((err: any): any[] => {
      console.error?.('[SessionsWidget] listSessions error:', err?.message || err);
      return [];
    }), [apiClient]),
    focused ? 5000 : 0
  );

  const sessionList: any[] = (sessions as any[]) || [];
  const filtered = statusFilter === 'all'
    ? sessionList
    : sessionList.filter(s => (s.status || '').toLowerCase() === statusFilter);
  const topLevel = useMemo(
    () => filtered.filter(s => !s.parentSessionId),
    [filtered]
  );

  const safeIndex = Math.min(selectedIndex, Math.max(0, topLevel.length - 1));

  // Delete session handler
  const handleDelete = useCallback(async (sessionId: string) => {
    try {
      await apiClient._fetch('DELETE', `/api/sessions/${sessionId}`);
    } catch {
      // Non-fatal — session may already be gone
    }
    setDeleteConfirm(null);
  }, [apiClient]);

  useManagedInput('widget', (input, key) => {
    // When delete confirmation is active, only y/n/Esc are accepted
    if (deleteConfirm) {
      if (input === 'y' || key.return) {
        handleDelete(deleteConfirm.id);
      }
      if (input === 'n' || key.escape) {
        setDeleteConfirm(null);
      }
      return;
    }

    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(topLevel.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (input === 'r') setStatusFilter(f => f === 'running' ? 'all' : 'running');
    if (input === ' ') {
      const session = topLevel[safeIndex];
      if (session) {
        setExpandedId(prev => prev === session.id ? null : session.id);
      }
    }
    if (input === 'd') {
      const session = topLevel[safeIndex];
      if (session) {
        setDeleteConfirm({ id: session.id, name: session.name || 'Unnamed' });
      }
    }
    if (key.return && topLevel[safeIndex] && onSessionSelect) {
      onSessionSelect(topLevel[safeIndex].id);
    }
  }, { isActive: focused });

  // Scroll support: center around selected index
  const scrollStart = Math.max(0,
    Math.min(safeIndex - Math.floor(maxItems / 2), topLevel.length - maxItems)
  );
  const visible = topLevel.slice(scrollStart, scrollStart + maxItems);

  // Build rows with expand detail
  const rows: any[] = [];
  for (let vi = 0; vi < visible.length; vi++) {
    const session = visible[vi];
    const realIndex = scrollStart + vi;
    const status = (session.status || 'unknown').toLowerCase();
    const name = session.name || 'Unnamed';
    const shortId = session.id ? session.id.substring(0, 8) : '--------';
    const vars = session.variables || {};
    const rawCost = vars._accumulatedCost;
    const costNum = typeof rawCost === 'number' ? rawCost : (typeof rawCost === 'string' ? parseFloat(rawCost) : 0);
    const costStr = (isNaN(costNum) ? 0 : costNum).toFixed(2);
    const duration = formatDuration(session.startedAt, session.completedAt);
    const children = sessionList.filter(s => s.parentSessionId === session.id);
    const badge = children.length > 0 ? ` [+${children.length}]` : '';
    const isSelected = focused && realIndex === safeIndex;
    const isExpanded = expandedId === session.id;
    const selector = isSelected ? icons.arrow : ' ';

    // Main row
    rows.push(
      h(Box, { key: session.id || `s-${realIndex}`, flexDirection: 'column' },
        h(Box, { flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
          h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
          h(Text, null, ' '),
          T(statusColor(status), statusIcon(status)),
          h(Text, null, ' '),
          h(Text, { color: isSelected ? 'cyan' : 'white' },
            truncate(name, 28).padEnd(28)),
          badge ? h(Text, { color: 'gray' }, badge.padEnd(6)) : h(Text, null, '      '),
          h(Text, null, ' '),
          muted(shortId.padEnd(8)),
          h(Text, null, '  '),
          T(statusColor(status), status.padEnd(10)),
          h(Text, null, ' $'),
          h(Text, { color: costNum > 0 ? 'yellow' : 'gray' }, costStr.padEnd(8)),
          h(Text, null, '  '),
          muted(duration.padEnd(10)),
        ),
        // Expanded detail
        isExpanded
          ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
              // Full ID
              h(Box, { key: 'detail-id', flexDirection: 'row' },
                muted('id: '), primary(session.id || '-'),
              ),
              // Children list
              ...(children.length > 0 ? [
                h(Box, { key: 'ch-label', flexDirection: 'row' }, muted('children:')),
                ...children.map((child: any) => {
                  const cStatus = (child.status || 'unknown').toLowerCase();
                  const cName = child.name || 'Unnamed';
                  const cShortName = cName.includes(' / ')
                    ? cName.split(' / ').pop() || cName
                    : cName;
                  const cVars = child.variables || {};
                  const cRawCost = cVars._accumulatedCost;
                  const cCostNum = typeof cRawCost === 'number' ? cRawCost : (typeof cRawCost === 'string' ? parseFloat(cRawCost) : 0);
                  const cCostStr = (isNaN(cCostNum) ? 0 : cCostNum).toFixed(2);

                  return h(Box, { key: child.id, flexDirection: 'row' },
                    h(Text, null, '  '),
                    T(statusColor(cStatus), statusIcon(cStatus)),
                    h(Text, null, ' '),
                    h(Text, { color: 'gray' }, truncate(cShortName, 20).padEnd(20)),
                    h(Text, null, '  '),
                    T(statusColor(cStatus), cStatus.padEnd(8)),
                    h(Text, null, '  '),
                    muted('$'),
                    h(Text, { color: cCostNum > 0 ? 'yellow' : 'gray' }, cCostStr),
                  );
                }),
              ] : []),
              // Fitness bar
              ...(() => {
                const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
                const hasFitness = fitness !== undefined && fitness !== null;
                if (!hasFitness) return [];
                const fitnessNum = fitness * 100;
                const fitnessStr = `${Math.round(fitnessNum)}%`;
                return [
                  h(Box, { key: 'detail-fitness', flexDirection: 'row' },
                    muted('fitness: '),
                    T(progressColor(fitnessNum), progressBar(fitnessNum, 12)),
                    h(Text, null, ' '),
                    T(progressColor(fitnessNum), fitnessStr),
                  ),
                ];
              })(),
              // Active workflow
              vars._activeWorkflow
                ? h(Box, { key: 'detail-wf', flexDirection: 'row' },
                    muted('workflow: '),
                    primary(truncate(vars._activeWorkflow, 50)),
                  )
                : null,
            )
          : null,
      ),
    );
  }

  return h(Box, { flexDirection: 'column' },
    // Filter + count
    h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 2 },
      muted(`${topLevel.length} session(s)`),
      h(Text, null,
        muted('Filter: '),
        statusFilter === 'running'
          ? h(Text, { color: theme.panel.borderFocused, bold: true }, 'Running')
          : muted('All'),
        muted(' [r]'),
      ),
      topLevel.length > maxItems
        ? muted(`  ${safeIndex + 1}/${topLevel.length}`)
        : null,
    ),
    h(Text, null, ''),
    // Session rows
    ...rows,
    topLevel.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no sessions)'))
      : null,
    topLevel.length > maxItems
      ? h(Box, { paddingLeft: 2 }, muted(`+${topLevel.length - maxItems} more`))
      : null,
    // Delete confirmation inline
    deleteConfirm
      ? h(Box, { flexDirection: 'row', paddingLeft: 2, marginTop: 1 },
          h(Text, { color: theme.status.error, bold: true },
            `Delete "${truncate(deleteConfirm.name, 30)}"? `),
          h(Text, null,
            h(Text, { color: theme.shortcut.bracket }, '['),
            h(Text, { color: theme.shortcut.key }, 'y'),
            h(Text, { color: theme.shortcut.bracket }, '] '),
            h(Text, { color: theme.status.error }, 'Yes'),
          ),
          h(Text, null, '  '),
          h(Text, null,
            h(Text, { color: theme.shortcut.bracket }, '['),
            h(Text, { color: theme.shortcut.key }, 'n'),
            h(Text, { color: theme.shortcut.bracket }, '] '),
            muted('No'),
          ),
        )
      : null,
    // Shortcut hints
    h(Box, { paddingLeft: 1, marginTop: 1, flexDirection: 'row' },
      muted('[j/k] Nav  '),
      muted('[Space] Expand  '),
      muted('[Enter] Open  '),
      muted('[r] Filter  '),
      muted('[d] Delete  '),
    ),
  );
};

export { SessionsWidget };
