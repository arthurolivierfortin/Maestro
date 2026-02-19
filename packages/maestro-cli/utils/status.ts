/**
 * Status helpers — pure functions for mapping status strings to colors and icons.
 *
 * Self-contained: uses inline color/icon maps (strings), not the TUI theme object.
 * The TUI theme re-exports these and wraps them with its own color system.
 */

/** Map of status strings to terminal color names. */
const STATUS_COLOR_MAP: Record<string, string> = {
  done: 'green',
  completed: 'green',
  success: 'green',
  running: 'cyan',
  active: 'cyan',
  pending: 'gray',
  waiting: 'gray',
  failed: 'red',
  error: 'red',
  paused: 'yellow',
};

/** Default color when status is unknown. */
const DEFAULT_STATUS_COLOR = 'gray';

/**
 * Returns a terminal color name for the given status string.
 */
export const statusColor = (status: string | null | undefined): string => {
  return STATUS_COLOR_MAP[(status || '').toLowerCase()] || DEFAULT_STATUS_COLOR;
};

/** Unicode icons for each status. */
const STATUS_ICON_MAP: Record<string, string> = {
  done: '\u2713',        // ✓
  completed: '\u2713',
  success: '\u2713',
  running: '\u25CF',     // ●
  active: '\u25CF',
  pending: '\u25CB',     // ○
  waiting: '\u25CB',
  failed: '\u2717',      // ✗
  error: '\u2717',
  paused: '\u2016',      // ‖
};

/** Default icon when status is unknown. */
const DEFAULT_STATUS_ICON = '\u25CB'; // ○

/**
 * Returns a Unicode icon character for the given status string.
 */
export const statusIcon = (status: string | null | undefined): string => {
  return STATUS_ICON_MAP[(status || '').toLowerCase()] || DEFAULT_STATUS_ICON;
};

/**
 * Map of block/node type names to terminal color names.
 * Used by TypeBadge components.
 */
export const typeBadgeColorMap: Record<string, string> = {
  workflow: 'cyan',
  agent: 'magenta',
  tool: 'green',
  template: 'yellow',
  prompt: 'blue',
  instruction: 'gray',
  decision: 'yellow',
  validator: 'red',
  trigger: 'magenta',
  inference: 'cyan',
  script: 'green',
  task: 'blue',
  'while': 'yellow',
  'for-each': 'yellow',
  conditional: 'yellow',
  phase: 'magenta',
  node: 'gray',
};
