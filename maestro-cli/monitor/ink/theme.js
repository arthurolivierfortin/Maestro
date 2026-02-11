/**
 * Ink Theme — Single source of truth for all TUI styling.
 *
 * To restyle the monitor, change values here and everything updates.
 *
 * Sections:
 *   theme.bg / theme.fg          — Global defaults
 *   theme.text.*                  — Text color helpers
 *   theme.status.*                — Status-based colors (done, running, error, etc.)
 *   theme.access.*                — Filesystem access colors
 *   theme.panel.*                 — Panel borders, backgrounds, focus states
 *   theme.ui.*                    — Misc UI elements (labels, highlights)
 *   theme.layout.*                — Layout constants (header height, etc.)
 *
 * Convention: import { theme, icons, T, statusColor, ... } from '../theme.js';
 */

import { createElement as h } from 'react';
import { Text } from 'ink';

// ── Color palette ──────────────────────────────────────────────
//
// All colors in one place. Change these to restyle the entire monitor.
// Supports: named colors (red, green, cyan, gray, white, etc.),
// hex (#1a1a2e), and xterm-256 numbers.

const theme = {
  // Global background & foreground (applied via OSC 11 in App.js)
  bg: '#1e1e1e',           // dark gray (VS Code-style)
  fg: 'white',

  // Text semantic colors
  text: {
    primary: 'white',
    secondary: 'gray',
    muted: 'gray',
    dim: 'gray',            // used with dimColor: true
  },

  // Status-based colors (used by statusColor helper)
  status: {
    success: 'green',
    running: 'cyan',
    pending: 'gray',
    warning: 'yellow',
    error: 'red',
    paused: 'yellow',
  },

  // Filesystem access level colors
  access: {
    readWrite: 'green',
    readOnly: 'yellow',
    none: 'red',
    ignored: 'gray',
    active: 'cyan',
  },

  // Panel styling — the core of the visual system
  panel: {
    border: 'gray',         // inactive panel border
    borderFocused: 'cyan',  // focused panel border
    borderStyle: 'single',  // 'single', 'double', 'round', 'bold', 'classic'
    title: 'gray',          // inactive panel title
    titleFocused: 'cyan',   // focused panel title
    titleBold: true,         // whether panel titles are bold when focused
    bg: null,               // panel background (null = terminal default)
    bgFocused: null,        // focused panel background
    scrollIndicator: 'gray', // scroll indicator arrows color
  },

  // UI elements
  ui: {
    border: 'gray',         // generic border (backward compat)
    borderActive: 'cyan',   // active element border
    label: 'gray',          // section labels
    highlight: 'cyan',      // highlighted text
    separator: 'gray',      // horizontal/vertical separators
  },

  // Layout constants
  layout: {
    headerHeight: 9,        // fixed header height in rows (enough for 3 content lines + borders)
    statusBarHeight: 3,     // fixed status bar height
    borderWidth: 1,         // border chars (single=1)
  },

  // Tree navigation styling
  tree: {
    cursor: 'cyan',           // color of > selector and highlighted name
    expandIcon: 'gray',       // color of expand/collapse icons
    selectedBold: true,        // bold selected item text
  },

  // Keyboard shortcut display
  shortcut: {
    bracket: 'gray',        // [ ] around key
    key: 'cyan',            // the key character
    label: 'gray',          // label after key
    keyInactive: 'gray',    // inactive key
  },
};

// ── Icons (Unicode) ────────────────────────────────────────────

const icons = {
  done: '\u2713',           // ✓ checkmark
  running: '\u25CF',        // ● filled circle
  pending: '\u25CB',        // ○ empty circle
  failed: '\u2717',         // ✗ X
  paused: '\u2016',         // ‖ double bar

  branch: '\u251C\u2500',   // ├─
  lastBranch: '\u2514\u2500', // └─
  vertical: '\u2502',       // │
  expanded: '\u25BC',       // ▼
  collapsed: '\u25B6',      // ▶

  arrow: '\u2192',          // →
  arrowUp: '\u25B2',        // ▲
  arrowDown: '\u25BC',      // ▼
  dot: '\u2022',            // •
  connected: '\u25CF',      // ● (reuse filled circle)

  scrollUp: '\u25B2',       // ▲ scroll indicator
  scrollDown: '\u25BC',     // ▼ scroll indicator
  focus: '\u25C6',          // ◆ focus indicator
};

// ── Text helper: T(color, text, opts) ──────────────────────────
// Returns a <Text> React element. Use inside h() trees.
// T('cyan', 'hello')            => <Text color="cyan">hello</Text>
// T('green', 'ok', {bold:true}) => <Text color="green" bold>ok</Text>

const T = (color, text, opts = {}) => h(Text, { color, ...opts }, text);

// ── Shortcut helpers (return React elements) ───────────────────

