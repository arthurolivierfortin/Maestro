/**
 * SpacesScreen — Repos / Workspaces / Sessions browser.
 *
 * Flat session list: only top-level sessions (no parentSessionId) appear
 * in the navigable list. Parents show a [+N] badge. Children and fitness
 * appear only in the expanded detail view.
 *
 * Props:
 *   apiClient        API client instance
 *   onNavigate       (page: string) => void
 *   onSessionSelect  (sessionId: string) => void
 *   onQuit           () => void
 */

import { createElement as h, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  statusColor, statusIcon,
  formatDuration, truncate,
  progressBar, progressColor,
  prevPage, nextPage,
} from '../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';

// ── Tab Header ───────────────────────────────────────────────

interface TabHeaderProps {
  activeTab: string;
}

const TabHeader = ({ activeTab }: TabHeaderProps) => {
  const tabs = [
    { key: 'repos', num: 1, label: 'Repos' },
    { key: 'workspaces', num: 2, label: 'Workspaces' },
    { key: 'sessions', num: 3, label: 'Sessions' },
  ];

  const elements = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const isActive = activeTab === tab.key;
    elements.push(
      h(Text, { key: tab.key },
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: isActive ? theme.panel.borderFocused : theme.shortcut.key, bold: isActive }, String(tab.num)),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
        isActive
          ? h(Text, { color: theme.panel.borderFocused, bold: true }, tab.label)
          : h(Text, { color: theme.text.muted }, tab.label),
      )
    );
    if (i < tabs.length - 1) {
      elements.push(h(Text, { key: `sp-${i}` }, '  '));
    }
  }

  return h(Box, { flexDirection: 'row', paddingLeft: 1 }, ...elements);
};

// ── Status Filter ────────────────────────────────────────────

interface StatusFilterProps {
  activeFilter: string;
}

const StatusFilter = ({ activeFilter }: StatusFilterProps) => {
  const isRunning = activeFilter === 'running';

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    muted('Filter: '),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'r'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      isRunning
        ? h(Text, { color: theme.panel.borderFocused, bold: true }, 'Running')
        : h(Text, { color: theme.text.muted }, 'All'),
    ),
  );
};

// ── Session row ─────────────────────────────────────────────

interface SessionRowProps {
  session: Record<string, any>;
  isSelected: boolean;
  isExpanded: boolean;
  /** Full session list (all sessions, unfiltered by parent) for child counting */
  allSessions: Record<string, any>[];
}

const STATUS_COL_WIDTH = 10;

