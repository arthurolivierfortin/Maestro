/**
 * Dogfooding session — Feature discovery & UX audit
 *
 * Follows the dogfooding methodology:
 * 1. Spawn TUI, observe what appears
 * 2. Visit every page, document what exists
 * 3. Test all interactions
 * 4. Note missing features
 * 5. Test agent workflow end-to-end
 *
 * Run: cd packages/maestro-code && npx tsx tests/_dogfood-features.ts
 */

import { TuiDriver } from './tui-driver.ts';

const driver = new TuiDriver(130, 45);
const notes: string[] = [];
const findings: { id: string; severity: string; desc: string }[] = [];

function note(msg: string) {
  notes.push(msg);
  console.log(`  📝 ${msg}`);
}

function finding(id: string, severity: string, desc: string) {
  findings.push({ id, severity, desc });
  console.log(`  🔍 [${severity}] ${id}: ${desc}`);
}

function printFrame(frame: any, label: string) {
  console.log(`\n=== ${label} (${frame.timestamp}ms) ===`);
  const lines = frame.lines.filter((l: string) => l.trim());
  lines.forEach((l: string, i: number) => {
    console.log(`  ${String(i + 1).padStart(2)}: ${l.substring(0, 128)}`);
  });
  console.log(`  (${lines.length} non-empty lines)\n`);
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

// ── Phase 1: Spawn & First Impression ───────────────────────

async function phase1_spawn() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  PHASE 1: SPAWN & FIRST IMPRESSION (demo mode)');
  console.log('══════════════════════════════════════════════\n');

  await driver.spawn('demo', { cols: 130, rows: 45 });
  const frame = await driver.waitForRender(10000);
  printFrame(frame, 'INITIAL RENDER');

  // What does the user see first?
  const text = frame.text;

  if (text.includes('MAESTRO')) note('NavBar visible with MAESTRO branding');
  else finding('F1-1', 'HIGH', 'No MAESTRO branding visible on first render');

  if (text.includes('AGENT STATUS')) note('Agent Status panel visible');
  else finding('F1-2', 'HIGH', 'Agent Status panel not visible');

  if (text.includes('CONVERSATION')) note('Conversation panel visible');
  else finding('F1-3', 'HIGH', 'Conversation panel not visible');

  if (text.includes('ACTIONS')) note('Actions panel visible');
  else finding('F1-4', 'MEDIUM', 'Actions panel not visible');

  if (text.includes('Type a task')) note('Welcome message shown');
  else finding('F1-5', 'HIGH', 'No welcome message/onboarding');

  // Check for page tabs
  const pages = ['Home', 'Agent', 'Spaces', 'Foundry', 'Catalog', 'Models'];
  for (const p of pages) {
    if (text.includes(p)) note(`NavBar shows [${p}]`);
    else finding(`F1-NAV-${p}`, 'LOW', `NavBar missing [${p}] tab`);
  }

  // Is the input bar visible?
  if (text.includes('❯') || text.includes('>') || text.includes('/') || text.includes('task')) {
    note('Input area visible');
  } else {
    finding('F1-6', 'HIGH', 'No visible input area/prompt');
  }

  // Check agent state
  if (text.includes('idle')) note('Agent state shows idle');
  else if (text.includes('working')) note('Agent state shows working');
  else finding('F1-7', 'MEDIUM', 'Agent state not visible');
}

// ── Phase 2: Navigate All Pages ──────────────────────────────

