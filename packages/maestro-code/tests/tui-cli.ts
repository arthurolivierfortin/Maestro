/**
 * TUI CLI — PTY server for E2E testing subagent.
 *
 * Runs the TUI in background and accepts commands via file-based IPC.
 * A Claude Code subagent with only Bash access drives the app through
 * simple helper functions (tui-helpers.sh) that read/write the IPC files.
 *
 * Architecture:
 *   tui-cli.ts serve  →  spawns TUI, polls IPC_DIR/cmd every 200ms
 *   tui-helpers.sh    →  source'd by the subagent, writes cmd, reads result
 *
 * IPC directory layout:
 *   $IPC_DIR/pid          — server PID (for cleanup)
 *   $IPC_DIR/ready        — created when TUI is ready
 *   $IPC_DIR/frame.txt    — latest captured frame
 *   $IPC_DIR/cmd          — command to execute (written by agent, deleted after processing)
 *   $IPC_DIR/result.txt   — command result (written by server, read by agent)
 *
 * Usage:
 *   npx tsx tests/tui-cli.ts serve --mode demo [--ipc-dir /tmp/tui-ipc]
 */

import { TuiDriver, type Frame } from './tui-driver.ts';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_IPC_DIR = process.platform === 'win32'
  ? path.join(process.env.TEMP || 'C:\\Temp', 'tui-ipc')
  : '/tmp/tui-ipc';

let driver: TuiDriver | null = null;

function formatFrame(frame: Frame): string {
  const nonEmpty = frame.lines.filter(l => l.trim());
  const lines = [
    `--- Frame (${frame.timestamp}ms, ${nonEmpty.length} lines) ---`,
    ...nonEmpty.map(l => l.substring(0, 140)),
    '--- End Frame ---',
  ];
  return lines.join('\n');
}

async function processCommand(cmdLine: string, ipcDir: string): Promise<string> {
  const parts = cmdLine.trim().split(/\s+/);
  const cmd = parts[0];
  const rest = parts.slice(1).join(' ');

  switch (cmd) {
    case 'frame': {
      const frame = driver!.captureFrame();
      const text = formatFrame(frame);
      fs.writeFileSync(path.join(ipcDir, 'frame.txt'), text, 'utf-8');
      return text;
    }

    case 'press': {
      driver!.press(rest as any);
      // Small delay for React to process the keystroke
      await new Promise(r => setTimeout(r, 300));
      const frame = driver!.captureFrame();
      const text = formatFrame(frame);
      fs.writeFileSync(path.join(ipcDir, 'frame.txt'), text, 'utf-8');
      return `[tui-cli] Pressed: ${rest}\n${text}`;
    }

    case 'type': {
      await driver!.typeText(rest, 20);
      // Small delay for React to process
      await new Promise(r => setTimeout(r, 500));
      const frame = driver!.captureFrame();
      const text = formatFrame(frame);
      fs.writeFileSync(path.join(ipcDir, 'frame.txt'), text, 'utf-8');
      return `[tui-cli] Typed: "${rest}"\n${text}`;
    }

    case 'wait': {
      const timeout = parts.includes('--timeout')
        ? parseInt(parts[parts.indexOf('--timeout') + 1])
        : 30000;
      const pattern = parts
        .filter(p => p !== '--timeout' && p !== parts[parts.indexOf('--timeout') + 1])
        .slice(1)
        .join(' ');
      const frame = await driver!.waitForContent(pattern, timeout);
      const found = frame.text.includes(pattern);
      const text = formatFrame(frame);
      fs.writeFileSync(path.join(ipcDir, 'frame.txt'), text, 'utf-8');
      return `[tui-cli] ${found ? 'FOUND' : 'NOT FOUND'}: "${pattern}"\n${text}`;
    }

    case 'stable': {
      const timeout = parts.includes('--timeout')
        ? parseInt(parts[parts.indexOf('--timeout') + 1])
        : 15000;
      const frame = await driver!.waitForStable(1000, timeout);
      const text = formatFrame(frame);
      fs.writeFileSync(path.join(ipcDir, 'frame.txt'), text, 'utf-8');
      return `[tui-cli] Screen stable.\n${text}`;
    }

    case 'check': {
      const frame = driver!.captureFrame();
      const found = frame.text.includes(rest);
      const text = formatFrame(frame);
      if (!found) {
        fs.writeFileSync(path.join(ipcDir, 'frame.txt'), text, 'utf-8');
      }
      return `[tui-cli] CHECK "${rest}": ${found ? 'PASS' : 'FAIL'}${found ? '' : '\n' + text}`;
    }

    case 'kill': {
      driver!.kill();
      return '[tui-cli] TUI killed.';
    }

    default:
      return `[tui-cli] Unknown command: ${cmd}. Use: frame, press, type, wait, stable, check, kill`;
  }
}

