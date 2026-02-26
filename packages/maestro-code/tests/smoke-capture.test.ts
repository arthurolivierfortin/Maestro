/**
 * Smoke test for the PTY capture pipeline.
 * Verifies that node-pty + @xterm/headless can spawn the TUI and read output.
 *
 * Phase 43-A: Visual Gate Infrastructure
 *
 * Run: npx vitest run tests/smoke-capture.test.ts
 */

import { describe, it, expect } from 'vitest';
import { captureFrame } from './frame-capture.ts';

describe('Smoke Capture — PTY pipeline works', () => {
  it('captures a non-empty frame from demo mode', async () => {
    const frame = await captureFrame({ waitMs: 5000 });

    // Buffer must not be empty
    const nonEmptyLines = frame.lines.filter(l => l.trim().length > 0);
    expect(nonEmptyLines.length).toBeGreaterThan(0);

    // Must contain at least one box-drawing character (panel borders)
    const hasBoxDrawing = /[┌┐└┘│─╭╮╰╯┤├┬┴┼╔╗╚╝║═]/.test(frame.text);
    expect(hasBoxDrawing).toBe(true);

    // Log a preview for debugging
    console.log(`Captured ${nonEmptyLines.length} non-empty lines (${frame.cols}x${frame.rows})`);
    console.log('First 5 lines:');
    frame.lines.slice(0, 5).forEach((l, i) => console.log(`  ${i}: ${l.substring(0, 100)}`));
  }, 15000); // 15s timeout — PTY spawn + 5s wait + cleanup
});