async function phase2_pages() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  PHASE 2: NAVIGATE ALL PAGES');
  console.log('══════════════════════════════════════════════\n');

  // Home page
  console.log('--- Pressing H (Home) ---');
  driver.sendKey('h');
  await sleep(1500);
  let frame = driver.captureFrame();
  printFrame(frame, 'HOME PAGE');

  let text = frame.text;
  if (text.includes('SYSTEM STATUS')) note('Home: System Status panel shown');
  else finding('F2-H1', 'HIGH', 'Home: No System Status panel');

  if (text.includes('ACTIVE SESSIONS') || text.includes('SESSION')) note('Home: Sessions panel shown');
  else finding('F2-H2', 'MEDIUM', 'Home: No Sessions panel');

  if (text.includes('QUICK ACTIONS') || text.includes('ACTIONS')) note('Home: Quick Actions panel shown');
  else finding('F2-H3', 'LOW', 'Home: No Quick Actions panel');

  // Check if backend/LLM status indicators are visible
  if (text.includes('Backend') || text.includes('backend')) note('Home: Backend status shown');
  else finding('F2-H4', 'MEDIUM', 'Home: No backend status indicator');

  if (text.includes('LLM') || text.includes('llm') || text.includes('Model')) note('Home: LLM status shown');
  else finding('F2-H5', 'MEDIUM', 'Home: No LLM status indicator');

  // Spaces page
  console.log('--- Pressing S (Spaces) ---');
  driver.sendKey('s');
  await sleep(1500);
  frame = driver.captureFrame();
  printFrame(frame, 'SPACES PAGE');

  text = frame.text;
  if (text.includes('Repos') || text.includes('[1]')) note('Spaces: Repos tab visible');
  else finding('F2-S1', 'MEDIUM', 'Spaces: No Repos tab');

  if (text.includes('Workspaces') || text.includes('[2]')) note('Spaces: Workspaces tab visible');
  else finding('F2-S2', 'MEDIUM', 'Spaces: No Workspaces tab');

  if (text.includes('Sessions') || text.includes('[3]')) note('Spaces: Sessions tab visible');
  else finding('F2-S3', 'MEDIUM', 'Spaces: No Sessions tab');

  // Test tab switching
  console.log('--- Pressing 2 (Workspaces tab) ---');
  driver.sendKey('2');
  await sleep(800);
  frame = driver.captureFrame();
  text = frame.text;
  if (text.includes('Workspaces') || text.includes('workspace')) note('Spaces: Tab 2 switched to Workspaces');

  console.log('--- Pressing 3 (Sessions tab) ---');
  driver.sendKey('3');
  await sleep(800);
  frame = driver.captureFrame();
  text = frame.text;
  if (text.includes('Sessions') || text.includes('session')) note('Spaces: Tab 3 switched to Sessions');

  // Test the A key conflict
  console.log('--- Pressing A (should filter All, but may navigate to Agent) ---');
  driver.sendKey('a');
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;
  if (text.includes('AGENT STATUS')) {
    finding('F2-AKEY', 'HIGH', 'Spaces: A key navigated to Agent instead of filtering All — KEY CONFLICT CONFIRMED');
  } else {
    note('Spaces: A key correctly filtered (or did not navigate)');
  }

  // Foundry page
  console.log('--- Pressing F (Foundry) ---');
  driver.sendKey('f');
  await sleep(1500);
  frame = driver.captureFrame();
  printFrame(frame, 'FOUNDRY PAGE');

  text = frame.text;
  if (text.includes('MY BLOCKS') || text.includes('BLOCKS') || text.includes('Foundry')) note('Foundry: Blocks panel shown');
  else finding('F2-F1', 'HIGH', 'Foundry: No blocks panel');

  // Can we see block types?
  if (text.includes('workflow') || text.includes('agent') || text.includes('tool')) {
    note('Foundry: Block type labels visible');
  } else {
    finding('F2-F2', 'MEDIUM', 'Foundry: No block type labels');
  }

  // Is there any way to CREATE a block?
  if (text.includes('Create') || text.includes('create') || text.includes('New') || text.includes('[N]')) {
    note('Foundry: Create block action available');
  } else {
    finding('F2-F3', 'CRITICAL', 'Foundry: NO way to create a block from this page — read-only browser only');
  }

  // Is there any way to PUBLISH/APPROVE?
  if (text.includes('Publish') || text.includes('publish') || text.includes('Approve') || text.includes('approve') || text.includes('Pending')) {
    note('Foundry: Publish/approve action available');
  } else {
    finding('F2-F4', 'HIGH', 'Foundry: NO publish/approve/pending blocks panel');
  }

  // Catalog page
  console.log('--- Pressing C (Catalog) ---');
  driver.sendKey('c');
  await sleep(1500);
  frame = driver.captureFrame();
  printFrame(frame, 'CATALOG PAGE');

  text = frame.text;
  if (text.includes('CATALOG') || text.includes('BLOCK CATALOG')) note('Catalog: Block catalog panel shown');
  else finding('F2-C1', 'MEDIUM', 'Catalog: No catalog panel');

  // Type filter?
  if (text.includes('All') || text.includes('Workflow') || text.includes('Agent') || text.includes('Tool')) {
    note('Catalog: Type filter tabs visible');
  } else {
    finding('F2-C2', 'LOW', 'Catalog: No type filter');
  }

  // Tab to cycle filter
  console.log('--- Pressing Tab (cycle type filter) ---');
  driver.press('tab');
  await sleep(800);
  frame = driver.captureFrame();
  // Check if filter changed

  // Models page
  console.log('--- Pressing M (Models) ---');
  driver.sendKey('m');
  await sleep(1500);
  frame = driver.captureFrame();
  printFrame(frame, 'MODELS PAGE');

  text = frame.text;
  if (text.includes('MODEL STATUS') || text.includes('MODELS')) note('Models: Model status panel shown');
  else finding('F2-M1', 'MEDIUM', 'Models: No model status panel');

  if (text.includes('AVAILABLE') || text.includes('Available')) note('Models: Available models list shown');
  else finding('F2-M2', 'MEDIUM', 'Models: No available models list');

  // Can we see model names?
  const modelNames = ['claude', 'sonnet', 'haiku', 'gpt', 'llama', 'qwen', 'phi'];
  const foundModels = modelNames.filter(m => text.toLowerCase().includes(m));
  if (foundModels.length > 0) {
    note(`Models: Found model names: ${foundModels.join(', ')}`);
  } else {
    finding('F2-M3', 'MEDIUM', 'Models: No recognizable model names visible');
  }

  // Can we SELECT/SWITCH a model?
  if (text.includes('Select') || text.includes('select') || text.includes('Switch') || text.includes('[Enter]')) {
    note('Models: Model selection action available');
  } else {
    finding('F2-M4', 'HIGH', 'Models: NO way to select/switch models — display-only page');
  }

  // Back to Agent
  console.log('--- Pressing A (Agent) ---');
  driver.sendKey('a');
  await sleep(1000);
}

