/**
 * Visual Gate — Structural assertions + golden file comparison.
 *
 * Uses the PTY capture pipeline to validate the TUI renders correctly.
 * Structural assertions are the HARD gate (test fails).
 * Golden file comparison is a SOFT gate (warns but doesn't fail).
 *
 * Phase 43-B: Visual Gate
 * Phase 42-B: Enriched assertions (page content, positional, keyboard regression)
 *
 * Run: npm run test:visual
 * Or:  npx vitest run tests/visual-gate.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { captureFrame, captureSequence } from './frame-capture.ts';
import { compareGolden, checkStructure } from './golden-utils.ts';
import type { StructuralAssertion } from './golden-utils.ts';

// ── Warmup ───────────────────────────────────────────────────
// The first PTY spawn on Windows is slow due to ConPTY initialization.
// We do a short warmup capture that we discard.

let warmupDone = false;
beforeAll(async () => {
  if (!warmupDone) {
    console.log('Warming up PTY (first spawn is slow on Windows)...');
    try {
      await captureFrame({ waitMs: 5000 });
    } catch { /* ignore warmup errors */ }
    // Post-warmup pause: let ConPTY resources settle after kill
    await new Promise(r => setTimeout(r, 2000));
    warmupDone = true;
    console.log('Warmup complete.');
  }
}, 20000);

// ── Shared assertions ────────────────────────────────────────

const NAVBAR_ASSERTION: StructuralAssertion = {
  label: 'NavBar with MAESTRO title',
  pattern: 'MAESTRO',
  maxLine: 3,
};

const TASKBAR_ASSERTION: StructuralAssertion = {
  label: 'TaskInputBar visible',
  pattern: /Describe your task|Send|Press \/ to type|Agent is working/,
  minLine: 33,
};

const BORDERS_ASSERTION: StructuralAssertion = {
  label: 'Box borders present',
  pattern: /[┌┐└┘│─╭╮╰╯]/,
};

const STATUSBAR_ASSERTION: StructuralAssertion = {
  label: 'StatusBar at bottom',
  pattern: /page.*quit|select.*quit|\[q\]uit/,
  minLine: 37,
};

const NO_CRASH_ASSERTION: StructuralAssertion = {
  label: 'No stack trace in output',
  pattern: /at\s+\S+\s+\(.*:\d+:\d+\)/,
  required: false, // pass = pattern NOT found (we invert the check below)
};

// ── Page-specific assertions ─────────────────────────────────

// AgentScreen panels: AGENT STATUS, CONVERSATION, ACTIONS
const AGENT_PAGE_ASSERTIONS: StructuralAssertion[] = [
  NAVBAR_ASSERTION,
  { label: 'Agent tab indicator', pattern: /gent/ },
  { label: 'AGENT STATUS panel', pattern: 'AGENT STATUS' },
  { label: 'CONVERSATION panel', pattern: 'CONVERSATION' },
  { label: 'ACTIONS panel', pattern: 'ACTIONS' },
  TASKBAR_ASSERTION,
  STATUSBAR_ASSERTION,
  BORDERS_ASSERTION,
];

const HOME_PAGE_ASSERTIONS: StructuralAssertion[] = [
  NAVBAR_ASSERTION,
  { label: 'Home tab indicator', pattern: /ome/ },
  { label: 'SYSTEM STATUS panel', pattern: 'SYSTEM STATUS' },
  { label: 'ACTIVE SESSIONS panel', pattern: 'ACTIVE SESSIONS' },
  { label: 'QUICK ACTIONS panel', pattern: 'QUICK ACTIONS' },
  { label: 'Session data visible', pattern: /Cantante|sess-/ },
  STATUSBAR_ASSERTION,
  BORDERS_ASSERTION,
];

