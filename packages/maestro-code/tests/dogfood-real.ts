/**
 * Dogfood Script — Drive maestro-code TUI in real mode via PTY.
 *
 * This script spawns the TUI connected to the real backend,
 * types a task into the TaskInputBar, submits it, and captures
 * the result. This is the real dogfooding — no mocks, no headless.
 *
 * Prerequisites: backend + LLM-Provider running on ports 5000/5010.
 *
 * Usage: npx tsx tests/dogfood-real.ts [task]
 *
 * Phase 44: Dogfooding Cantante + Jarvis
 */

import { TuiDriver } from './tui-driver.ts';

const DEFAULT_TASK = 'List the files in C:/Cantante/src';

async function main() {
  const task = process.argv[2] || DEFAULT_TASK;
  console.log(`\n[dogfood] Task: "${task}"`);
  console.log('[dogfood] Spawning maestro-code in REAL mode (backend required)...\n');

  const driver = new TuiDriver(120, 40);

  try {
    // 1. Spawn TUI in real mode
    await driver.spawn('real', {
      repo: 'C:/Cantante',
      template: 'jarvis',
      entry: 'ask',
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

    // Check for MAESTRO navbar
    if (!initial.text.includes('MAESTRO')) {
      console.error('\n[dogfood] WARNING: MAESTRO title not found in initial render.');
    }

    // 3. Press / to focus TaskInputBar
    console.log('\n[dogfood] Pressing / to focus input...');
    driver.press('/');
    await new Promise(r => setTimeout(r, 500));

    const focused = driver.captureFrame();
    // Verify we see the focused prompt
    if (focused.text.includes('Describe your task')) {
      console.log('[dogfood] TaskInputBar focused (> Describe your task...)');
    } else if (focused.text.includes('Press / to type')) {
      console.error('[dogfood] WARNING: TaskInputBar did NOT focus after /');
    }

    // 4. Type the task
    console.log(`[dogfood] Typing: "${task}"...`);
    await driver.typeText(task, 20);
    await new Promise(r => setTimeout(r, 300));

    const typed = driver.captureFrame();
    TuiDriver.printFrame(typed, 'After Typing');

    // 5. Press Enter to submit
    console.log('\n[dogfood] Pressing Enter to submit...');
    driver.pressEnter();

    // 6. Wait for session creation feedback
    console.log('[dogfood] Waiting for session creation...');
    const sessionFrame = await driver.waitForContent(/Session:|Creating session|Invoking/, 15000);
    TuiDriver.printFrame(sessionFrame, 'Session Created');

    // 7. Wait for agent completion
    console.log('\n[dogfood] Waiting for agent to complete (up to 120s)...');
    const completedFrame = await driver.waitForContent(/completed|Error:|error|step-complete/, 120000);
    TuiDriver.printFrame(completedFrame, 'Agent Completed');

    // 8. Final stable capture
    await new Promise(r => setTimeout(r, 2000));
    const finalFrame = await driver.waitForStable(2000, 10000);
    TuiDriver.printFrame(finalFrame, 'Final State');

    // Summary
    console.log('\n[dogfood] === SUMMARY ===');
    console.log(`  Task: "${task}"`);
    console.log(`  Duration: ${Math.round(finalFrame.timestamp / 1000)}s`);
    console.log(`  Has MAESTRO: ${finalFrame.text.includes('MAESTRO')}`);
    console.log(`  Has error: ${/Error:|error|crash/i.test(finalFrame.text)}`);
    console.log(`  Has completion: ${/completed|step-complete/i.test(finalFrame.text)}`);

  } catch (err: any) {
    console.error(`\n[dogfood] FATAL: ${err.message}`);
    // Capture whatever is on screen
    try {
      const crashFrame = driver.captureFrame();
      TuiDriver.printFrame(crashFrame, 'Crash State');
    } catch { /* already dead */ }
  } finally {
    driver.kill();
    console.log('\n[dogfood] Done.');
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