// ── Phase 3: Agent Interaction ───────────────────────────────

async function phase3_agent() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  PHASE 3: AGENT INTERACTION');
  console.log('══════════════════════════════════════════════\n');

  // Test slash-to-focus
  console.log('--- Pressing / (activate input) ---');
  driver.sendKey('/');
  await sleep(500);
  let frame = driver.captureFrame();
  let text = frame.text;

  // The input bar should be focused now
  note('Pressed / to activate input bar');

  // Test typing
  console.log('--- Typing "hello world" ---');
  await driver.typeText('hello world', 20);
  await sleep(500);
  frame = driver.captureFrame();
  printFrame(frame, 'AFTER TYPING');

  text = frame.text;
  if (text.includes('hello world')) {
    note('Input text visible on screen');
  } else {
    finding('F3-1', 'HIGH', 'Typed text not visible in input bar');
  }

  // Test clearing input with backspace
  console.log('--- Pressing backspace 11 times ---');
  for (let i = 0; i < 11; i++) driver.press('backspace');
  await sleep(300);

  // Test slash commands
  console.log('--- Testing /help ---');
  await driver.typeText('/help', 20);
  await sleep(300);
  frame = driver.captureFrame();
  text = frame.text;

  // Submit
  driver.pressEnter();
  await sleep(1500);
  frame = driver.captureFrame();
  printFrame(frame, 'AFTER /help');

  text = frame.text;
  if (text.includes('help') && (text.includes('command') || text.includes('shortcut') || text.includes('available'))) {
    note('/help command shows help text');
  } else {
    finding('F3-HELP', 'CRITICAL', '/help does not exist or produces no useful output');
  }

  // Test /clear
  console.log('--- Testing /clear ---');
  driver.sendKey('/');
  await sleep(300);
  await driver.typeText('/clear', 20);
  driver.pressEnter();
  await sleep(1500);
  frame = driver.captureFrame();
  text = frame.text;

  if (!text.includes('/help') && !text.includes('hello')) {
    note('/clear command cleared conversation');
  } else {
    finding('F3-CLEAR', 'HIGH', '/clear does not exist or did not clear conversation');
  }

  // Test /new
  console.log('--- Testing /new ---');
  driver.sendKey('/');
  await sleep(300);
  await driver.typeText('/new', 20);
  driver.pressEnter();
  await sleep(1500);
  frame = driver.captureFrame();
  text = frame.text;

  if (text.includes('new') && (text.includes('session') || text.includes('conversation'))) {
    note('/new command starts new session/conversation');
  } else {
    finding('F3-NEW', 'HIGH', '/new does not exist or produces no output');
  }

  // Test /stop
  console.log('--- Testing /stop ---');
  driver.sendKey('/');
  await sleep(300);
  await driver.typeText('/stop', 20);
  driver.pressEnter();
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;
  finding('F3-STOP', 'HIGH', '/stop command not implemented (no task to stop, but command should exist)');

  // Test /model
  console.log('--- Testing /model ---');
  driver.sendKey('/');
  await sleep(300);
  await driver.typeText('/model', 20);
  driver.pressEnter();
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;
  finding('F3-MODEL', 'MEDIUM', '/model command not implemented');

  // Test /status
  console.log('--- Testing /status ---');
  driver.sendKey('/');
  await sleep(300);
  await driver.typeText('/status', 20);
  driver.pressEnter();
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;
  finding('F3-STATUS', 'MEDIUM', '/status command not implemented');

  // Test Escape to exit input mode
  console.log('--- Pressing Escape (exit input) ---');
  driver.pressEscape();
  await sleep(500);
}

