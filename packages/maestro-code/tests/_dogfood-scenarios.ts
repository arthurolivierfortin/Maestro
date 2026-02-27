/**
 * _dogfood-scenarios.ts — Comprehensive dogfooding: scenarios 2, 4, 5, 6 + discussion.
 *
 * Runs against the REAL backend. Both backend (5000) and LLM-Provider (5010)
 * must be running.
 *
 * Usage: npx tsx tests/_dogfood-scenarios.ts
 *        npx tsx tests/_dogfood-scenarios.ts --skip-long   (skip scenarios > 60s)
 */

import { TuiDriver } from './tui-driver.ts';
import type { Frame } from './tui-driver.ts';

const REPO = 'C:\\Cantante';
const skipLong = process.argv.includes('--skip-long');

// ── Helpers ──────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function printFrame(frame: Frame, label: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}  (${frame.timestamp}ms)`);
  console.log('='.repeat(80));
  const nonEmpty = frame.lines.map(l => l.trimEnd()).filter(l => l.length > 0);
  for (const line of nonEmpty) console.log(line);
  console.log(`(${nonEmpty.length} lines)\n`);
}

function check(label: string, ok: boolean): boolean {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  return ok;
}

interface ScenarioResult {
  name: string;
  result: 'PASS' | 'PARTIAL' | 'FAIL' | 'SKIP';
  timeMs: number;
  checks: { label: string; ok: boolean }[];
  notes: string[];
}

const results: ScenarioResult[] = [];

// ── Scenario 2: Real connection, no task ─────────────────────

async function scenario2(): Promise<ScenarioResult> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SCÉNARIO 2 : Connexion réelle (pas de tâche)               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const start = Date.now();
  const checks: { label: string; ok: boolean }[] = [];
  const notes: string[] = [];
  const driver = new TuiDriver(120, 40);

  try {
    await driver.spawn('real', { repo: REPO });

    // Wait for initial render on Agent page
    console.log('[S2] Waiting for Agent page...');
    const agent = await driver.waitForRender(15000);
    printFrame(agent, 'S2: Agent Page');

    const hasConnected = agent.text.includes('connected');
    checks.push({ label: 'StatusBar shows "connected"', ok: check('StatusBar shows "connected"', hasConnected) });

    const hasAgentStatus = agent.text.includes('AGENT STATUS');
    checks.push({ label: 'AGENT STATUS panel visible', ok: check('AGENT STATUS panel visible', hasAgentStatus) });

    const hasConversation = agent.text.includes('CONVERSATION');
    checks.push({ label: 'CONVERSATION panel visible', ok: check('CONVERSATION panel visible', hasConversation) });

    // Navigate to Home
    console.log('\n[S2] Pressing H → Home...');
    driver.press('h');
    await sleep(3000);
    const home = driver.captureFrame();
    printFrame(home, 'S2: Home Page');

    const homeHasContent = home.text.includes('SYSTEM STATUS') || home.text.includes('ACTIVE SESSIONS')
      || home.text.includes('session') || home.text.includes('SESSION') || home.text.includes('Home');
    checks.push({ label: 'Home page has content', ok: check('Home page has content', homeHasContent) });

    // Navigate to Spaces
    console.log('[S2] Pressing S → Spaces...');
    driver.press('s');
    await sleep(3000);
    const spaces = driver.captureFrame();
    printFrame(spaces, 'S2: Spaces Page');

    const hasSessionsList = spaces.text.includes('SESSIONS') || spaces.text.includes('session');
    checks.push({ label: 'Spaces shows sessions list', ok: check('Spaces shows sessions list', hasSessionsList) });

    // Navigate to Foundry
    console.log('[S2] Pressing F → Foundry...');
    driver.press('f');
    await sleep(3000);
    const foundry = driver.captureFrame();
    printFrame(foundry, 'S2: Foundry Page');

    const hasBlocks = foundry.text.includes('block') || foundry.text.includes('BLOCKS');
    checks.push({ label: 'Foundry shows blocks', ok: check('Foundry shows blocks', hasBlocks) });

    // Navigate to Catalog
    console.log('[S2] Pressing C → Catalog...');
    driver.press('c');
    await sleep(3000);
    const catalog = driver.captureFrame();
    printFrame(catalog, 'S2: Catalog Page');

    const hasCatalog = catalog.text.includes('CATALOG') || catalog.text.includes('block');
    checks.push({ label: 'Catalog shows blocks', ok: check('Catalog shows blocks', hasCatalog) });

    // Navigate to Models
    console.log('[S2] Pressing M → Models...');
    driver.press('m');
    await sleep(1000);
    const models = await driver.waitForContent(/MODEL|model|Status/, 8000);
    printFrame(models, 'S2: Models Page');

    const hasModels = models.text.includes('MODEL') || models.text.includes('model') || models.text.includes('Status');
    checks.push({ label: 'Models shows model info', ok: check('Models shows model info', hasModels) });

    // Return to Agent
    console.log('[S2] Pressing A → Agent...');
    driver.press('a');
    await sleep(1000);
    const agentReturn = await driver.waitForContent(/CONVERSATION|AGENT STATUS/, 5000);
    printFrame(agentReturn, 'S2: Agent Return');

    const agentIntact = agentReturn.text.includes('CONVERSATION') || agentReturn.text.includes('AGENT STATUS');
    checks.push({ label: 'Agent page intact after navigation', ok: check('Agent page intact after navigation', agentIntact) });

    const allOk = checks.every(c => c.ok);
    return { name: 'Connexion réelle (pas de tâche)', result: allOk ? 'PASS' : 'PARTIAL', timeMs: Date.now() - start, checks, notes };
  } catch (err: any) {
    notes.push(`Error: ${err.message}`);
    return { name: 'Connexion réelle (pas de tâche)', result: 'FAIL', timeMs: Date.now() - start, checks, notes };
  } finally {
    driver.kill();
  }
}

