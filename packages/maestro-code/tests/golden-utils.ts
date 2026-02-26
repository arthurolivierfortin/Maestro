/**
 * Golden file comparison + structural assertion utilities.
 *
 * Phase 43-B: Visual Gate
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeFrame } from './frame-capture.ts';

const GOLDEN_DIR = path.resolve(__dirname, '..', 'testdata');

// ── Golden file I/O ──────────────────────────────────────────

export function readGolden(name: string): string | null {
  const filePath = path.join(GOLDEN_DIR, `${name}.golden`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeGolden(name: string, content: string): void {
  if (!fs.existsSync(GOLDEN_DIR)) fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  const filePath = path.join(GOLDEN_DIR, `${name}.golden`);
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ── Golden file comparison ───────────────────────────────────

export interface DiffResult {
  match: boolean;
  diffs: string[];
  diffCount: number;
}

export function compareGolden(name: string, actualText: string): DiffResult {
  const golden = readGolden(name);
  if (golden === null) {
    return {
      match: false,
      diffs: [`Golden file "${name}.golden" not found. Run: npx tsx tests/update-golden.ts`],
      diffCount: 1,
    };
  }

  const normalizedActual = normalizeFrame(actualText);
  const normalizedGolden = normalizeFrame(golden);

  const actualLines = normalizedActual.split('\n');
  const goldenLines = normalizedGolden.split('\n');
  const diffs: string[] = [];

  const maxLines = Math.max(actualLines.length, goldenLines.length);
  for (let i = 0; i < maxLines; i++) {
    const a = actualLines[i] || '';
    const g = goldenLines[i] || '';
    if (a !== g) {
      diffs.push(`Line ${i + 1}:`);
      diffs.push(`  expected: ${JSON.stringify(g)}`);
      diffs.push(`  actual:   ${JSON.stringify(a)}`);
    }
  }

  return { match: diffs.length === 0, diffs, diffCount: Math.floor(diffs.length / 3) };
}

// ── Structural assertions ────────────────────────────────────

export interface StructuralAssertion {
  label: string;
  pattern: string | RegExp;
  required?: boolean;   // default true
  minLine?: number;     // pattern must appear on or after this line
  maxLine?: number;     // pattern must appear on or before this line
}

export interface StructuralResult {
  pass: boolean;
  results: Array<{ label: string; pass: boolean; detail: string }>;
}

/**
 * Check that expected text patterns exist in the captured frame.
 * This is the "hard gate" — structural assertions must pass.
 */
export function checkStructure(
  lines: string[],
  assertions: StructuralAssertion[],
): StructuralResult {
  const results: Array<{ label: string; pass: boolean; detail: string }> = [];
  let allPass = true;

  for (const assertion of assertions) {
    const { label, pattern, required = true, minLine, maxLine } = assertion;
    let found = false;
    let foundLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (minLine !== undefined && i < minLine) continue;
      if (maxLine !== undefined && i > maxLine) continue;

      const match = typeof pattern === 'string'
        ? lines[i].includes(pattern)
        : pattern.test(lines[i]);

      if (match) {
        found = true;
        foundLine = i;
        break;
      }
    }

    if (required && !found) {
      results.push({ label, pass: false, detail: `"${pattern}" not found in frame` });
      allPass = false;
    } else {
      results.push({
        label,
        pass: true,
        detail: found ? `Found at line ${foundLine + 1}` : 'Not found (optional)',
      });
    }
  }

  return { pass: allPass, results };
}
