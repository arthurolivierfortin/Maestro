/**
 * TuiDriver — Interactive PTY driver for dogfooding maestro-code.
 *
 * Maintains a persistent PTY session and provides methods to:
 * - Spawn the TUI in demo or real mode
 * - Send keystrokes and type text
 * - Capture frames (what the user sees)
 * - Wait for specific content to appear
 *
 * Built on the same node-pty + @xterm/headless stack as frame-capture.ts.
 *
 * Phase 44: Dogfooding infrastructure.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname_esm = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// ── Types ────────────────────────────────────────────────────

export interface Frame {
  lines: string[];
  text: string;
  timestamp: number;
  cols: number;
  rows: number;
}

export interface SpawnOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  /** Real mode options */
  repo?: string;
  template?: string;
  entry?: string;
}

// ── TuiDriver ────────────────────────────────────────────────

export class TuiDriver {
  private proc: any = null;
  private term: any = null;
  private cols: number;
  private rows: number;
  private startTime: number = 0;

  constructor(cols = 120, rows = 40) {
    this.cols = cols;
    this.rows = rows;
  }

  // ── Lifecycle ──────────────────────────────────────────

  /**
   * Spawn the TUI in a real PTY.
   * mode='demo' → --demo --no-bell (no backend needed)
   * mode='real' → connects to running backend, uses specified template/entry
   */
  async spawn(mode: 'demo' | 'real', options: SpawnOptions = {}): Promise<void> {
    if (this.proc) throw new Error('TuiDriver already spawned. Call kill() first.');

    const pty = await import('node-pty');
    const { Terminal } = await import('@xterm/headless');

    const root = options.cwd || path.resolve(__dirname_esm, '..', '..', '..');
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : '/bin/bash';

    const args: string[] = ['node', 'packages/maestro-cli/index.js', 'code', '--no-bell'];

    if (mode === 'demo') {
      args.push('--demo');
    } else {
      if (options.repo) args.push('--repo', options.repo);
      if (options.template) args.push('--template', options.template);
      if (options.entry) args.push('--entry', options.entry);
    }

    const shellArgs = isWin
      ? ['/c', ...args]
      : ['-c', args.join(' ')];

    this.term = new Terminal({ cols: this.cols, rows: this.rows, allowProposedApi: true });

    this.proc = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: root,
      env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' } as any,
    });

    this.proc.onData((data: string) => { if (this.term) this.term.write(data); });
    this.startTime = Date.now();
  }

  /** Kill the PTY process and dispose the terminal. */
  kill(): void {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }
  }

  get isRunning(): boolean {
    return this.proc !== null;
  }

  // ── Input ──────────────────────────────────────────────

  /** Send raw characters to the PTY stdin. */
  sendKey(key: string): void {
    if (!this.proc) throw new Error('TuiDriver not spawned.');
    this.proc.write(key);
  }

  /** Type text character by character with a delay between each. */
  async typeText(text: string, delayMs = 30): Promise<void> {
    for (const char of text) {
      this.sendKey(char);
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  /** Press Enter (carriage return). */
  pressEnter(): void {
    this.sendKey('\r');
  }

  /** Press Escape. */
  pressEscape(): void {
    this.sendKey('\x1b');
  }

  /** Press a specific key by name. */
  press(key: 'enter' | 'escape' | 'tab' | 'up' | 'down' | 'left' | 'right' | 'backspace' | string): void {
    const keyMap: Record<string, string> = {
      enter: '\r',
      escape: '\x1b',
      tab: '\t',
      up: '\x1b[A',
      down: '\x1b[B',
      right: '\x1b[C',
      left: '\x1b[D',
      backspace: '\x7f',
    };
    this.sendKey(keyMap[key] || key);
  }

  // ── Capture ────────────────────────────────────────────

  /** Read the current terminal buffer as a Frame. */
  captureFrame(): Frame {
    if (!this.term) throw new Error('TuiDriver not spawned.');
    const buffer = this.term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < this.rows; i++) {
      const line = buffer.getLine(i);
      lines.push(line ? line.translateToString(true) : '');
    }
    return {
      lines,
      text: lines.join('\n'),
      timestamp: Date.now() - this.startTime,
      cols: this.cols,
      rows: this.rows,
    };
  }

  /** Check if the terminal has meaningful TUI content (box-drawing chars). */
  hasContent(): boolean {
    const frame = this.captureFrame();
    return /[┌┐└┘│─╭╮╰╯]/.test(frame.text);
  }

  // ── Wait helpers ───────────────────────────────────────

  /** Wait until TUI content appears (box-drawing characters detected). */
  async waitForRender(timeoutMs = 15000): Promise<Frame> {
    const pollInterval = 500;
    let elapsed = 0;
    while (elapsed < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval));
      elapsed += pollInterval;
      if (this.hasContent()) {
        // Wait a bit more for data to populate
        await new Promise(r => setTimeout(r, 1000));
        return this.captureFrame();
      }
    }
    return this.captureFrame();
  }

  /** Wait until a specific pattern appears on screen. */
  async waitForContent(pattern: RegExp | string, timeoutMs = 30000): Promise<Frame> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : pattern;
    const pollInterval = 500;
    let elapsed = 0;
    while (elapsed < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval));
      elapsed += pollInterval;
      const frame = this.captureFrame();
      if (regex.test(frame.text)) {
        return frame;
      }
    }
    // Timeout — return what we have
    return this.captureFrame();
  }

  /** Wait for the screen to stabilize (stop changing). */
  async waitForStable(stableDurationMs = 1000, timeoutMs = 15000): Promise<Frame> {
    const pollInterval = 300;
    let elapsed = 0;
    let lastText = '';
    let stableFor = 0;

    while (elapsed < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval));
      elapsed += pollInterval;
      const frame = this.captureFrame();
      const currentText = frame.text.replace(/[●◉◌○◍⊙⊚⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏*]/g, ''); // Ignore spinners

      if (currentText === lastText) {
        stableFor += pollInterval;
        if (stableFor >= stableDurationMs) {
          return frame;
        }
      } else {
        stableFor = 0;
        lastText = currentText;
      }
    }
    return this.captureFrame();
  }

  // ── Convenience ────────────────────────────────────────

  /** Print a frame to console with line numbers (for debugging). */
  static printFrame(frame: Frame, label?: string): void {
    if (label) console.log(`\n=== ${label} (${frame.timestamp}ms) ===`);
    const nonEmpty = frame.lines.filter(l => l.trim());
    nonEmpty.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2)}: ${l.substring(0, 120)}`));
    console.log(`  (${nonEmpty.length} non-empty lines)`);
  }

  /** Extract text content from a specific line range. */
  getLines(from: number, to: number): string[] {
    const frame = this.captureFrame();
    return frame.lines.slice(from, to);
  }
}
