/**
 * Frame Capture — PTY-based terminal capture for visual gate testing.
 *
 * Spawns the TUI in a real pseudo-terminal (node-pty + ConPTY on Windows),
 * interprets ANSI output via @xterm/headless, and reads the terminal buffer
 * as text lines. This captures what a real user would see, unlike
 * ink-testing-library which operates in a fictional environment.
 *
 * Phase 43-A: Visual Gate Infrastructure
 */

import * as path from 'path';

// ── Types ────────────────────────────────────────────────────

export interface CaptureOptions {
  cols?: number;       // default 120
  rows?: number;       // default 40
  waitMs?: number;     // default 5000
  cwd?: string;        // default monorepo root
}

export interface Frame {
  lines: string[];     // text content per row
  text: string;        // all rows joined by \n
  timestamp: number;   // ms since process start
  cols: number;
  rows: number;
}

export interface KeystrokeStep {
  key: string;         // raw characters to write to PTY stdin
  label?: string;      // human-readable label (e.g. "press h for Home")
  waitMs: number;      // wait after keystroke before capture
}

// ── Helpers ──────────────────────────────────────────────────

function getMonorepoRoot(): string {
  // tests/ is inside packages/maestro-code/tests/
  // monorepo root is 3 levels up
  return path.resolve(__dirname, '..', '..', '..');
}

function readBuffer(term: any, rows: number): string[] {
  const lines: string[] = [];
  const buffer = term.buffer.active;
  for (let i = 0; i < rows; i++) {
    const line = buffer.getLine(i);
    lines.push(line ? line.translateToString(true) : '');
  }
  return lines;
}

/** Check if buffer has meaningful content (box-drawing chars = TUI rendered). */
function hasContent(lines: string[]): boolean {
  const text = lines.join('');
  return /[┌┐└┘│─╭╮╰╯]/.test(text);
}

/** Spawn a PTY process running maestro code --demo. */
function spawnDemoPty(ptyMod: any, cols: number, rows: number, root: string) {
  const isWin = process.platform === 'win32';
  const shell = isWin ? 'cmd.exe' : '/bin/bash';
  const shellArgs = isWin
    ? ['/c', 'node', 'packages/maestro-cli/index.js', 'code', '--demo', '--no-bell']
    : ['-c', 'node packages/maestro-cli/index.js code --demo --no-bell'];

  return ptyMod.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols, rows,
    cwd: root,
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' } as any,
  });
}

// ── Core capture functions ───────────────────────────────────

/**
 * Capture a single frame of the TUI in demo mode.
 * Spawns a real PTY, polls until content appears (or timeout), reads the buffer.
 * Polls every 500ms to detect when the TUI has rendered, up to waitMs total.
 */
export async function captureFrame(options: CaptureOptions = {}): Promise<Frame> {
  const pty = await import('node-pty');
  const { Terminal } = await import('@xterm/headless');

  const { cols = 120, rows = 40, waitMs = 5000, cwd } = options;
  const root = cwd || getMonorepoRoot();

  const proc = spawnDemoPty(pty, cols, rows, root);
  const term = new Terminal({ cols, rows, allowProposedApi: true });
  proc.onData((data: string) => term.write(data));

  const POLL_INTERVAL = 500;

  try {
    // Poll until content appears or we hit the timeout
    let elapsed = 0;
    while (elapsed < waitMs) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      elapsed += POLL_INTERVAL;
      const lines = readBuffer(term, rows);
      if (hasContent(lines) && elapsed >= 2000) {
        // Content found and at least 2s elapsed (ensure demo data populated)
        // Wait a bit more for final rendering
        await new Promise(r => setTimeout(r, 1000));
        elapsed += 1000;
        const finalLines = readBuffer(term, rows);
        return {
          lines: finalLines,
          text: finalLines.join('\n'),
          timestamp: elapsed,
          cols, rows,
        };
      }
    }
    // Timeout — return whatever we have
    const lines = readBuffer(term, rows);
    return {
      lines,
      text: lines.join('\n'),
      timestamp: elapsed,
      cols, rows,
    };
  } finally {
    proc.kill();
    term.dispose();
  }
}

/**
 * Capture a sequence of frames, injecting keystrokes between each.
 * Returns [initialFrame, ...frameAfterEachKeystroke].
 */
export async function captureSequence(
  steps: KeystrokeStep[],
  options: CaptureOptions = {},
): Promise<Frame[]> {
  const pty = await import('node-pty');
  const { Terminal } = await import('@xterm/headless');

  const { cols = 120, rows = 40, waitMs = 5000, cwd } = options;
  const root = cwd || getMonorepoRoot();
  const frames: Frame[] = [];
  let elapsed = 0;

  const proc = spawnDemoPty(pty, cols, rows, root);
  const term = new Terminal({ cols, rows, allowProposedApi: true });
  proc.onData((data: string) => term.write(data));

  const POLL_INTERVAL = 500;

  try {
    // Poll until initial content appears
    while (elapsed < waitMs) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      elapsed += POLL_INTERVAL;
      const lines = readBuffer(term, rows);
      if (hasContent(lines) && elapsed >= 2000) {
        await new Promise(r => setTimeout(r, 1000));
        elapsed += 1000;
        break;
      }
    }

    const initLines = readBuffer(term, rows);
    frames.push({
      lines: initLines,
      text: initLines.join('\n'),
      timestamp: elapsed,
      cols, rows,
    });

    // Execute each keystroke and capture
    // After pressing a key, Ink navigates to a new page. The screen
    // redraw involves: clear old content → render new content. On Windows
    // ConPTY, ANSI data arrives in multiple chunks via async events.
    // Strategy: wait a fixed period for the transition to complete, then
    // retry-read if the buffer is empty (caught mid-clear).
    for (const step of steps) {
      proc.write(step.key);

      // Primary wait: enough for keystroke + React state change + Ink redraw
      await new Promise(r => setTimeout(r, step.waitMs));
      elapsed += step.waitMs;

      // Read with retry: if buffer is empty (caught during screen clear),
      // wait and retry up to 3 times
      let lines = readBuffer(term, rows);
      let retries = 3;
      while (!hasContent(lines) && retries > 0) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        elapsed += POLL_INTERVAL;
        lines = readBuffer(term, rows);
        retries--;
      }

      frames.push({
        lines,
        text: lines.join('\n'),
        timestamp: elapsed,
        cols, rows,
      });
    }
  } finally {
    proc.kill();
    term.dispose();
  }

  return frames;
}

/**
 * Normalize dynamic content that would cause false diffs in golden file comparison.
 * Strips timestamps, UUIDs, animation characters, and trailing whitespace.
 */
export function normalizeFrame(text: string): string {
  return text
    // Timestamps: HH:MM:SS
    .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS')
    // ISO dates: 2026-02-25T10:00:00Z
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, 'YYYY-MM-DDTHH:MM:SSZ')
    // Full UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    // Short hex IDs (8 chars)
    .replace(/\b[0-9a-f]{8}\b/gi, 'HEXID')
    // Animation characters (breathing dots, spinners)
    .replace(/[●◉◌○◍⊙⊚⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '*')
    // Trailing whitespace per line
    .split('\n').map(l => l.trimEnd()).join('\n');
}
