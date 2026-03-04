// test-maestro-code-global.mjs
// Spawn le maestro code GLOBAL via PTY, envoie "allo", capture le résultat.
// Exécuter : node C:\Meastro\TODO\test-maestro-code-global.mjs

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use node-pty from the maestro-code package
const require = createRequire(import.meta.url);

async function main() {
  const pty = require(join('C:/Meastro/node_modules', 'node-pty'));
  const { Terminal } = require(join('C:/Meastro/node_modules', '@xterm/headless'));

  console.log('[test] Spawning global maestro code via PTY...');

  const term = new Terminal({ cols: 120, rows: 40, allowProposedApi: true });

  // Spawn the GLOBAL maestro command
  const proc = pty.spawn('cmd.exe', ['/c', 'maestro', 'code', '--no-bell'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: 'C:/Users/arthu',
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
  });

  proc.onData(data => term.write(data));

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function captureFrame() {
    const buffer = term.buffer.active;
    const lines = [];
    for (let i = 0; i < 40; i++) {
      const line = buffer.getLine(i);
      lines.push(line ? line.translateToString(true) : '');
    }
    return lines.filter(l => l.trim()).join('\n');
  }

  function printFrame(label) {
    console.log(`\n=== ${label} ===`);
    console.log(captureFrame());
    console.log('=== END ===\n');
  }

  // Wait for TUI to render (box-drawing chars)
  console.log('[test] Waiting for TUI render (up to 30s)...');
  let rendered = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const text = captureFrame();
    if (/[┌┐└┘│─╭╮╰╯]/.test(text)) {
      rendered = true;
      break;
    }
  }

  printFrame(rendered ? 'TUI Rendered' : 'TUI NOT rendered (timeout)');

  if (!rendered) {
    console.error('[test] FAIL: TUI did not render. Backend not running?');
    proc.kill();
    return;
  }

  // Press / to focus input
  console.log('[test] Pressing / to focus input...');
  proc.write('/');
  await sleep(500);
  printFrame('After / (input focus)');

  // Type "allo"
  console.log('[test] Typing "allo"...');
  for (const ch of 'allo') {
    proc.write(ch);
    await sleep(30);
  }
  await sleep(300);
  printFrame('After typing allo');

  // Press Enter
  console.log('[test] Pressing Enter...');
  proc.write('\r');

  // Wait for evidence of processing (up to 30s)
  console.log('[test] Waiting for session/processing state (up to 30s)...');
  let processed = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const text = captureFrame();
    if (/session|processing|invoking|Creating|allo/i.test(text)) {
      processed = true;
      printFrame(`State at ${i * 500}ms`);
      break;
    }
  }

  if (!processed) {
    printFrame('State after 30s (no change detected)');
  }

  // Wait for agent response (up to 180s)
  // Look for: agent going back to idle, error messages, or assistant response text
  // AVOID matching "Agent:" in the status panel (always present)
  console.log('[test] Waiting for agent response (up to 180s)...');
  let done = false;
  for (let i = 0; i < 360; i++) {
    await sleep(500);
    const text = captureFrame();
    // Match: agent idle again, explicit error, "completed", "failed", or "Bonjour"/"Salut"/"Hello"
    if (/Agent: idle.*session|Entry point .* completed|error.*not retryable|LLM provider error|Bonjour|Salut|Hello|Comment puis/i.test(text)) {
      done = true;
      printFrame(`DONE at ${(i * 500 / 1000).toFixed(1)}s`);
      break;
    }
    if (i % 30 === 0 && i > 0) {
      printFrame(`Still waiting... (${(i * 500 / 1000).toFixed(1)}s)`);
    }
  }

  if (!done) {
    printFrame('TIMEOUT after 180s — still in processing');
  }

  proc.kill();
  term.dispose();
  console.log('[test] Done.');
}

main().catch(err => {
  console.error('[test] Fatal:', err);
  process.exit(1);
});