const SessionRow = ({ session, isSelected, isExpanded, allSessions }: SessionRowProps) => {
  const rawStatus = (session.status || 'unknown').toLowerCase();
  const vars = session.variables || {};
  const costLimitExceeded = vars._costLimitExceeded === true || vars._costLimitExceeded === 'true';

  const status = costLimitExceeded ? 'paused' : rawStatus;
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);
  const name = session.name || 'Unnamed';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';
  const duration = formatDuration(session.startedAt, session.completedAt);
  const rawCost = vars._accumulatedCost;
  const costNum = typeof rawCost === 'number' ? rawCost : (typeof rawCost === 'string' ? parseFloat(rawCost) : 0);
  const costStr = (isNaN(costNum) ? 0 : costNum).toFixed(2);
  const statusText = status.padEnd(STATUS_COL_WIDTH);

  // Count children from full session list
  const children = allSessions.filter(s => s.parentSessionId === session.id);
  const childCount = children.length;

  // Selector and expand icon
  const selector = isSelected ? icons.arrow : ' ';
  const expandIcon = isExpanded ? icons.expanded : (isSelected ? icons.collapsed : ' ');

  // Display name + badge in fixed width (36 chars total)
  const NAME_COL = 36;
  const badge = childCount > 0 ? ` [+${childCount}]` : '';
  const maxNameLen = NAME_COL - badge.length;
  const truncName = name.length > maxNameLen ? name.substring(0, maxNameLen) : name;
  const nameWithBadge = (truncName + badge).padEnd(NAME_COL);

  // ── Row: [selector] [expandIcon] [statusIcon] [nameWithBadge] [shortId] [status] [$cost] [duration]
  const mainRow = h(Box, { flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    h(Text, { color: 'gray' }, expandIcon),
    h(Text, null, ' '),
    T(sColor, sIcon),
    h(Text, null, ' '),
    h(Text, null,
      h(Text, { color: isSelected ? 'cyan' : 'white' }, truncName),
      badge ? h(Text, { color: 'gray' }, badge) : null,
      h(Text, null, ''.padEnd(NAME_COL - truncName.length - badge.length)),
    ),
    h(Text, null, ' '),
    muted(shortId),
    h(Text, null, '  '),
    T(sColor, statusText),
    h(Text, null, '  '),
    muted('$'),
    h(Text, { color: costNum > 0 ? 'yellow' : 'gray' }, costStr),
    h(Text, null, '  '),
    muted(duration),
  );

  if (!isExpanded) return mainRow;

  // ── Detail view (expanded) ───────────────────────────────

  // Fitness (only in detail view)
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
  const hasFitness = fitness !== undefined && fitness !== null;
  const fitnessNum = hasFitness ? fitness * 100 : null;
  const fitnessStr = hasFitness ? `${Math.round(fitness * 100)}%` : '';

  // Build child detail lines
  const childLines = children.map((child: Record<string, any>) => {
    const cStatus = (child.status || 'unknown').toLowerCase();
    const cVars = child.variables || {};
    const cCostLimitExceeded = cVars._costLimitExceeded === true || cVars._costLimitExceeded === 'true';
    const cEffectiveStatus = cCostLimitExceeded ? 'paused' : cStatus;
    const cName = child.name || 'Unnamed';
    // Short name: show only part after last ' / '
    const cShortName = cName.includes(' / ')
      ? cName.split(' / ').pop() || cName
      : cName;
    const cShortId = child.id ? child.id.substring(0, 8) : '--------';
    const cRawCost = cVars._accumulatedCost;
    const cCostNum = typeof cRawCost === 'number' ? cRawCost : (typeof cRawCost === 'string' ? parseFloat(cRawCost) : 0);
    const cCostStr = (isNaN(cCostNum) ? 0 : cCostNum).toFixed(2);
    const cDuration = formatDuration(child.startedAt, child.completedAt);

    return h(Box, { key: child.id, flexDirection: 'row' },
      h(Text, null, '  '),
      T(statusColor(cEffectiveStatus), statusIcon(cEffectiveStatus)),
      h(Text, null, ' '),
      h(Text, { color: 'gray' }, truncate(cShortName, 20).padEnd(20)),
      h(Text, null, '  '),
      muted(cShortId),
      h(Text, null, '  '),
      T(statusColor(cEffectiveStatus), cEffectiveStatus.padEnd(8)),
      h(Text, null, '  '),
      muted('$'),
      h(Text, { color: cCostNum > 0 ? 'yellow' : 'gray' }, cCostStr),
      h(Text, null, '  '),
      muted(cDuration),
    );
  });

  return h(Box, { flexDirection: 'column' },
    mainRow,
    h(Box, { flexDirection: 'column', paddingLeft: 6 },
      // Full ID
      h(Box, { key: 'detail-id', flexDirection: 'row' },
        muted('id: '), primary(session.id || '-'),
      ),
      // Children header + lines
      ...(childCount > 0 ? [
        h(Box, { key: 'ch-label', flexDirection: 'row' }, muted('children:')),
        ...childLines,
      ] : []),
      // Fitness bar (only in detail view)
      fitnessNum !== null
        ? h(Box, { key: 'detail-fitness', flexDirection: 'row' },
            muted('fitness: '),
            T(progressColor(fitnessNum), progressBar(fitnessNum, 12)),
            h(Text, null, ' '),
            T(progressColor(fitnessNum), fitnessStr),
          )
        : null,
      // Phases summary
      vars._phases && Array.isArray(vars._phases)
        ? h(Box, { key: 'detail-phases', flexDirection: 'row' },
            muted('phases: '),
            ...vars._phases.map((p: any, pi: number) => {
              const ps = (p.status || 'pending').toLowerCase();
              return h(Text, { key: `ph-${pi}` },
                T(statusColor(ps), statusIcon(ps)),
                h(Text, { color: 'gray' }, pi < vars._phases.length - 1 ? ' ' : ''),
              );
            }),
          )
        : null,
      // Active workflow
      vars._activeWorkflow
        ? h(Box, { key: 'detail-wf', flexDirection: 'row' },
            muted('workflow: '),
            primary(truncate(vars._activeWorkflow, 50)),
          )
        : null,
      // Entry points
      session.entryPoints && Object.keys(session.entryPoints).length > 0
        ? h(Box, { key: 'detail-entry', flexDirection: 'row' },
            muted('entry: '),
            muted(Object.keys(session.entryPoints).join(', ')),
          )
        : null,
    ),
  );
};

