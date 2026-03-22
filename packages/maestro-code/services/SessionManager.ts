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
import type { IMaestroCodeApiClient, InteractiveOptions } from '../types.ts';

// ── Types ──────────────────────────────────────────────────────

export type { InteractiveOptions };

export interface LogLine {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  timestamp?: string;
  /** When present, this line is rendered as an inline widget instead of text */
  widgetId?: string;
  /** Widget definition — type + props + interactive flag */
  widget?: import('../types/widgets.ts').ChatWidget;
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

// ── Widget marker parser ─────────────────────────────────────

/** Pattern: [widget:TYPE] or [widget:TYPE:key=val,key=val] */
const WIDGET_MARKER_PATTERN = /\[widget:([a-z-]+)(?::([^\]]*))?\]/;

/**
 * Parse a line for a widget marker. Returns null if no marker found.
 * Used by agent response processing to inject inline widgets.
 */
function parseWidgetMarker(line: string): { type: string; props: Record<string, any>; cleanLine: string } | null {
  const match = line.match(WIDGET_MARKER_PATTERN);
  if (!match) return null;

  const type = match[1];
  const argsStr = match[2] || '';
  const props: Record<string, any> = {};

  if (argsStr) {
    for (const pair of argsStr.split(',')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const k = pair.slice(0, eqIdx).trim();
        const v = pair.slice(eqIdx + 1).trim();
        props[k] = v;
      }
    }
  }

  const cleanLine = line.replace(WIDGET_MARKER_PATTERN, '').trim();
  return { type, props, cleanLine };
}

// ── Session Manager ───────────────────────────────────────────

class SessionManager {
  private client: IMaestroCodeApiClient;
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
  private _lastHadErrors: boolean = false;

  getLastOutput(): string | null { return this._lastOutput; }
  getLastHadErrors(): boolean { return this._lastHadErrors; }

