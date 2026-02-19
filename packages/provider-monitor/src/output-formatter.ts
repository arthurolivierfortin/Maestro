import chalk from 'chalk';

/** Dual-mode output formatter (JSON or styled text) */
export class OutputFormatter {
  constructor(private jsonMode: boolean = false) {}

  success(data: unknown, message?: string): void {
    if (this.jsonMode) {
      console.log(JSON.stringify({ status: 'ok', message, data }, null, 2));
    } else {
      if (message) console.log(chalk.green(`\u2714 ${message}`));
      if (data) console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    }
  }

  error(message: string, code?: string): void {
    if (this.jsonMode) {
      console.log(JSON.stringify({ status: 'error', message, code }));
    } else {
      console.error(chalk.red(`\u2718 ${message}`));
      if (code) console.error(chalk.gray(`  Code: ${code}`));
    }
  }

  info(message: string): void {
    if (this.jsonMode) {
      console.log(JSON.stringify({ status: 'info', message }));
    } else {
      console.log(chalk.cyan(`\u2139 ${message}`));
    }
  }

  table(headers: string[], rows: string[][]): void {
    if (this.jsonMode) {
      const data = rows.map(row =>
        Object.fromEntries(headers.map((h, i) => [h, row[i]]))
      );
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // Calculate column widths
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
    );

    // Print header
    const headerLine = headers.map((h, i) => h.padEnd(widths[i]!)).join('  ');
    console.log(chalk.bold(headerLine));
    console.log(chalk.gray(widths.map(w => '\u2500'.repeat(w)).join('  ')));

    // Print rows
    for (const row of rows) {
      console.log(row.map((cell, i) => cell.padEnd(widths[i]!)).join('  '));
    }
  }
}
