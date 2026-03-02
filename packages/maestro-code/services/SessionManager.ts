// @ts-nocheck
/**
 * SessionManager — Manages the Maestro session lifecycle.
 *
 * Extracted from App.ts to reduce file size and improve modularity.
 * Handles: persistent session (one per TUI instance), entry point invocation,
 * polling for completion, widget polling, and user messages.
 *
 * Architecture: The TUI creates ONE session at first message. All subsequent
 * messages invoke the same entry point on the same session. The agent (a system
 * block) decides how to handle each message — no routing in the TUI.
 */

import * as nodePath from 'path';
import * as fs from 'fs/promises';

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
  private sessionReady: boolean = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private widgetPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastWidgetId: string | null = null;
  private _lastOutput: string | null = null;

  getLastOutput(): string | null { return this._lastOutput; }

  constructor(options: InteractiveOptions) {
    this.client = options.apiClient;
    this.repoPath = options.repoPath || process.cwd();
    this.template = options.template || 'maestro-assistant';
    this.entryPoint = options.entryPoint || 'message';
    this.importTemplate = options.importSessionTemplate || (async () => {});
  }

  /**
   * Ensure the persistent session exists. Called once on the first message.
   * Subsequent calls are no-ops.
   *
   * Tries to reuse a session from `.maestro/session.json` in the repo path.
   * If the file exists and the session is valid on the backend, reuses it.
   * Otherwise creates a new session and writes the file.
   */
  private async ensureSession(addLine: (line: LogLine) => void, firstTask?: string): Promise<void> {
    if (this.sessionReady) return;

    const sessionFile = nodePath.join(this.repoPath, '.maestro', 'session.json');

    // Try to reuse existing session
    try {
      const data = await fs.readFile(sessionFile, 'utf-8');
      const saved = JSON.parse(data);
      if (saved.sessionId) {
        // Verify the session exists on the backend
        const existing = await this.client.getSession(saved.sessionId);
        if (existing && existing.id) {
          this.sessionId = existing.id;
          this.sessionReady = true;
          addLine({ text: `Reusing session: ${existing.id.slice(0, 8)}`, color: 'gray', timestamp: ts() });
          return;
        }
      }
    } catch {
      // File doesn't exist or session not found — create a new one
    }

    // Create new session
    addLine({ text: 'Creating session...', color: 'gray', dim: true, timestamp: ts() });
    const session = await this.client.createSession({
      repositoryPath: this.repoPath,
      authority: 'human',
      name: `${nodePath.basename(this.repoPath)} — ${firstTask ? firstTask.trim().slice(0, 50) : 'Assistant'}`,
    });
    this.sessionId = session.id;
    addLine({ text: `Session: ${session.id.slice(0, 8)}`, color: 'gray', timestamp: ts() });

    addLine({ text: `Importing template: ${this.template}`, color: 'gray', dim: true, timestamp: ts() });
    await this.importTemplate(this.sessionId, this.template);

    await this.client.startSession(this.sessionId);
    addLine({ text: 'Session started', color: 'gray', timestamp: ts() });

    // Persist session ID to .maestro/session.json
    try {
      await fs.mkdir(nodePath.join(this.repoPath, '.maestro'), { recursive: true });
      await fs.writeFile(sessionFile, JSON.stringify({
        sessionId: this.sessionId,
        createdAt: new Date().toISOString(),
        template: this.template,
      }, null, 2));
    } catch {
      // Non-fatal — session still works without persistence
    }

    this.sessionReady = true;
  }

  getRepoPath(): string {
    return this.repoPath;
  }

  async submitTask(
    task: string,
    addLine: (line: LogLine) => void,
    setBusy: (b: boolean) => void,
  ): Promise<void> {
    setBusy(true);
    this._lastOutput = null;

    try {
      // Ensure persistent session exists (no-op after first call)
      await this.ensureSession(addLine, task);

      // Invoke the entry point with the user's message
      const inputs: Record<string, string> = {
        message: task,
        repoPath: this.repoPath,
      };
      addLine({ text: `Invoking: ${this.entryPoint}`, color: 'cyan', bold: true, timestamp: ts() });
      await this.client._fetch('POST', `/api/sessions/${this.sessionId}/invoke/${this.entryPoint}`, {
        body: { inputs }
      });

      // Start polling for completion
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

          // Try to unwrap JSON summary from step-complete output
          // The agent's step-complete tool returns {"summary":"..."} — extract the summary text
          if (agentOutput) {
            try {
              const parsed = JSON.parse(agentOutput);
              if (parsed && typeof parsed === 'object' && typeof parsed.summary === 'string') {
                agentOutput = parsed.summary;
              }
            } catch { /* not JSON, use as-is */ }
          }

          if (agentOutput) {
            this._lastOutput = agentOutput;
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

  /**
   * Invoke a named entry point on the current session (e.g. 'new-conversation', 'clear-conversation').
   * No-op if no session exists yet.
   */
  async invokeEntryPoint(
    name: string,
    addLine: (line: LogLine) => void,
    inputs?: Record<string, string>,
  ): Promise<void> {
    if (!this.sessionId || !this.sessionReady) {
      addLine({ text: 'No active session.', color: 'yellow', timestamp: ts() });
      return;
    }

    try {
      addLine({ text: `Invoking: ${name}`, color: 'cyan', dim: true, timestamp: ts() });
      await this.client._fetch('POST', `/api/sessions/${this.sessionId}/invoke/${name}`, {
        body: { inputs: inputs || {} }
      });
      addLine({ text: `Done: ${name}`, color: 'green', timestamp: ts() });
    } catch (err: any) {
      addLine({ text: `Error: ${err.message || err}`, color: 'red', timestamp: ts() });
    }
  }

  /**
   * Cancel the current task — stop polling and reset local state.
   */
  cancelTask(
    addLine: (line: LogLine) => void,
    setBusy: (b: boolean) => void,
  ): void {
    this.stopPolling();
    addLine({ text: 'Task cancelled.', color: 'yellow', bold: true, timestamp: ts() });
    addLine({ text: '' });
    setBusy(false);
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

export { SessionManager, ts };