const primary = (text) => T(theme.text.primary, text);
const secondary = (text) => T(theme.text.secondary, text);
const muted = (text) => T(theme.text.muted, text);
const dim = (text) => h(Text, { dimColor: true }, text);
const success = (text) => T(theme.status.success, text);
const running = (text) => T(theme.status.running, text);
const error = (text) => T(theme.status.error, text);
const warning = (text) => T(theme.status.warning, text);
const label = (text) => h(Text, { color: theme.ui.highlight, bold: true }, text);
const bold = (text) => h(Text, { bold: true }, text);
const highlight = (text) => T(theme.ui.highlight, text);

// ── Status helpers ─────────────────────────────────────────────

const statusColor = (status) => {
  const map = {
    done: theme.status.success, completed: theme.status.success, success: theme.status.success,
    running: theme.status.running, active: theme.status.running,
    pending: theme.status.pending, waiting: theme.status.pending,
    failed: theme.status.error, error: theme.status.error,
    paused: theme.status.paused,
  };
  return map[(status || '').toLowerCase()] || theme.status.pending;
};

const statusIcon = (status) => {
  const map = {
    done: icons.done, completed: icons.done, success: icons.done,
    running: icons.running, active: icons.running,
    pending: icons.pending, waiting: icons.pending,
    failed: icons.failed, error: icons.failed,
    paused: icons.paused,
  };
  return map[(status || '').toLowerCase()] || icons.pending;
};

// ── Duration formatter ─────────────────────────────────────────

const formatDuration = (startedAt, completedAt) => {
  if (!startedAt) return '-';
  try {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
    if (diffMs < 3600000) {
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  } catch { return '-'; }
};

const formatTime = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '--:--:--'; }
};

const truncate = (str, max) => {
  if (!str) return '';
  const s = String(str);
  return s.length > max ? s.substring(0, max - 3) + '...' : s;
};

// ── Badge: [status] with colored label ─────────────────────────

const Badge = ({ status }) => {
  const col = statusColor(status);
  const labelMap = {
    done: 'done', completed: 'done', success: 'done',
    running: 'running', active: 'active',
    pending: '...', waiting: '...',
    failed: 'FAIL', error: 'ERR', paused: 'paused',
  };
  const text = labelMap[(status || '').toLowerCase()] || status;
  return h(Text, {},
    h(Text, { color: theme.shortcut.bracket }, '['),
    h(Text, { color: col }, text),
    h(Text, { color: theme.shortcut.bracket }, ']')
  );
};

// ── Sparkline renderer ─────────────────────────────────────────

const sparkline = (values, length = 12) => {
  const chars = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
  const nums = values.map(v => Number(v) || 0).slice(-length);
  if (nums.length === 0) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return nums.map(n => {
    const idx = Math.floor(((n - min) / range) * (chars.length - 1));
    return chars[Math.max(0, Math.min(chars.length - 1, idx))];
  }).join('');
};

// ── Progress bar string ────────────────────────────────────────

const progressBar = (percent, width = 16) => {
  const p = Math.min(100, Math.max(0, percent));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
};

const progressColor = (percent) =>
  percent >= 80 ? theme.status.success : percent >= 50 ? theme.status.warning : theme.status.error;

// ── Path resolver for widgets ──────────────────────────────────

const resolvePath = (session, pathStr) => {
  if (typeof pathStr === 'number') return pathStr;
  if (typeof pathStr !== 'string') return pathStr;
  if (pathStr.startsWith('$.variables.')) {
    return session.variables?.[pathStr.replace('$.variables.', '')];
  }
  if (pathStr.startsWith('$.')) {
    const parts = pathStr.substring(2).split('.');
    let current = session;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
  const num = Number(pathStr);
  return isNaN(num) ? pathStr : num;
};

// ── TypeBadge: [type] with colored label, dynamic width ─────

const typeBadgeColorMap = {
  workflow: 'cyan', agent: 'magenta', tool: 'green',
  template: 'yellow', prompt: 'blue', instruction: 'gray',
  decision: 'yellow', validator: 'red', trigger: 'magenta',
  inference: 'cyan', script: 'green', task: 'blue',
  'while': 'yellow', 'for-each': 'yellow', conditional: 'yellow',
  phase: 'magenta', node: 'gray',
};

const TypeBadge = ({ type }) => {
  const t = (type || 'unknown').toLowerCase();
  const color = typeBadgeColorMap[t] || 'gray';
  return h(Text, null,
    h(Text, { color }, '['),
    h(Text, { color }, t),
    h(Text, { color }, ']'),
  );
};

export {
  theme, icons,
  T, primary, secondary, muted, dim, success, running, error, warning, label, bold, highlight,
  statusColor, statusIcon,
  formatDuration, formatTime, truncate,
  Badge, TypeBadge, sparkline, progressBar, progressColor, resolvePath,
};
