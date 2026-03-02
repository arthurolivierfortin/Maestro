// @ts-nocheck
/**
 * SpacesScreen — Repos / Workspaces / Sessions browser.
 *
 * Replaces GlobalMonitor as the main session/workspace/project browser.
 * Has 3 tabs switchable via number keys 1-3.
 * Supports scrolling when items exceed visible area.
 *
 * Props:
 *   apiClient        API client instance
 *   onNavigate       (page: string) => void
 *   onSessionSelect  (sessionId: string) => void
 *   onQuit           () => void
 */

import { createElement as h, useState, useEffect, useCallback, useRef } from 'react';
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

const TabHeader = ({ activeTab }) => {
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

const StatusFilter = ({ activeFilter }) => {
  const filters = [
    { key: 'all', label: 'All', hotkey: 'a' },
    { key: 'running', label: 'Running', hotkey: 'r' },
  ];

  const elements = [];
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    const isActive = activeFilter === f.key;
    elements.push(
      h(Text, { key: f.key },
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: isActive ? theme.panel.borderFocused : theme.shortcut.key }, f.hotkey),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
        isActive
          ? h(Text, { color: theme.panel.borderFocused, bold: true }, f.label)
          : h(Text, { color: theme.text.muted }, f.label),
      )
    );
    if (i < filters.length - 1) {
      elements.push(h(Text, { key: `fsp-${i}` }, '  '));
    }
  }

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    muted('Filter: '),
    ...elements,
  );
};

// ── Generic list row ─────────────────────────────────────────

const SessionRow = ({ session, isSelected, isExpanded }) => {
  const status = (session.status || 'unknown').toLowerCase();
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);
  const name = session.name || 'Unnamed';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';
  const selector = isSelected ? icons.arrow : ' ';
  const expandIcon = isExpanded ? icons.expanded : (isSelected ? icons.collapsed : ' ');
  const vars = session.variables || {};
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
  const fitnessStr = fitness !== undefined && fitness !== null
    ? `${Math.round(fitness * 100)}%` : '-';
  const fitnessNum = fitness !== undefined && fitness !== null ? fitness * 100 : null;
  const duration = formatDuration(session.startedAt, session.completedAt);

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
      h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
      h(Text, null, ' '),
      h(Text, { color: 'gray' }, expandIcon),
      h(Text, null, ' '),
      T(sColor, sIcon),
      h(Text, null, ' '),
      h(Text, { color: isSelected ? 'cyan' : 'white' },
        name.length > 30 ? name.substring(0, 30) : name.padEnd(30)),
      h(Text, null, ' '),
      muted(shortId),
      h(Text, null, '  '),
      T(sColor, status.padEnd(10)),
      h(Text, null, ' '),
      muted('fit:'),
      T(sColor, fitnessStr.padStart(4)),
      h(Text, null, '  '),
      muted(duration),
    ),
    isExpanded
      ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
          // Full ID
          h(Box, { flexDirection: 'row', gap: 2 },
            h(Text, null, muted('id: '), primary(session.id || '-')),
          ),
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
                ...vars._phases.map((p, pi) => {
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

const RepoRow = ({ project, isSelected }) => {
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

const WorkspaceRow = ({ workspace, isSelected }) => {
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

const DeleteConfirmation = ({ sessionName, onConfirm, onCancel }) => {
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

const SpacesScreen = ({ apiClient, onNavigate, onSessionSelect, onWorkspaceSelect, onRepoSelect, onQuit, initialState, chrome, keyboardActive }) => {
  const showChrome = chrome !== false;
  const { stdout } = useStdout();
  const [activeTab, setActiveTab] = useState(initialState?.activeTab ?? 'sessions');
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const [statusFilter, setStatusFilter] = useState(initialState?.statusFilter ?? 'all');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name } | null

  // Terminal rows for scroll calculation
  // NavBar(3) + TabHeader(3) + PanelBorder(2) + title(1) + spacer(1) + headerLines(2) + StatusBar(3) = 15 fixed
  const termRows = stdout.rows || 40;
  const visibleItems = Math.max(3, termRows - 15);

  // Fetch sessions
  const { data: sessions } = useApiData(
    useCallback(() => apiClient.listSessions(), [apiClient]),
    3000
  );

  // Fetch projects (repos)
  const { data: projects } = useApiData(
    useCallback(() => apiClient.listProjects().catch(() => []), [apiClient]),
    10000
  );

  // Fetch workspaces
  const { data: workspaces } = useApiData(
    useCallback(() => apiClient.get('/api/workspaces').catch(() => []), [apiClient]),
    10000
  );

  const sessionList = sessions || [];
  const projectList = projects || [];
  const workspaceList = workspaces || [];
  const runningCount = sessionList.filter(s => s.status === 'running').length;

  // Apply status filter
  const filteredSessions = statusFilter === 'all'
    ? sessionList
    : sessionList.filter(s => (s.status || '').toLowerCase() === statusFilter);

  // Current items based on active tab
  const currentItems =
    activeTab === 'sessions' ? filteredSessions
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
    up: () => setSelectedIndex(i => Math.max(0, i - 1)),
    down: () => setSelectedIndex(i => Math.min(currentItems.length - 1, i + 1)),
    k: () => setSelectedIndex(i => Math.max(0, i - 1)),
    j: () => setSelectedIndex(i => Math.min(currentItems.length - 1, i + 1)),
    // Chrome-only keys: page navigation (disabled when embedded in maestro-code)
    ...(showChrome ? {
      ctrlLeft: () => onNavigate(prevPage('spaces')),
      ctrlRight: () => onNavigate(nextPage('spaces')),
    } : {}),
    enter: () => {
      const state = { selectedIndex, activeTab, statusFilter };
      if (activeTab === 'sessions' && filteredSessions.length > 0) {
        const session = filteredSessions[selectedIndex];
        if (session) onSessionSelect(session.id, state);
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
    a: () => setStatusFilter('all'),
    r: () => setStatusFilter('running'),
    d: () => {
      if (activeTab === 'sessions' && filteredSessions.length > 0) {
        const session = filteredSessions[selectedIndex];
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
  const rows = visibleSlice.map((item, vi) => {
    const realIndex = scrollStart + vi;
    const isSelected = realIndex === selectedIndex;
    if (activeTab === 'sessions') {
      return h(SessionRow, { key: item.id || `s-${realIndex}`, session: item, isSelected, isExpanded: isSelected });
    } else if (activeTab === 'repos') {
      return h(RepoRow, { key: item.id || `r-${realIndex}`, project: item, isSelected });
    } else {
      return h(WorkspaceRow, { key: item.id || `w-${realIndex}`, workspace: item, isSelected });
    }
  });

  const tabTitle = activeTab === 'repos' ? 'REPOS'
    : activeTab === 'workspaces' ? 'WORKSPACES'
    : 'SESSIONS';

  // Header inside content panel (with spacing from panel title)
  const headerLines = [
    h(Box, { key: 'spacer', height: 1 }),  // breathing room after panel title
  ];
  if (activeTab === 'sessions') {
    headerLines.push(h(StatusFilter, { key: 'filter', activeFilter: statusFilter }));
  }
  headerLines.push(
    h(Box, { key: 'count', paddingLeft: 2 },
      muted(`${currentItems.length} ${activeTab === 'repos' ? 'repo(s)' : activeTab === 'workspaces' ? 'workspace(s)' : 'session(s)'}`),
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
