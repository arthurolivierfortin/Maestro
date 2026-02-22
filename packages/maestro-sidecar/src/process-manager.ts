import { spawn, type ChildProcess } from 'child_process';
import * as readline from 'readline';

export interface ManagedProcess {
  process: ChildProcess;
  name: string;
  port: number;
  kill(): Promise<void>;
}

/**
 * Spawn a managed child process with log piping and graceful shutdown.
 */
export function spawnManaged(opts: {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  port: number;
  env?: Record<string, string>;
  onLog?: (line: string) => void;
  inheritStdio?: boolean;
}): ManagedProcess {
  const env = { ...process.env, ...opts.env };
  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env,
    stdio: opts.inheritStdio ? 'inherit' : 'pipe',
    windowsHide: true,
    detached: false,
  });

  // Pipe stdout/stderr line by line
  if (!opts.inheritStdio && opts.onLog) {
    const onLog = opts.onLog;
    if (child.stdout) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => onLog(line));
    }
    if (child.stderr) {
      const rl = readline.createInterface({ input: child.stderr });
      rl.on('line', (line) => onLog(line));
    }
  }

  return {
    process: child,
    name: opts.name,
    port: opts.port,
    async kill() {
      if (child.killed || child.exitCode !== null) return;

      // Try tree-kill for Windows process tree cleanup
      try {
        const treeKill = (await import('tree-kill')).default;
        await new Promise<void>((resolve, reject) => {
          treeKill(child.pid!, 'SIGTERM', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch {
        // Fallback to regular kill
        child.kill('SIGTERM');
      }

      // Wait up to 5s for graceful exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGKILL');
          }
          resolve();
        }, 5000);
        child.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    },
  };
}
