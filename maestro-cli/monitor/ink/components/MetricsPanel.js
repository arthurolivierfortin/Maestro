/**
 * MetricsPanel — Session metrics display.
 *
 * Ink equivalent of the blessed MetricsPanelComponent.
 *
 * - Fitness progress bar with color
 * - Quality score, token count
 * - Iteration + plateau info
 * - Trend sparkline
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  muted, dim, primary, running,
  progressBar, progressColor,
  sparkline,
} from '../theme.js';

// ── Fitness line with colored bar ──────────────────────────────

const FitnessLine = ({ current, target }) => {
  const barWidth = 10;
  const progressToTarget = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const barColor = progressColor(progressToTarget);
  const bar = progressBar(progressToTarget, barWidth);

  const parts = [
    h(Text, { key: 'pad' }, '  '),
    muted('Fitness'),
    h(Text, { key: 'sp' }, '  '),
    h(Text, { key: 'bar', color: barColor }, bar),
    h(Text, { key: 'val' }, ` ${Math.round(current * 100)}%`),
  ];

  if (target !== 1) {
    parts.push(dim(`/${Math.round(target * 100)}%`));
  }

  return h(Box, { flexDirection: 'row' }, ...parts);
};

// ── Iteration line ─────────────────────────────────────────────

const IterationLine = ({ value, max, plateauCount }) => {
  const parts = [
    h(Text, { key: 'pad' }, '  '),
    muted('Iter'),
    h(Text, { key: 'sp' }, '     '),
    primary(String(value)),
  ];

  if (plateauCount !== undefined && plateauCount !== null) {
    parts.push(
      h(Text, { key: 'psp' }, '  '),
      dim('plateau:'),
      h(Text, { key: 'psp2' }, ' '),
      primary(String(plateauCount)),
    );
  } else if (max !== null && max !== undefined) {
    parts.push(dim(`/${max}`));
  }

  return h(Box, { flexDirection: 'row' }, ...parts);
};

// ── Trend sparkline line ───────────────────────────────────────

const TrendLine = ({ history }) => {
  const nums = history.map(v => Number(v) || 0).slice(-12);
  if (nums.length <= 1) return null;

  const spark = sparkline(nums, 12);
  const last = nums[nums.length - 1];

  return h(Box, { flexDirection: 'row' },
    h(Text, { key: 'pad' }, '  '),
    muted('Trend'),
    h(Text, { key: 'sp' }, '    '),
    running(spark),
    h(Text, { key: 'vsp' }, ' '),
    primary(last.toFixed(2)),
  );
};

// ── Main component ─────────────────────────────────────────────

const MetricsPanel = ({ session, context = {} }) => {
  const vars = session?.variables || {};

  const fitness = Number(vars.currentFitness || vars.fitness || 0);
  const target = Number(vars.targetFitness || vars.target || 1);
  const qualityScore = Number(vars._qualityScore || 0);
  const tokenCount = vars._tokenCount || 0;
  const iteration = vars.currentIteration || vars.iteration || 0;
  const maxIter = vars.maxIterations;
  const plateauCount = vars._plateauCount;
  const history = vars.scoreHistory;

  const children = [];

  // Fitness bar
  children.push(h(FitnessLine, { key: 'fitness', current: fitness, target }));

  // Quality score (when different from fitness)
  if (qualityScore > 0 && Math.abs(qualityScore - fitness) > 0.01) {
    children.push(
      h(Box, { key: 'quality', flexDirection: 'row' },
        h(Text, null, '  '),
        muted('Quality'),
        h(Text, null, '  '),
        primary(Math.round(qualityScore * 100) + '%'),
        dim('/' + Math.round(target * 100) + '%'),
      )
    );
  }

  // Token count
  if (tokenCount > 0) {
    children.push(
      h(Box, { key: 'tokens', flexDirection: 'row' },
        h(Text, null, '  '),
        muted('Tokens'),
        h(Text, null, '   '),
        primary('~' + tokenCount),
      )
    );
  }

  // Iteration + plateau
  children.push(
    h(IterationLine, {
      key: 'iter',
      value: iteration,
      max: maxIter,
      plateauCount: plateauCount !== undefined && plateauCount !== null ? plateauCount : undefined,
    })
  );

  // Trend sparkline
  if (Array.isArray(history) && history.length > 1) {
    children.push(h(TrendLine, { key: 'trend', history }));
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { MetricsPanel };