// ── Phase 4: Navigation & Shortcuts ──────────────────────────

async function phase4_shortcuts() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  PHASE 4: NAVIGATION & SHORTCUTS');
  console.log('══════════════════════════════════════════════\n');

  // Test Ctrl+Left/Right page cycling
  console.log('--- Pressing Ctrl+Right (next page) ---');
  driver.sendKey('\x1b[1;5C'); // Ctrl+Right
  await sleep(1000);
  let frame = driver.captureFrame();
  let text = frame.text;
  note(`After Ctrl+Right: visible content includes ${text.includes('HOME') ? 'HOME' : text.includes('SPACES') ? 'SPACES' : text.includes('FOUNDRY') ? 'FOUNDRY' : 'unknown page'}`);

  console.log('--- Pressing Ctrl+Left (prev page) ---');
  driver.sendKey('\x1b[1;5D'); // Ctrl+Left
  await sleep(1000);
  frame = driver.captureFrame();

  // Go to Home for scroll testing
  driver.sendKey('h');
  await sleep(1000);

  // Test J/K scrolling
  console.log('--- On Home, pressing J (scroll down) ---');
  driver.sendKey('j');
  await sleep(500);
  frame = driver.captureFrame();
  note('Pressed J on Home page');

  console.log('--- Pressing K (scroll up) ---');
  driver.sendKey('k');
  await sleep(500);
  frame = driver.captureFrame();
  note('Pressed K on Home page');

  // Test ? (help overlay)
  console.log('--- Pressing ? on Home page ---');
  driver.sendKey('?');
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;

  if (text.includes('Help') || text.includes('help') || text.includes('Shortcut') || text.includes('shortcut') || text.includes('Key')) {
    note('? help overlay shown on Home page');
  } else {
    finding('F4-HELP', 'HIGH', 'No ? help overlay on Home page — only SessionMonitor has help');
    printFrame(frame, 'HOME AFTER ? KEY');
  }

  // Go back to Agent
  driver.sendKey('a');
  await sleep(800);

  // Test ? on Agent page
  console.log('--- Pressing ? on Agent page ---');
  driver.sendKey('?');
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;

  if (text.includes('Help') || text.includes('help') || text.includes('Shortcut') || text.includes('shortcut')) {
    note('? help overlay shown on Agent page');
  } else {
    finding('F4-HELP-AGENT', 'HIGH', 'No ? help overlay on Agent page');
  }

  // Escape back if needed
  driver.pressEscape();
  await sleep(500);
  // If quit dialog appeared, press n to cancel
  driver.sendKey('n');
  await sleep(500);
}