const SPACES_PAGE_ASSERTIONS: StructuralAssertion[] = [
  NAVBAR_ASSERTION,
  { label: 'Spaces tab indicator', pattern: /paces/ },
  { label: 'Tab selector', pattern: /Repos.*Workspaces.*Sessions/ },
  { label: 'SESSIONS panel', pattern: 'SESSIONS' },
  { label: 'Filter controls', pattern: /Filter.*\[r\].*(?:All|Running)/ },
  { label: 'Session count', pattern: /5 session/ },
  STATUSBAR_ASSERTION,
  BORDERS_ASSERTION,
];

const FOUNDRY_PAGE_ASSERTIONS: StructuralAssertion[] = [
  NAVBAR_ASSERTION,
  { label: 'Foundry tab indicator', pattern: /oundry/ },
  { label: 'MY BLOCKS panel', pattern: 'MY BLOCKS' },
  { label: 'Block count', pattern: /14 block/ },
  { label: 'Block type summary', pattern: /workflow.*agent.*tool|agent.*tool.*inference/ },
  STATUSBAR_ASSERTION,
  BORDERS_ASSERTION,
];

const CATALOG_PAGE_ASSERTIONS: StructuralAssertion[] = [
  NAVBAR_ASSERTION,
  { label: 'Catalog tab indicator', pattern: /atalog/ },
  { label: 'BLOCK CATALOG panel', pattern: 'BLOCK CATALOG' },
  { label: 'Type filter tabs', pattern: /All.*Workflows.*Agents.*Tools/ },
  { label: 'Block count', pattern: /14 block/ },
  { label: 'Fitness percentage', pattern: /\d+%/ },
  STATUSBAR_ASSERTION,
  BORDERS_ASSERTION,
];

const MODELS_PAGE_ASSERTIONS: StructuralAssertion[] = [
  NAVBAR_ASSERTION,
  { label: 'Models tab indicator', pattern: /odels/ },
  { label: 'MODEL STATUS panel', pattern: 'MODEL STATUS' },
  { label: 'METRICS panel', pattern: 'METRICS' },
  { label: 'QUEUE panel', pattern: 'QUEUE' },
  { label: 'AVAILABLE MODELS panel', pattern: 'AVAILABLE MODELS' },
  { label: 'Claude model visible', pattern: /claude-sonnet|Claude Sonnet/ },
  { label: 'Model count', pattern: /6 model/ },
  STATUSBAR_ASSERTION,
  BORDERS_ASSERTION,
];

// ── Helper ───────────────────────────────────────────────────

function logFailures(label: string, result: ReturnType<typeof checkStructure>) {
  const failures = result.results.filter(r => !r.pass);
  if (failures.length > 0) {
    console.log(`\n${label} — ${failures.length} structural failures:`);
    failures.forEach(f => console.log(`  FAIL: ${f.label} — ${f.detail}`));
  }
}

// ── Tests ────────────────────────────────────────────────────

describe('Visual Gate — Agent Page (initial render)', () => {
  it('has correct structure and conversation content', async () => {
    const frame = await captureFrame({ waitMs: 10000 });

    // Diagnostic: log frame stats
    const nonEmpty = frame.lines.filter(l => l.trim()).length;
    console.log(`Captured ${nonEmpty} non-empty lines at ${frame.timestamp}ms`);
    if (nonEmpty > 0) {
      frame.lines.slice(0, 5).forEach((l, i) => console.log(`  ${i}: ${l.substring(0, 80)}`));
    }

    // No stack traces (crash detection)
    const crashCheck = frame.lines.some(l => /at\s+\S+\s+\(.*:\d+:\d+\)/.test(l));
    if (crashCheck) {
      console.log('CRASH DETECTED — stack trace in output:');
      frame.lines.filter(l => /at\s+\S+\s+\(.*:\d+:\d+\)/.test(l)).forEach(l => console.log(`  ${l}`));
    }
    expect(crashCheck).toBe(false);

    // Structural assertions + conversation content
    const result = checkStructure(frame.lines, [
      ...AGENT_PAGE_ASSERTIONS,
      // Demo mode auto-started "Add login page" → ConversationLog should show it
      { label: 'Has conversation content', pattern: /login|Maestro|task|idle|working/ },
    ]);
    logFailures('Agent page', result);
    expect(result.pass).toBe(true);
  }, 20000);
});

