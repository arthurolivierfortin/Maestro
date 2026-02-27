/**
 * Dogfood Script — Drive maestro-code TUI in real mode via PTY.
 *
 * This script spawns the TUI connected to the real backend,
 * types a task into the TaskInputBar, submits it, and captures
 * the result. This is the real dogfooding — no mocks, no headless.
 *
 * Phase 45-A: Updated for persistent session architecture.
 * - Default template: maestro-assistant (system block agent)
 * - Default entry point: message
 * - Tests single message AND multi-message on same session
 *
 * Prerequisites: backend + LLM-Provider running on ports 5000/5010.
 *
 * Usage: npx tsx tests/dogfood-real.ts [task]
 *        npx tsx tests/dogfood-real.ts "Create a hello.ts file"
 *        npx tsx tests/dogfood-real.ts --multi  (test 2 consecutive messages)
 */

import { TuiDriver } from './tui-driver.ts';

const DEFAULT_TASK = 'List the files in C:/Cantante/src';

async function main() {
  const isMulti = process.argv.includes('--multi');
  const task = process.argv.filter(a => a !== '--multi')[2] || DEFAULT_TASK;
  const task2 = 'What is this project about?';

  console.log(`\n[dogfood] Task: "${task}"`);
  if (isMulti) console.log(`[dogfood] Task 2: "${task2}"`);
  console.log('[dogfood] Spawning maestro-code in REAL mode (backend required)...\n');

  const driver = new TuiDriver(120, 40);
  const checks: [string, boolean][] = [];

  try {
    // 1. Spawn TUI in real mode (no template/entry overrides — uses defaults)
    await driver.spawn('real', {
      repo: 'C:/Cantante',
    });

    // 2. Wait for initial render
    console.log('[dogfood] Waiting for TUI render...');
    const initial = await driver.waitForRender(20000);
    TuiDriver.printFrame(initial, 'Initial Render');

    // Check for NoBackendScreen
    if (initial.text.includes('Backend Not Available')) {
      console.error('\n[dogfood] ERROR: Backend not running! Start with: dev-scripts/dev-start.ps1 -BackendOnly');
      return;
    }

    checks.push(['MAESTRO navbar visible', initial.text.includes('MAESTRO')]);
    checks.push(['StatusBar visible', /connected|connecting/.test(initial.text)]);

    // 3. Press / to focus TaskInputBar
    console.log('\n[dogfood] Pressing / to focus input...');
    driver.press('/');
    await sleep(500);

    const focused = driver.captureFrame();
    checks.push(['TaskInputBar focused', focused.text.includes('Describe your task') || focused.text.includes('>')]);

    // 4. Type and submit task 1
    console.log(`[dogfood] Typing: "${task}"...`);
    await driver.typeText(task, 20);
    await sleep(300);
    driver.pressEnter();

    // 5. Wait for session creation
    console.log('[dogfood] Waiting for session creation...');
    const sessionFrame = await driver.waitForContent(/Session:|Creating session|Invoking/, 30000);
    TuiDriver.printFrame(sessionFrame, 'Session Created');

    // Extract session ID for persistence check
    const sessionMatch = sessionFrame.text.match(/Session:\s*([a-f0-9]{8})/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;
    checks.push(['Session created', !!sessionId]);
    if (sessionId) console.log(`[dogfood] Session ID: ${sessionId}`);

    // Check template used — should be maestro-assistant, not project-autonomous
    checks.push(['Template is maestro-assistant', sessionFrame.text.includes('maestro-assistant')]);
    checks.push(['Entry point is message', sessionFrame.text.includes('Invoking: message')]);

    // 6. Wait for agent completion (up to 120s)
    console.log('\n[dogfood] Waiting for agent to complete (up to 120s)...');
    const completedFrame = await driver.waitForContent(/Task completed|Error:/i, 120000);
    TuiDriver.printFrame(completedFrame, 'Agent Completed');

    checks.push(['Task completed visible', /Task completed/i.test(completedFrame.text)]);

    // 7. Check agent response visibility
    await sleep(2000);
    const finalFrame = driver.captureFrame();
    TuiDriver.printFrame(finalFrame, 'Final State');

    const hasAgentResponse = finalFrame.text.includes('Agent:');
    checks.push(['Agent response visible', hasAgentResponse]);

    // Check AGENT STATUS shows completed
    const hasCompleted = /completed/i.test(finalFrame.text);
    checks.push(['Agent state shows completed', hasCompleted]);

    // 8. Multi-message test (if --multi)
    if (isMulti) {
      console.log('\n[dogfood] === MULTI-MESSAGE TEST ===');
      console.log(`[dogfood] Sending second message: "${task2}"...`);

      // Focus input again
      driver.press('/');
      await sleep(500);

      // Type and submit task 2
      await driver.typeText(task2, 20);
      await sleep(300);
      driver.pressEnter();

      // Wait for invocation — should NOT show "Creating session..." again
      console.log('[dogfood] Waiting for second invocation...');
      const msg2Frame = await driver.waitForContent(/Invoking:|Session:|Creating/, 30000);
      TuiDriver.printFrame(msg2Frame, 'Message 2 Submitted');

      // Check session persistence: should see "Invoking:" without "Creating session..."
      // If we see "Creating session...", the session was NOT reused
      const msg2Text = msg2Frame.text;
      const reusedSession = msg2Text.includes('Invoking:') && !msg2Text.includes('Creating session');
      checks.push(['Session reused (no re-creation)', reusedSession]);

      // If session ID visible again, verify it's the same
      const session2Match = msg2Text.match(/Session:\s*([a-f0-9]{8})/);
      if (session2Match && sessionId) {
        checks.push(['Same session ID', session2Match[1] === sessionId]);
      }

      // Wait for second completion
      console.log('[dogfood] Waiting for second completion (up to 120s)...');
      const completed2 = await driver.waitForContent(/Task completed|Error:/i, 120000);
      TuiDriver.printFrame(completed2, 'Message 2 Completed');
      checks.push(['Second task completed', /Task completed/i.test(completed2.text)]);
    }

    // Summary
    console.log('\n[dogfood] === SUMMARY ===');
    console.log(`  Task: "${task}"`);
    console.log(`  Duration: ${Math.round((driver.captureFrame()).timestamp / 1000)}s`);

  } catch (err: any) {
    console.error(`\n[dogfood] FATAL: ${err.message}`);
    try {
      const crashFrame = driver.captureFrame();
      TuiDriver.printFrame(crashFrame, 'Crash State');
    } catch { /* already dead */ }
  } finally {
    driver.kill();

    // Print checks
    console.log('\n--- CHECKS ---');
    let passed = 0, failed = 0;
    for (const [name, ok] of checks) {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
      if (ok) passed++; else failed++;
    }
    console.log(`\n${passed}/${passed + failed} checks passed${failed > 0 ? ` (${failed} failed)` : ''}`);
    console.log('\n[dogfood] Done.');

    if (failed > 0) process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