  constructor(options: InteractiveOptions) {
    this.client = options.apiClient!;
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
        // Verify the session exists on the backend AND is usable
        const existing = await this.client.getSession(saved.sessionId);
        const deadStatuses = ['stopped', 'ended', 'error', 'completed'];
        if (existing && existing.id && !deadStatuses.includes(existing.status)) {
          this.sessionId = existing.id;
          this.sessionReady = true;
          addLine({ text: `Session restored (${existing.id.slice(0, 8)})`, color: 'gray', timestamp: ts() });
          return;
        }
        // Session is dead — will create a new one below
        if (existing && existing.id) {
          addLine({ text: `Previous session ${existing.id.slice(0, 8)} is ${existing.status}, creating new one...`, color: 'yellow', dim: true, timestamp: ts() });
        }
      }
    } catch {
      // File doesn't exist or session not found — create a new one
    }

    // Create new session
    addLine({ text: 'Starting session...', color: 'gray', dim: true, timestamp: ts() });
    const session = await this.client.createSession({
      repositoryPath: this.repoPath,
      authority: 'human',
      name: `${nodePath.basename(this.repoPath)} — ${firstTask ? firstTask.trim().slice(0, 50) : 'Assistant'}`,
    });
    this.sessionId = session.id;

    const debug = process.env.MAESTRO_DEBUG;
    if (debug) addLine({ text: `  Session: ${session.id.slice(0, 8)}`, color: 'gray', dim: true });
    if (debug) addLine({ text: `  Template: ${this.template}`, color: 'gray', dim: true });

    await this.importTemplate(this.sessionId, this.template);

    if (debug) addLine({ text: '  Session started', color: 'gray', dim: true });
    await this.client.startSession(this.sessionId);

    addLine({ text: `Session ready (${session.id.slice(0, 8)})`, color: 'gray', timestamp: ts() });

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

  /**
   * Try to load conversation history from an existing session.
   * Called at TUI startup to restore previous conversation.
   * Non-fatal — if anything fails, returns empty array.
   */
  async loadConversationHistory(): Promise<LogLine[]> {
    const sessionFile = nodePath.join(this.repoPath, '.maestro', 'session.json');
    const lines: LogLine[] = [];

    try {
      const data = await fs.readFile(sessionFile, 'utf-8');
      const saved = JSON.parse(data);
      if (!saved.sessionId) return lines;

      const session = await this.client.getSession(saved.sessionId);
      if (!session || !session.id) return lines;

      const vars = session.variables || {};

      // Find conversation state — look for _conversationState_* variables
      let messages: Array<{ role: string; content: string }> = [];
      const convKeys = Object.keys(vars).filter(k => k.startsWith('_conversationState_'));
      for (const key of convKeys) {
        const conv = vars[key] as { messages?: Array<{ role: string; content: string }> } | undefined;
        if (conv && Array.isArray(conv.messages) && conv.messages.length > 0) {
          messages = conv.messages;
          break;
        }
      }

      if (messages.length === 0) return lines;

      // Limit to last 50 messages
      const recent = messages.slice(-50);

      lines.push({ text: '--- Previous conversation ---', color: 'gray', dim: true });

      for (const msg of recent) {
        if (msg.role === 'user') {
          lines.push({ text: `> ${msg.content}`, color: 'green', bold: true });
        } else if (msg.role === 'assistant') {
          // Try to unwrap JSON summary
          let content = String(msg.content || '');
          try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed.summary === 'string') content = parsed.summary;
          } catch { /* not JSON */ }

          lines.push({ text: 'Agent:', color: 'cyan', bold: true });
          const outputLines = content.split('\n');
          for (const line of outputLines) {
            lines.push({ text: `  ${line}`, color: 'white' });
          }
        }
      }

      lines.push({ text: '' });
    } catch {
      // Non-fatal — TUI works fine without history
    }

    return lines;
  }

  async submitTask(
    task: string,
    addLine: (line: LogLine) => void,
    setBusy: (b: boolean) => void,
    addWidget?: (type: string, props: Record<string, any>, interactive?: boolean) => string,
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
      if (process.env.MAESTRO_DEBUG) {
        addLine({ text: `Invoking: ${this.entryPoint}`, color: 'gray', dim: true, timestamp: ts() });
      }
      await this.client._fetch('POST', `/api/sessions/${this.sessionId}/invoke/${this.entryPoint}`, {
        body: { inputs }
      });

      // Start polling for completion
      this.startPolling(addLine, setBusy, addWidget);

    } catch (err: any) {
      const msg = String(err.message || err);
      const isEntryPoint = msg.includes('not found') && msg.includes('entry');
      const isConnection = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('Connection refused');
      if (isEntryPoint) {
        addLine({ text: 'Could not start conversation — the assistant workflow is not configured.', color: 'red', bold: true, timestamp: ts() });
        addLine({ text: '  Try restarting with "maestro code".', color: 'yellow' });
      } else if (isConnection) {
        addLine({ text: `Could not connect to Maestro backend.`, color: 'red', bold: true, timestamp: ts() });
        addLine({ text: '  Check that "maestro" services are running, or run "maestro init".', color: 'yellow' });
      } else {
        addLine({ text: `Could not create session: ${msg}`, color: 'red', bold: true, timestamp: ts() });
        addLine({ text: '  Check connection with "maestro health" or run "maestro init".', color: 'yellow' });
      }
      setBusy(false);
    }
  }

  private lastReportedStatus = new Map<string, string>();
  private pollStartTime: number = 0;
  private static readonly POLL_TIMEOUT_MS = 300_000; // 5 minutes
  private static readonly EMPTY_TREE_TIMEOUT_MS = 30_000; // 30 seconds with empty tree = likely error

  private startPolling(addLine: (line: LogLine) => void, setBusy: (b: boolean) => void, addWidget?: (type: string, props: Record<string, any>, interactive?: boolean) => string) {
    this.lastReportedStatus.clear();
    this.pollStartTime = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polling data has extra fields beyond Session type
    const reportNode = (key: string, name: string, status: string, node?: any) => {
      const isDone = status === 'completed' || status === 'done';
      const isError = status === 'error';
      const icon = isDone ? '✓' : isError ? '✗' : '…';
      const color = isDone ? 'green' : isError ? 'red' : 'yellow';

      const prevStatus = this.lastReportedStatus.get(key);
      if (prevStatus === status) return; // already reported this status
      if (!status || status === 'pending') return;

      this.lastReportedStatus.set(key, status);
      addLine({ text: `  ${icon} ${name}`, color, timestamp: ts() });

      // Extract and display error message for failed nodes
      if (isError && node) {
        const errMsg = node.error
          || node.errorMessage
          || (typeof node.output === 'string' ? node.output : null)
          || (node.output?.error ? String(node.output.error) : null);
        if (errMsg) {
          const truncated = String(errMsg).split('\n')[0].slice(0, 120);
          addLine({ text: `    Error: ${truncated}`, color: 'red' });
        }
      }
    };

    this.pollTimer = setInterval(async () => {
      try {
        // Cast to any for polling — backend returns extra fields (error, containerStatus) beyond Session type
        const session: any = await this.client.getSession(this.sessionId!);
        const vars = session.variables || {};
        const tree: any[] = vars._executionTree || [];

        // Report child nodes (nested execution trees)
        for (const node of tree) {
          const children: any[] = node.children || [];
          for (const child of children) {
            reportNode(
              `${node.id}:${child.id || child.name}`,
              child.name || child.id || 'step',
              child.status,
              child
            );
          }
        }

        // Report top-level nodes with no children (flat execution trees)
        for (const node of tree) {
          if (!(node.children || []).length) {
            reportNode(
              `root:${node.id || node.name}`,
              node.name || node.id || 'step',
              node.status,
              node
            );
          }
        }

        const status = (session.status || session.containerStatus || '').toLowerCase();
        const allDone = tree.length > 0 && tree.every(n => n.status === 'completed' || n.status === 'done' || n.status === 'error' || n.status === 'skipped');
        const elapsed = Date.now() - this.pollStartTime;

        // Detect session-level error (e.g., LLM provider failure)
        if (status === 'error' || status === 'failed') {
          this.stopPolling();
          const errMsg = session.error || session.errorMessage || session.statusMessage || 'Session encountered an error';
          addLine({ text: `Error: ${errMsg}`, color: 'red', bold: true, timestamp: ts() });
          // Surface provider-specific advice
          const errLower = String(errMsg).toLowerCase();
          if (errLower.includes('provider') || errLower.includes('not available') || errLower.includes('not authenticated') || errLower.includes('claude') || errLower.includes('api key')) {
            addLine({ text: '  This looks like a provider configuration issue.', color: 'yellow' });
            addLine({ text: '  Run "maestro init" to reconfigure providers, or "claude login" for Claude auth.', color: 'yellow' });
          }
          this._lastHadErrors = true;
          setBusy(false);
          return;
        }

        // Check _executionLog for error entries (backend logs errors here even when tree is empty)
        const executionLog: any[] = vars._executionLog || [];
        const errorLogs = executionLog.filter((e: any) => e.level === 'error');

        // Detect empty execution tree that never populates (workflow failed to start)
        if (tree.length === 0 && elapsed > SessionManager.EMPTY_TREE_TIMEOUT_MS) {
          this.stopPolling();

          // Check if errors point to a provider issue
          const isProviderError = errorLogs.some((e: any) => {
            const msg = String(e.msg || e.message || '').toLowerCase();
            return msg.includes('provider') || msg.includes('not available') || msg.includes('not authenticated')
              || msg.includes('api key') || msg.includes('claude') || msg.includes('503');
          });

          if (errorLogs.length > 0) {
            const lastErr = errorLogs[errorLogs.length - 1];
            addLine({ text: `Error: ${lastErr.msg || lastErr.message || 'Workflow failed to start'}`, color: 'red', bold: true, timestamp: ts() });
          } else {
            addLine({ text: 'The agent didn\'t respond. Check that your LLM provider is running.', color: 'red', bold: true, timestamp: ts() });
          }

          if (isProviderError) {
            addLine({ text: '  LLM provider is not available or not authenticated.', color: 'yellow' });
            addLine({ text: '  Run "maestro init" to reconfigure, or "claude login" for Claude Code auth.', color: 'yellow' });
          } else {
            addLine({ text: '  Possible causes: LLM provider not configured, missing API keys, or workflow error.', color: 'yellow' });
            addLine({ text: '  Run "maestro init" to reconfigure or "maestro health" to check services.', color: 'yellow' });
          }
          this._lastHadErrors = true;
          setBusy(false);
          return;
        }

        // Detect stuck nodes: tree has nodes but all are running for too long (e.g., LLM call hangs)
        if (tree.length > 0 && !allDone && elapsed > SessionManager.POLL_TIMEOUT_MS / 2) {
          const hasRunning = tree.some(n => n.status === 'running');
          if (hasRunning && errorLogs.length > 0) {
            // Errors in the log but nodes still "running" — likely a stuck execution
            this.stopPolling();
            const lastErr = errorLogs[errorLogs.length - 1];
            addLine({ text: `Error: ${lastErr.msg || lastErr.message || 'Execution error'}`, color: 'red', bold: true, timestamp: ts() });
            this._lastHadErrors = true;
            setBusy(false);
            return;
          }
        }

        // Global timeout
        if (elapsed > SessionManager.POLL_TIMEOUT_MS) {
          this.stopPolling();
          // Mark in-progress nodes as failed so they show ✗ instead of …
          for (const node of tree) {
            if (node.status === 'running' || node.status === 'in-progress' || node.status === 'executing') {
              reportNode(node.id || node.name, node.name || node.id, 'error', node);
            }
          }
          addLine({ text: 'The agent took too long to respond (5 min timeout).', color: 'yellow', bold: true, timestamp: ts() });
          addLine({ text: '  Try a simpler task or check that your LLM provider is responding.', color: 'yellow' });
          this._lastHadErrors = true;
          setBusy(false);
          return;
        }

        if (allDone || status === 'completed' || status === 'idle') {
          this.stopPolling();
          const hasErrors = tree.some(n => n.status === 'error');

          // Extract the agent's response — try multiple sources
          let agentOutput: string | null = null;

          // Helper: detect conversation-manager metadata output (not actual content)
          const isMetadataOutput = (s: string): boolean =>
            typeof s === 'string' && s.includes('conversationId:') && s.includes('state:');

          const extractNodeOutput = (node: any): string | null => {
            if (!node?.output) return null;
            if (typeof node.output === 'string') {
              return isMetadataOutput(node.output) ? null : node.output;
            }
            if (typeof node.output === 'object') {
              return node.output.summary
                || node.output.result
                || node.output.response
                || null;
            }
            return null;
          };

          // Source 1: Look for the agent execution node in the tree (e.g. "execute-agent")
          // The workflow typically has: ensure-conversation, save-user-message, load-history,
          // execute-agent, save-assistant-response. We want the execute-agent node specifically.
          const agentNode = tree.find((n: any) => n.id === 'execute-agent' || (n.id && n.id.includes('execute-agent')));
          if (agentNode) {
            agentOutput = extractNodeOutput(agentNode);
          }

          // Source 1b: Fall back to last node with non-metadata output
          if (!agentOutput) {
            for (let i = tree.length - 1; i >= 0; i--) {
              const extracted = extractNodeOutput(tree[i]);
              if (extracted) {
                agentOutput = extracted;
                break;
              }
            }
          }

          // Source 2: _nodeResult_execute-agent variable (most reliable source)
          if (!agentOutput) {
            const agentResult = vars['_nodeResult_execute-agent'];
            if (typeof agentResult === 'string' && !isMetadataOutput(agentResult)) {
              agentOutput = agentResult;
            }
          }

          // Source 3: _blockOutputs variable — look for execute-agent key first, then others
          if (!agentOutput) {
            const blockOutputs = vars._blockOutputs;
            if (blockOutputs && typeof blockOutputs === 'object') {
              // Prefer execute-agent key
              const agentBo = blockOutputs['execute-agent'];
              if (agentBo) {
                const boStr = typeof agentBo === 'string' ? agentBo : agentBo?.output ? String(agentBo.output) : null;
                if (boStr && !isMetadataOutput(boStr)) agentOutput = boStr;
              }
              // Fall back to any non-metadata block output
              if (!agentOutput) {
                const keys = Object.keys(blockOutputs);
                for (let i = keys.length - 1; i >= 0; i--) {
                  const bo = blockOutputs[keys[i]];
                  const boStr = typeof bo === 'string' ? bo : bo?.output ? String(bo.output) : null;
                  if (boStr && !isMetadataOutput(boStr)) {
                    agentOutput = boStr;
                    break;
                  }
                }
              }
            }
          }

          // Source 4: Any _nodeResult_* that isn't metadata
          if (!agentOutput) {
            const resultKeys = Object.keys(vars).filter(k => k.startsWith('_nodeResult_'));
            for (let i = resultKeys.length - 1; i >= 0; i--) {
              const val = vars[resultKeys[i]];
              if (typeof val === 'string' && !isMetadataOutput(val)) {
                agentOutput = val;
                break;
              }
            }
          }

          // Source 5: _conversationState_* (agent conversation history)
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

          // Source 6: _llmActivity last entry response
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
            const outputLines = String(agentOutput).split('\n');
            for (const line of outputLines) {
              const marker = parseWidgetMarker(line);
              if (marker && addWidget) {
                addWidget(marker.type, marker.props, true);
                if (marker.cleanLine) {
                  addLine({ text: `  ${marker.cleanLine}`, color: 'white' });
                }
              } else {
                addLine({ text: `  ${line}`, color: 'white' });
              }
            }
          }

          if (hasErrors) {
            addLine({ text: 'Task completed with errors', color: 'red', bold: true, timestamp: ts() });
          } else if (tree.length > 0) {
            addLine({ text: 'Task completed', color: 'green', bold: true, timestamp: ts() });
          }
          this._lastHadErrors = hasErrors;
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

    // Guard: reject messages while a task is in progress (poll timer active)
    if (this.pollTimer) {
      addLine({ text: 'Agent is busy — wait for completion or press Ctrl+C to cancel.', color: 'yellow', timestamp: ts() });
      return;
    }

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
        const session = await this.client.getSession(this.sessionId!);
        const vars: Record<string, any> = (session.variables as Record<string, any>) || {};
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
   * Set a session variable via the API.
   */
  async setVariable(name: string, value: any): Promise<void> {
    if (!this.sessionId) return;
    await this.client._fetch('PUT',
      `/api/sessions/${this.sessionId}/variables/${name}`,
      { body: { value } }
    );
  }

  /**
   * Get a session variable via the API.
   */
  async getVariable(name: string): Promise<any> {
    if (!this.sessionId) return undefined;
    try {
      const resp: any = await this.client._fetch('GET',
        `/api/sessions/${this.sessionId}/variables/${name}`);
      return resp?.value;
    } catch { return undefined; }
  }

  /**
   * Force-reset session state so the next submitTask creates a fresh session.
   * Used by /new when the current session is dead.
   */
  resetSession(): void {
    this.sessionId = null;
    this.sessionReady = false;
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

export { SessionManager, ts, parseWidgetMarker };
