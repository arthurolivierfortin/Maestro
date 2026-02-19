/**
 * CLI Colors — Zero-dependency ANSI color utility for terminal output.
 *
 * Maps the same color name strings used by shared/utils/status.ts and
 * shared/utils/progress.ts to ANSI escape codes.
 *
 * Respects NO_COLOR env (https://no-color.org) and non-TTY stdout.
 */

import { statusColor, statusIcon } from './status.js';

// ── ANSI escape codes ──────────────────────────────────────────

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

const ANSI_CODES: Record<string, string> = {
  // Colors
  black:   `${ESC}30m`,
  red:     `${ESC}31m`,
  green:   `${ESC}32m`,
  yellow:  `${ESC}33m`,
  blue:    `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan:    `${ESC}36m`,
  white:   `${ESC}37m`,
  gray:    `${ESC}90m`,
  grey:    `${ESC}90m`,

  // Styles
  bold:      `${ESC}1m`,
  dim:       `${ESC}2m`,
  italic:    `${ESC}3m`,
  underline: `${ESC}4m`,
};

// ── NO_COLOR / TTY detection ───────────────────────────────────

const supportsColor = (): boolean => {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  if (typeof process.stdout?.isTTY === 'boolean') return process.stdout.isTTY;
  return false;
};

const enabled = supportsColor();

// ── Core wrap function ─────────────────────────────────────────

/**
 * Wraps text in ANSI escape codes. Returns plain text if colors are disabled.
 */
const wrap = (code: string, text: string): string => {
  if (!enabled || !code) return text;
  return `${code}${text}${RESET}`;
};

/**
 * Apply a color by name (same names as statusColor/progressColor return).
 */
const colorize = (colorName: string, text: string): string => {
  return wrap(ANSI_CODES[colorName] || '', text);
};

// ── Public API ─────────────────────────────────────────────────

/** Color a string by color name. */
export const color = (name: string, text: string): string => colorize(name, text);

/** Named color shortcuts. */
export const red     = (text: string): string => colorize('red', text);
export const green   = (text: string): string => colorize('green', text);
export const yellow  = (text: string): string => colorize('yellow', text);
export const blue    = (text: string): string => colorize('blue', text);
export const magenta = (text: string): string => colorize('magenta', text);
export const cyan    = (text: string): string => colorize('cyan', text);
export const white   = (text: string): string => colorize('white', text);
export const gray    = (text: string): string => colorize('gray', text);

/** Style shortcuts. */
export const bold      = (text: string): string => wrap(ANSI_CODES.bold, text);
export const dim       = (text: string): string => wrap(ANSI_CODES.dim, text);
export const italic    = (text: string): string => wrap(ANSI_CODES.italic, text);
export const underline = (text: string): string => wrap(ANSI_CODES.underline, text);

/** Compose bold + color. */
export const boldColor = (name: string, text: string): string => {
  if (!enabled) return text;
  const code = ANSI_CODES[name] || '';
  return `${ANSI_CODES.bold}${code}${text}${RESET}`;
};

/**
 * Color text using a status string (delegates to statusColor() for the color name).
 * Example: status('running', 'In Progress') → cyan "In Progress"
 */
export const status = (statusStr: string, text: string): string => {
  return colorize(statusColor(statusStr), text);
};

/**
 * Status icon + text colored by status.
 * Example: statusLabel('done', 'Complete') → green "✓ Complete"
 */
export const statusLabel = (statusStr: string, text: string): string => {
  const icon = statusIcon(statusStr);
  const col = statusColor(statusStr);
  return colorize(col, `${icon} ${text}`);
};

/** Success prefix (green check). */
export const ok = (text: string): string => green(`\u2713 ${text}`);

/** Error prefix (red cross). */
export const fail = (text: string): string => red(`\u2717 ${text}`);

/** Warning prefix (yellow). */
export const warn = (text: string): string => yellow(`\u26A0 ${text}`);

/** Info prefix (cyan). */
export const info = (text: string): string => cyan(`\u2022 ${text}`);

/**
 * P3-30: Simple spinner for progress indication during API calls.
 * Returns an object with stop() method.
 */
export const spinner = (message: string): { stop: (finalMsg?: string) => void } => {
  if (!enabled) {
    console.log(message);
    return { stop: (finalMsg?: string) => { if (finalMsg) console.log(finalMsg); } };
  }

  const frames = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
  let i = 0;
  const interval = setInterval(() => {
    const frame = cyan(frames[i % frames.length]);
    process.stdout.write(`\r  ${frame} ${dim(message)}`);
    i++;
  }, 80);

  return {
    stop: (finalMsg?: string) => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(message.length + 10) + '\r');
      if (finalMsg) console.log(finalMsg);
    }
  };
};

/**
 * Namespace-style export for convenient usage:
 *   import * as c from '@shared/utils/cli-colors.js';
 *   console.log(c.green('success'));
 *   console.log(c.status('running', 'text'));
 */