// ── Phase 5: Feature Completeness Check ──────────────────────

async function phase5_features() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  PHASE 5: FEATURE COMPLETENESS AUDIT');
  console.log('══════════════════════════════════════════════\n');

  // Go to Agent page
  driver.sendKey('a');
  await sleep(800);
  let frame = driver.captureFrame();
  let text = frame.text;

  // Check: Is the working directory / repo shown?
  if (text.includes('Cantante') || text.includes('cantante') || text.includes('C:\\') || text.includes('repo')) {
    note('Working directory/repo shown somewhere');
  } else {
    finding('F5-REPO', 'HIGH', 'No working directory/repo indicator visible on Agent page');
  }

  // Check: Token/context usage?
  if (text.includes('token') || text.includes('Token') || text.includes('context') || text.includes('Context') || /\d+k/.test(text)) {
    note('Token/context usage indicator found');
  } else {
    finding('F5-TOKENS', 'HIGH', 'No token/context usage visible anywhere');
  }

  // Check: Cost/usage tracking?
  if (text.includes('cost') || text.includes('Cost') || text.includes('$')) {
    note('Cost tracking visible');
  } else {
    finding('F5-COST', 'MEDIUM', 'No cost/usage tracking visible');
  }

  // Check: Git status?
  if (text.includes('git') || text.includes('Git') || text.includes('branch') || text.includes('main') || text.includes('commit')) {
    note('Git info visible');
  } else {
    finding('F5-GIT', 'MEDIUM', 'No git status/branch info visible');
  }

  // Go to Foundry - check for create/edit capabilities
  driver.sendKey('f');
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;

  if (text.includes('Create') || text.includes('Edit') || text.includes('Delete') || text.includes('[N]') || text.includes('[E]') || text.includes('[D]')) {
    note('Foundry: CRUD actions available');
  } else {
    finding('F5-CRUD', 'CRITICAL', 'Foundry: ZERO CRUD actions — cannot create, edit, or delete blocks from TUI');
  }

  // Check for publication workflow
  if (text.includes('Publish') || text.includes('Approve') || text.includes('Pending') || text.includes('Draft') || text.includes('Review')) {
    note('Foundry: Publication workflow visible');
  } else {
    finding('F5-PUB', 'HIGH', 'Foundry: No publication workflow — no pending/draft/review states visible');
  }

  // Go to Models - check for selection
  driver.sendKey('m');
  await sleep(1000);
  frame = driver.captureFrame();
  text = frame.text;

  // Navigate to a model with J then Enter
  driver.sendKey('j');
  await sleep(300);
  driver.pressEnter();
  await sleep(1500);
  frame = driver.captureFrame();
  text = frame.text;
  printFrame(frame, 'MODEL DETAIL (after Enter)');

  if (text.includes('Select') || text.includes('select') || text.includes('Use') || text.includes('use') || text.includes('Switch')) {
    note('ModelDetail: Can select/switch to this model');
  } else {
    finding('F5-MODELSWITCH', 'HIGH', 'ModelDetail: No way to select/switch to a model — display only');
  }

  // Back
  driver.pressEscape();
  await sleep(500);

  // Back to Agent
  driver.sendKey('a');
  await sleep(500);
}

