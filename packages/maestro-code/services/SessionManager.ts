// @ts-nocheck
/**
 * SessionManager — Manages the Maestro session lifecycle.
 *
 * Extracted from App.ts to reduce file size and improve modularity.
 * Handles: session creation, template import, entry point invocation,
 * polling for completion, widget polling, and user messages.
 */

import * as nodePath from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface LogLine {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  timestamp?: string;
}

export interface InteractiveOptions {
  apiClient?: any;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  importSessionTemplate?: (sessionId: string, templateName: string) => Promise<void>;
  isFirstRun?: boolean;
  demo?: boolean;
}

export interface Widget {
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

class SessionManager {
  private client: any;
  private repoPath: string;
  private template: string;
  private entryPoint: string;
  private importTemplate: (sessionId: string, templateName: string) => Promise<void>;
  private sessionId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
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
      const path = nodePath;
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

      // 5. Start polling for completion
      this.startPolling(addLine, setBusy);

    } catch (err: any) {
      addLine({ text: `Error: ${err.message || err}`, color: 'red', bold: true, timestamp: ts() });
      addLine({ text: '' });
      setBusy(false);
    }
  }

  private lastReportedNodes = new Set<string>();

  private startPolling(addLine: (line: LogLine) => void, setBusy: (b: boolean) => void) {
    this.lastReportedNodes.clear();

    this.pollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};
        const tree: any[] = vars._executionTree || [];

        // Show intermediate actions (new tool calls as they appear)
        for (const node of tree) {
          const children: any[] = node.children || [];
          for (const child of children) {
            const key = `${node.id}:${child.id || child.name}`;
            if (!this.lastReportedNodes.has(key) && child.status && child.status !== 'pending') {
              this.lastReportedNodes.add(key);
              const icon = child.status === 'completed' ? '✓' : child.status === 'error' ? '✗' : '…';
              const color = child.status === 'completed' ? 'green' : child.status === 'error' ? 'red' : 'yellow';
              addLine({ text: `  ${icon} ${child.name || child.id || 'step'}`, color, timestamp: ts() });
            }
          }
        }

        const status = session.status || session.containerStatus;
        const allDone = tree.length > 0 && tree.every(n => n.status === 'completed' || n.status === 'done' || n.status === 'error' || n.status === 'skipped');
        if (allDone || status === 'completed' || status === 'idle') {
          this.stopPolling();
          const hasErrors = tree.some(n => n.status === 'error');

          // Extract the agent's response from execution tree output
          const lastNode = tree[tree.length - 1];
          const agentOutput = lastNode?.output?.summary
            || lastNode?.output?.result
            || lastNode?.output?.response;

          if (agentOutput) {
            addLine({ text: '' });
            addLine({ text: 'Agent:', color: 'cyan', bold: true, timestamp: ts() });
            // Split long output into lines for readability
            const outputLines = String(agentOutput).split('\n');
            for (const line of outputLines) {
              addLine({ text: `  ${line}`, color: 'white' });
            }
          }

          // Also check _conversationState variables for the response
          if (!agentOutput) {
            const convKeys = Object.keys(vars).filter(k => k.startsWith('_conversationState_'));
            for (const key of convKeys) {
              const conv = vars[key];
              if (conv && Array.isArray(conv.messages)) {
                const lastMsg = conv.messages[conv.messages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
                  addLine({ text: '' });
                  addLine({ text: 'Agent:', color: 'cyan', bold: true, timestamp: ts() });
                  const msgLines = String(lastMsg.content).split('\n').slice(0, 10);
                  for (const line of msgLines) {
                    addLine({ text: `  ${line}`, color: 'white' });
                  }
                  break;
                }
              }
            }
          }

          addLine({ text: '' });
          if (hasErrors) {
            addLine({ text: 'Task completed with errors', color: 'red', bold: true, timestamp: ts() });
          } else if (tree.length > 0) {
            addLine({ text: 'Task completed', color: 'green', bold: true, timestamp: ts() });
          }
          addLine({ text: '' });
          setBusy(false);
        }
      } catch (err: any) {
        // Poll errors are non-fatal
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

export { SessionManager, ts };
