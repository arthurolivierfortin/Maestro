/**
 * SpacesScreen — Repos / Workspaces / Sessions browser.
 *
 * Replaces GlobalMonitor as the main session/workspace/project browser.
 * Has 3 tabs switchable via number keys 1-3.
 * Supports scrolling when items exceed visible area.
 *
 * Sessions with parentSessionId are grouped under their parent with
 * tree connectors. Parents can be collapsed/expanded.
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
  statusColor, statusIcon, TypeBadge,
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

// ── Tree display item types ─────────────────────────────────

interface DisplayItem {
  session: Record<string, any>;
  isChild: boolean;
  /** Tree connector prefix for child rows */
  treePrefix: string;
  /** The parent session ID if this is a child */
  parentId?: string;
  /** Whether this parent is expanded to show children */
  isParentExpanded?: boolean;
  /** Number of children (for parents only) */
  childCount?: number;
  /** Child session names (for detail view) */
  childNames?: string[];
  /** Parent name (for child detail view) */
  parentName?: string;
}

// ── Generic list row ─────────────────────────────────────────

interface SessionRowProps {
  session: Record<string, any>;
  isSelected: boolean;
  isExpanded: boolean;
  isChild?: boolean;
  treePrefix?: string;
  isParentExpanded?: boolean;
  childCount?: number;
  childNames?: string[];
  parentName?: string;
  parentId?: string;
}

const STATUS_COL_WIDTH = 10;

const SessionRow = ({ session, isSelected, isExpanded, isChild, treePrefix, isParentExpanded, childCount, childNames, parentName, parentId }: SessionRowProps) => {
  const rawStatus = (session.status || 'unknown').toLowerCase();
  const vars = session.variables || {};
  const costLimitExceeded = vars._costLimitExceeded === true || vars._costLimitExceeded === 'true';

  // When cost limit exceeded, REPLACE status with "paused"
  const status = costLimitExceeded ? 'paused' : rawStatus;
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);
  const name = session.name || 'Unnamed';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
  const hasFitness = fitness !== undefined && fitness !== null;
  const fitnessStr = hasFitness ? `${Math.round(fitness * 100)}%` : '';
  const fitnessNum = hasFitness ? fitness * 100 : null;
  const duration = formatDuration(session.startedAt, session.completedAt);
  const rawCost = vars._accumulatedCost;
  const costNum = typeof rawCost === 'number' ? rawCost : (typeof rawCost === 'string' ? parseFloat(rawCost) : 0);
  const costStr = (isNaN(costNum) ? 0 : costNum).toFixed(2);

  // Fixed-width status column
  const statusText = status.padEnd(STATUS_COL_WIDTH);

  // Determine selector and expand icon
  const selector = isSelected ? icons.arrow : ' ';

  // For parents with children: show collapse/expand triangle
  // For children: no expand icon (tree prefix handles it)
  // For regular sessions (no children): normal expand icon
  let expandIcon: string;
  if (isChild) {
    expandIcon = ' ';
  } else if (childCount !== undefined && childCount > 0) {
    expandIcon = isParentExpanded ? icons.expanded : icons.collapsed;
  } else {
    expandIcon = isExpanded ? icons.expanded : (isSelected ? icons.collapsed : ' ');
  }

  // Display name — truncated at 30 chars
  const displayName = name.length > 30 ? name.substring(0, 30) : name.padEnd(30);

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', paddingLeft: isChild ? 0 : 1, overflow: 'hidden' },
      // Tree prefix for children (replaces selector + expand icon)
      isChild
        ? h(Text, null,
            h(Text, { color: 'gray' }, '      '),
            h(Text, { color: 'gray' }, treePrefix || ''),
            h(Text, null, ' '),
          )
        : h(Text, null,
            h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
            h(Text, null, ' '),
            h(Text, { color: 'gray' }, expandIcon),
            h(Text, null, ' '),
          ),
      T(sColor, sIcon),
      h(Text, null, ' '),
      h(Text, { color: isChild ? 'gray' : (isSelected ? 'cyan' : 'white') }, displayName),
      h(Text, null, ' '),
      muted(shortId),
      h(Text, null, '  '),
      T(sColor, statusText),
      h(Text, null, ' '),
      hasFitness ? muted('fit:') : null,
      hasFitness ? T(sColor, fitnessStr.padStart(4)) : h(Text, null, '        '),
      h(Text, null, '  '),
      muted('$'),
      h(Text, { color: costNum > 0 ? 'yellow' : 'gray' }, costStr),
      h(Text, null, '  '),
      muted(duration),
    ),
    isExpanded
      ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
          // Full ID
          h(Box, { flexDirection: 'row', gap: 2 },
            h(Text, null, muted('id: '), primary(session.id || '-')),
          ),
          // Parent/child relationship info
          childCount !== undefined && childCount > 0
            ? h(Box, { flexDirection: 'row' },
                muted('children: '),
                h(Text, { color: 'white' }, `${childCount} session(s)`),
                childNames && childNames.length > 0
                  ? h(Text, { color: 'gray' }, ` (${childNames.join(', ')})`)
                  : null,
              )
            : null,
          parentId
            ? h(Box, { flexDirection: 'row' },
                muted('parent: '),
                h(Text, { color: 'white' }, parentId.substring(0, 8)),
                parentName ? h(Text, { color: 'gray' }, ` (${parentName})`) : null,
              )
            : null,
          // Fitness bar
          fitnessNum !== null
            ? h(Box, { flexDirection: 'row' },
                muted('fitness: '),
                T(progressColor(fitnessNum), progressBar(fitnessNum, 12)),
                h(Text, null, ' '),
                T(progressColor(fitnessNum), fitnessStr),
              )
            : null,
          // Phases summary
          vars._phases && Array.isArray(vars._phases)
            ? h(Box, { flexDirection: 'row' },
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
            ? h(Box, { flexDirection: 'row' },
                muted('workflow: '),
                primary(truncate(vars._activeWorkflow, 50)),
              )
            : null,
          // Entry points
          session.entryPoints && Object.keys(session.entryPoints).length > 0
            ? h(Box, { flexDirection: 'row' },
                muted('entry: '),
                muted(Object.keys(session.entryPoints).join(', ')),
              )
            : null,
        )
      : null,
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

