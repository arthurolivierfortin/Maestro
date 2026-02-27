/**
 * Temporary dogfooding live script — Agent test with real backend.
 * NOT a test runner. The agent reads output and makes judgments.
 * Delete after dogfooding session.
 */
import { TuiDriver } from './tui-driver.ts';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const d = new TuiDriver(120, 40);
  console.log('[live] Spawning maestro-code in REAL mode (Cantante repo)...\n');

  await d.spawn('real', { repo: 'C:/Cantante' });

  // 1. Wait for TUI to render (longer timeout for Windows)
  console.log('[live] Waiting for initial render...');
  const initial = await d.waitForRender(25000);
  TuiDriver.printFrame(initial, 'INITIAL RENDER');

  // Check for NoBackendScreen
  if (initial.text.includes('Backend Not Available')) {
    console.error('[live] FATAL: Backend not running!');
    d.kill();
    return;
  }

  // If initial is empty, wait more
  if (initial.lines.filter(l => l.trim()).length === 0) {
    console.log('[live] Initial empty, waiting more...');
    await sleep(5000);
    TuiDriver.printFrame(d.captureFrame(), 'DELAYED RENDER');
  }

  // 2. Verify we're on Agent page (default)
  const agentPage = d.captureFrame();
  console.log('\n--- Checking default page ---');
  console.log('Has MAESTRO:', agentPage.text.includes('MAESTRO'));
  console.log('Has AGENT STATUS:', agentPage.text.includes('AGENT STATUS'));
  console.log('Has CONVERSATION:', agentPage.text.includes('CONVERSATION'));

  // 3. Focus input and type task
  console.log('\n[live] Pressing / to focus input...');
  d.press('/');
  await sleep(800);

  const focusedFrame = d.captureFrame();
  const hasFocus = focusedFrame.text.includes('Describe your task') || focusedFrame.text.includes('>');
  console.log('Input focused:', hasFocus);

  const task = 'What is the Cantante project about? Give me a brief summary.';
  console.log(`\n[live] Typing task: "${task}"`);
  await d.typeText(task, 15);
  await sleep(500);

  // Verify text appears
  const typedFrame = d.captureFrame();
  TuiDriver.printFrame(typedFrame, 'TASK TYPED');

  // 4. Submit task
  console.log('\n[live] Pressing Enter to submit...');
  d.pressEnter();

  // 5. Watch session creation
  console.log('[live] Waiting for session creation (up to 30s)...');
  const sessionFrame = await d.waitForContent(/Session:|Creating session|Invoking/, 30000);
  TuiDriver.printFrame(sessionFrame, 'SESSION CREATED');

  // Extract session ID
  const sessionMatch = sessionFrame.text.match(/Session:\s*([a-f0-9]{8})/);
  if (sessionMatch) {
    console.log(`\n[live] Session ID prefix: ${sessionMatch[1]}`);
  }

  // Check template used
  console.log('Template maestro-assistant:', sessionFrame.text.includes('maestro-assistant'));
  console.log('Entry point message:', sessionFrame.text.includes('Invoking: message'));

  // 6. Wait for agent state changes
  console.log('\n[live] Waiting for agent to work (polling every 5s, up to 120s)...');
  let lastFrame = d.captureFrame();
  let elapsed = 0;
  const maxWait = 120000;

  while (elapsed < maxWait) {
    await sleep(5000);
    elapsed += 5000;
    const frame = d.captureFrame();

    // Check for state changes
    const hasWorking = /working/i.test(frame.text);
    const hasCompleted = /Task completed/i.test(frame.text);
    const hasError = /Error:/i.test(frame.text);

    console.log(`[live] ${Math.round(elapsed/1000)}s — working:${hasWorking} completed:${hasCompleted} error:${hasError}`);

    if (hasCompleted || hasError) {
      await sleep(2000); // Let final state settle
      lastFrame = d.captureFrame();
      break;
    }
    lastFrame = frame;
  }

  // 7. Capture final state
  console.log('\n=== FINAL STATE ===');
  TuiDriver.printFrame(lastFrame, 'FINAL');

  // 8. Check agent response
  const hasAgentLabel = lastFrame.text.includes('Agent:');
  console.log('\n--- Agent Response Analysis ---');
  console.log('Has "Agent:" label:', hasAgentLabel);
  console.log('Has "Task completed":', /Task completed/i.test(lastFrame.text));

  // Extract the agent's response text
  const lines = lastFrame.lines;
  let agentResponseLines: string[] = [];
  let inResponse = false;
  for (const line of lines) {
    if (line.includes('Agent:')) {
      inResponse = true;
      continue;
    }
    if (inResponse) {
      if (line.includes('Task completed') || (line.replace(/│/g, '').trim() === '' && agentResponseLines.length > 0)) {
        break;
      }
      const cleaned = line.replace(/│/g, '').trim();
      if (cleaned) agentResponseLines.push(cleaned);
    }
  }

  console.log('\nAgent response text:');
  for (const l of agentResponseLines) {
    console.log(`  > ${l}`);
  }
  console.log(`  (${agentResponseLines.length} lines)`);

  // 9. Test session persistence — send a SECOND message
  console.log('\n\n=== SESSION PERSISTENCE TEST ===');
  console.log('[live] Pressing / to focus input for second message...');
  d.press('/');
  await sleep(800);

  const task2 = 'What framework does it use?';
  console.log(`[live] Typing: "${task2}"`);
  await d.typeText(task2, 15);
  await sleep(500);

  console.log('[live] Submitting second message...');
  d.pressEnter();

  // Wait — should NOT see "Creating session..." again
  console.log('[live] Waiting for second invocation...');
  const msg2Frame = await d.waitForContent(/Invoking:|Creating session/, 30000);

  const hasNewSession = msg2Frame.text.includes('Creating session');
  const hasInvoking = msg2Frame.text.includes('Invoking:');
  console.log('Re-created session (BAD):', hasNewSession);
  console.log('Invoked directly (GOOD):', hasInvoking && !hasNewSession);
  TuiDriver.printFrame(msg2Frame, 'SECOND MESSAGE SUBMITTED');

  // Wait for second completion
  console.log('\n[live] Waiting for second task completion (up to 120s)...');
  elapsed = 0;
  while (elapsed < maxWait) {
    await sleep(5000);
    elapsed += 5000;
    const frame = d.captureFrame();
    // Count "Task completed" occurrences — need to see 2
    const completionCount = (frame.text.match(/Task completed/gi) || []).length;
    console.log(`[live] ${Math.round(elapsed/1000)}s — completions:${completionCount}`);

    if (completionCount >= 2) {
      await sleep(2000);
      const final2 = d.captureFrame();
      TuiDriver.printFrame(final2, 'SECOND TASK COMPLETED');

      // Extract second response
      let secondResponse: string[] = [];
      let count = 0;
      for (const line of final2.lines) {
        if (line.includes('Agent:')) {
          count++;
          if (count === 2) {
            const idx = final2.lines.indexOf(line);
            for (let i = idx + 1; i < final2.lines.length; i++) {
              const cl = final2.lines[i].replace(/│/g, '').trim();
              if (cl.includes('Task completed') || (!cl && secondResponse.length > 0)) break;
              if (cl) secondResponse.push(cl);
            }
          }
        }
      }
      console.log('\nSecond response:');
      for (const l of secondResponse) console.log(`  > ${l}`);
      break;
    }
  }

  d.kill();
  console.log('\n[live] Done.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
