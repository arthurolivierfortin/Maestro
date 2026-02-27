/**
 * Dogfood Navigation — Navigate maestro-code TUI like a real user.
 *
 * This script spawns the TUI in demo mode (no backend needed),
 * navigates through all pages, verifies layout integrity, tests
 * TaskInputBar focus, and reports results.
 *
 * Usage: npx tsx tests/dogfood-navigation.ts
 *
 * Phase 44-E: Comprehensive TUI navigation verification.
 */

import { TuiDriver } from './tui-driver.ts';
import type { Frame } from './tui-driver.ts';

// ── Assertions ────────────────────────────────────────────────

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

function checkFrame(frame: Frame, pageName: string): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. NavBar present with MAESTRO title
  const hasNavBar = frame.text.includes('MAESTRO');
  results.push({
    name: `${pageName}: NavBar has MAESTRO`,
    passed: hasNavBar,
    detail: hasNavBar ? undefined : 'MAESTRO title not found',
  });

  // 2. StatusBar present (bottom area with shortcuts)
  const hasStatusBar = frame.text.includes('quit') || frame.text.includes('Esc');
  results.push({
    name: `${pageName}: StatusBar present`,
    passed: hasStatusBar,
    detail: hasStatusBar ? undefined : 'StatusBar shortcuts not found',
  });

  // 3. No line overflows terminal width
  const overflows = frame.lines.filter(l => l.length > frame.cols);
  results.push({
    name: `${pageName}: No line overflow (${frame.cols} cols)`,
    passed: overflows.length === 0,
    detail: overflows.length > 0 ? `${overflows.length} lines overflow` : undefined,
  });

  // 4. Has box-drawing characters (TUI rendered)
  const hasTUI = /[┌┐└┘│─╭╮╰╯]/.test(frame.text);
  results.push({
    name: `${pageName}: TUI rendered`,
    passed: hasTUI,
    detail: hasTUI ? undefined : 'No box-drawing characters found',
  });

  return results;
}

function checkActiveTab(frame: Frame, expectedKey: string): CheckResult {
  // Active tab is rendered with bold/highlight bracket style
  // The hotkey pattern: [X] where X is the first letter
  // When active, it's rendered with the focus color
  // We can detect by checking if the page name panel/content is visible
  const pageContent: Record<string, RegExp> = {
    H: /SYSTEM STATUS|ACTIVE SESSIONS|Quick Actions/,
    A: /AGENT STATUS|CONVERSATION/,
    S: /SESSIONS|WORKSPACES|REPOS|Repos|Workspaces|Sessions/,
    F: /MY BLOCKS|FOUNDRY/,
    C: /BLOCK CATALOG/,
    M: /MODELS|AVAILABLE MODELS/,
  };

  const expected = pageContent[expectedKey];
  if (!expected) {
    return { name: `Tab ${expectedKey}: content check`, passed: false, detail: 'Unknown page key' };
  }

  const hasContent = expected.test(frame.text);
  return {
    name: `Tab [${expectedKey}]: correct page content`,
    passed: hasContent,
    detail: hasContent ? undefined : `Expected content for ${expectedKey} not found`,
  };
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('\n[nav] Maestro Code — Navigation Test');
  console.log('[nav] Spawning TUI in DEMO mode...\n');

  const driver = new TuiDriver(120, 40);
  const allResults: CheckResult[] = [];

  try {
    // 1. Spawn in demo mode
    await driver.spawn('demo');
    const initial = await driver.waitForRender(15000);

    if (!initial.text.includes('MAESTRO')) {
      console.error('[nav] FATAL: TUI did not render. Aborting.');
      TuiDriver.printFrame(initial, 'Failed Initial Render');
      return;
    }

    console.log('[nav] TUI rendered successfully.\n');

    // 2. Check initial page (Agent)
    allResults.push(...checkFrame(initial, 'Agent (initial)'));
    allResults.push(checkActiveTab(initial, 'A'));

    // 3. Navigate through all pages
    const pages: [string, string][] = [
      ['H', 'Home'],
      ['S', 'Spaces'],
      ['F', 'Foundry'],
      ['C', 'Catalog'],
      ['M', 'Models'],
      ['A', 'Agent (return)'],
    ];

    for (const [key, label] of pages) {
      console.log(`[nav] Pressing ${key} → ${label}...`);
      driver.press(key.toLowerCase());
      await new Promise(r => setTimeout(r, 1500));
      const frame = driver.captureFrame();
      allResults.push(...checkFrame(frame, label));
      allResults.push(checkActiveTab(frame, key));
    }

    // 4. Test TaskInputBar focus
    console.log('\n[nav] Testing TaskInputBar focus...');

    // Press / to focus
    driver.press('/');
    await new Promise(r => setTimeout(r, 500));
    const focusedFrame = driver.captureFrame();
    const hasFocusPrompt = focusedFrame.text.includes('Describe your task') || focusedFrame.text.includes('>');
    allResults.push({
      name: 'TaskInputBar: / focuses input',
      passed: hasFocusPrompt,
      detail: hasFocusPrompt ? undefined : 'Focus prompt not found after pressing /',
    });

    // Press Escape to unfocus
    driver.pressEscape();
    await new Promise(r => setTimeout(r, 500));
    const unfocusedFrame = driver.captureFrame();
    const hasUnfocusPrompt = unfocusedFrame.text.includes('Press / to type');
    allResults.push({
      name: 'TaskInputBar: Escape unfocuses',
      passed: hasUnfocusPrompt,
      detail: hasUnfocusPrompt ? undefined : '"Press / to type" not found after Escape',
    });

    // 5. Check StatusBar connection status
    const statusFrame = driver.captureFrame();
    const hasConnecting = statusFrame.text.includes('connecting');
    const hasConnected = statusFrame.text.includes('connected');
    allResults.push({
      name: 'StatusBar: shows "connected" in demo mode',
      passed: hasConnected && !hasConnecting,
      detail: hasConnecting ? 'Still showing "connecting"' : (hasConnected ? undefined : 'Neither connecting nor connected found'),
    });

    // ── Report ──────────────────────────────────────────────
    console.log('\n[nav] ═══════════════════════════════════════');
    console.log('[nav]  NAVIGATION TEST RESULTS');
    console.log('[nav] ═══════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    for (const r of allResults) {
      const icon = r.passed ? '✓' : '✗';
      const color = r.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`  ${color}${icon}\x1b[0m ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
      if (r.passed) passed++;
      else failed++;
    }

    console.log(`\n[nav] ${passed} passed, ${failed} failed, ${allResults.length} total`);

    if (failed > 0) {
      console.log('\n[nav] FAILED CHECKS:');
      for (const r of allResults.filter(r => !r.passed)) {
        console.log(`  ✗ ${r.name}: ${r.detail}`);
      }
    }

    console.log('');

  } catch (err: any) {
    console.error(`[nav] FATAL: ${err.message}`);
    try {
      const crashFrame = driver.captureFrame();
      TuiDriver.printFrame(crashFrame, 'Crash State');
    } catch { /* already dead */ }
  } finally {
    driver.kill();
    console.log('[nav] Done.');
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
