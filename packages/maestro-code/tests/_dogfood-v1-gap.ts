/**
 * Dogfooding script — V1 Feature Gap Analysis
 * Runs multiple iterations exploring different aspects of maestro-code.
 * Usage: npx tsx tests/_dogfood-v1-gap.ts [iteration]
 *
 * Iterations:
 *   1 - Demo mode: initial render + all pages
 *   2 - Demo mode: keyboard navigation flow
 *   3 - Demo mode: agent page + task submission
 *   4 - Real mode: initial render + home page
 *   5 - Real mode: agent task submission
 *   6 - Real mode: spaces page exploration
 *   7 - Real mode: catalog + foundry pages
 *   8 - Real mode: models page
 *   9 - Real mode: detail views (session, block)
 *  10 - UX polish: error states, edge cases, responsiveness
 */

import { TuiDriver, Frame } from './tui-driver';

const iteration = parseInt(process.argv[2] || '1', 10);
const REPO = 'C:\\Cantante';

function printFrame(frame: Frame, label: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${label}  (${frame.timestamp}ms, ${frame.cols}x${frame.rows})`);
  console.log('='.repeat(80));
  const nonEmpty = frame.lines.filter(l => l.trim());
  nonEmpty.forEach((l, i) => {
    console.log(`  ${String(i + 1).padStart(2)}: ${l.substring(0, 118)}`);
  });
  console.log(`  (${nonEmpty.length} non-empty lines)\n`);
}

function analyzeFrame(frame: Frame): string[] {
  const observations: string[] = [];
  const text = frame.text;

  // Check for common UI elements
  if (/loading|spinner|wait/i.test(text)) observations.push('Loading state visible');
  if (/error|fail|crash/i.test(text)) observations.push('Error state visible');
  if (/─|│|┌|┐|└|┘|╭|╮|╰|╯/.test(text)) observations.push('Box-drawing present');
  if (/\[.*\]/.test(text)) observations.push('Bracketed elements present');
  if (text.includes('/')) observations.push('Slash input prompt visible');

  // Check for page indicators
  const pages = ['Home', 'Agent', 'Spaces', 'Foundry', 'Catalog', 'Models'];
  for (const p of pages) {
    if (text.includes(p)) observations.push(`Page "${p}" referenced`);
  }

  return observations;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Iteration Runners ──────────────────────────────────────────

async function iteration1() {
  console.log('\n🔍 ITERATION 1: Demo Mode — Initial Render + All Pages');
  console.log('Goal: See what each page looks like, identify visual gaps\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('demo');
    const initial = await driver.waitForRender(10000);
    printFrame(initial, 'Initial Render (Agent page default)');

    // Navigate to each page
    const pages = [
      { key: 'h', name: 'Home' },
      { key: 'a', name: 'Agent' },
      { key: 's', name: 'Spaces' },
      { key: 'f', name: 'Foundry' },
      { key: 'c', name: 'Catalog' },
      { key: 'm', name: 'Models' },
    ];

    for (const page of pages) {
      driver.sendKey(page.key);
      await sleep(1500);
      const frame = driver.captureFrame();
      printFrame(frame, `Page: ${page.name} (key: ${page.key})`);
      console.log('  Observations:', analyzeFrame(frame).join(', '));
    }

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration2() {
  console.log('\n🔍 ITERATION 2: Demo Mode — Keyboard Navigation Flow');
  console.log('Goal: Test Tab cycling, arrow keys, Escape, slash focus\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('demo');
    await driver.waitForRender(10000);

    // Test slash focus
    driver.sendKey('/');
    await sleep(800);
    const slashFocus = driver.captureFrame();
    printFrame(slashFocus, 'After pressing / (input focus)');

    // Type something and press Escape
    await driver.typeText('hello test', 50);
    await sleep(500);
    const typed = driver.captureFrame();
    printFrame(typed, 'After typing "hello test"');

    // Press Escape to unfocus
    driver.press('escape');
    await sleep(800);
    const escaped = driver.captureFrame();
    printFrame(escaped, 'After Escape (should unfocus input)');

    // Navigate to home page and test Tab cycling
    driver.sendKey('h');
    await sleep(1000);

    driver.press('tab');
    await sleep(500);
    const tab1 = driver.captureFrame();
    printFrame(tab1, 'Home page — After Tab (panel cycle 1)');

    driver.press('tab');
    await sleep(500);
    const tab2 = driver.captureFrame();
    printFrame(tab2, 'Home page — After Tab (panel cycle 2)');

    // Test arrow keys on Spaces page
    driver.sendKey('s');
    await sleep(1000);
    const spaces = driver.captureFrame();
    printFrame(spaces, 'Spaces page');

    driver.press('down');
    await sleep(300);
    driver.press('down');
    await sleep(300);
    const scrolled = driver.captureFrame();
    printFrame(scrolled, 'Spaces — After 2x Down arrow');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration3() {
  console.log('\n🔍 ITERATION 3: Demo Mode — Agent Page + Task Submission');
  console.log('Goal: Test the core flow of submitting a task\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('demo');
    await driver.waitForRender(10000);

    // Go to agent page
    driver.sendKey('a');
    await sleep(1000);
    const agentPage = driver.captureFrame();
    printFrame(agentPage, 'Agent Page — Initial');

    // Focus input and submit a task
    driver.sendKey('/');
    await sleep(500);
    await driver.typeText('Add a login page with email and password', 30);
    await sleep(500);
    const beforeSubmit = driver.captureFrame();
    printFrame(beforeSubmit, 'Agent Page — Task typed before submit');

    // Submit with Enter
    driver.press('enter');
    await sleep(3000);
    const afterSubmit = driver.captureFrame();
    printFrame(afterSubmit, 'Agent Page — After submit (3s)');

    // Wait more for demo execution
    await sleep(5000);
    const afterWait = driver.captureFrame();
    printFrame(afterWait, 'Agent Page — After submit (8s total)');

    // Check if conversation log shows anything
    await sleep(5000);
    const finalState = driver.captureFrame();
    printFrame(finalState, 'Agent Page — Final state (13s total)');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration4() {
  console.log('\n🔍 ITERATION 4: Real Mode — Initial Render + Home Page');
  console.log('Goal: See real backend data, health checks, active sessions\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('real', { repo: REPO });
    const initial = await driver.waitForRender(15000);
    printFrame(initial, 'Real Mode — Initial Render');

    // Go to home
    driver.sendKey('h');
    await sleep(2000);
    const home = driver.captureFrame();
    printFrame(home, 'Real Mode — Home Page');

    // Wait for health data to load
    await sleep(3000);
    const homeLoaded = driver.captureFrame();
    printFrame(homeLoaded, 'Real Mode — Home Page (after data load)');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration5() {
  console.log('\n🔍 ITERATION 5: Real Mode — Agent Task Submission');
  console.log('Goal: Submit a real task and observe the full lifecycle\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Go to agent page
    driver.sendKey('a');
    await sleep(1500);
    const agent = driver.captureFrame();
    printFrame(agent, 'Real Mode — Agent Page');

    // Submit a simple task
    driver.sendKey('/');
    await sleep(300);
    await driver.typeText('List all files in the src directory', 30);
    await sleep(300);
    driver.press('enter');

    console.log('  Submitted task, polling for 30s...');

    // Poll every 5s
    for (let i = 1; i <= 6; i++) {
      await sleep(5000);
      const frame = driver.captureFrame();
      printFrame(frame, `Real Mode — ${i * 5}s after submit`);
    }

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration6() {
  console.log('\n🔍 ITERATION 6: Real Mode — Spaces Page Exploration');
  console.log('Goal: Browse repos, workspaces, sessions with real data\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Go to spaces
    driver.sendKey('s');
    await sleep(2000);
    const spaces = driver.captureFrame();
    printFrame(spaces, 'Real Mode — Spaces (default tab)');

    // Try tab 2 (workspaces)
    driver.sendKey('2');
    await sleep(1500);
    const workspaces = driver.captureFrame();
    printFrame(workspaces, 'Real Mode — Spaces Tab 2 (Workspaces)');

    // Try tab 3 (sessions)
    driver.sendKey('3');
    await sleep(1500);
    const sessions = driver.captureFrame();
    printFrame(sessions, 'Real Mode — Spaces Tab 3 (Sessions)');

    // Try scrolling
    driver.press('down');
    await sleep(300);
    driver.press('down');
    await sleep(300);
    driver.press('down');
    await sleep(300);
    const scrolled = driver.captureFrame();
    printFrame(scrolled, 'Real Mode — Spaces after scrolling down');

    // Try selecting (Enter)
    driver.press('enter');
    await sleep(2000);
    const detail = driver.captureFrame();
    printFrame(detail, 'Real Mode — After Enter on selection');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration7() {
  console.log('\n🔍 ITERATION 7: Real Mode — Catalog + Foundry Pages');
  console.log('Goal: Browse blocks, check fitness display, filters\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Catalog
    driver.sendKey('c');
    await sleep(2000);
    const catalog = driver.captureFrame();
    printFrame(catalog, 'Real Mode — Catalog Page');

    // Scroll through blocks
    for (let i = 0; i < 5; i++) {
      driver.press('down');
      await sleep(200);
    }
    await sleep(500);
    const scrolled = driver.captureFrame();
    printFrame(scrolled, 'Real Mode — Catalog after scrolling');

    // Try type filters (if they exist)
    driver.sendKey('2');
    await sleep(1000);
    const filtered = driver.captureFrame();
    printFrame(filtered, 'Real Mode — Catalog filter 2 (agents?)');

    driver.sendKey('3');
    await sleep(1000);
    const filtered2 = driver.captureFrame();
    printFrame(filtered2, 'Real Mode — Catalog filter 3 (tools?)');

    // Foundry
    driver.sendKey('f');
    await sleep(2000);
    const foundry = driver.captureFrame();
    printFrame(foundry, 'Real Mode — Foundry Page');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration8() {
  console.log('\n🔍 ITERATION 8: Real Mode — Models Page');
  console.log('Goal: See available models, health, active model\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Models
    driver.sendKey('m');
    await sleep(2000);
    const models = driver.captureFrame();
    printFrame(models, 'Real Mode — Models Page');

    // Wait for data
    await sleep(3000);
    const modelsLoaded = driver.captureFrame();
    printFrame(modelsLoaded, 'Real Mode — Models Page (loaded)');

    // Try scrolling through models
    for (let i = 0; i < 3; i++) {
      driver.press('down');
      await sleep(300);
    }
    const modelsScrolled = driver.captureFrame();
    printFrame(modelsScrolled, 'Real Mode — Models after scrolling');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration9() {
  console.log('\n🔍 ITERATION 9: Real Mode — Detail Views');
  console.log('Goal: Open session monitor, block detail, workspace detail\n');

  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Go to spaces → sessions tab
    driver.sendKey('s');
    await sleep(1500);
    driver.sendKey('3');
    await sleep(1500);
    const sessions = driver.captureFrame();
    printFrame(sessions, 'Sessions list');

    // Try to open first session
    driver.press('enter');
    await sleep(2000);
    const sessionDetail = driver.captureFrame();
    printFrame(sessionDetail, 'Session detail / monitor view');

    // Go back
    driver.press('escape');
    await sleep(1000);

    // Go to catalog → try to open a block
    driver.sendKey('c');
    await sleep(1500);
    driver.press('enter');
    await sleep(2000);
    const blockDetail = driver.captureFrame();
    printFrame(blockDetail, 'Block detail view');

    // Go back
    driver.press('escape');
    await sleep(1000);

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

async function iteration10() {
  console.log('\n🔍 ITERATION 10: UX Polish — Error States, Edge Cases');
  console.log('Goal: Test edge cases, small terminal, rapid input, help\n');

  // Test with small terminal
  const smallDriver = new TuiDriver(60, 20);
  try {
    await smallDriver.spawn('demo');
    await smallDriver.waitForRender(10000);
    const small = smallDriver.captureFrame();
    printFrame(small, 'Small terminal (60x20)');

    smallDriver.sendKey('h');
    await sleep(1000);
    const smallHome = smallDriver.captureFrame();
    printFrame(smallHome, 'Small terminal — Home');

    smallDriver.sendKey('q');
  } finally {
    smallDriver.kill();
  }

  // Test help (?) key
  const driver = new TuiDriver(120, 40);
  try {
    await driver.spawn('demo');
    await driver.waitForRender(10000);

    driver.sendKey('?');
    await sleep(1500);
    const help = driver.captureFrame();
    printFrame(help, 'Help overlay (? key)');

    // Close help
    driver.press('escape');
    await sleep(500);

    // Test rapid page switching
    for (const key of ['h', 's', 'c', 'm', 'f', 'a', 'h', 's']) {
      driver.sendKey(key);
      await sleep(200);
    }
    await sleep(1000);
    const rapid = driver.captureFrame();
    printFrame(rapid, 'After rapid page switching');

    // Test slash commands
    driver.sendKey('/');
    await sleep(300);
    await driver.typeText('/help', 30);
    driver.press('enter');
    await sleep(1500);
    const helpCmd = driver.captureFrame();
    printFrame(helpCmd, 'After /help command');

    // /new command
    driver.sendKey('/');
    await sleep(300);
    await driver.typeText('/new', 30);
    driver.press('enter');
    await sleep(1500);
    const newCmd = driver.captureFrame();
    printFrame(newCmd, 'After /new command');

    driver.sendKey('q');
  } finally {
    driver.kill();
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'#'.repeat(80)}`);
  console.log(`# MAESTRO-CODE V1 FEATURE GAP ANALYSIS — Iteration ${iteration}`);
  console.log(`# Date: ${new Date().toISOString()}`);
  console.log(`${'#'.repeat(80)}`);

  const runners: Record<number, () => Promise<void>> = {
    1: iteration1,
    2: iteration2,
    3: iteration3,
    4: iteration4,
    5: iteration5,
    6: iteration6,
    7: iteration7,
    8: iteration8,
    9: iteration9,
    10: iteration10,
  };

  const runner = runners[iteration];
  if (!runner) {
    console.error(`Unknown iteration: ${iteration}. Use 1-10.`);
    process.exit(1);
  }

  try {
    await runner();
    console.log(`\n✓ Iteration ${iteration} completed.`);
  } catch (err) {
    console.error(`\n✗ Iteration ${iteration} failed:`, err);
    process.exit(1);
  }
}

main();
