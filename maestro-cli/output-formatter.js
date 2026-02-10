'use strict';

/**
 * OutputFormatter - Abstraction layer for CLI output.
 *
 * In text mode (default): outputs human-readable text with emojis and tables.
 * In JSON mode (--json): outputs structured JSON on stdout, one object per line.
 *
 * This ensures agents receive parseable JSON while humans get readable output.
 */
class OutputFormatter {
  constructor(jsonMode = false) {
    this.jsonMode = jsonMode;
    this._command = null;
  }

  /**
   * Set the current command name for inclusion in JSON responses.
   * @param {string} command - e.g. "session.create", "health"
   */
  setCommand(command) {
    this._command = command;
  }

  /**
   * Output a successful result.
   * @param {*} data - The data payload (object, array, string, number, etc.)
   * @param {string} [message] - Human-readable message (displayed in text mode, included in JSON)
   */
  success(data, message = null) {
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
   * @param {string} message - Error message
   * @param {string} [code] - Machine-readable error code (e.g. "NOT_FOUND", "PARSE_ERROR")
   * @param {string} [details] - Additional details (e.g. HTTP status)
   */
  error(message, code = null, details = null) {
    if (this.jsonMode) {
      this._writeJson({ status: 'error', code: code || 'ERROR', message, details: details || null, command: this._command });
    } else {
      console.error(`\u274c ${message}`);
      if (details) console.error(`   ${details}`);
    }
  }

  /**
   * Output informational text (no main data payload).
   * @param {string} message - The information message
   */
  info(message) {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data: null, message, command: this._command });
    } else {
      console.log(message);
    }
  }

  /**
   * Output a table (array of objects).
   * @param {Array<Object>} rows - Array of row objects
   * @param {string} [message] - Optional header message for text mode
   */
  table(rows, message = null) {
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
   * @private
   */
  _writeJson(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
  }
}

module.exports = { OutputFormatter };
