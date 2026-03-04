/**
 * SessionManager Integration Tests (Phase 46-B)
 *
 * Tests the full session lifecycle: construction, ensureSession (via submitTask),
 * polling, sendMessage, cancelTask, invokeEntryPoint, loadConversationHistory.
 *
 * Mock strategy:
 * - Mock fs/promises to avoid real file I/O (.maestro/session.json)
 * - Mock API client with vi.fn() for all methods
 * - Use vi.useFakeTimers() for polling tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs/promises before importing SessionManager
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { SessionManager } from '../services/SessionManager.ts';
import * as fsPromises from 'fs/promises';

// ── Helpers ──────────────────────────────────────────────────

function createMockClient(overrides: Record<string, any> = {}) {
  return {
    createSession: vi.fn().mockResolvedValue({ id: 'sess-1234-5678-abcd-ef0123456789' }),
    startSession: vi.fn().mockResolvedValue({}),
    getSession: vi.fn().mockResolvedValue({
      id: 'sess-1234-5678-abcd-ef0123456789',
      status: 'idle',
      variables: { _executionTree: [], _executionLog: [] },
    }),
    _fetch: vi.fn().mockResolvedValue({ status: 'running' }),
    ...overrides,
  };
}

function createHelpers() {
  const lines: Array<{ text: string; color?: string; bold?: boolean }> = [];
  const addLine = vi.fn((line: any) => lines.push(line));
  const setBusy = vi.fn();
  return { lines, addLine, setBusy };
}

// ── Tests ────────────────────────────────────────────────────

describe('SessionManager', () => {
  let mockClient: any;
  let mockImportTemplate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    mockImportTemplate = vi.fn().mockResolvedValue(undefined);
    // Default: no session file exists
    (fsPromises.readFile as any).mockRejectedValue({ code: 'ENOENT' });
    (fsPromises.writeFile as any).mockResolvedValue(undefined);
    (fsPromises.mkdir as any).mockResolvedValue(undefined);
  });

  // ── Construction and configuration ────────────────────────

  describe('Construction', () => {
    it('uses provided options', () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/my/project',
        template: 'custom-template',
        entryPoint: 'custom-entry',
        importSessionTemplate: mockImportTemplate,
      });

      expect(sm.getRepoPath()).toBe('/my/project');
      expect(sm.getSessionId()).toBeNull();
    });

    it('uses default values when options are omitted', () => {
      const sm = new SessionManager({
        apiClient: mockClient,
      });

      expect(sm.getRepoPath()).toBe(process.cwd());
      expect(sm.getSessionId()).toBeNull();
    });

    it('getSessionId returns null before any session is created', () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test',
      });

      expect(sm.getSessionId()).toBeNull();
    });

    it('getLastOutput returns null before any task', () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test',
      });

      expect(sm.getLastOutput()).toBeNull();
      expect(sm.getLastHadErrors()).toBe(false);
    });
  });

  // ── Session lifecycle (ensureSession via submitTask) ───────

  describe('Session lifecycle', () => {
    it('creates session, imports template, starts, and invokes entry point', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('Add README', addLine, setBusy);

      // Creates session with correct params
      expect(mockClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          repositoryPath: '/test/project',
          authority: 'human',
        })
      );

      // Imports template (default: maestro-assistant)
      expect(mockImportTemplate).toHaveBeenCalledWith('sess-1234-5678-abcd-ef0123456789', 'maestro-assistant');

      // Starts session
      expect(mockClient.startSession).toHaveBeenCalledWith('sess-1234-5678-abcd-ef0123456789');

      // Invokes entry point with correct inputs
      expect(mockClient._fetch).toHaveBeenCalledWith(
        'POST',
        '/api/sessions/sess-1234-5678-abcd-ef0123456789/invoke/message',
        expect.objectContaining({
          body: { inputs: { message: 'Add README', repoPath: '/test/project' } },
        })
      );

      // Sets busy
      expect(setBusy).toHaveBeenCalledWith(true);

      // Logs progress (consolidated: 2 lines instead of 5)
      expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ text: 'Starting session...' }));
      expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Session ready') }));

      sm.stopPolling();
    });

    it('uses custom template and entry point', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        template: 'project-autonomous',
        entryPoint: 'dev',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('Build feature', addLine, setBusy);

      expect(mockImportTemplate).toHaveBeenCalledWith('sess-1234-5678-abcd-ef0123456789', 'project-autonomous');
      expect(mockClient._fetch).toHaveBeenCalledWith(
        'POST',
        '/api/sessions/sess-1234-5678-abcd-ef0123456789/invoke/dev',
        expect.any(Object)
      );

      sm.stopPolling();
    });

    it('does not recreate session on second submitTask (idempotent)', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();

      // First task — creates session
      await sm.submitTask('First task', addLine, setBusy);
      sm.stopPolling();

      // Second task — reuses session
      await sm.submitTask('Second task', addLine, setBusy);
      sm.stopPolling();

      // createSession should only be called once
      expect(mockClient.createSession).toHaveBeenCalledTimes(1);
      expect(mockImportTemplate).toHaveBeenCalledTimes(1);
      expect(mockClient.startSession).toHaveBeenCalledTimes(1);

      // _fetch (invoke) should be called twice
      expect(mockClient._fetch).toHaveBeenCalledTimes(2);
    });

    it('stores session ID after creation', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      expect(sm.getSessionId()).toBeNull();

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      expect(sm.getSessionId()).toBe('sess-1234-5678-abcd-ef0123456789');
      sm.stopPolling();
    });

    it('persists session to .maestro/session.json', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.maestro'),
        { recursive: true }
      );
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('session.json'),
        expect.stringContaining('sess-1234-5678-abcd-ef0123456789')
      );

      sm.stopPolling();
    });

    it('reuses existing session from .maestro/session.json if valid on backend', async () => {
      // Mock: session file exists
      (fsPromises.readFile as any).mockResolvedValue(
        JSON.stringify({ sessionId: 'sess-existing-1234' })
      );
      // Mock: backend confirms the session exists
      mockClient.getSession.mockResolvedValue({
        id: 'sess-existing-1234',
        status: 'idle',
        variables: { _executionTree: [], _executionLog: [] },
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      // Should NOT create a new session
      expect(mockClient.createSession).not.toHaveBeenCalled();
      expect(mockImportTemplate).not.toHaveBeenCalled();
      expect(mockClient.startSession).not.toHaveBeenCalled();

      // Should reuse existing session ID
      expect(sm.getSessionId()).toBe('sess-existing-1234');

      // Should have logged restore
      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('Session restored') })
      );

      sm.stopPolling();
    });

    it('creates new session when .maestro/session.json points to nonexistent backend session', async () => {
      // Mock: session file exists
      (fsPromises.readFile as any).mockResolvedValue(
        JSON.stringify({ sessionId: 'sess-gone-forever' })
      );
      // Mock: backend returns 404 / null
      mockClient.getSession
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValue({
          id: 'sess-1234-5678-abcd-ef0123456789',
          status: 'idle',
          variables: { _executionTree: [], _executionLog: [] },
        });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      // Should create a new session since the old one doesn't exist
      expect(mockClient.createSession).toHaveBeenCalled();
      expect(mockImportTemplate).toHaveBeenCalled();

      sm.stopPolling();
    });

    it('handles createSession error gracefully', async () => {
      mockClient.createSession.mockRejectedValue(new Error('Connection refused'));

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('fail task', addLine, setBusy);

      // Should show actionable error
      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('Could not connect'), color: 'red' })
      );

      // Should release busy state
      expect(setBusy).toHaveBeenCalledWith(false);
    });

    it('handles importTemplate error gracefully', async () => {
      mockImportTemplate.mockRejectedValue(new Error('Template not found'));

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('fail task', addLine, setBusy);

      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('Template not found'), color: 'red' })
      );
      expect(setBusy).toHaveBeenCalledWith(false);
    });
  });

  // ── Polling ───────────────────────────────────────────────

  describe('Polling', () => {
    it('detects workflow completion via polling', async () => {
      vi.useFakeTimers();

      let pollCount = 0;
      mockClient.getSession.mockImplementation(async () => {
        pollCount++;
        if (pollCount === 1) {
          return {
            status: 'running',
            variables: {
              _executionTree: [{ id: 'plan', name: 'Plan', status: 'running' }],
              _executionLog: [],
            },
          };
        }
        return {
          status: 'idle',
          variables: {
            _executionTree: [{ id: 'plan', name: 'Plan', status: 'completed' }],
            _executionLog: [],
          },
        };
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('plan task', addLine, setBusy);

      // First poll (2s) — running
      await vi.advanceTimersByTimeAsync(2100);

      // Second poll — completed
      await vi.advanceTimersByTimeAsync(2100);

      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Task completed', color: 'green' })
      );
      expect(setBusy).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });

    it('detects session-level error status', async () => {
      vi.useFakeTimers();

      let pollCount = 0;
      mockClient.getSession.mockImplementation(async () => {
        pollCount++;
        if (pollCount === 1) {
          return {
            status: 'running',
            variables: {
              _executionTree: [{ id: 'step1', name: 'Step', status: 'running' }],
              _executionLog: [],
            },
          };
        }
        return {
          status: 'error',
          error: 'LLM provider not available',
          variables: {
            _executionTree: [{ id: 'step1', name: 'Step', status: 'running' }],
            _executionLog: [],
          },
        };
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      // First poll — running
      await vi.advanceTimersByTimeAsync(2100);
      // Second poll — error status
      await vi.advanceTimersByTimeAsync(2100);

      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('LLM provider not available'), color: 'red' })
      );
      expect(setBusy).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });

    it('detects empty execution tree after 30s timeout', async () => {
      vi.useFakeTimers();

      // getSession always returns running with empty tree
      mockClient.getSession.mockResolvedValue({
        status: 'running',
        variables: { _executionTree: [], _executionLog: [] },
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      // Advance past EMPTY_TREE_TIMEOUT_MS (30s) — need enough poll cycles
      await vi.advanceTimersByTimeAsync(32_000);

      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('agent didn\'t respond'),
          color: 'red',
        })
      );
      expect(setBusy).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });

    it('extracts agent output from execute-agent node', async () => {
      vi.useFakeTimers();

      let pollCount = 0;
      mockClient.getSession.mockImplementation(async () => {
        pollCount++;
        if (pollCount === 1) {
          return {
            status: 'running',
            variables: {
              _executionTree: [{ id: 'execute-agent', name: 'Execute Agent', status: 'running' }],
              _executionLog: [],
            },
          };
        }
        return {
          status: 'idle',
          variables: {
            _executionTree: [{
              id: 'execute-agent',
              name: 'Execute Agent',
              status: 'completed',
              output: { summary: 'I created the README file.' },
            }],
            _executionLog: [],
          },
        };
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('Add README', addLine, setBusy);

      // First poll — running
      await vi.advanceTimersByTimeAsync(2100);
      // Second poll — completed with output
      await vi.advanceTimersByTimeAsync(2100);

      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Agent:', color: 'cyan', bold: true })
      );
      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: '  I created the README file.', color: 'white' })
      );
      expect(sm.getLastOutput()).toBe('I created the README file.');

      vi.useRealTimers();
    });

    it('parses JSON summary from step-complete output', async () => {
      vi.useFakeTimers();

      let pollCount = 0;
      mockClient.getSession.mockImplementation(async () => {
        pollCount++;
        if (pollCount === 1) {
          return {
            status: 'running',
            variables: {
              _executionTree: [{ id: 'execute-agent', name: 'Execute Agent', status: 'running' }],
              _executionLog: [],
            },
          };
        }
        return {
          status: 'idle',
          variables: {
            _executionTree: [{
              id: 'execute-agent',
              name: 'Execute Agent',
              status: 'completed',
              output: '{"summary":"Task completed successfully."}',
            }],
            _executionLog: [],
          },
        };
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      // First poll — running
      await vi.advanceTimersByTimeAsync(2100);
      // Second poll — completed with JSON output
      await vi.advanceTimersByTimeAsync(2100);

      expect(sm.getLastOutput()).toBe('Task completed successfully.');

      vi.useRealTimers();
    });

    it('reports completion with errors when nodes have error status', async () => {
      vi.useFakeTimers();

      let pollCount = 0;
      mockClient.getSession.mockImplementation(async () => {
        pollCount++;
        if (pollCount === 1) {
          return {
            status: 'running',
            variables: {
              _executionTree: [{ id: 'execute-agent', name: 'Execute Agent', status: 'running' }],
              _executionLog: [],
            },
          };
        }
        return {
          status: 'idle',
          variables: {
            _executionTree: [{
              id: 'execute-agent',
              name: 'Execute Agent',
              status: 'error',
              error: 'Tool call failed',
            }],
            _executionLog: [],
          },
        };
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('test', addLine, setBusy);

      // First poll — running
      await vi.advanceTimersByTimeAsync(2100);
      // Second poll — error status
      await vi.advanceTimersByTimeAsync(2100);

      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Task completed with errors', color: 'red' })
      );
      expect(sm.getLastHadErrors()).toBe(true);
      expect(setBusy).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });
  });

  // ── sendMessage ───────────────────────────────────────────

  describe('sendMessage', () => {
    it('sends message as variable and logs it', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      // Create a session first
      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('init', addLine, setBusy);
      sm.stopPolling();

      // Send a follow-up message
      const sendLine = vi.fn();
      await sm.sendMessage('Hello again', sendLine);

      expect(mockClient._fetch).toHaveBeenCalledWith(
        'PUT',
        '/api/sessions/sess-1234-5678-abcd-ef0123456789/variables/_userMessage',
        expect.objectContaining({
          body: { value: { text: 'Hello again', time: expect.any(String) } },
        })
      );

      expect(sendLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: '> Hello again', color: 'green' })
      );
    });

    it('rejects message when no session exists', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
      });

      const sendLine = vi.fn();
      await sm.sendMessage('Hello', sendLine);

      // No session → no-op (no _fetch call, no log)
      expect(mockClient._fetch).not.toHaveBeenCalled();
      expect(sendLine).not.toHaveBeenCalled();
    });

    it('rejects message while poll timer is active (agent busy)', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      // Create session and start polling
      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('init', addLine, setBusy);
      // DO NOT stop polling — simulates agent being busy

      const sendLine = vi.fn();
      await sm.sendMessage('Hello', sendLine);

      // Should be rejected with busy message
      expect(sendLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('busy'), color: 'yellow' })
      );

      sm.stopPolling();
    });
  });

  // ── cancelTask ────────────────────────────────────────────

  describe('cancelTask', () => {
    it('stops polling and resets busy state', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('long task', addLine, setBusy);

      // Cancel while polling is active
      const cancelLine = vi.fn();
      const cancelBusy = vi.fn();
      sm.cancelTask(cancelLine, cancelBusy);

      expect(cancelLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Task cancelled.', color: 'yellow' })
      );
      expect(cancelBusy).toHaveBeenCalledWith(false);
    });
  });

  // ── invokeEntryPoint ──────────────────────────────────────

  describe('invokeEntryPoint', () => {
    it('invokes named entry point on active session', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
        importSessionTemplate: mockImportTemplate,
      });

      // Create session
      const { addLine, setBusy } = createHelpers();
      await sm.submitTask('init', addLine, setBusy);
      sm.stopPolling();

      // Invoke a different entry point
      const invokeLine = vi.fn();
      await sm.invokeEntryPoint('new-conversation', invokeLine);

      expect(mockClient._fetch).toHaveBeenCalledWith(
        'POST',
        '/api/sessions/sess-1234-5678-abcd-ef0123456789/invoke/new-conversation',
        expect.objectContaining({ body: { inputs: {} } })
      );

      expect(invokeLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Invoking: new-conversation' })
      );
      expect(invokeLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Done: new-conversation', color: 'green' })
      );
    });

    it('no-ops when no session exists', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
      });

      const invokeLine = vi.fn();
      await sm.invokeEntryPoint('test', invokeLine);

      expect(invokeLine).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'No active session.', color: 'yellow' })
      );
      expect(mockClient._fetch).not.toHaveBeenCalled();
    });
  });

  // ── loadConversationHistory ───────────────────────────────

  describe('loadConversationHistory', () => {
    it('returns empty array when no session file exists', async () => {
      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
      });

      const lines = await sm.loadConversationHistory();
      expect(lines).toEqual([]);
    });

    it('loads conversation from _conversationState_ variable', async () => {
      (fsPromises.readFile as any).mockResolvedValue(
        JSON.stringify({ sessionId: 'sess-history' })
      );
      mockClient.getSession.mockResolvedValue({
        id: 'sess-history',
        variables: {
          '_conversationState_agent': {
            messages: [
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there!' },
            ],
          },
        },
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
      });

      const lines = await sm.loadConversationHistory();

      expect(lines.length).toBeGreaterThan(0);
      // Should have the separator line
      expect(lines[0]).toEqual(expect.objectContaining({ text: '--- Previous conversation ---' }));
      // Should have user message
      expect(lines).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: '> Hello', color: 'green' }),
      ]));
      // Should have assistant message
      expect(lines).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: 'Agent:', color: 'cyan' }),
      ]));
    });

    it('unwraps JSON summary in conversation history', async () => {
      (fsPromises.readFile as any).mockResolvedValue(
        JSON.stringify({ sessionId: 'sess-history' })
      );
      mockClient.getSession.mockResolvedValue({
        id: 'sess-history',
        variables: {
          '_conversationState_agent': {
            messages: [
              { role: 'assistant', content: '{"summary":"Parsed summary"}' },
            ],
          },
        },
      });

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
      });

      const lines = await sm.loadConversationHistory();

      expect(lines).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: '  Parsed summary', color: 'white' }),
      ]));
    });

    it('returns empty array when backend session is gone', async () => {
      (fsPromises.readFile as any).mockResolvedValue(
        JSON.stringify({ sessionId: 'sess-deleted' })
      );
      mockClient.getSession.mockResolvedValue(null);

      const sm = new SessionManager({
        apiClient: mockClient,
        repoPath: '/test/project',
      });

      const lines = await sm.loadConversationHistory();
      expect(lines).toEqual([]);
    });
  });
});
