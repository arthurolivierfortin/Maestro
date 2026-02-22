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

interface Widget {
  type: string;
  content: string;
  params: Record<string, any>;
  id: string;
  interactive?: boolean;
  timestamp?: string;
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
  private widgetPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastWidgetId: string | null = null;

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
    this.stopWidgetPolling();
  }

  async sendMessage(message: string, addLine: (line: LogLine) => void): Promise<void> {
    if (!this.sessionId) return;

    try {
      await this.client._fetch('PUT',
        `/api/sessions/${this.sessionId}/variables/_userMessage`,
        { body: { value: { text: message, time: new Date().toISOString() } } }
      );
      addLine({ text: `> ${message}`, color: 'green', bold: true, timestamp: ts() });
    } catch (err: any) {
      addLine({ text: `Error sending message: ${err.message}`, color: 'red', timestamp: ts() });
    }
  }

  startWidgetPolling(
    addLine: (line: LogLine) => void,
    setWidget: (w: Widget | null) => void,
    setPendingInteractive: (w: Widget | null) => void
  ): void {
    this.widgetPollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};
        const widgetReq = vars._widgetRequest;

        if (widgetReq && widgetReq.widget && widgetReq.widget.id !== this.lastWidgetId) {
          this.lastWidgetId = widgetReq.widget.id;
          const widget = widgetReq.widget as Widget;
          setWidget(widget);

          if (!widget.interactive) {
            addLine({
              text: `[${widget.type}] ${widget.content}`,
              color: 'blue',
              timestamp: widget.timestamp || ts(),
            });
          } else {
            setPendingInteractive(widget);
          }
        }
      } catch {
        // Non-fatal
      }
    }, 500);
  }

  async sendWidgetResponse(
    response: string,
    widgetId: string,
    addLine: (line: LogLine) => void
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      await this.client._fetch('PUT',
        `/api/sessions/${this.sessionId}/variables/_widgetResponse`,
        { body: { value: { response, widgetId } } }
      );
      addLine({ text: `  Response: ${response}`, color: 'cyan', timestamp: ts() });
    } catch (err: any) {
      addLine({ text: `Error sending response: ${err.message}`, color: 'red', timestamp: ts() });
    }
  }

  stopWidgetPolling(): void {
    if (this.widgetPollTimer) {
      clearInterval(this.widgetPollTimer);
      this.widgetPollTimer = null;
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

const StatusBar = ({ sessionId, busy, voiceActive }: { sessionId: string | null; busy: boolean; voiceActive?: boolean }) => {
  const sessionLabel = sessionId ? `Session: ${sessionId.slice(0, 8)}` : 'No session';
  const statusLabel = busy ? 'Running...' : 'Ready';
  const statusColor = busy ? 'yellow' : 'green';

  return h(Box, { paddingX: 1, justifyContent: 'space-between' },
    h(Box, null,
      h(Text, { color: 'gray', dimColor: true }, sessionLabel),
      voiceActive ? h(Text, { color: 'magenta', bold: true }, ' VOICE') : null
    ),
    h(Text, { color: statusColor, dimColor: !busy }, statusLabel)
  );
};

// ── WidgetRenderer ──────────────────────────────────────────────

const WidgetRenderer = ({ widget, onResponse }: { widget: Widget | null; onResponse: (response: string) => void }) => {
  if (!widget) return null;

  switch (widget.type) {
    case 'message':
      return h(Box, { borderStyle: 'round', borderColor: 'blue', paddingX: 1, marginY: 1 },
        h(Text, { color: 'blue', bold: true }, 'Agent: '),
        h(Text, null, widget.content)
      );

    case 'progress':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'cyan',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'cyan', bold: true }, 'Progress'),
        h(Text, null, widget.content),
        ...(widget.params.phases || []).map((phase: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: phase.status === 'completed' ? 'green'
                : phase.status === 'in_progress' ? 'yellow'
                : 'gray',
            },
              phase.status === 'completed' ? '  [done] '
                : phase.status === 'in_progress' ? '  [>>]   '
                : '  [  ]   '
            ),
            h(Text, null, `${phase.name}${phase.detail ? ` — ${phase.detail}` : ''}`)
          )
        )
      );

    case 'confirmation':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'yellow',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'yellow', bold: true }, 'Confirmation required'),
        h(Text, null, widget.content),
        h(Text, { color: 'gray', dimColor: true },
          `Action: ${widget.params.action || 'N/A'}`
        ),
        h(Text, { color: 'gray', dimColor: true },
          `Consequence: ${widget.params.consequence || 'N/A'}`
        ),
        h(Text, { color: 'cyan' }, 'Type "yes" or "no" to respond.')
      );

    case 'option-select':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'magenta',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'magenta', bold: true }, widget.params.prompt || 'Choose:'),
        h(Text, null, widget.content),
        ...(widget.params.options || []).map((opt: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: 'cyan' }, `  [${opt.id}] `),
            h(Text, null, opt.label),
            opt.description
              ? h(Text, { color: 'gray', dimColor: true }, ` — ${opt.description}`)
              : null
          )
        ),
        h(Text, { color: 'cyan' }, 'Type the option ID to select.')
      );

    case 'plan-view':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'green',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'green', bold: true }, 'Implementation Plan'),
        ...(widget.params.steps || []).map((step: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: step.status === 'done' ? 'green'
                : step.status === 'in_progress' ? 'yellow'
                : 'gray',
            },
              step.status === 'done' ? '  [done] '
                : step.status === 'in_progress' ? '  [>>]   '
                : '  [  ]   '
            ),
            h(Text, null, step.description),
            step.domain
              ? h(Text, { color: 'gray', dimColor: true }, ` (${step.domain})`)
              : null
          )
        )
      );

    case 'test-results':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'green',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'green', bold: true }, 'Test Results'),
        ...(widget.params.suites || []).map((suite: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: suite.failed > 0 ? 'red' : 'green',
            }, `  ${suite.name}: `),
            h(Text, { color: 'green' }, `${suite.passed} passed`),
            suite.failed > 0
              ? h(Text, { color: 'red' }, ` / ${suite.failed} failed`)
              : null
          )
        )
      );

    default:
      return h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 1, marginY: 1 },
        h(Text, { color: 'gray' }, `[${widget.type}] ${widget.content}`)
      );
  }
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
    { text: 'Type a task and press Enter. Ctrl+C to quit. Ctrl+V to toggle voice mode.', color: 'gray', dim: true },
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (stdout.rows) setRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
      // Cleanup polling on unmount
      if (sessionManager) {
        sessionManager.stopPolling();
        sessionManager.stopWidgetPolling();
      }
    };
  }, [stdout, sessionManager]);

  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      if (sessionManager) sessionManager.stopPolling();
      exit();
    }
    if (input === 'v' && key.ctrl) {
      setVoiceMode(v => !v);
    }
  });

  const addLine = useCallback((line: LogLine) => {
    setLines(prev => [...prev, line]);
  }, []);

  const handleSubmit = useCallback((input: string) => {
    // Branch 1: User responding to an interactive widget
    if (pendingInteractive) {
      addLine({ text: `> ${input}`, color: 'green' });
      if (sessionManager) {
        sessionManager.sendWidgetResponse(input, pendingInteractive.id, addLine);
      }
      setPendingInteractive(null);
      setCurrentWidget(null);
      return;
    }

    // Branch 2: Session running — send as user message
    if (busy && sessionManager?.getSessionId()) {
      sessionManager.sendMessage(input, addLine);
      return;
    }

    // Branch 3: First message — create session (existing behavior)
    addLine({ text: `> ${input}`, color: 'green', bold: true });

    if (sessionManager) {
      sessionManager.submitTask(input, addLine, (b) => {
        setBusy(b);
        if (!b) {
          setCurrentSessionId(null);
          sessionManager.stopWidgetPolling();
        } else {
          setCurrentSessionId(sessionManager.getSessionId());
          sessionManager.startWidgetPolling(addLine, setCurrentWidget, setPendingInteractive);
        }
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
  }, [addLine, sessionManager, busy, pendingInteractive]);

  const outputHeight = Math.max(rows - 7, 5);

  return h(Box, { flexDirection: 'column', width: '100%', height: rows },
    h(OutputPanel, { lines, height: outputHeight - (currentWidget ? 8 : 0) }),
    currentWidget ? h(WidgetRenderer, { widget: currentWidget, onResponse: () => {} }) : null,
    h(StatusBar, { sessionId: currentSessionId, busy, voiceActive: voiceMode }),
    h(InputPrompt, {
      onSubmit: handleSubmit,
      disabled: false,
      placeholder: pendingInteractive
        ? 'Respond to the widget above...'
        : voiceMode
          ? 'Listening...'
          : busy
            ? 'Send a message to the agent...'
            : 'Describe your task...',
    })
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

export { startInteractive, InteractiveApp, OutputPanel, InputPrompt, StatusBar, SessionManager, WidgetRenderer };
export type { LogLine as InteractiveLogLine, InteractiveOptions, Widget };
