/**
 * Dogfood Session 2 — Full discovery + detail views + scroll + keyboard
 *
 * NOT a test runner. The agent reads captured frames and judges each one.
 * Delete after dogfooding session.
 */
import { TuiDriver } from './tui-driver.ts';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
const driver = new TuiDriver(120, 40);
try {
  // === SPAWN (real mode) ===
  console.log('=== SPAWNING (real mode) ===');
  await driver.spawn('real', { repo: 'C:/Cantante' });
  const frame0 = await driver.waitForRender(15000);
  TuiDriver.printFrame(frame0, 'INITIAL FRAME — Agent Page');

  // === DISCOVERY: Navigate to each page ===

  // Home
  console.log('\n=== PRESS H — Home ===');
  driver.press('h');
  await wait(2500);
  TuiDriver.printFrame(driver.captureFrame(), 'HOME PAGE');

  // Foundry
  console.log('\n=== PRESS F — Foundry ===');
  driver.press('f');
  await wait(2500);
  TuiDriver.printFrame(driver.captureFrame(), 'FOUNDRY PAGE');

  // Catalog
  console.log('\n=== PRESS C — Catalog ===');
  driver.press('c');
  await wait(2500);
  TuiDriver.printFrame(driver.captureFrame(), 'CATALOG PAGE');

  // Models
  console.log('\n=== PRESS M — Models ===');
  driver.press('m');
  await wait(2500);
  TuiDriver.printFrame(driver.captureFrame(), 'MODELS PAGE');

  // Spaces
  console.log('\n=== PRESS S — Spaces ===');
  driver.press('s');
  await wait(2500);
  TuiDriver.printFrame(driver.captureFrame(), 'SPACES PAGE');

  // Back to Agent
  console.log('\n=== PRESS A — Agent ===');
  driver.press('a');
  await wait(2500);
  TuiDriver.printFrame(driver.captureFrame(), 'AGENT PAGE');

  // ===================================================================
  // DETAIL VIEW TESTS (mandatory per updated methodology)
  // ===================================================================

  // Go to Foundry and press Enter on first block
  console.log('\n=== DETAIL VIEW: Foundry -> Block Detail ===');
  driver.press('f');
  await wait(2500);
  driver.pressEnter(); // Select first block
  await wait(2500);
  const blockDetailFrame = driver.captureFrame();
  TuiDriver.printFrame(blockDetailFrame, 'BLOCK DETAIL (from Foundry)');

  // Composition check
  const detailLines = blockDetailFrame.lines;
  const statusBarCount = detailLines.filter(l =>
    l.includes('connected') || (l.includes('page') && l.includes('Ctrl'))
  ).length;
  const taskInputCount = detailLines.filter(l =>
    l.includes('Press / to type') || l.includes('Describe your task')
  ).length;
  console.log('\n=== COMPOSITION CHECK — BlockDetail ===');
  console.log('StatusBar instances: ' + statusBarCount + ' (expected: 1)');
  console.log('TaskInputBar instances: ' + taskInputCount + ' (expected: 0 on detail)');

  // Back to Foundry
  console.log('\n=== PRESS Esc — Back to Foundry ===');
  driver.pressEscape();
  await wait(1500);
  TuiDriver.printFrame(driver.captureFrame(), 'BACK TO FOUNDRY');

  // ===================================================================
  // SCROLL BOUNDARY TEST — Foundry
  // ===================================================================
  console.log('\n=== SCROLL BOUNDARY TEST — Foundry ===');
  for (let i = 0; i < 20; i++) {
    driver.press('j');
    await wait(80);
  }
  await wait(500);
  const scrollFrame = driver.captureFrame();
  TuiDriver.printFrame(scrollFrame, 'FOUNDRY SCROLLED TO BOTTOM');

  // Analyze rows
  const sLines = scrollFrame.lines;
  let lastContentRow = -1;
  let taskBarRow = -1;
  let statusRow = -1;
  for (let i = 0; i < sLines.length; i++) {
    const line = sLines[i];
    if (line.includes('Press / to type') || line.includes('Describe your task')) taskBarRow = i;
    if (line.includes('connected') || (line.includes('Ctrl+') && line.includes('page'))) statusRow = i;
    if (line.match(/workflow|agent|tool|inference|validator/i) && line.trim().length > 10) {
      lastContentRow = i;
    }
  }
  console.log('\nScroll analysis:');
  console.log('  Last content row: ' + lastContentRow);
  console.log('  TaskInputBar row: ' + taskBarRow);
  console.log('  StatusBar row: ' + statusRow);
  if (lastContentRow >= taskBarRow && taskBarRow >= 0) {
    console.log('  BUG: Content overlaps with or is behind TaskInputBar');
  } else if (taskBarRow < 0) {
    console.log('  NOTE: TaskInputBar not found in frame');
  } else {
    console.log('  OK: Content is above TaskInputBar');
  }

  // ===================================================================
  // KEYBOARD IN CONTEXT — Agent J/K scroll
  // ===================================================================
  console.log('\n=== KEYBOARD TEST — Agent J/K scroll ===');
  driver.press('a');
  await wait(2000);
  const beforeFrame = driver.captureFrame();
  const beforeText = beforeFrame.text.replace(/[●◉◌○◍⊙⊚⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏*]/g, '');

  // Press K 5 times
  for (let i = 0; i < 5; i++) {
    driver.press('k');
    await wait(200);
  }
  await wait(500);
  const afterKFrame = driver.captureFrame();
  TuiDriver.printFrame(afterKFrame, 'AGENT AFTER 5x K');
  const afterKText = afterKFrame.text.replace(/[●◉◌○◍⊙⊚⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏*]/g, '');

  if (beforeText === afterKText) {
    console.log('RESULT: K key has NO effect (keyboard dead)');
  } else {
    console.log('RESULT: K key works — frame changed');
  }

  // Press J 5 times
  for (let i = 0; i < 5; i++) {
    driver.press('j');
    await wait(200);
  }
  await wait(500);
  const afterJFrame = driver.captureFrame();
  const afterJText = afterJFrame.text.replace(/[●◉◌○◍⊙⊚⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏*]/g, '');

  if (afterKText === afterJText) {
    console.log('RESULT: J key has NO effect');
  } else {
    console.log('RESULT: J key works — frame changed');
  }

  // Scroll indicators
  console.log('Scroll up indicator: ' + afterKFrame.text.includes('\u25B2'));
  console.log('Scroll down indicator: ' + afterKFrame.text.includes('\u25BC'));

  // ===================================================================
  // DETAIL VIEW: Home -> Session (if sessions exist)
  // ===================================================================
  console.log('\n=== DETAIL VIEW: Home -> Session Detail ===');
  driver.press('h');
  await wait(2500);
  const homeFrame = driver.captureFrame();
  const hasSessions = homeFrame.text.includes('running') || homeFrame.text.includes('completed');
  console.log('Sessions on Home: ' + hasSessions);

  if (hasSessions) {
    driver.pressEnter();
    await wait(2500);
    const sessionFrame = driver.captureFrame();
    TuiDriver.printFrame(sessionFrame, 'SESSION DETAIL (from Home)');
    const sdStatus = sessionFrame.lines.filter(l => l.includes('connected')).length;
    const sdInput = sessionFrame.lines.filter(l => l.includes('Press / to type') || l.includes('Describe your task')).length;
    console.log('Composition: StatusBars=' + sdStatus + ' TaskInputBars=' + sdInput);
    driver.pressEscape();
    await wait(1000);
  } else {
    console.log('No sessions — skipping');
  }

  // ===================================================================
  // DETAIL VIEW: Catalog -> Block Detail
  // ===================================================================
  console.log('\n=== DETAIL VIEW: Catalog -> Block Detail ===');
  driver.press('c');
  await wait(2500);
  driver.pressEnter();
  await wait(2500);
  const catFrame = driver.captureFrame();
  TuiDriver.printFrame(catFrame, 'BLOCK DETAIL (from Catalog)');
  const catStatus = catFrame.lines.filter(l => l.includes('connected') || (l.includes('page') && l.includes('Ctrl'))).length;
  const catInput = catFrame.lines.filter(l => l.includes('Press / to type') || l.includes('Describe your task')).length;
  console.log('Composition: StatusBars=' + catStatus + ' TaskInputBars=' + catInput);

  driver.pressEscape();
  await wait(1000);

  console.log('\n=== ALL TESTS COMPLETE ===');

} catch (err) {
  console.error('ERROR:', err);
} finally {
  driver.kill();
}
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
