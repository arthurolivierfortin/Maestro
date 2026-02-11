/**
 * OutputFormatter - Abstraction layer for CLI output.
 *
 * In text mode (default): outputs human-readable text with emojis and tables.
 * In JSON mode (--json): outputs structured JSON on stdout, one object per line.
 *
 * This ensures agents receive parseable JSON while humans get readable output.
 */

interface JsonOutput {
  status: 'ok' | 'error';
  data?: unknown;
  message?: string | null;
  command?: string | null;
  code?: string | null;
  details?: string | null;
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
   */
  success(data: unknown, message: string | null = null): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data, message: message || null, command: this._command });
    } else {
      if (message) console.log(message);
      if (data !== undefined && data !== null) {
        if (Array.isArray(data)) {
          console.table(data);
        } else if (typeof data === 'object') {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(String(data));
        }
      }
    }
  }

  /**
   * Output an error.
   */
  error(message: string, code: string | null = null, details: string | null = null): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'error', code: code || 'ERROR', message, details: details || null, command: this._command });
    } else {
      console.error(`\u274c ${message}`);
      if (details) console.error(`   ${details}`);
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
   */
  table(rows: Record<string, unknown>[], message: string | null = null): void {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data: rows, message: message || null, command: this._command });
    } else {
      if (message) console.log(message);
      if (rows && rows.length > 0) {
        console.table(rows);
      } else {
        console.log('  (no results)');
      }
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