// ── Scenario 4: Navigation during execution ──────────────────

async function scenario4(): Promise<ScenarioResult> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SCÉNARIO 4 : Navigation pendant l\'exécution                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (skipLong) {
    console.log('[S4] SKIP (--skip-long)');
    return { name: 'Navigation pendant exécution', result: 'SKIP', timeMs: 0, checks: [], notes: ['Skipped'] };
  }

  const start = Date.now();
  const checks: { label: string; ok: boolean }[] = [];
  const notes: string[] = [];
  const driver = new TuiDriver(120, 40);

  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Submit a task
    const task = 'Add a comment at the top of src/utils/formatTime.ts saying "// Time formatting utility"';
    console.log(`[S4] Submitting task: "${task.slice(0, 60)}..."`);
    driver.press('/');
    await sleep(300);
    await driver.typeText(task, 15);
    driver.pressEnter();

    // Wait for session creation
    console.log('[S4] Waiting for session creation...');
    await driver.waitForContent(/Session:|Invoking/, 30000);
    await sleep(2000);

    // Capture agent state during execution
    const duringExec = driver.captureFrame();
    const hasWorking = duringExec.text.includes('working') || duringExec.text.includes('Processing');
    checks.push({ label: 'Agent shows working state', ok: check('Agent shows working state', hasWorking) });

    // Navigate to Home during execution
    console.log('[S4] Navigating to Home during execution...');
    driver.press('h');
    await sleep(2000);
    const homeDuring = driver.captureFrame();
    printFrame(homeDuring, 'S4: Home during execution');

    const homeHasContent = homeDuring.text.includes('Home') || homeDuring.text.includes('SESSIONS') || homeDuring.text.includes('session');
    checks.push({ label: 'Home page loads during execution', ok: check('Home page loads during execution', homeHasContent) });

    // Navigate to Spaces
    console.log('[S4] Navigating to Spaces...');
    driver.press('s');
    await sleep(2000);
    const spacesDuring = driver.captureFrame();
    const spacesOk = spacesDuring.text.includes('SESSIONS') || spacesDuring.text.includes('session');
    checks.push({ label: 'Spaces page loads during execution', ok: check('Spaces page loads during execution', spacesOk) });

    // Return to Agent
    console.log('[S4] Returning to Agent page...');
    driver.press('a');
    await sleep(2000);
    const agentBack = driver.captureFrame();
    printFrame(agentBack, 'S4: Agent after navigation');

    const historyPreserved = agentBack.text.includes('Creating session') || agentBack.text.includes('Session:');
    checks.push({ label: 'Conversation history preserved', ok: check('Conversation history preserved', historyPreserved) });

    const hasSteps = agentBack.text.includes('✓') || agentBack.text.includes('…');
    checks.push({ label: 'Steps visible after navigation', ok: check('Steps visible after navigation', hasSteps) });

    // Wait for completion (up to 180s from start)
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 180000 - elapsed);
    if (remaining > 0) {
      console.log(`[S4] Waiting for completion (up to ${Math.round(remaining/1000)}s)...`);
      await driver.waitForContent(/Task completed|Error:/i, remaining);
      await sleep(2000);
      const finalFrame = driver.captureFrame();
      const completed = finalFrame.text.includes('Task completed');
      checks.push({ label: 'Task completed visible', ok: check('Task completed visible', completed) });
    }

    const allOk = checks.every(c => c.ok);
    return { name: 'Navigation pendant exécution', result: allOk ? 'PASS' : 'PARTIAL', timeMs: Date.now() - start, checks, notes };
  } catch (err: any) {
    notes.push(`Error: ${err.message}`);
    return { name: 'Navigation pendant exécution', result: 'FAIL', timeMs: Date.now() - start, checks, notes };
  } finally {
    driver.kill();
  }
}

