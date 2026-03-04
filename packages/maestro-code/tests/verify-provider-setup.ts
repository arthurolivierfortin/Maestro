/**
 * Verify that ProviderSetupScreen appears when no providers are configured.
 * Uses PTY to spawn the real TUI and capture what the user sees.
 */
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLS = 100;
const ROWS = 30;
const WAIT_MS = 15000;

async function main() {
  const pty = await import('node-pty');
  const { Terminal } = await import('@xterm/headless');

  const root = path.resolve(__dirname, '..', '..', '..');
  const isWin = process.platform === 'win32';
  const shell = isWin ? 'cmd.exe' : '/bin/bash';
  const shellArgs = isWin
    ? ['/c', 'node', 'packages/maestro-cli/index.js', 'code', '--no-bell']
    : ['-c', 'node packages/maestro-cli/index.js code --no-bell'];

  console.log('Spawning maestro code (no providers configured)...');
  const os = await import('os');
  console.log(`Config: ${path.join(os.homedir(), '.maestro', 'config.json')}`);

  const proc = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: COLS,
    rows: ROWS,
    cwd: root,
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' } as any,
  });

  const term = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  proc.onData((data: string) => term.write(data));

  // Poll every second
  const POLL_INTERVAL = 1000;
  let elapsed = 0;

  while (elapsed < WAIT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    elapsed += POLL_INTERVAL;

    const lines: string[] = [];
    const buffer = term.buffer.active;
    for (let i = 0; i < ROWS; i++) {
      const line = buffer.getLine(i);
      lines.push(line ? line.translateToString(true) : '');
    }

    const text = lines.join('\n');
    const nonEmpty = lines.filter(l => l.trim()).length;

    console.log(`\n--- Frame at ${elapsed}ms (${nonEmpty} non-empty lines) ---`);

    // Check for key indicators
    const hasProviderSetup = text.includes('Provider Setup');
    const hasProviderSelection = text.includes('Which LLM providers');
    const hasClaudeCode = text.includes('Claude Code');
    const hasAzure = text.includes('Azure');
    const hasNumberKeys = text.includes('[1]') || text.includes('[2]');
    const hasAgentScreen = text.includes('AGENT STATUS');
    const hasNoBackend = text.includes('Backend Not Available');
    const hasCrash = lines.some(l => /at\s+\S+\s+\(.*:\d+:\d+\)/.test(l));
    const hasStarting = text.includes('Starting Maestro');

    console.log(`  Provider Setup title: ${hasProviderSetup}`);
    console.log(`  Provider selection text: ${hasProviderSelection}`);
    console.log(`  Claude Code option: ${hasClaudeCode}`);
    console.log(`  Azure option: ${hasAzure}`);
    console.log(`  Number keys: ${hasNumberKeys}`);
    console.log(`  Agent screen: ${hasAgentScreen}`);
    console.log(`  No Backend screen: ${hasNoBackend}`);
    console.log(`  Starting services: ${hasStarting}`);
    console.log(`  Crash detected: ${hasCrash}`);

    // Print first 15 non-empty lines
    const visible = lines.filter(l => l.trim()).slice(0, 15);
    visible.forEach((l, i) => console.log(`  ${i}: ${l.trimEnd()}`));

    if (hasProviderSetup || hasProviderSelection) {
      console.log('\n=== SUCCESS: ProviderSetupScreen is showing! ===');
      proc.kill();
      process.exit(0);
    }

    if (hasAgentScreen) {
      console.log('\n=== FAIL: Agent screen showed instead of Provider Setup ===');
      proc.kill();
      process.exit(1);
    }

    if (hasCrash) {
      console.log('\n=== FAIL: Crash detected ===');
      lines.filter(l => l.trim()).forEach(l => console.log(`  ${l}`));
      proc.kill();
      process.exit(1);
    }
  }

  console.log('\n=== TIMEOUT: Neither Provider Setup nor Agent screen appeared ===');
  // Print all lines for debugging
  const lines: string[] = [];
  const buffer = term.buffer.active;
  for (let i = 0; i < ROWS; i++) {
    const line = buffer.getLine(i);
    lines.push(line ? line.translateToString(true) : '');
  }
  lines.filter(l => l.trim()).forEach(l => console.log(`  ${l}`));
  proc.kill();
  process.exit(1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
