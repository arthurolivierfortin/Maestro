// @ts-nocheck
/**
 * Header Component (Ink)
 *
 * Displays session info at the top of the monitor:
 * - Status icon + name + shortId + status + duration
 * - Workflow info if running
 * - Iteration/fitness line with progress bar + sparkline
 *
 * Props: { session, context }
 */

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  T, primary, secondary, muted, dim, bold, running,
  statusColor, statusIcon, formatDuration,
  sparkline, progressBar, progressColor,
  icons, theme,
} from '../theme.ts';

/**
 * Header — top bar showing session identity, status, and fitness metrics.
 */
const Header = ({ session, context }) => {
  if (!session) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      muted('Loading...')
    );
  }

  const status = (session.status || 'unknown').toLowerCase();
  const sIcon = statusIcon(status);
  const sColor = statusColor(status);

  const name = session.name || 'Unnamed Session';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';
  const duration = formatDuration(session.startedAt, session.completedAt);

  // ── Row 1: Status icon + Name + ShortId + Status + Duration ──
  const statusLine = h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 1 },
    T(sColor, sIcon),
    bold(name),
    dim(shortId),
    muted(status),
    dim('duration:'),
    secondary(duration)
  );

  // ── Row 2: Workflow / Project info ──
  let workflowLine = null;
  if (context && context.activeWorkflow) {
    workflowLine = h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('workflow: '),
      running(context.activeWorkflow)
    );
  } else {
    const projectLabel = session.projectId
      ? session.projectId.substring(0, 8)
      : 'N/A';
    workflowLine = h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('project: '),
      muted(projectLabel)
    );
  }

  // ── Row 3: Iteration / Fitness (always visible if data present) ──
  const vars = session.variables || {};
  const currentIteration = vars.currentIteration || 0;
  const maxIterations = vars.maxIterations || 50;
  const currentFitness = Number(vars.currentFitness || 0);
  const targetFitness = Number(vars.targetFitness || 0.85);

  // Detect if session has any metrics data at all
  const hasScoreHistory = Array.isArray(vars.scoreHistory) && vars.scoreHistory.length > 0;
  const hasPhases = Array.isArray(vars._phases) && vars._phases.length > 0;
  const hasAnyMetrics = currentIteration > 0 || currentFitness > 0 || hasScoreHistory || hasPhases;

  let iterFitnessLine = null;

  if (hasAnyMetrics) {
    const fitnessPercent = currentFitness * 100;
    const progressToTarget = targetFitness > 0
      ? (currentFitness / targetFitness) * 100
      : 0;

    // Fitness bar (7 chars relative to target)
    const barWidth = 7;
    const fitnessBarStr = progressBar(progressToTarget, barWidth);
    const barColor = progressColor(progressToTarget);

    // Active phase name
    let phaseName = '';
    const phases = vars._phases;
    if (Array.isArray(phases)) {
      const runningPhase = phases.find(p => p.status === 'running');
      if (runningPhase) phaseName = runningPhase.id || runningPhase.name || '';
    }

    // Target string (only if target != 100%)
    const targetStr = targetFitness !== 1
      ? '/' + (targetFitness * 100).toFixed(0) + '%'
      : '';

    // Score sparkline
    let sparklineEl = null;
    const scoreHistory = vars.scoreHistory;
    if (Array.isArray(scoreHistory) && scoreHistory.length > 0) {
      const sparkStr = sparkline(scoreHistory, 8);
      sparklineEl = h(Text, { dimColor: true }, ' ' + sparkStr);
    }

    // Build the parts as React elements
    const parts = [];

    // Part 1: fitness bar + percentage + target (only if fitness data exists)
    if (currentFitness > 0 || currentIteration > 0) {
      parts.push(
        h(Box, { key: 'fitness', flexDirection: 'row' },
          T(barColor, fitnessBarStr),
          h(Text, {}, ' '),
          h(Text, {}, fitnessPercent.toFixed(0) + '%'),
          targetStr ? dim(targetStr) : null
        )
      );
    }

    // Part 2: iteration + sparkline (only if iteration data exists)
    if (currentIteration > 0) {
      parts.push(
        h(Box, { key: 'iter', flexDirection: 'row' },
          h(Text, {}, 'iter '),
          bold(String(currentIteration)),
          h(Text, {}, '/' + maxIterations),
          sparklineEl
        )
      );
    } else if (sparklineEl) {
      // Show sparkline even without active iteration if score history exists
      parts.push(
        h(Box, { key: 'spark', flexDirection: 'row' },
          muted('scores'),
          sparklineEl
        )
      );
    }

    // Part 3: phase info (always shown if phases exist)
    if (phaseName) {
      parts.push(
        h(Box, { key: 'phase', flexDirection: 'row' },
          h(Text, {}, 'Phase: '),
          running(phaseName)
        )
      );
    } else if (hasPhases) {
      // Show compact phase summary: e.g., "3/5 phases done"
      const phases = vars._phases;
      const doneCount = phases.filter(p => p.status === 'done' || p.status === 'completed').length;
      const totalCount = phases.length;
      parts.push(
        h(Box, { key: 'phase-summary', flexDirection: 'row' },
          muted('phases '),
          bold(String(doneCount)),
          muted('/' + totalCount)
        )
      );
    }

    // Join parts with separators
    const separated = [];
    parts.forEach((part, i) => {
      if (i > 0) {
        separated.push(h(Text, { key: 'sep-' + i, color: 'gray' }, '  |  '));
      }
      separated.push(part);
    });

    iterFitnessLine = h(Box, { flexDirection: 'row', paddingLeft: 1 },
      ...separated
    );
  }

  return h(Box, { flexDirection: 'column' },
    statusLine,
    workflowLine,
    iterFitnessLine
  );
};

export { Header };