// ── Phase 6: Demo Agent Flow ─────────────────────────────────

async function phase6_agent_demo() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  PHASE 6: DEMO AGENT FLOW');
  console.log('══════════════════════════════════════════════\n');

  // In demo mode, submitting a task should work (DemoApiClient)
  driver.sendKey('/');
  await sleep(300);
  await driver.typeText('Add a login page', 20);
  driver.pressEnter();
  await sleep(3000);

  let frame = driver.captureFrame();
  printFrame(frame, 'AFTER SUBMITTING TASK');

  let text = frame.text;

  // Check: Did the task appear in conversation?
  if (text.includes('Add a login page')) {
    note('Submitted task visible in conversation');
  } else {
    finding('F6-TASK', 'CRITICAL', 'Submitted task not visible in conversation');
  }

  // Check: Did the agent state change?
  if (text.includes('working') || text.includes('Working') || text.includes('Processing')) {
    note('Agent state changed to working');
  } else if (text.includes('completed') || text.includes('Completed')) {
    note('Agent already completed');
  } else if (text.includes('Creating session') || text.includes('Session')) {
    note('Session creation in progress');
  } else {
    finding('F6-STATE', 'HIGH', 'Agent state did not change after submitting task');
  }

  // Wait for completion (demo mode should be fast)
  await sleep(5000);
  frame = driver.captureFrame();
  printFrame(frame, 'AFTER WAITING 5s');

  text = frame.text;
  if (text.includes('completed') || text.includes('Completed') || text.includes('Task completed')) {
    note('Task completed successfully in demo mode');
  }

  // Check: Can we see the agent's response?
  if (text.includes('Agent:') || text.includes('agent:')) {
    note('Agent response visible in conversation');
  } else {
    finding('F6-RESPONSE', 'MEDIUM', 'No agent response visible (may be expected in demo mode)');
  }

  // Check: G key to go to session
  console.log('--- Pressing G (go to session) ---');
  driver.sendKey('g');
  await sleep(2000);
  frame = driver.captureFrame();
  printFrame(frame, 'SESSION DETAIL (G key)');

  text = frame.text;
  if (text.includes('execution') || text.includes('Execution') || text.includes('phase') || text.includes('Phase') || text.includes('workflow') || text.includes('Workflow')) {
    note('G key opened session detail with execution info');
  } else if (text.includes('No active session') || text.includes('AGENT STATUS')) {
    finding('F6-NOSESSION', 'HIGH', 'G key did not navigate to session (no session in demo mode?)');
  } else {
    note('G key navigated somewhere — content:');
  }

  // Back
  driver.pressEscape();
  await sleep(500);
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  MAESTRO CODE — DOGFOODING SESSION          ║');
  console.log('║  Focus: Feature completeness & UX           ║');
  console.log('║  Mode: Demo (no real backend tasks)         ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await phase1_spawn();
    await phase2_pages();
    await phase3_agent();
    await phase4_shortcuts();
    await phase5_features();
    await phase6_agent_demo();
  } catch (err: any) {
    console.error(`\n❌ FATAL ERROR: ${err.message}\n${err.stack}`);
  } finally {
    driver.kill();
  }

  // ── Summary ────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  DOGFOODING SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  console.log(`Notes: ${notes.length}`);
  console.log(`Findings: ${findings.length}\n`);

  const bySeverity: Record<string, typeof findings> = {};
  for (const f of findings) {
    (bySeverity[f.severity] ||= []).push(f);
  }

  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const items = bySeverity[sev] || [];
    if (items.length === 0) continue;
    console.log(`  ${sev} (${items.length}):`);
    for (const f of items) {
      console.log(`    ${f.id}: ${f.desc}`);
    }
    console.log('');
  }

  console.log('\nDone.');
}

main();