// ── Helper: build tree display list from flat sessions ───────

function buildSessionDisplayList(
  sessions: Record<string, any>[],
  collapsedParents: Set<string>,
): DisplayItem[] {
  // Build parent->children map
  const childrenMap = new Map<string, Record<string, any>[]>();
  const childIds = new Set<string>();
  const sessionById = new Map<string, Record<string, any>>();

  for (const s of sessions) {
    sessionById.set(s.id, s);
    const pid = s.parentSessionId;
    if (pid) {
      childIds.add(s.id);
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(s);
    }
  }

  const result: DisplayItem[] = [];

  for (const s of sessions) {
    // Skip children — they'll be placed under their parent
    if (childIds.has(s.id)) continue;

    const children = childrenMap.get(s.id) || [];
    const isCollapsed = collapsedParents.has(s.id);

    result.push({
      session: s,
      isChild: false,
      treePrefix: '',
      isParentExpanded: children.length > 0 ? !isCollapsed : undefined,
      childCount: children.length > 0 ? children.length : undefined,
      childNames: children.length > 0 ? children.map(c => c.name || 'Unnamed') : undefined,
    });

    // Add children if parent is expanded
    if (children.length > 0 && !isCollapsed) {
      for (let ci = 0; ci < children.length; ci++) {
        const isLast = ci === children.length - 1;
        const parent = sessionById.get(s.id);
        result.push({
          session: children[ci],
          isChild: true,
          treePrefix: isLast ? '\u2514\u2500' : '\u251C\u2500',
          parentId: s.id,
          parentName: parent?.name || 'Unknown',
        });
      }
    }
  }

  return result;
}

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
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

  // Terminal rows for scroll calculation
  // NavBar(3) + TabHeader(3) + PanelBorder(2) + title(1) + spacer(1) + headerLines(2) + StatusBar(3) = 15 fixed
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

  // Build tree display list for sessions tab
  const sessionDisplayList = useMemo(
    () => buildSessionDisplayList(filteredSessions, collapsedParents),
    [filteredSessions, collapsedParents]
  );

  // Current items based on active tab
  // For sessions, we use the display list length for navigation
  const currentItems =
    activeTab === 'sessions' ? sessionDisplayList
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

  // Toggle parent collapse/expand
  const toggleParent = useCallback((parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

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
      if (activeTab === 'sessions' && sessionDisplayList.length > 0) {
        const displayItem = sessionDisplayList[selectedIndex] as DisplayItem | undefined;
        if (displayItem) {
          // If this is a parent with children, toggle collapse/expand
          if (!displayItem.isChild && displayItem.childCount && displayItem.childCount > 0) {
            toggleParent(displayItem.session.id);
            return;
          }
          onSessionSelect(displayItem.session.id, state);
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
      if (activeTab === 'sessions' && sessionDisplayList.length > 0) {
        const displayItem = sessionDisplayList[selectedIndex] as DisplayItem | undefined;
        if (displayItem) setDeleteConfirm({ id: displayItem.session.id, name: displayItem.session.name || 'Unnamed' });
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
      const displayItem = item as DisplayItem;
      return h(SessionRow, {
        key: displayItem.session.id || `s-${realIndex}`,
        session: displayItem.session,
        isSelected,
        isExpanded: isSelected && !displayItem.isChild,
        isChild: displayItem.isChild,
        treePrefix: displayItem.treePrefix,
        isParentExpanded: displayItem.isParentExpanded,
        childCount: displayItem.childCount,
        childNames: displayItem.childNames,
        parentName: displayItem.parentName,
        parentId: displayItem.parentId,
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

  // Session count for display — use total (not display list which includes children inline)
  const sessionCount = activeTab === 'sessions' ? filteredSessions.length : currentItems.length;

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

export { SpacesScreen, buildSessionDisplayList };
