// @ts-nocheck
/**
 * Maestro Interactive Mode — Ink App (Phase 33-B)
 *
 * Split layout: OutputPanel (scrollable log) on top, InputPrompt at bottom.
 * Wired to Maestro session lifecycle: create → template → start → invoke → poll.
 *
 * Entry: call startInteractive() via dynamic import (same pattern as monitor).
 */

import { createElement as h, useState, useCallback, useEffect, useRef } from 'react';
import { render, useApp, useStdout, Box, Text, useInput } from 'ink';

// ── Types ──────────────────────────────────────────────────────

export interface LogLine {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  timestamp?: string;
}

interface InteractiveOptions {
  apiClient?: any;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  importSessionTemplate?: (sessionId: string, templateName: string) => Promise<void>;
}

// ── Timestamp helper ──────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

// ── Session Manager ───────────────────────────────────────────
// Manages the Maestro session lifecycle outside of React state.

class SessionManager {
  private client: any;
  private repoPath: string;
  private template: string;
  private entryPoint: string;
  private importTemplate: (sessionId: string, templateName: string) => Promise<void>;
  private sessionId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastLogCount = 0;
  private lastTreeHash = '';

  constructor(options: InteractiveOptions) {
    this.client = options.apiClient;
    this.repoPath = options.repoPath || process.cwd();
    this.template = options.template || 'project-autonomous';
    this.entryPoint = options.entryPoint || 'dev';
    this.importTemplate = options.importSessionTemplate || (async () => {});
  }

  async submitTask(
    task: string,
    addLine: (line: LogLine) => void,
    setBusy: (b: boolean) => void
  ): Promise<void> {
    setBusy(true);

    try {
      // 1. Create session
      addLine({ text: 'Creating session...', color: 'gray', dim: true, timestamp: ts() });
      const path = require('path');
      const session = await this.client.createSession({
        repositoryPath: this.repoPath,
        authority: 'human',
        name: `${path.basename(this.repoPath)} - ${task.slice(0, 60)}`,
      });
      this.sessionId = session.id;
      addLine({ text: `Session: ${session.id.slice(0, 8)}`, color: 'gray', timestamp: ts() });

      // 2. Import template
      addLine({ text: `Importing template: ${this.template}`, color: 'gray', dim: true, timestamp: ts() });
      await this.importTemplate(this.sessionId, this.template);

      // 3. Start session
      await this.client.startSession(this.sessionId);
      addLine({ text: 'Session started', color: 'gray', timestamp: ts() });

      // 4. Invoke entry point
      const inputs: Record<string, string> = { repoPath: this.repoPath, task };
      addLine({ text: `Invoking: ${this.entryPoint}`, color: 'cyan', bold: true, timestamp: ts() });
      await this.client._fetch('POST', `/api/sessions/${this.sessionId}/invoke/${this.entryPoint}`, {
        body: { inputs }
      });

      // 5. Start polling for updates
      this.lastLogCount = 0;
      this.lastTreeHash = '';
      this.startPolling(addLine, setBusy);

    } catch (err: any) {
      addLine({ text: `Error: ${err.message || err}`, color: 'red', bold: true, timestamp: ts() });
      addLine({ text: '' });
      setBusy(false);
    }
  }

  private startPolling(addLine: (line: LogLine) => void, setBusy: (b: boolean) => void) {
    this.pollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};

        // Check execution log for new entries
        const log: any[] = vars._executionLog || [];
        if (log.length > this.lastLogCount) {
          const newEntries = log.slice(this.lastLogCount);
          for (const entry of newEntries) {
            const level = entry.level || 'info';
            const color = level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'white';
            addLine({ text: entry.msg || entry.message || JSON.stringify(entry), color, timestamp: entry.time || ts() });
          }
          this.lastLogCount = log.length;
        }

        // Check execution tree for status changes
        const tree: any[] = vars._executionTree || [];
        const treeHash = JSON.stringify(tree.map(n => `${n.name}:${n.status}`));
        if (treeHash !== this.lastTreeHash) {
          this.lastTreeHash = treeHash;
          // Show node status updates
          for (const node of tree) {
            if (node.status === 'running') {
              addLine({ text: `  ▶ ${node.name}`, color: 'cyan', timestamp: ts() });
            } else if (node.status === 'completed') {
              addLine({ text: `  ✓ ${node.name}`, color: 'green', timestamp: ts() });
            } else if (node.status === 'error') {
              addLine({ text: `  ✗ ${node.name}: ${node.error || 'failed'}`, color: 'red', timestamp: ts() });
            }
          }
        }

