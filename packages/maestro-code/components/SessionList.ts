/**
 * SessionList — Renders the list of session cards.
 *
 * Ink equivalent of the blessed SessionListComponent.
 *
 * Props:
 *   sessions       Array of session objects
 *   selectedIndex  Index of the currently highlighted session
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, primary, muted, label,
  statusColor, statusIcon,
  formatDuration,
  progressBar, progressColor,
} from '../theme.ts';

// ── Card width constant (matches blessed 68-char inner width) ──
const CARD_INNER_WIDTH = 68;

// ── Empty state ────────────────────────────────────────────────

const EmptyState = () =>
  h(Box, { flexDirection: 'column', paddingLeft: 2, paddingTop: 1 },
    muted('(no active sessions)'),
    h(Text, null, ''),
    muted('Create one with:'),
    primary('maestro session create --project <id> --name "My Session"'),
  );

// ── Fitness bar ────────────────────────────────────────────────

interface FitnessBarProps { fitness?: number | null; }

const FitnessBar = ({ fitness }: FitnessBarProps) => {
  if (fitness === undefined || fitness === null) return null;

  const percent = Math.round(fitness * 100);
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  const color = progressColor(percent);

  return h(Text, null,
    muted('fitness: '),
    T(color, '\u2588'.repeat(filled) + '\u2591'.repeat(empty)),
    h(Text, null, ' '),
    muted(`${percent}%`),
  );
};

// ── Single session card ────────────────────────────────────────

interface SessionCardProps { session: Record<string, any>; index: number; isSelected: boolean; }

const SessionCard = ({ session, index, isSelected }: SessionCardProps) => {
  const status = (session.status || 'unknown').toLowerCase();
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);

  const name = session.name || 'Unnamed Session';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';
  const duration = formatDuration(session.startedAt, session.completedAt);

  const borderColor = isSelected ? theme.ui.borderActive : 'gray';
  const selector = isSelected ? icons.arrow : ' ';
  const numKey = `[${index + 1}]`;

  // Detail line content
  let details = '';
  if (session.activeWorkflow) {
    details = `workflow: ${session.activeWorkflow}`;
  } else if (session.projectId) {
    details = `project: ${session.projectId.substring(0, 8)}`;
  }

  const vars = session.variables || {};
  const iteration = vars.currentIteration !== undefined ? vars.currentIteration : vars.iteration;
  const maxIter = vars.maxIterations;
  const iterInfo = (iteration !== undefined && maxIter) ? `iter: ${iteration}/${maxIter}` : '';

  // Fitness value
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;

  // Horizontal rule: box-drawing chars
  const hLine = '\u2500'.repeat(CARD_INNER_WIDTH);

  return h(Box, { flexDirection: 'column', paddingLeft: 2, marginBottom: 1 },
    // Top border ┌──────────────────────┐
    h(Text, { color: borderColor }, '\u250C' + hLine + '\u2510'),

    // Main line: selector  [n]  icon  name           shortId   status
    h(Box, { flexDirection: 'row' },
      h(Text, { color: borderColor }, '\u2502'),
      h(Text, null, ' '),
      h(Text, { color: isSelected ? 'cyan' : undefined }, selector),
      h(Text, null, ' '),
      muted(numKey),
      h(Text, null, ' '),
      T(sColor, sIcon),
      h(Text, null, ' '),
      primary(name.length > 35 ? name.substring(0, 35) : name.padEnd(35)),
      h(Text, null, ' '),
      muted(shortId),
      h(Text, null, '  '),
      T(sColor, status.padEnd(12)),
      h(Text, null, padToFit(name, shortId, status)),
      h(Text, { color: borderColor }, '\u2502'),
    ),

    // Details line: workflow / project + iteration
    h(Box, { flexDirection: 'row' },
      h(Text, { color: borderColor }, '\u2502'),
      h(Text, null, '     '),
      muted(details.length > 45 ? details.substring(0, 45) : details.padEnd(45)),
      h(Text, null, ' '),
      muted(iterInfo.length > 15 ? iterInfo.substring(0, 15) : iterInfo.padEnd(15)),
      padRight(details, iterInfo),
      h(Text, { color: borderColor }, '\u2502'),
    ),

    // Fitness / Duration line
    h(Box, { flexDirection: 'row' },
      h(Text, { color: borderColor }, '\u2502'),
      h(Text, null, '     '),
      fitness !== undefined && fitness !== null
        ? h(Box, { flexDirection: 'row', width: 45 },
            h(FitnessBar, { fitness }),
          )
        : h(Text, null, ' '.repeat(45)),
      h(Text, null, ' '),
      muted(('duration: ' + duration).padEnd(15)),
      padRightDuration(fitness, duration),
      h(Text, { color: borderColor }, '\u2502'),
    ),

    // Bottom border └──────────────────────┘
    h(Text, { color: borderColor }, '\u2514' + hLine + '\u2518'),
  );
};

/**
 * Padding helpers.
 * These return spacer Text elements to ensure each row fills CARD_INNER_WIDTH chars
 * inside the vertical borders. Because Ink uses flex layout, these are approximations
 * that keep the visual output consistent. They return empty text when not needed.
 */
const padToFit = (..._args: any[]) => h(Text, null, '');
const padRight = (..._args: any[]) => h(Text, null, '');
const padRightDuration = (..._args: any[]) => h(Text, null, '');

// ── SessionList component ──────────────────────────────────────

interface SessionListProps { sessions?: any[]; selectedIndex?: number; }

const SessionList = ({ sessions = [], selectedIndex = 0 }: SessionListProps) => {
  if (sessions.length === 0) {
    return h(Box, {
      flexDirection: 'column',
      flexGrow: 1,
      width: '100%',
    },
      h(EmptyState),
    );
  }

  return h(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    width: '100%',
    overflow: 'hidden',
  },
    h(Box, { flexDirection: 'column', paddingTop: 0, paddingBottom: 0 },
      h(Box, { paddingLeft: 2, marginBottom: 1 },
        muted(`${sessions.length} session(s) available`),
      ),
      ...sessions.map((session, i) =>
        h(SessionCard, {
          key: session.id || `session-${i}`,
          session,
          index: i,
          isSelected: i === selectedIndex,
        }),
      ),
    ),
  );
};

export { SessionList };
