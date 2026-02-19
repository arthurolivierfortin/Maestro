/**
 * OutputFormatter - Abstraction layer for CLI output.
 *
 * In text mode (default): outputs human-readable colored text.
 * In JSON mode (--json): outputs structured JSON on stdout, one object per line.
 *
 * This ensures agents receive parseable JSON while humans get readable output.
 */

import * as c from '../shared/utils/cli-colors.js';

interface JsonOutput {
  status: 'ok' | 'error';
  data?: unknown;
  message?: string | null;
  command?: string | null;
  code?: string | null;
  details?: string | null;
}

// Smart table column widths
const MAX_COL_WIDTH = 50;
const MIN_COL_WIDTH = 4;

// Empty column sentinel values — columns where ALL rows match these are hidden
const EMPTY_SENTINELS = new Set(['-', '—', '0', '', 'undefined', 'null', 'N/A']);

function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Format an ISO date string to a short human-readable format.
 * Returns "Feb 19 02:36" for recent dates, "2025-12-01" for older dates.
 */
function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sameYear = d.getFullYear() === now.getFullYear();
    const day = d.getDate();
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');

    if (sameYear) return `${month} ${day} ${hours}:${mins}`;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  } catch {
    return iso;
  }
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[m][n];
}

/**
 * Suggest the closest known command for a mistyped command.
 */
function suggestCommand(input: string, knownCommands: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const cmd of knownCommands) {
    const d = levenshtein(input.toLowerCase(), cmd.toLowerCase());
    if (d < bestDist && d <= 2) {
      bestDist = d;
      best = cmd;
    }
  }
  return best;
}

function formatTable(rows: Record<string, unknown>[], options?: { hideEmpty?: boolean }): string {
  if (!rows || rows.length === 0) return '';

  let keys = Object.keys(rows[0]);

  // Optionally hide columns where all values are empty/sentinel
  if (options?.hideEmpty) {
    keys = keys.filter(key => {
      return rows.some(r => {
        const v = String(r[key] ?? '');
        return !EMPTY_SENTINELS.has(v);
      });
    });
    if (keys.length === 0) return '';
  }

  // Calculate optimal column widths
  const widths: Record<string, number> = {};
  for (const key of keys) {
    const headerLen = key.length;
    const maxDataLen = Math.max(...rows.map(r => {
      const val = r[key];
      return String(val ?? '').length;
    }));
    widths[key] = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, headerLen, maxDataLen));
  }

  const lines: string[] = [];

  // Header
  const header = keys.map(k => c.bold(k.padEnd(widths[k]))).join('  ');
  lines.push('  ' + header);

  // Separator
  const sep = keys.map(k => c.gray('-'.repeat(widths[k]))).join('  ');
  lines.push('  ' + sep);

  // Rows
  for (const row of rows) {
    const cells = keys.map(k => {
      const val = String(row[k] ?? '');
      return truncate(val, widths[k]).padEnd(widths[k]);
    });
    lines.push('  ' + cells.join('  '));
  }

  return lines.join('\n');
}

class OutputFormatter {
  jsonMode: boolean;
  _command: string | null;

  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode;
    this._command = null;
  }

  /**
   * Set the current command name for inclusion in JSON responses.
   */
  setCommand(command: string): void {
    this._command = command;
  }

  /**
   * Output a successful result.
   * In text mode: show message only (no raw JSON dump).
   * In JSON mode: structured output.
   */
  success(data: unknown, message: string | null = null): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data, message: message || null, command: this._command });
    } else {
      if (message) console.log(message);
      // P1-9: Don't dump raw JSON in text mode — message should be sufficient
    }
  }

  /**
   * Output an error.
   */
  error(message: string, code: string | null = null, details: string | null = null): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'error', code: code || 'ERROR', message, details: details || null, command: this._command });
    } else {
      console.error(c.fail(message));
      if (details) console.error(c.gray(`   ${details}`));
    }
  }

  /**
   * Output informational text (no main data payload).
   */
  info(message: string): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data: null, message, command: this._command });
    } else {
      console.log(message);
    }
  }

  /**
   * Output a table (array of objects).
   * P2-20: Smart formatting with column width limits and truncation.
   * hideEmpty: hide columns where all values are empty/sentinel (-, —, 0, etc.)
   */
  table(rows: Record<string, unknown>[], message: string | null = null, options?: { hideEmpty?: boolean }): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data: rows, message: message || null, command: this._command });
    } else {
      if (message) console.log(message);
      if (rows && rows.length > 0) {
        console.log(formatTable(rows, options));
      } else {
        console.log(c.gray('  (no results)'));
      }
      console.log('');
    }
  }

  /**
   * Write a single JSON line to stdout (atomic, parseable).
   */
  private _writeJson(obj: JsonOutput): void {
    process.stdout.write(JSON.stringify(obj) + '\n');
  }
}

module.exports = { OutputFormatter, formatDate, levenshtein, suggestCommand };
export { OutputFormatter, formatDate, levenshtein, suggestCommand };