// ── Scenario 5: Conversational message ───────────────────────

async function scenario5(): Promise<ScenarioResult> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SCÉNARIO 5 : Message conversationnel (edge case)           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (skipLong) {
    console.log('[S5] SKIP (--skip-long)');
    return { name: 'Message conversationnel', result: 'SKIP', timeMs: 0, checks: [], notes: ['Skipped'] };
  }

  const start = Date.now();
  const checks: { label: string; ok: boolean }[] = [];
  const notes: string[] = [];
  const driver = new TuiDriver(120, 40);

  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Submit a conversational message
    const message = 'Salut, comment vas-tu?';
    console.log(`[S5] Submitting: "${message}"`);
    driver.press('/');
    await sleep(300);
    await driver.typeText(message, 20);
    driver.pressEnter();

    // Wait for session creation
    console.log('[S5] Waiting for session creation...');
    const sessionFrame = await driver.waitForContent(/Session:|Creating session/, 30000);

    const sessionCreated = sessionFrame.text.includes('Session:');
    checks.push({ label: 'Session created for conversational msg', ok: check('Session created for conversational msg', sessionCreated) });

    // Wait for completion (up to 180s)
    console.log('[S5] Waiting for agent response (up to 180s)...');
    const completedFrame = await driver.waitForContent(/Task completed|Error:/i, 180000);
    printFrame(completedFrame, 'S5: After agent response');

    const hasCompletion = completedFrame.text.includes('Task completed') || completedFrame.text.includes('Error:');
    checks.push({ label: 'Agent finishes (completed or error)', ok: check('Agent finishes (completed or error)', hasCompletion) });

    const hasResponse = completedFrame.text.includes('Agent:');
    checks.push({ label: 'Agent response visible', ok: check('Agent response visible', hasResponse) });

    const noCrash = !completedFrame.text.includes('FATAL') && !completedFrame.text.includes('Unhandled');
    checks.push({ label: 'No crash', ok: check('No crash', noCrash) });

    notes.push(`Time: ${Math.round((Date.now() - start) / 1000)}s`);

    const allOk = checks.every(c => c.ok);
    return { name: 'Message conversationnel', result: allOk ? 'PASS' : 'PARTIAL', timeMs: Date.now() - start, checks, notes };
  } catch (err: any) {
    notes.push(`Error: ${err.message}`);
    return { name: 'Message conversationnel', result: 'FAIL', timeMs: Date.now() - start, checks, notes };
  } finally {
    driver.kill();
  }
}

// ── Scenario 6: Consecutive tasks ────────────────────────────