interface RepoRowProps {
  project: Record<string, any>;
  isSelected: boolean;
}

const RepoRow = ({ project, isSelected }: RepoRowProps) => {
  const name = project.name || project.rootPath || 'Unknown';
  const id = project.id ? project.id.substring(0, 8) : '--------';
  const status = project.containerStatus || 'idle';
  const sColor = statusColor(status);
  const selector = isSelected ? icons.arrow : ' ';

  return h(Box, { flexDirection: 'row', paddingLeft: 2, overflow: 'hidden' },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    T(sColor, statusIcon(status)),
    h(Text, null, ' '),
    h(Text, { color: isSelected ? 'cyan' : 'white' },
      name.length > 30 ? name.substring(0, 30) : name.padEnd(30)),
    h(Text, null, ' '),
    muted(id),
    h(Text, null, '  '),
    muted(project.rootPath || ''),
  );
};

interface WorkspaceRowProps {
  workspace: Record<string, any>;
  isSelected: boolean;
}

const WorkspaceRow = ({ workspace, isSelected }: WorkspaceRowProps) => {
  const name = workspace.name || workspace.id || 'Unknown';
  const id = workspace.id ? workspace.id.substring(0, 8) : '--------';
  const type = workspace.type || '';
  const selector = isSelected ? icons.arrow : ' ';

  return h(Box, { flexDirection: 'row', paddingLeft: 2, overflow: 'hidden' },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    h(Text, { color: theme.status.running }, icons.running),
    h(Text, null, ' '),
    h(Text, { color: isSelected ? 'cyan' : 'white' },
      name.length > 30 ? name.substring(0, 30) : name.padEnd(30)),
    h(Text, null, ' '),
    muted(id),
    type ? h(Text, null, '  ', muted(type)) : null,
  );
};

// ── Delete confirmation overlay ──────────────────────────────

interface DeleteConfirmationProps {
  sessionName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmation = ({ sessionName, onConfirm, onCancel }: DeleteConfirmationProps) => {
  useKeyboard({
    enter: onConfirm,
    escape: onCancel,
    n: onCancel,
  }, { isActive: true });

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'single',
    borderColor: theme.status.error,
    paddingX: 2,
    paddingY: 1,
    marginLeft: 2,
    marginTop: 1,
    width: 50,
  },
    h(Text, { bold: true, color: theme.status.error }, 'Delete Session?'),
    h(Text, null, ''),
    h(Text, { color: 'white' }, truncate(sessionName, 44)),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row', gap: 2 },
      h(Text, null,
        h(Text, { color: theme.shortcut.bracket }, '['),
        h(Text, { color: theme.shortcut.key }, 'Enter'),
        h(Text, { color: theme.shortcut.bracket }, '] '),
        h(Text, { color: theme.status.error }, 'Delete'),
      ),
      h(Text, null,
        h(Text, { color: theme.shortcut.bracket }, '['),
        h(Text, { color: theme.shortcut.key }, 'Esc/n'),
        h(Text, { color: theme.shortcut.bracket }, '] '),
        h(Text, { color: theme.text.muted }, 'Cancel'),
      ),
    ),
  );
};

// ── SpacesScreen component ───────────────────────────────────

interface SpacesScreenProps {
  apiClient: any;
  onNavigate: (page: string) => void;
  onSessionSelect: (id: string, state?: Record<string, any>) => void;
  onWorkspaceSelect?: (id: string, state?: Record<string, any>) => void;
  onRepoSelect?: (id: string, state?: Record<string, any>) => void;
  onQuit: () => void;
  initialState?: Record<string, any>;
  chrome?: boolean;
  keyboardActive?: boolean;
}

