import fs from 'fs';
import path from 'path';

type LineCallback = (line: string) => void;

/** Streams and buffers log lines from the Serilog file sink */
export class LogStreamer {
  private lines: string[] = [];
  private lineCallbacks: LineCallback[] = [];
  private watcher: fs.FSWatcher | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private lastSize = 0;
  private filePath: string | null = null;
  private maxLines: number;

  constructor(private logDir: string, maxLines = 500) {
    this.maxLines = maxLines;
  }

  start(): void {
    this.filePath = this.findLatestLog();
    if (!this.filePath) return;

    // Initial read
    this.readNewLines();

    // Watch for changes
    try {
      this.watcher = fs.watch(this.logDir, (_event, filename) => {
        if (filename && filename.endsWith('.log')) {
          // Check if there's a newer log file
          const latest = this.findLatestLog();
          if (latest && latest !== this.filePath) {
            this.filePath = latest;
            this.lastSize = 0;
          }
          this.readNewLines();
        }
      });
    } catch {
      // Fallback to polling — store timer reference so stop() can clear it
      this.fallbackTimer = setInterval(() => this.readNewLines(), 1000);
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.lineCallbacks = [];
  }

  /** Register a line callback. Returns an unsubscribe function. */
  onLine(callback: LineCallback): () => void {
    this.lineCallbacks.push(callback);
    return () => {
      const idx = this.lineCallbacks.indexOf(callback);
      if (idx >= 0) this.lineCallbacks.splice(idx, 1);
    };
  }

  getLines(): string[] {
    return [...this.lines];
  }

  clear(): void {
    this.lines = [];
  }

  private readNewLines(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;

    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size <= this.lastSize) return;

      const fd = fs.openSync(this.filePath, 'r');
      const buffer = Buffer.alloc(stat.size - this.lastSize);
      fs.readSync(fd, buffer, 0, buffer.length, this.lastSize);
      fs.closeSync(fd);

      this.lastSize = stat.size;

      const newLines = buffer.toString('utf8').split('\n').filter(Boolean);
      for (const line of newLines) {
        this.lines.push(line);
        if (this.lines.length > this.maxLines) {
          this.lines.shift();
        }
        this.lineCallbacks.forEach(cb => cb(line));
      }
    } catch {
      // File might be locked during write
    }
  }

  private findLatestLog(): string | null {
    try {
      if (!fs.existsSync(this.logDir)) return null;

      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('llm-provider-') && f.endsWith('.log'))
        .sort()
        .reverse();

      return files.length > 0 ? path.join(this.logDir, files[0]!) : null;
    } catch {
      return null;
    }
  }
}
