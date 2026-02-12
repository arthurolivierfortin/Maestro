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

function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen - 3) + '...';
}

function formatTable(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return '';

  const keys = Object.keys(rows[0]);

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
   */
  table(rows: Record<string, unknown>[], message: string | null = null): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data: rows, message: message || null, command: this._command });
    } else {
      if (message) console.log(message);
      if (rows && rows.length > 0) {
        console.log(formatTable(rows));
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

module.exports = { OutputFormatter };
export { OutputFormatter };
