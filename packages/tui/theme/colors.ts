/**
 * Maestro Color Palette — Single source of truth for all colors.
 *
 * `palette` contains raw hex/named values.
 * `semantic` maps UI concepts to color names (used by both CLI and TUI).
 */

export const palette = {
  bg: '#1e1e1e',
  fg: '#ffffff',
  brand: '#00d8ff',
  accent: '#f5a623',
  agentAccent: '#a78bfa',
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
  muted: '#888888',
};

export const semantic = {
  text: {
    primary: 'white',
    secondary: 'gray',
    muted: 'gray',
    dim: 'gray',
  },
  status: {
    success: 'green',
    running: 'cyan',
    pending: 'gray',
    warning: 'yellow',
    error: 'red',
    paused: 'yellow',
  },
  access: {
    readWrite: 'green',
    readOnly: 'yellow',
    none: 'red',
    ignored: 'gray',
    active: 'cyan',
  },
  panel: {
    border: 'gray',
    borderFocused: 'cyan',
    title: 'gray',
    titleFocused: 'cyan',
  },
  agent: {
    idle: 'green',
    working: 'cyan',
    navigating: 'yellow',
    waiting: 'magenta',
    accent: '#a78bfa',
  },
  ui: {
    border: 'gray',
    borderActive: 'cyan',
    label: 'gray',
    highlight: 'cyan',
    separator: 'gray',
  },
  tree: {
    cursor: 'cyan',
    expandIcon: 'gray',
  },
  shortcut: {
    bracket: 'gray',
    key: 'cyan',
    label: 'gray',
    keyInactive: 'gray',
  },
};