const SpacesScreen = ({ apiClient, onNavigate, onSessionSelect, onWorkspaceSelect, onRepoSelect, onQuit, initialState, chrome, keyboardActive }: SpacesScreenProps) => {
  const showChrome = chrome !== false;
  const { stdout } = useStdout();
  const [activeTab, setActiveTab] = useState(initialState?.activeTab ?? 'sessions');
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const [statusFilter, setStatusFilter] = useState(initialState?.statusFilter ?? 'all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Terminal rows for scroll calculation
  const termRows = stdout.rows || 40;
  const visibleItems = Math.max(3, termRows - 15);

  // Fetch sessions
  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions().catch((): any[] => []), [apiClient]),
    3000
  );

  // Fetch projects (repos)
  const { data: projects } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listProjects().catch((): any[] => []), [apiClient]),
    10000
  );

  // Fetch workspaces
  const { data: workspaces } = useApiData(
    useCallback((): Promise<any[]> => apiClient.get('/api/workspaces').catch((): any[] => []), [apiClient]),
    10000
  );

  const sessionList: any[] = (sessions as any[]) || [];
  const projectList: any[] = (projects as any[]) || [];
  const workspaceList: any[] = (workspaces as any[]) || [];
  const runningCount = sessionList.filter((s: any) => s.status === 'running').length;

  // Apply status filter
  const filteredSessions = statusFilter === 'all'
    ? sessionList
    : sessionList.filter(s => (s.status || '').toLowerCase() === statusFilter);

  // Flat list: only top-level sessions (no parentSessionId)
  const topLevelSessions = useMemo(
    () => filteredSessions.filter(s => !s.parentSessionId),
    [filteredSessions]
  );

  // Current items based on active tab
  const currentItems =
    activeTab === 'sessions' ? topLevelSessions
    : activeTab === 'repos' ? projectList
    : workspaceList;

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= currentItems.length && currentItems.length > 0) {
      setSelectedIndex(Math.max(0, currentItems.length - 1));
    }
  }, [currentItems.length]);

  // Reset index on tab/filter change (skip initial mount to preserve restored state)
  const prevTabFilter = useRef(`${activeTab}:${statusFilter}`);
  useEffect(() => {
    const key = `${activeTab}:${statusFilter}`;
    if (prevTabFilter.current !== key) {
      setSelectedIndex(0);
      prevTabFilter.current = key;
    }
  }, [activeTab, statusFilter]);

  // Scroll window
  const scrollStart = Math.max(0,
    Math.min(selectedIndex - Math.floor(visibleItems / 2), currentItems.length - visibleItems)
  );

  const visibleSlice = currentItems.slice(scrollStart, scrollStart + visibleItems);
  const canScrollUp = scrollStart > 0;
  const canScrollDown = scrollStart + visibleItems < currentItems.length;

  // Keyboard
  useKeyboard({
    up: () => setSelectedIndex((i: number) => Math.max(0, i - 1)),
    down: () => setSelectedIndex((i: number) => Math.min(currentItems.length - 1, i + 1)),
    k: () => setSelectedIndex((i: number) => Math.max(0, i - 1)),
    j: () => setSelectedIndex((i: number) => Math.min(currentItems.length - 1, i + 1)),
    // Chrome-only keys: page navigation (disabled when embedded in maestro-code)
    ...(showChrome ? {
      ctrlLeft: () => onNavigate(prevPage('spaces')),
      ctrlRight: () => onNavigate(nextPage('spaces')),
    } : {}),
    enter: () => {
      const state = { selectedIndex, activeTab, statusFilter };
      if (activeTab === 'sessions' && topLevelSessions.length > 0) {
        const session = topLevelSessions[selectedIndex];
        if (session) {
          onSessionSelect(session.id, state);
        }
      } else if (activeTab === 'workspaces' && workspaceList.length > 0 && onWorkspaceSelect) {
        const ws = workspaceList[selectedIndex];
        if (ws) onWorkspaceSelect(ws.id, state);
      } else if (activeTab === 'repos' && projectList.length > 0 && onRepoSelect) {
        const proj = projectList[selectedIndex];
        if (proj) onRepoSelect(proj.id, state);
      }
    },
    number: (num) => {
      if (num === 1) setActiveTab('repos');
      else if (num === 2) setActiveTab('workspaces');
      else if (num === 3) setActiveTab('sessions');
    },
    r: () => setStatusFilter((f: string) => f === 'running' ? 'all' : 'running'),
    d: () => {
      if (activeTab === 'sessions' && topLevelSessions.length > 0) {
        const session = topLevelSessions[selectedIndex];
        if (session) setDeleteConfirm({ id: session.id, name: session.name || 'Unnamed' });
      }
    },
    ...(showChrome ? {
      h: () => onNavigate('home'),
      a: () => onNavigate('agent'),
      s: () => {},
      f: () => onNavigate('foundry'),
      c: () => onNavigate('catalog'),
      m: () => onNavigate('models'),
    } : {}),
    escape: showChrome ? () => onNavigate('home') : undefined,
    q: onQuit,
  }, { isActive: keyboardActive !== false && !deleteConfirm });

  // Delete session handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient._fetch('DELETE', `/api/sessions/${deleteConfirm.id}`);
    } catch {
      // Non-fatal — session may already be gone
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, apiClient]);

  // Build rows for current tab
  const rows = visibleSlice.map((item: any, vi: number) => {
    const realIndex = scrollStart + vi;
    const isSelected = realIndex === selectedIndex;
    if (activeTab === 'sessions') {
      return h(SessionRow, {
        key: item.id || `s-${realIndex}`,
        session: item,
        isSelected,
        isExpanded: isSelected,
        allSessions: sessionList,
      });
    } else if (activeTab === 'repos') {
      return h(RepoRow, { key: item.id || `r-${realIndex}`, project: item, isSelected });
    } else {
      return h(WorkspaceRow, { key: item.id || `w-${realIndex}`, workspace: item, isSelected });
    }
  });

  const tabTitle = activeTab === 'repos' ? 'REPOS'
    : activeTab === 'workspaces' ? 'WORKSPACES'
    : 'SESSIONS';

  // Session count: show top-level count for sessions tab
  const sessionCount = activeTab === 'sessions' ? topLevelSessions.length : currentItems.length;

  // Header inside content panel (with spacing from panel title)
  const headerLines: any[] = [
    h(Box, { key: 'spacer', height: 1 }),  // breathing room after panel title
  ];
  if (activeTab === 'sessions') {
    headerLines.push(h(StatusFilter, { key: 'filter', activeFilter: statusFilter }));
  }
  headerLines.push(
    h(Box, { key: 'count', paddingLeft: 2 },
      muted(`${sessionCount} ${activeTab === 'repos' ? 'repo(s)' : activeTab === 'workspaces' ? 'workspace(s)' : 'session(s)'}`),
      canScrollUp || canScrollDown
        ? h(Text, null,
            muted('  '),
            muted(`${selectedIndex + 1}/${currentItems.length}`),
            h(Text, null, ' '),
            canScrollUp ? h(Text, { color: theme.panel.scrollIndicator }, icons.scrollUp) : null,
            canScrollDown ? h(Text, { color: theme.panel.scrollIndicator }, icons.scrollDown) : null,
          )
        : null,
    )
  );

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    showChrome ? h(NavBar, { currentPage: 'spaces', sessionCount: sessionList.length, runningCount }) : null,

    // Tab selector header (lightweight Box, not Panel)
    h(Box, {
      borderStyle: theme.panel.borderStyle,
      borderColor: theme.panel.border,
      paddingLeft: 1,
      paddingRight: 1,
      width: '100%',
    },
      h(TabHeader, { activeTab }),
    ),

    // Content panel
    h(Panel, { title: tabTitle, flexGrow: 1, width: '100%' },
      h(Box, { flexDirection: 'column' },
        ...headerLines,
        currentItems.length === 0
          ? h(Box, { paddingLeft: 2, paddingTop: 1, flexDirection: 'column' },
              muted(activeTab === 'sessions' ? '(no sessions)' : activeTab === 'repos' ? '(no repos connected)' : '(no workspaces)'),
            )
          : h(Box, { flexDirection: 'column' }, ...rows),
      ),
    ),

    // Delete confirmation overlay
    deleteConfirm
      ? h(DeleteConfirmation, {
          sessionName: deleteConfirm.name,
          onConfirm: handleDeleteConfirm,
          onCancel: () => setDeleteConfirm(null),
        })
      : null,

  );
};

export { SpacesScreen };
