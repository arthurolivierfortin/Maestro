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

  private lastReportedStatus = new Map<string, string>();

  private startPolling(addLine: (line: LogLine) => void, setBusy: (b: boolean) => void) {
    this.lastReportedStatus.clear();

    const reportNode = (key: string, name: string, status: string) => {
      const isDone = status === 'completed' || status === 'done';
      const isError = status === 'error';
      const icon = isDone ? '✓' : isError ? '✗' : '…';
      const color = isDone ? 'green' : isError ? 'red' : 'yellow';

      const prevStatus = this.lastReportedStatus.get(key);
      if (prevStatus === status) return; // already reported this status
      if (!status || status === 'pending') return;

      this.lastReportedStatus.set(key, status);
      addLine({ text: `  ${icon} ${name}`, color, timestamp: ts() });
    };

    this.pollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};
        const tree: any[] = vars._executionTree || [];

        // Report child nodes (nested execution trees)
        for (const node of tree) {
          const children: any[] = node.children || [];
          for (const child of children) {
            reportNode(
              `${node.id}:${child.id || child.name}`,
              child.name || child.id || 'step',
              child.status
            );
          }
        }

        // Report top-level nodes with no children (flat execution trees)
        for (const node of tree) {
          if (!(node.children || []).length) {
            reportNode(
              `root:${node.id || node.name}`,
              node.name || node.id || 'step',
              node.status
            );
          }
        }

        const status = session.status || session.containerStatus;
        const allDone = tree.length > 0 && tree.every(n => n.status === 'completed' || n.status === 'done' || n.status === 'error' || n.status === 'skipped');
        if (allDone || status === 'completed' || status === 'idle') {
          this.stopPolling();
          const hasErrors = tree.some(n => n.status === 'error');

          // Extract the agent's response — try multiple sources
          let agentOutput: string | null = null;

          // Source 1: Execution tree node output (backend stores as string directly)
          const lastNode = tree[tree.length - 1];
          if (lastNode?.output) {
            if (typeof lastNode.output === 'string') {
              agentOutput = lastNode.output;
            } else if (typeof lastNode.output === 'object') {
              agentOutput = lastNode.output.summary
                || lastNode.output.result
                || lastNode.output.response
                || JSON.stringify(lastNode.output);
            }
          }

          // Source 2: _blockOutputs variable (per-node output with metadata)
          if (!agentOutput) {
            const blockOutputs = vars._blockOutputs;
            if (blockOutputs && typeof blockOutputs === 'object') {
              const keys = Object.keys(blockOutputs);
              // Take the last block output
              const lastKey = keys[keys.length - 1];
              if (lastKey) {
                const bo = blockOutputs[lastKey];
                if (typeof bo === 'string') agentOutput = bo;
                else if (bo?.output) agentOutput = String(bo.output);
              }
            }
          }

          // Source 3: _nodeResult_* variables (full output per node ID)
          if (!agentOutput) {
            const resultKeys = Object.keys(vars).filter(k => k.startsWith('_nodeResult_'));
            if (resultKeys.length > 0) {
              const lastResultKey = resultKeys[resultKeys.length - 1];
              const val = vars[lastResultKey];
              if (typeof val === 'string') agentOutput = val;
            }
          }

          // Source 4: _conversationState_* (agent conversation history)
          if (!agentOutput) {
            const convKeys = Object.keys(vars).filter(k => k.startsWith('_conversationState_'));
            for (const key of convKeys) {
              const conv = vars[key];
              if (conv && Array.isArray(conv.messages)) {
                const lastMsg = conv.messages[conv.messages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
                  agentOutput = String(lastMsg.content);
                  break;
                }
              }
            }
          }

          // Source 5: _llmActivity last entry response
          if (!agentOutput) {
            const activity: any[] = vars._llmActivity || [];
            if (activity.length > 0) {
              const last = activity[activity.length - 1];
              if (last?.response) agentOutput = String(last.response);
              else if (last?.responsePreview) agentOutput = String(last.responsePreview);
              else if (last?.fullResponse) agentOutput = String(last.fullResponse);
            }
          }

          if (agentOutput) {
            addLine({ text: '' });
            addLine({ text: 'Agent:', color: 'cyan', bold: true, timestamp: ts() });
            // Split long output into lines, cap at 20 lines for readability
            const outputLines = String(agentOutput).split('\n').slice(0, 20);
            for (const line of outputLines) {
              addLine({ text: `  ${line}`, color: 'white' });
            }
            if (String(agentOutput).split('\n').length > 20) {
              addLine({ text: '  ...', color: 'gray', dim: true });
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
