// @ts-nocheck
/**
 * WidgetsPanel Component (Ink)
 *
 * Renders custom session widgets defined in templates.
 *
 * Widget types:
 *   progress-bar, counter, score-chart, status-list,
 *   fitness-summary, knowledge-status, context-panel
 *
 * Default widgets: auto-generated from session variables
 *   (fitness, iteration, scoreHistory, phase)
 *
 * Uses resolvePath() from utils to resolve $.variables.xxx paths.
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  T, primary, secondary, muted, dim, success, running, warning, error,
  icons, inkTheme as theme,
} from '../theme/index.ts';
import {
  statusColor, statusIcon, formatTime,
  sparkline, progressBar, progressColor, resolvePath,
} from '../utils/index.ts';

// ── Progress bar sub-component ──────────────────────────────────

const ProgressBarWidget = ({ labelText, current, max, showPercent }) => {
  const width = 16;
  const percent = Math.min(100, Math.max(0, (current / max) * 100));
  const barStr = progressBar(percent, width);
  const barColor = progressColor(percent);
  const percentStr = showPercent ? ' ' + Math.round(percent) + '%' : '';

  const children = [
    h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
    h(Box, { key: 'bar', flexDirection: 'row', paddingLeft: 2 },
      T(barColor, barStr),
      h(Text, null, percentStr)
    ),
  ];

  if (max !== 1) {
    children.push(
      h(Box, { key: 'target', flexDirection: 'row', paddingLeft: 2 },
        dim('target:'),
        h(Text, null, ' '),
        muted(String(max))
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Counter sub-component ───────────────────────────────────────

const CounterWidget = ({ labelText, value, max }) => {
  const maxStr = max !== null && max !== undefined ? ' / ' + max : '';

  return h(Box, { flexDirection: 'column' },
    h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
    h(Box, { key: 'value', flexDirection: 'row', paddingLeft: 2 },
      primary(String(value)),
      dim(maxStr)
    )
  );
};

// ── Sparkline / Score chart sub-component ───────────────────────

const ScoreChartWidget = ({ labelText, values, threshold }) => {
  const nums = (values || []).map(v => Number(v) || 0).slice(-12);

  if (nums.length === 0) {
    return h(Box, { flexDirection: 'column' },
      h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
      h(Box, { key: 'empty', paddingLeft: 2 }, dim('(no data)'))
    );
  }

  const sparkStr = sparkline(nums, 12);
  const lastValue = nums[nums.length - 1];

  const children = [
    h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
    h(Box, { key: 'chart', flexDirection: 'row', paddingLeft: 2 },
      running(sparkStr),
      h(Text, null, ' '),
      primary(lastValue.toFixed(2))
    ),
  ];

  if (threshold !== null && threshold !== undefined) {
    children.push(
      h(Box, { key: 'target', flexDirection: 'row', paddingLeft: 2 },
        dim('target:'),
        h(Text, null, ' '),
        muted(String(threshold))
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Status list sub-component ───────────────────────────────────

const StatusListWidget = ({ labelText, items }) => {
  const children = [
    h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
  ];

  if (!Array.isArray(items) || items.length === 0) {
    children.push(
      h(Box, { key: 'empty', paddingLeft: 2 }, dim('(empty)'))
    );
  } else {
    const displayItems = items.slice(0, 5);
    for (let i = 0; i < displayItems.length; i++) {
      const item = displayItems[i];
      const status = item.status || 'pending';
      const sIcon = status === 'done' ? icons.done
        : status === 'running' ? icons.running
        : icons.pending;
      const sColor = statusColor(status);
      const itemName = item.name || String(item);

      children.push(
        h(Box, { key: 'item-' + i, flexDirection: 'row', paddingLeft: 2 },
          T(sColor, sIcon),
          h(Text, null, ' '),
          h(Text, null, itemName)
        )
      );
    }
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Mini bar helper (returns React element) ─────────────────────

const MiniBar = ({ score }) => {
  const width = 16;
  const percent = Math.min(100, Math.max(0, score * 100));
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const barColor = progressColor(percent);
  const barStr = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  return T(barColor, barStr);
};

// ── Fitness summary sub-component ───────────────────────────────

const FitnessSummaryWidget = ({ labelText, data }) => {
  const levels = ['block', 'task', 'value'];
  const levelLabels = { block: 'Block', task: 'Task ', value: 'Value' };

  const children = [
    h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
  ];

  for (const level of levels) {
    const entry = data?.[level];
    const lbl = levelLabels[level];

    if (entry && entry.score !== null && entry.score !== undefined) {
      const score = Number(entry.score) || 0;

      children.push(
        h(Box, { key: 'level-' + level, flexDirection: 'row', paddingLeft: 2 },
          dim(lbl + ':'),
          h(Text, null, ' '),
          primary(score.toFixed(2)),
          h(Text, null, ' '),
          h(MiniBar, { score })
        )
      );

      // Show sub-dimensions for task fitness
      if (level === 'task' && typeof entry === 'object') {
        const dims = [
          ['Completion', entry.completion],
          ['Quality', entry.quality],
          ['Cost-Eff', entry.costEfficiency],
          ['Reliability', entry.reliability],
          ['Resilience', entry.resilience],
        ];
        for (const [dimName, dimValue] of dims) {
          if (dimValue !== null && dimValue !== undefined) {
            const pct = Math.round(Number(dimValue) * 100);
            const padding = ' '.repeat(Math.max(1, 13 - dimName.length));
            children.push(
              h(Box, { key: 'dim-' + dimName, flexDirection: 'row', paddingLeft: 4 },
                dim(dimName + ':'),
                h(Text, null, padding),
                muted(pct + '%')
              )
            );
          }
        }
      }
    } else {
      children.push(
        h(Box, { key: 'level-' + level, flexDirection: 'row', paddingLeft: 2 },
          dim(lbl + ':'),
          h(Text, null, ' '),
          dim('--')
        )
      );
    }
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Knowledge status sub-component ──────────────────────────────

const formatRelativeTime = (isoString) => {
  try {
    const then = new Date(isoString);
    const now = new Date();
    const diffMs = now - then;

    if (diffMs < 0) return 'just now';

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return diffSec + 's ago';

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + ' min ago';

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';

    const diffDays = Math.floor(diffHr / 24);
    return diffDays + 'd ago';
  } catch {
    return String(isoString);
  }
};

const KnowledgeStatusWidget = ({ labelText, data }) => {
  const children = [
    h(Box, { key: 'label', paddingLeft: 2 }, muted(labelText)),
  ];

  // Total articles
  const total = data?.totalArticles;
  children.push(
    h(Box, { key: 'articles', flexDirection: 'row', paddingLeft: 2 },
      dim('Articles:'),
      h(Text, null, ' '),
      total !== null && total !== undefined ? primary(String(total)) : dim('--')
    )
  );

  // Confidence breakdown
  const conf = data?.byConfidence || {};
  const high = conf.high || 0;
  const med = conf.medium || 0;
  const low = conf.low || 0;
  if (high || med || low) {
    children.push(
      h(Box, { key: 'confidence', flexDirection: 'row', paddingLeft: 2 },
        success('High: ' + high),
        h(Text, null, ' '),
        dim('|'),
        h(Text, null, ' '),
        warning('Med: ' + med),
        h(Text, null, ' '),
        dim('|'),
        h(Text, null, ' '),
        error('Low: ' + low)
      )
    );
  }

  // Under review count
  const byStatus = data?.byStatus || {};
  const review = byStatus['under-review'] || byStatus['underReview'] || 0;
  if (review > 0) {
    children.push(
      h(Box, { key: 'review', flexDirection: 'row', paddingLeft: 2 },
        dim('Review:'),
        h(Text, null, ' '),
        warning(String(review))
      )
    );
  }

  // Last generated (relative time)
  if (data?.lastGenerated) {
    const relTime = formatRelativeTime(data.lastGenerated);
    children.push(
      h(Box, { key: 'lastgen', flexDirection: 'row', paddingLeft: 2 },
        dim('Last gen:'),
        h(Text, null, ' '),
        muted(relTime)
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Context panel sub-component ─────────────────────────────────

const ContextPanelWidget = ({ labelText, data }) => {
  const children = [];

  children.push(
    h(Box, { key: 'ctx-label', paddingLeft: 2 }, muted(labelText))
  );

  if (!data || typeof data !== 'object') {
    children.push(
      h(Box, { key: 'ctx-empty', paddingLeft: 2 }, dim('(no context data)'))
    );
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  // Conversation ID (truncated)
  if (data.conversationId) {
    const shortId = String(data.conversationId).substring(0, 12);
    children.push(
      h(Box, { key: 'ctx-id', flexDirection: 'row', paddingLeft: 2 },
        dim('Conv:'),
        h(Text, null, ' '),
        muted(shortId)
      )
    );
  }

  // Iteration
  if (data.iteration !== undefined) {
    children.push(
      h(Box, { key: 'ctx-iter', flexDirection: 'row', paddingLeft: 2 },
        dim('Iteration:'),
        h(Text, null, ' '),
        primary(String(data.iteration))
      )
    );
  }

  // Message count
  const msgCount = data.messageCount || 0;
  children.push(
    h(Box, { key: 'ctx-msgs', flexDirection: 'row', paddingLeft: 2 },
      dim('Messages:'),
      h(Text, null, ' '),
      primary(String(msgCount))
    )
  );

  // Token usage with bar
  const estimated = data.estimatedTokens || 0;
  if (estimated > 0) {
    const maxTokens = 128000; // reasonable display max
    const pct = Math.min(100, Math.round((estimated / maxTokens) * 100));
    children.push(
      h(Box, { key: 'ctx-tokens', flexDirection: 'row', paddingLeft: 2 },
        dim('Tokens:'),
        h(Text, null, ' '),
        T(progressColor(pct), progressBar(pct, 10)),
        h(Text, null, ' '),
        muted(estimated.toLocaleString())
      )
    );

    // System vs history breakdown
    const sys = data.systemTokens || 0;
    const hist = data.historyTokens || 0;
    if (sys > 0 || hist > 0) {
      children.push(
        h(Box, { key: 'ctx-breakdown', flexDirection: 'row', paddingLeft: 4 },
          dim('sys:' + sys.toLocaleString()),
          h(Text, null, '  '),
          dim('hist:' + hist.toLocaleString())
        )
      );
    }
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Widget dispatcher ───────────────────────────────────────────

const renderWidget = (widget, session) => {
  const config = widget.config || {};

  switch (widget.type) {
    case 'progress-bar': {
      const labelText = config.label || 'Progress';
      const current = resolvePath(session, config.current) || 0;
      const max = resolvePath(session, config.max) || 1;
      return h(ProgressBarWidget, {
        key: 'w-' + widget.id,
        labelText,
        current,
        max,
        showPercent: config.showPercentage !== false,
      });
    }

    case 'counter': {
      const labelText = config.label || 'Count';
      const value = resolvePath(session, config.value) || 0;
      const max = config.max ? resolvePath(session, config.max) : null;
      return h(CounterWidget, {
        key: 'w-' + widget.id,
        labelText,
        value,
        max,
      });
    }

    case 'score-chart': {
      const labelText = config.label || 'Score';
      const data = resolvePath(session, config.data) || [];
      const threshold = config.threshold ? resolvePath(session, config.threshold) : null;
      return h(ScoreChartWidget, {
        key: 'w-' + widget.id,
        labelText,
        values: data,
        threshold,
      });
    }

    case 'status-list': {
      const labelText = config.label || 'Status';
      const items = resolvePath(session, config.items) || [];
      return h(StatusListWidget, {
        key: 'w-' + widget.id,
        labelText,
        items,
      });
    }

    case 'fitness-summary': {
      const labelText = config.label || 'Fitness';
      const data = resolvePath(session, config.data) || {};
      return h(FitnessSummaryWidget, {
        key: 'w-' + widget.id,
        labelText,
        data,
      });
    }

    case 'knowledge-status': {
      const labelText = config.label || 'Knowledge Base';
      const data = resolvePath(session, config.data) || {};
      return h(KnowledgeStatusWidget, {
        key: 'w-' + widget.id,
        labelText,
        data,
      });
    }

    case 'context-panel': {
      const labelText = config.label || 'Context Window';
      const data = resolvePath(session, config.data) || {};
      return h(ContextPanelWidget, {
        key: 'w-' + widget.id,
        labelText,
        data,
      });
    }

    default:
      return h(Box, { key: 'w-' + widget.id, paddingLeft: 2 },
        dim('Unknown widget: ' + widget.type)
      );
  }
};

// ── Default widgets (from session variables) ────────────────────

const DefaultWidgets = ({ session }) => {
  const vars = session?.variables || {};
  const children = [];

  // Fitness/Score widget
  const fitness = vars.currentFitness || vars.fitness;
  const target = vars.targetFitness || vars.target || vars.qualityThreshold;

  if (fitness !== undefined) {
    children.push(
      h(ProgressBarWidget, {
        key: 'default-fitness',
        labelText: 'Fitness Score',
        current: fitness,
        max: target || 1,
        showPercent: true,
      })
    );
    children.push(h(Box, { key: 'gap-fitness', height: 1 }));
  }

  // Iteration widget
  const iteration = vars.currentIteration || vars.iteration;
  const maxIterations = vars.maxIterations;

  if (iteration !== undefined) {
    children.push(
      h(CounterWidget, {
        key: 'default-iter',
        labelText: 'Iteration',
        value: iteration,
        max: maxIterations,
      })
    );
    children.push(h(Box, { key: 'gap-iter', height: 1 }));
  }

  // Score history widget
  const scoreHistory = vars.scoreHistory;
  if (Array.isArray(scoreHistory) && scoreHistory.length > 0) {
    children.push(
      h(ScoreChartWidget, {
        key: 'default-score',
        labelText: 'Score History',
        values: scoreHistory,
        threshold: target,
      })
    );
    children.push(h(Box, { key: 'gap-score', height: 1 }));
  }

  // Phase widget
  const phase = vars.currentPhase || vars.phase;
  if (phase !== undefined) {
    children.push(
      h(Box, { key: 'default-phase', flexDirection: 'column' },
        h(Box, { key: 'phase-label', paddingLeft: 2 }, muted('Phase')),
        h(Box, { key: 'phase-value', paddingLeft: 2 }, primary(String(phase)))
      )
    );
    children.push(h(Box, { key: 'gap-phase', height: 1 }));
  }

  // Phase 36-E: Auto-detect conversation context state variables
  const contextKeys = Object.keys(vars).filter(k => k.startsWith('_conversationState_'));
  for (const key of contextKeys) {
    const blockId = key.replace('_conversationState_', '');
    const data = vars[key];
    if (data && typeof data === 'object') {
      children.push(
        h(ContextPanelWidget, {
          key: 'default-ctx-' + blockId,
          labelText: 'Context: ' + blockId.substring(0, 20),
          data,
        })
      );
      children.push(h(Box, { key: 'gap-ctx-' + blockId, height: 1 }));
    }
  }

  if (children.length === 0) {
    return dim('  (no widget data available)');
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Main component ──────────────────────────────────────────────

const WidgetsPanel = ({ session, context }) => {
  const widgets = session?.monitorWidgets || [];

  const children = [];

  if (widgets.length === 0) {
    // Show default widgets based on session variables
    children.push(h(DefaultWidgets, { key: 'defaults', session }));
  } else {
    for (let i = 0; i < widgets.length; i++) {
      const widget = widgets[i];
      try {
        children.push(renderWidget(widget, session));
      } catch (err) {
        children.push(
          h(Box, { key: 'werr-' + i, paddingLeft: 2 },
            error((widget.id || 'widget') + ': ' + err.message)
          )
        );
      }
      // Gap between widgets
      if (i < widgets.length - 1) {
        children.push(h(Box, { key: 'wgap-' + i, height: 1 }));
      }
    }
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 }, ...children);
};

export { WidgetsPanel };