        // Check if workflow is done
        const status = session.status || session.containerStatus;
        const allDone = tree.length > 0 && tree.every(n => n.status === 'completed' || n.status === 'error' || n.status === 'skipped');
        if (allDone || status === 'completed' || status === 'idle') {
          this.stopPolling();
          const hasErrors = tree.some(n => n.status === 'error');
          if (hasErrors) {
            addLine({ text: 'Task completed with errors', color: 'red', bold: true, timestamp: ts() });
          } else if (tree.length > 0) {
            addLine({ text: 'Task completed', color: 'green', bold: true, timestamp: ts() });
          }
          addLine({ text: '' });
          setBusy(false);
        }
      } catch (err: any) {
        // Poll errors are non-fatal — session may still be running
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// ── OutputPanel ────────────────────────────────────────────────

const OutputPanel = ({ lines, height }: { lines: LogLine[]; height: number }) => {
  const maxLines = Math.max(height - 2, 1);
  const visible = lines.slice(-maxLines);

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: 'gray',
    paddingX: 1,
    height,
    overflow: 'hidden',
  },
    ...visible.map((line, i) =>
      h(Box, { key: i },
        line.timestamp
          ? h(Text, { color: 'gray', dimColor: true }, `${line.timestamp} `)
          : null,
        h(Text, {
          color: (line.color || 'white') as any,
          bold: line.bold,
          dimColor: line.dim,
        }, line.text)
      )
    ),
    visible.length === 0
      ? h(Text, { color: 'gray', dimColor: true }, 'Waiting for input...')
      : null
  );
};

// ── StatusBar ─────────────────────────────────────────────────

const StatusBar = ({ sessionId, busy }: { sessionId: string | null; busy: boolean }) => {
  const sessionLabel = sessionId ? `Session: ${sessionId.slice(0, 8)}` : 'No session';
  const statusLabel = busy ? 'Running...' : 'Ready';
  const statusColor = busy ? 'yellow' : 'green';

  return h(Box, { paddingX: 1, justifyContent: 'space-between' },
    h(Text, { color: 'gray', dimColor: true }, sessionLabel),
    h(Text, { color: statusColor, dimColor: !busy }, statusLabel)
  );
};

// ── InputPrompt ────────────────────────────────────────────────

const InputPrompt = ({ onSubmit, disabled, placeholder }: {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (disabled) return;

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue('');
      }
      return;
    }
    if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setValue(v => v + input);
    }
  });

  const prompt = disabled ? '...' : '>';
  const promptColor = disabled ? 'gray' : 'green';

  return h(Box, {
    borderStyle: 'round',
    borderColor: disabled ? 'gray' : 'cyan',
    paddingX: 1,
    flexShrink: 0,
  },
    h(Text, { color: promptColor, bold: true }, `${prompt} `),
    h(Text, null,
      value || h(Text, { color: 'gray', dimColor: true }, placeholder || 'Describe your task...')
    )
  );
};

// ── Root App ───────────────────────────────────────────────────

const InteractiveApp = ({ sessionManager }: { sessionManager: SessionManager | null }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);
  const [lines, setLines] = useState<LogLine[]>([
    { text: 'Maestro Interactive Mode', color: 'cyan', bold: true },
    { text: 'Type a task and press Enter. Ctrl+C to quit.', color: 'gray', dim: true },
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (stdout.rows) setRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
      // Cleanup polling on unmount
      if (sessionManager) sessionManager.stopPolling();
    };
  }, [stdout, sessionManager]);

  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      if (sessionManager) sessionManager.stopPolling();
      exit();
    }
  });

  const addLine = useCallback((line: LogLine) => {
    setLines(prev => [...prev, line]);
  }, []);

  const handleSubmit = useCallback((task: string) => {
    addLine({ text: `> ${task}`, color: 'green', bold: true });

    if (sessionManager) {
      sessionManager.submitTask(task, addLine, (b) => {
        setBusy(b);
        if (!b) setCurrentSessionId(null);
        else setCurrentSessionId(sessionManager.getSessionId());
      });
    } else {
      // Demo mode (no API client)
      setBusy(true);
      addLine({ text: 'Processing... (demo mode — no API)', color: 'gray', dim: true, timestamp: ts() });
      setTimeout(() => {
        addLine({ text: 'Done (no real execution in demo mode)', color: 'yellow', timestamp: ts() });
        addLine({ text: '' });
        setBusy(false);
      }, 1000);
    }
  }, [addLine, sessionManager]);

  const outputHeight = Math.max(rows - 7, 5);

  return h(Box, { flexDirection: 'column', width: '100%', height: rows },
    h(OutputPanel, { lines, height: outputHeight }),
    h(StatusBar, { sessionId: currentSessionId, busy }),
    h(InputPrompt, { onSubmit: handleSubmit, disabled: busy })
  );
};

// ── Public entry point ─────────────────────────────────────────

async function startInteractive(options: InteractiveOptions = {}): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error('Interactive mode requires a terminal (TTY).');
    process.exit(1);
  }

  // Create session manager if API client is provided
  const sessionManager = options.apiClient ? new SessionManager(options) : null;

  const instance = render(
    h(InteractiveApp, { sessionManager }),
    { exitOnCtrlC: true }
  );

  await instance.waitUntilExit();
}

export { startInteractive, InteractiveApp, OutputPanel, InputPrompt, StatusBar, SessionManager };
export type { LogLine as InteractiveLogLine, InteractiveOptions };
