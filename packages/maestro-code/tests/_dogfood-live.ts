/**
 * _dogfood-live.ts — Real dogfooding session with running backend.
 *
 * Spawns maestro-code in REAL mode, submits tasks, captures frames
 * at each step so Claude can visually inspect the results.
 *
 * Usage: npx tsx tests/_dogfood-live.ts "Your task here"
 *        npx tsx tests/_dogfood-live.ts  (default: simple greeting)
 */

import { TuiDriver } from './tui-driver.ts';

const task = process.argv[2] || 'Salut mon ami, comment vas-tu?';
const REPO = 'C:\\Cantante';

async function main() {
  console.log(`\n[dogfood] Task: "${task}"`);
  console.log(`[dogfood] Repo: ${REPO}`);
  console.log('[dogfood] Spawning TUI in REAL mode...\n');

  const driver = new TuiDriver(120, 40);

  try {
    await driver.spawn('real', { repo: REPO });

    // Step 1: Wait for initial render
    console.log('[dogfood] Waiting for TUI render...');
    const initial = await driver.waitForRender(15000);
    printFrame(initial, 'STEP 1: Initial Render');

    // Step 2: Check StatusBar
    const hasConnected = initial.text.includes('connected');
    const hasConnecting = initial.text.includes('connecting');
    console.log(`[dogfood] StatusBar: ${hasConnected ? 'connected ✓' : hasConnecting ? 'connecting ✗' : 'unknown ✗'}\n`);

    // Step 3: Focus TaskInputBar
    console.log('[dogfood] Pressing / to focus input...');
    driver.press('/');
    await sleep(500);
    const focused = driver.captureFrame();
    const hasFocus = focused.text.includes('Describe your task') || focused.text.includes('>');
    console.log(`[dogfood] Input focused: ${hasFocus ? '✓' : '✗'}\n`);

    // Step 4: Type the task
    console.log(`[dogfood] Typing: "${task}"...`);
    await driver.typeText(task, 20);
    await sleep(300);
    const typed = driver.captureFrame();
    printFrame(typed, 'STEP 4: Task Typed');

    // Step 5: Press Enter to submit
    console.log('[dogfood] Pressing Enter...');
    driver.pressEnter();

    // Step 6: Wait for session creation
    console.log('[dogfood] Waiting for session creation...');
    const sessionFrame = await driver.waitForContent(/Session:|Creating session/, 30000);
    printFrame(sessionFrame, 'STEP 6: Session Created');

    // Step 7: Wait for agent to work (up to 180s)
    console.log('[dogfood] Waiting for agent to complete (up to 180s)...');
    const completedFrame = await driver.waitForContent(/Task completed|Error:/i, 180000);
    printFrame(completedFrame, 'STEP 7: Agent Response');

    // Step 8: Wait for stability then final capture
    await sleep(2000);
    const finalFrame = driver.captureFrame();
    printFrame(finalFrame, 'STEP 8: Final State');

    // Check if agent response is visible
    const hasAgentResponse = finalFrame.text.includes('Agent:') || finalFrame.text.includes('✓');
    console.log(`\n[dogfood] Agent response visible: ${hasAgentResponse ? '✓' : '✗'}`);

  } catch (err: any) {
    console.error(`[dogfood] ERROR: ${err.message}`);
    try {
      const crash = driver.captureFrame();
      printFrame(crash, 'CRASH STATE');
    } catch { /* dead */ }
  } finally {
    driver.kill();
    console.log('\n[dogfood] Done.');
  }
}

function printFrame(frame: ReturnType<TuiDriver['captureFrame']>, label: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}  (${frame.timestamp}ms)`);
  console.log('='.repeat(80));
  const nonEmpty = frame.lines.map(l => l.trimEnd()).filter(l => l.length > 0);
  for (const line of nonEmpty) {
    console.log(line);
  }
  console.log(`(${nonEmpty.length} lines)\n`);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => { console.error(err); process.exit(1); });