describe('Visual Gate — Page Navigation', () => {
  it('navigates through all pages: h, s, f, c, m', async () => {
    const frames = await captureSequence(
      [
        { key: 'h', label: 'Home', waitMs: 3000 },
        { key: 's', label: 'Spaces', waitMs: 3000 },
        { key: 'f', label: 'Foundry', waitMs: 3000 },
        { key: 'c', label: 'Catalog', waitMs: 3000 },
        { key: 'm', label: 'Models', waitMs: 3000 },
      ],
      { waitMs: 12000 },
    );

    // Diagnostic: log first 3 lines of each frame
    const pageLabels = ['Agent (initial)', 'Home', 'Spaces', 'Foundry', 'Catalog', 'Models'];
    for (let i = 0; i < frames.length; i++) {
      const nonEmpty = frames[i].lines.filter(l => l.trim()).length;
      console.log(`\n${pageLabels[i]}: ${nonEmpty} non-empty lines`);
      frames[i].lines.slice(0, 3).forEach((l, j) => console.log(`  ${j}: ${l.substring(0, 80)}`));
    }

    // frames[0] = agent (initial), frames[1] = home, etc.
    const checks = [
      { name: 'Agent (initial)', assertions: AGENT_PAGE_ASSERTIONS, frame: frames[0] },
      { name: 'Home', assertions: HOME_PAGE_ASSERTIONS, frame: frames[1] },
      { name: 'Spaces', assertions: SPACES_PAGE_ASSERTIONS, frame: frames[2] },
      { name: 'Foundry', assertions: FOUNDRY_PAGE_ASSERTIONS, frame: frames[3] },
      { name: 'Catalog', assertions: CATALOG_PAGE_ASSERTIONS, frame: frames[4] },
      { name: 'Models', assertions: MODELS_PAGE_ASSERTIONS, frame: frames[5] },
    ];

    const failures: string[] = [];
    for (const check of checks) {
      const result = checkStructure(check.frame.lines, check.assertions);
      logFailures(check.name, result);
      if (!result.pass) {
        failures.push(check.name);
      }
    }

    if (failures.length > 0) {
      console.log(`\nNavigation failures: ${failures.join(', ')}`);
    }

    // Keyboard regression: verify navigation keys are NOT captured in TaskInputBar
    // Phase 42-B: The old bug showed "> hs", "> hsf", "> hsfc", "> hsfcm" in the input bar
    // The pattern: strip box-drawing borders, check for prompt + only nav key chars
    for (let i = 0; i < frames.length; i++) {
      const garbageLine = frames[i].lines.find(l => {
        const stripped = l.replace(/[│╭╰╮╯┌└┐┘─\s]/g, '');
        // Match: prompt char followed by 2+ nav key letters (the exact bug pattern)
        return /^[>\/][hsfcm]{2,}$/.test(stripped);
      });
      if (garbageLine) {
        console.log(`\nKEYBOARD BUG REGRESSION: Frame ${pageLabels[i]} has garbage in input bar:`);
        console.log(`  ${garbageLine}`);
      }
      expect(garbageLine).toBeUndefined();
    }

    expect(failures).toEqual([]);
  }, 45000);
});

describe('Visual Gate — Golden File Comparison (soft)', () => {
  it('agent page matches golden file (warning only)', async () => {
    const frame = await captureFrame({ waitMs: 10000 });
    const result = compareGolden('agent', frame.text);

    if (!result.match) {
      console.warn(`\nGolden file "agent.golden" has ${result.diffCount} line differences.`);
      console.warn('First 15 diff lines:');
      result.diffs.slice(0, 15).forEach(d => console.warn(`  ${d}`));
      if (result.diffCount > 5) {
        console.warn(`  ... and ${result.diffCount - 5} more`);
      }
      console.warn('\nTo update golden files: npx tsx tests/update-golden.ts');
    }

    // Soft assertion — log but don't fail
    // The structural assertions above are the hard gate
  }, 15000);
});
