/**
 * Variables Component (Ink)
 *
 * Displays session variables with grouping.
 * - Filters out _prefixed (internal) variables
 * - Groups into Config / State / Other
 * - Formats values with colors: booleans (green/red), numbers (cyan, 0-1 as percent),
 *   arrays, objects, strings
 * - Shows group headers with separator lines
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  T, primary, secondary, muted, dim,
  theme,
} from '../theme.js';

// ── Variable grouping logic ─────────────────────────────────────

const CONFIG_KEYS = ['qualitythreshold', 'maxiterations', 'maxoptimizationrounds', 'targetfitness', 'threshold', 'target', 'max', 'min'];
const STATE_KEYS = ['currentphase', 'currentiteration', 'currentfitness', 'phase', 'iteration', 'fitness', 'status', 'score', 'scorehistory', 'result'];

const groupVariables = (vars) => {
  const groups = {
    'Config': {},
    'State': {},
    'Other': {},
  };

  for (const [key, value] of Object.entries(vars)) {
    const lowerKey = key.toLowerCase();

    if (CONFIG_KEYS.some(k => lowerKey.includes(k))) {
      groups['Config'][key] = value;
    } else if (STATE_KEYS.some(k => lowerKey.includes(k))) {
      groups['State'][key] = value;
    } else {
      groups['Other'][key] = value;
    }
  }

  return groups;
};

// ── Value formatting ────────────────────────────────────────────

const FormatValue = ({ value }) => {
  if (value === null || value === undefined) {
    return muted('null');
  }

  if (typeof value === 'boolean') {
    return value
      ? T('green', 'true')
      : T('red', 'false');
  }

  if (typeof value === 'number') {
    // Format 0-1 range as percentage
    if (value >= 0 && value <= 1) {
      const percent = Math.round(value * 100);
      const color = percent >= 80 ? 'green'
        : percent >= 50 ? 'yellow'
        : 'red';
      return h(Text, null,
        T(color, String(value)),
        h(Text, null, ' '),
        muted(`(${percent}%)`)
      );
    }
    return T('cyan', String(value));
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return dim('[]');
    }
    if (value.length <= 5) {
      const items = value.map(v =>
        typeof v === 'number' ? v.toFixed(2) : String(v)
      ).join(', ');
      return muted(`[${items}]`);
    }
    return muted(`[${value.length} items]`);
  }

  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    if (str.length > 30) {
      return muted(str.substring(0, 27) + '...');
    }
    return muted(str);
  }

  // String
  const str = String(value);
  if (str.length > 30) {
    return h(Text, null,
      primary(str.substring(0, 27)),
      dim('...')
    );
  }
  return primary(str);
};

// ── Group header ────────────────────────────────────────────────

const GroupHeader = ({ name }) => {
  return h(Box, { flexDirection: 'column', paddingLeft: 2 },
    muted(name),
    dim('\u2500'.repeat(name.length))
  );
};

// ── Variable row ────────────────────────────────────────────────

const VariableRow = ({ name, value }) => {
  return h(Box, { flexDirection: 'row', paddingLeft: 2 },
    secondary(name.padEnd(20)),
    h(Text, null, ' '),
    h(FormatValue, { value })
  );
};

// ── Main component ──────────────────────────────────────────────

const Variables = ({ session, context }) => {
  const vars = session?.variables || {};

  // Filter out internal variables (starting with _)
  const userVars = {};
  for (const [key, value] of Object.entries(vars)) {
    if (!key.startsWith('_')) {
      userVars[key] = value;
    }
  }

  const keys = Object.keys(userVars);

  if (keys.length === 0) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      dim('(no variables set)'),
      h(Box, { height: 1 }),
      dim('set with: maestro session vars <id> set <key> <value>')
    );
  }

  const groups = groupVariables(userVars);

  const children = [];

  for (const [groupName, groupVars] of Object.entries(groups)) {
    const groupKeys = Object.keys(groupVars);
    if (groupKeys.length === 0) continue;

    children.push(h(GroupHeader, { key: 'gh-' + groupName, name: groupName }));

    for (const [key, value] of Object.entries(groupVars)) {
      children.push(h(VariableRow, { key: 'var-' + key, name: key, value }));
    }

    children.push(h(Box, { key: 'gap-' + groupName, height: 1 }));
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 }, ...children);
};

export { Variables };