async function scenario6(): Promise<ScenarioResult> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SCÉNARIO 6 : Deuxième tâche consécutive                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (skipLong) {
    console.log('[S6] SKIP (--skip-long)');
    return { name: 'Deuxième tâche consécutive', result: 'SKIP', timeMs: 0, checks: [], notes: ['Skipped'] };
  }

  const start = Date.now();
  const checks: { label: string; ok: boolean }[] = [];
  const notes: string[] = [];
  const driver = new TuiDriver(120, 40);

  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Task 1: Simple file creation
    const task1 = 'Create a file src/utils/clamp.ts exporting function clamp(val: number, min: number, max: number): number';
    console.log(`[S6] Task 1: "${task1.slice(0, 60)}..."`);
    driver.press('/');
    await sleep(300);
    await driver.typeText(task1, 12);
    driver.pressEnter();

    console.log('[S6] Waiting for task 1 completion (up to 180s)...');
    await driver.waitForContent(/Task completed|Error:/i, 180000);
    await sleep(3000);
    const afterTask1 = driver.captureFrame();
    printFrame(afterTask1, 'S6: After Task 1');

    const task1Completed = afterTask1.text.includes('Task completed');
    checks.push({ label: 'Task 1 completed', ok: check('Task 1 completed', task1Completed) });

    // Check history has task 1 content
    const hasTask1History = afterTask1.text.includes('clamp') || afterTask1.text.includes('Creating session');
    checks.push({ label: 'Task 1 history visible', ok: check('Task 1 history visible', hasTask1History) });

    // Task 2: Follow-up
    const task2 = 'Add a JSDoc comment to the clamp function in src/utils/clamp.ts';
    console.log(`\n[S6] Task 2: "${task2}"`);
    driver.press('/');
    await sleep(300);
    await driver.typeText(task2, 12);
    driver.pressEnter();

    // Check that a new session is created
    console.log('[S6] Waiting for task 2 session creation...');
    await driver.waitForContent(/Invoking:|Session started/, 30000);
    await sleep(2000);
    const duringTask2 = driver.captureFrame();
    printFrame(duringTask2, 'S6: During Task 2');

    // History should contain both tasks
    const hasBothTasks = duringTask2.text.includes('clamp') && duringTask2.text.includes('JSDoc');
    checks.push({ label: 'Both tasks visible in conversation', ok: check('Both tasks visible in conversation', hasBothTasks) });

    // Wait for task 2 completion
    console.log('[S6] Waiting for task 2 completion (up to 180s)...');
    const remaining = Math.max(0, 360000 - (Date.now() - start));
    await driver.waitForContent(/Task completed|Error:/i, remaining);
    await sleep(2000);
    const afterTask2 = driver.captureFrame();

    // Count "Task completed" occurrences
    const completedCount = (afterTask2.text.match(/Task completed/g) || []).length;
    checks.push({ label: 'Two "Task completed" messages', ok: check('Two "Task completed" messages', completedCount >= 2) });

    const allOk = checks.every(c => c.ok);
    return { name: 'Deuxième tâche consécutive', result: allOk ? 'PASS' : 'PARTIAL', timeMs: Date.now() - start, checks, notes };
  } catch (err: any) {
    notes.push(`Error: ${err.message}`);
    return { name: 'Deuxième tâche consécutive', result: 'FAIL', timeMs: Date.now() - start, checks, notes };
  } finally {
    driver.kill();
  }
}

// ── Scenario 7: Discussion with agent ────────────────────────