async function serve(args: string[]) {
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] as 'demo' | 'real' : 'demo';
  const ipcDirIdx = args.indexOf('--ipc-dir');
  const ipcDir = ipcDirIdx >= 0 ? args[ipcDirIdx + 1] : DEFAULT_IPC_DIR;
  const repoIdx = args.indexOf('--repo');
  const repo = repoIdx >= 0 ? args[repoIdx + 1] : undefined;

  // Clean up previous IPC state
  if (fs.existsSync(ipcDir)) {
    for (const f of ['cmd', 'result.txt', 'ready', 'pid', 'frame.txt']) {
      const p = path.join(ipcDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } else {
    fs.mkdirSync(ipcDir, { recursive: true });
  }

  // Write PID
  fs.writeFileSync(path.join(ipcDir, 'pid'), String(process.pid), 'utf-8');

  console.log(`[tui-cli] Spawning TUI in ${mode} mode...`);
  console.log(`[tui-cli] IPC dir: ${ipcDir}`);

  driver = new TuiDriver(120, 40);
  await driver.spawn(mode, { repo });

  console.log('[tui-cli] Waiting for initial render...');
  const frame = await driver.waitForRender(20000);
  const frameText = formatFrame(frame);
  fs.writeFileSync(path.join(ipcDir, 'frame.txt'), frameText, 'utf-8');

  if (frame.text.includes('Backend Not Available')) {
    console.error('[tui-cli] WARNING: Backend not running!');
  }

  // Signal ready
  fs.writeFileSync(path.join(ipcDir, 'ready'), 'true', 'utf-8');
  console.log('[tui-cli] TUI ready. Polling for commands...');

  // Poll for commands
  const cmdPath = path.join(ipcDir, 'cmd');
  const resultPath = path.join(ipcDir, 'result.txt');

  let running = true;
  while (running) {
    await new Promise(r => setTimeout(r, 200));

    if (!fs.existsSync(cmdPath)) continue;

    let cmdLine: string;
    try {
      cmdLine = fs.readFileSync(cmdPath, 'utf-8').trim();
      fs.unlinkSync(cmdPath);
    } catch {
      continue; // File might be mid-write
    }

    if (!cmdLine) continue;

    console.log(`[tui-cli] Command: ${cmdLine}`);
    try {
      const result = await processCommand(cmdLine, ipcDir);
      fs.writeFileSync(resultPath, result, 'utf-8');
      console.log(`[tui-cli] Result written (${result.length} chars)`);

      if (cmdLine.trim() === 'kill') {
        running = false;
      }
    } catch (err: any) {
      const errMsg = `[tui-cli] Error: ${err.message}`;
      fs.writeFileSync(resultPath, errMsg, 'utf-8');
      console.error(errMsg);
    }
  }

  // Cleanup
  console.log('[tui-cli] Shutting down...');
  for (const f of ['cmd', 'ready', 'pid']) {
    const p = path.join(ipcDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error('Usage: npx tsx tests/tui-cli.ts serve [--mode demo|real] [--ipc-dir path]');
    process.exit(1);
  }

  if (command === 'serve') {
    await serve(args.slice(1));
  } else {
    console.error(`[tui-cli] Unknown command: ${command}. Use: serve`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`[tui-cli] Fatal error: ${err.message}`);
  process.exit(1);
});
