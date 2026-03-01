// @ts-nocheck
/**
 * BlockDetail — Block detail page.
 *
 * Shows block info, fitness dimensions, linked sessions, and actions.
 * 4 panels: INFO, FITNESS, SESSIONS, ACTIONS.
 *
 * Props:
 *   blockId          string
 *   apiClient        API client instance
 *   onExit           () => void — back to catalog
 *   onQuit           () => void — quit app
 *   onSessionSelect  (sessionId: string) => void
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary, bold, dim,
  statusColor, statusIcon,
  TypeBadge,
  progressBar, progressColor,
} from '../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useActionKeyboard } from '../hooks/useKeyboard.ts';
import { Panel } from './Panel.ts';
import { StatusBar } from './StatusBar.ts';

// ── Info panel content ───────────────────────────────────────

const InfoContent = ({ block }) => {
  if (!block) return muted('(loading...)');

  const children = block.children || [];

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('ID:      '),
      primary(block.id || '-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Type:    '),
      h(TypeBadge, { type: block.type || 'unknown' }),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Atomic:  '),
      primary(block.isAtomic ? 'yes' : 'no'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Version: '),
      primary(block.version || '-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Author:  '),
      primary(block.author || '-'),
    ),

    // Children list for composite blocks
    children.length > 0
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          muted(`Children: ${children.length} block(s)`),
          ...children.map((childId, i) => {
            const isLast = i === children.length - 1;
            const branch = isLast ? icons.lastBranch : icons.branch;
            return h(Box, { key: `ch-${i}`, flexDirection: 'row', paddingLeft: 1 },
              muted(branch + ' '),
              primary(childId),
            );
          }),
        )
      : null,
  );
};

// ── Fitness panel content ────────────────────────────────────

const FitnessContent = ({ block }) => {
  if (!block) return muted('(loading...)');

  const fitness = block.fitness;
  const dims = block.fitnessDimensions;
  const taskFit = block.taskFitness;

  if (fitness == null && !dims && !taskFit) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      muted('(no fitness data)'),
      h(Text, null, ''),
      muted('Run a training session to'),
      muted('generate fitness metrics.'),
    );
  }

  const elements = [];

  // Block fitness
  if (fitness != null) {
    const pct = Math.round(fitness * 100);
    const col = progressColor(pct);
    elements.push(
      h(Box, { key: 'bf-title', flexDirection: 'row' },
        bold('Block Fitness'),
      ),
      h(Box, { key: 'bf-score', flexDirection: 'row' },
        muted('  Score: '),
        T(col, `${pct}%`, { bold: true }),
      ),
      h(Box, { key: 'bf-bar', flexDirection: 'row' },
        muted('  '),
        T(col, progressBar(pct, 16)),
      ),
    );
  }

  // Block fitness dimensions (P/S/W)
  if (dims) {
    const dimList = [
      { label: 'Performance', value: dims.performance },
      { label: 'Specialization', value: dims.specialization },
      { label: 'Composability', value: dims.composability },
    ];
    elements.push(h(Text, { key: 'bf-dims-space' }, ''));
    for (const d of dimList) {
      if (d.value != null) {
        const pct = Math.round(d.value * 100);
        elements.push(
          h(Box, { key: `bd-${d.label}`, flexDirection: 'row' },
            muted(`  ${d.label.padEnd(16)}`),
            T(progressColor(pct), progressBar(pct, 10)),
            h(Text, null, ' '),
            T(progressColor(pct), `${pct}%`),
          ),
        );
      }
    }
  }

  // Task fitness (for composite blocks)
  if (taskFit) {
    elements.push(h(Text, { key: 'tf-space' }, ''));
    const tPct = Math.round(taskFit.score * 100);
    const tCol = progressColor(tPct);
    elements.push(
      h(Box, { key: 'tf-title', flexDirection: 'row' },
        bold('Task Fitness'),
        h(Text, null, ' '),
        T(tCol, `${tPct}%`, { bold: true }),
      ),
    );

    if (taskFit.dimensions) {
      const taskDims = [
        { label: 'Completion', value: taskFit.dimensions.completion },
        { label: 'Quality', value: taskFit.dimensions.quality },
        { label: 'Cost-Eff', value: taskFit.dimensions.costEfficiency },
        { label: 'Reliability', value: taskFit.dimensions.reliability },
      ];
      for (const d of taskDims) {
        if (d.value != null) {
          const pct = Math.round(d.value * 100);
          elements.push(
            h(Box, { key: `td-${d.label}`, flexDirection: 'row' },
              muted(`  ${d.label.padEnd(16)}`),
              T(progressColor(pct), progressBar(pct, 10)),
              h(Text, null, ' '),
              T(progressColor(pct), `${pct}%`),
            ),
          );
        }
      }
    }
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 }, ...elements);
};

// ── Session row (compact) ────────────────────────────────────

const SessionRow = ({ session, isSelected }) => {
  const status = (session.status || 'unknown').toLowerCase();
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);
  const name = session.name || 'Unnamed';
  const selector = isSelected ? icons.arrow : ' ';

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    T(sColor, sIcon),
    h(Text, null, ' '),
    h(Text, { color: isSelected ? 'cyan' : 'white' },
      name.length > 25 ? name.substring(0, 25) : name.padEnd(25)),
    h(Text, null, ' '),
    T(sColor, status),
  );
};

// ── Actions panel content ────────────────────────────────────

const ActionsContent = () => {
  const actions = [
    { key: 'v', label: 'View source JSON' },
  ];

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    ...actions.map(a =>
      h(Box, { key: `act-${a.key}`, flexDirection: 'row' },
        h(Text, null,
          h(Text, { color: theme.shortcut.bracket }, '['),
          h(Text, { color: theme.shortcut.key }, a.key),
          h(Text, { color: theme.shortcut.bracket }, '] '),
          primary(a.label),
        ),
      )
    ),
  );
};

// ── BlockDetail component ────────────────────────────────────

const BlockDetail = ({ blockId, apiClient, onExit, onQuit, onNavigate, onSessionSelect, initialState }) => {
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const [activePanel, setActivePanel] = useState(initialState?.activePanel ?? 'sessions'); // 'sessions' | 'actions'

  // Fetch block detail
  const {
    data: block,
    connectionStatus,
    latency,
    lastRefresh,
  } = useApiData(
    useCallback(() => apiClient.getBlock(blockId), [apiClient, blockId]),
    10000
  );

  // Fetch all sessions to filter by block
  const { data: allSessions } = useApiData(
    useCallback(() => apiClient.listSessions().catch(() => []), [apiClient]),
    5000
  );

  // Filter sessions linked to this block
  const sessionIds = block?.sessionIds || [];
  const sessions = (allSessions || []).filter(s => sessionIds.includes(s.id));

  const maxIndex = Math.max(0, sessions.length - 1);
  const clampedIndex = Math.min(selectedIndex, maxIndex);

  // Keyboard (Schema A: detail context)
  useActionKeyboard({
    'cursor.up': () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.max(0, i - 1));
    },
    'cursor.down': () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.min(maxIndex, i + 1));
    },
    'cursor.upAlt': () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.max(0, i - 1));
    },
    'cursor.downAlt': () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.min(maxIndex, i + 1));
    },
    'panel.cycle': () => setActivePanel(p => p === 'sessions' ? 'actions' : 'sessions'),
    'panel.next': () => setActivePanel(p => p === 'sessions' ? 'actions' : 'sessions'),
    'panel.prev': () => setActivePanel(p => p === 'sessions' ? 'actions' : 'sessions'),
    'tree.toggle': () => {
      if (activePanel === 'sessions' && sessions.length > 0) {
        const session = sessions[clampedIndex];
        if (session) onSessionSelect(session.id, { selectedIndex, activePanel });
      }
    },
    'back': onExit,
    'quit': onQuit,
    'page.home': () => { if (onNavigate) onNavigate('home'); },
    'page.spaces': () => { if (onNavigate) onNavigate('spaces'); },
    'page.foundry': () => { if (onNavigate) onNavigate('foundry'); },
    'page.catalog': () => { if (onNavigate) onNavigate('catalog'); },
    'page.models': () => { if (onNavigate) onNavigate('models'); },
  }, 'detail');

  const b = block || {};
  const fitnessStr = b.fitness != null ? `${Math.round(b.fitness * 100)}%` : '-';
  const fitCol = b.fitness != null ? progressColor(b.fitness * 100) : theme.text.muted;

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'BLOCK', width: '100%' },
      h(Box, { flexDirection: 'column', paddingLeft: 1 },
        h(Box, { flexDirection: 'row' },
          h(TypeBadge, { type: b.type || 'unknown' }),
          h(Text, null, ' '),
          bold(b.name || blockId),
          h(Text, null, '  '),
          muted('v' + (b.version || '?')),
          h(Text, null, '   '),
          muted('fit: '),
          T(fitCol, fitnessStr),
        ),
        b.description
          ? h(Box, { flexDirection: 'row' },
              muted(b.description),
            )
          : null,
      ),
    ),

    // Top row: INFO + FITNESS
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      h(Panel, { title: 'INFO', width: '40%' },
        h(InfoContent, { block: b }),
      ),
      h(Panel, { title: 'FITNESS', flexGrow: 1 },
        h(FitnessContent, { block: b }),
      ),
    ),

    // Bottom row: SESSIONS + ACTIONS
    h(Box, { flexDirection: 'row', width: '100%', height: '40%' },
      h(Panel, {
        title: 'SESSIONS',
        focused: activePanel === 'sessions',
        width: '60%',
      },
        h(Box, { flexDirection: 'column' },
          h(Box, { paddingLeft: 2 },
            muted(`${sessions.length} session(s) use this block`),
          ),
          sessions.length === 0
            ? h(Box, { paddingLeft: 2 }, muted('(none)'))
            : h(Box, { flexDirection: 'column' },
                ...sessions.map((s, i) =>
                  h(SessionRow, {
                    key: s.id,
                    session: s,
                    isSelected: activePanel === 'sessions' && i === clampedIndex,
                  })
                ),
              ),
        ),
      ),
      h(Panel, {
        title: 'ACTIONS',
        focused: activePanel === 'actions',
        flexGrow: 1,
      },
        h(ActionsContent),
      ),
    ),

    // Status bar
    h(StatusBar, {
      connectionStatus,
      latency,
      lastRefresh,
      currentPage: 'catalog',
      isDetailView: true,
    }),
  );
};

export { BlockDetail };