async function scenario7(): Promise<ScenarioResult> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SCÉNARIO 7 : Discussion avec l\'agent                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (skipLong) {
    console.log('[S7] SKIP (--skip-long)');
    return { name: 'Discussion avec l\'agent', result: 'SKIP', timeMs: 0, checks: [], notes: ['Skipped'] };
  }

  const start = Date.now();
  const checks: { label: string; ok: boolean }[] = [];
  const notes: string[] = [];
  const driver = new TuiDriver(120, 40);

  try {
    await driver.spawn('real', { repo: REPO });
    await driver.waitForRender(15000);

    // Turn 1: Ask a question about the project
    const msg1 = 'What is this project about? List the main technologies used.';
    console.log(`[S7] Turn 1: "${msg1}"`);
    driver.press('/');
    await sleep(300);
    await driver.typeText(msg1, 12);
    driver.pressEnter();

    console.log('[S7] Waiting for turn 1 session...');
    await driver.waitForContent(/Session:|Creating session/, 30000);

    const afterSubmit1 = driver.captureFrame();
    const msg1Visible = afterSubmit1.text.includes('What is this project');
    checks.push({ label: 'Turn 1 message visible in conversation', ok: check('Turn 1 message visible in conversation', msg1Visible) });

    const hasWorking = afterSubmit1.text.includes('working') || afterSubmit1.text.includes('Processing') || afterSubmit1.text.includes('Invoking');
    checks.push({ label: 'Agent starts working on turn 1', ok: check('Agent starts working on turn 1', hasWorking) });

    // Wait for turn 1 to complete
    console.log('[S7] Waiting for turn 1 response (up to 180s)...');
    const turn1Done = await driver.waitForContent(/Task completed|Error:/i, 180000);
    printFrame(turn1Done, 'S7: Turn 1 Response');

    const turn1Completed = turn1Done.text.includes('Task completed');
    checks.push({ label: 'Turn 1 completed', ok: check('Turn 1 completed', turn1Completed) });

    const hasAgentResponse1 = turn1Done.text.includes('Agent:');
    checks.push({ label: 'Turn 1 agent response visible', ok: check('Turn 1 agent response visible', hasAgentResponse1) });

    // Wait for idle state
    await sleep(4000);

    // Turn 2: Follow-up question (creates new session)
    const msg2 = 'Now explain the folder structure of this project briefly.';
    console.log(`\n[S7] Turn 2: "${msg2}"`);
    driver.press('/');
    await sleep(300);
    await driver.typeText(msg2, 12);
    driver.pressEnter();

    console.log('[S7] Waiting for turn 2 session...');
    await driver.waitForContent(/Invoking:|Session started/, 30000);
    await sleep(2000);

    const afterSubmit2 = driver.captureFrame();
    printFrame(afterSubmit2, 'S7: Turn 2 Submitted');

    // History should show both messages
    const hasTurn1Msg = afterSubmit2.text.includes('What is this project') || afterSubmit2.text.includes('Turn 1');
    const hasTurn2Msg = afterSubmit2.text.includes('folder structure');
    checks.push({ label: 'Turn 1 still visible in history', ok: check('Turn 1 still visible in history', hasTurn1Msg) });
    checks.push({ label: 'Turn 2 message visible', ok: check('Turn 2 message visible', hasTurn2Msg) });

    // Wait for turn 2 completion
    console.log('[S7] Waiting for turn 2 response (up to 180s)...');
    const remaining = Math.max(0, 360000 - (Date.now() - start));
    const turn2Done = await driver.waitForContent(/Task completed|Error:/i, remaining);
    printFrame(turn2Done, 'S7: Turn 2 Response');

    const turn2Completed = turn2Done.text.includes('Task completed');
    checks.push({ label: 'Turn 2 completed', ok: check('Turn 2 completed', turn2Completed) });

    // Final state
    await sleep(2000);
    const finalFrame = driver.captureFrame();

    // Check agent state transitions
    const hasIdle = finalFrame.text.includes('idle') || finalFrame.text.includes('completed');
    checks.push({ label: 'Agent returns to idle/completed after discussion', ok: check('Agent returns to idle/completed after discussion', hasIdle) });

    const noCrash = !finalFrame.text.includes('FATAL') && !finalFrame.text.includes('Unhandled');
    checks.push({ label: 'No crash during discussion', ok: check('No crash during discussion', noCrash) });

    notes.push(`Total turns: 2`);
    notes.push(`Total time: ${Math.round((Date.now() - start) / 1000)}s`);

    const allOk = checks.every(c => c.ok);
    return { name: 'Discussion avec l\'agent', result: allOk ? 'PASS' : 'PARTIAL', timeMs: Date.now() - start, checks, notes };
  } catch (err: any) {
    notes.push(`Error: ${err.message}`);
    return { name: 'Discussion avec l\'agent', result: 'FAIL', timeMs: Date.now() - start, checks, notes };
  } finally {
    driver.kill();
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  DOGFOOD SCENARIOS — maestro-code                           ║');
  console.log('║  Backend: http://localhost:5000                              ║');
  console.log('║  LLM-Provider: http://localhost:5010                         ║');
  console.log(`║  Skip long: ${skipLong ? 'YES' : 'NO'}                                                ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Run scenarios in order
  results.push(await scenario2());
  results.push(await scenario4());
  results.push(await scenario5());
  results.push(await scenario7());
  // Scenario 6 last (creates files, longest)
  results.push(await scenario6());

  // ── Summary ──────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BILAN                                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const r of results) {
    const icon = r.result === 'PASS' ? '✓' : r.result === 'PARTIAL' ? '◐' : r.result === 'SKIP' ? '⊘' : '✗';
    const color = r.result === 'PASS' ? '\x1b[32m' : r.result === 'PARTIAL' ? '\x1b[33m' : r.result === 'SKIP' ? '\x1b[90m' : '\x1b[31m';
    console.log(`${color}${icon}\x1b[0m ${r.name} — ${r.result} (${Math.round(r.timeMs / 1000)}s)`);
    for (const c of r.checks) {
      if (!c.ok) console.log(`    ✗ ${c.label}`);
    }
    for (const n of r.notes) {
      console.log(`    ${n}`);
    }
  }

  const passed = results.filter(r => r.result === 'PASS').length;
  const total = results.filter(r => r.result !== 'SKIP').length;
  console.log(`\nTotal: ${passed}/${total} passed`);

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
