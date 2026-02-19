import { spawn, execSync, type ChildProcess } from 'child_process';
import path from 'path';
import { platform } from 'os';

type LogCallback = (line: string) => void;

/** Manages the .NET backend process lifecycle */
export class ProcessManager {
  private process: ChildProcess | null = null;
  private logCallbacks: LogCallback[] = [];
  private projectPath: string;

  constructor(projectPath?: string) {
    this.projectPath = projectPath ?? path.resolve(
      import.meta.dirname ?? process.cwd(),
      '..', 'dotnet', 'src', 'LLMProvider.Web'
    );
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  get pid(): number | undefined {
    return this.process?.pid;
  }

  onLog(callback: LogCallback): void {
    this.logCallbacks.push(callback);
  }

  start(): void {
    if (this.isRunning) return;

    this.process = spawn('dotnet', ['run', '--project', this.projectPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => this.logCallbacks.forEach(cb => cb(line)));
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => this.logCallbacks.forEach(cb => cb(`[ERR] ${line}`)));
    });

    this.process.on('exit', (code) => {
      this.logCallbacks.forEach(cb => cb(`Process exited with code ${code}`));
      this.process = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    const pid = this.process.pid;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill after timeout
        this.forceKill(pid);
        resolve();
      }, 5000);

      this.process!.on('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        resolve();
      });

      // On Windows, SIGTERM doesn't work for .NET processes.
      // Use taskkill which properly terminates the process tree.
      if (platform() === 'win32' && pid) {
        try {
          execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
        } catch {
          // Process may have already exited
        }
      } else {
        this.process!.kill('SIGTERM');
      }
    });
  }

  private forceKill(pid: number | undefined): void {
    if (!pid) return;
    try {
      if (platform() === 'win32') {
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process already exited
    }
    this.process = null;
  }
}
