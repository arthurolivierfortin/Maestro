// @ts-nocheck
/**
 * Tests for Maestro Headless Mode.
 * Tests the runHeadless function with mock API client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Headless Mode', () => {
  let mockClient: any;
  let mockImportTemplate: any;
  let consoleOutput: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    mockClient = {
      createSession: vi.fn().mockResolvedValue({ id: 'sess-aaaa-bbbb-cccc-ddddeeee0000' }),
      startSession: vi.fn().mockResolvedValue({}),
      getSession: vi.fn().mockResolvedValue({
        status: 'idle',
        variables: {
          _executionTree: [{ name: 'Plan', status: 'completed' }],
          _executionLog: [{ msg: 'Task done', level: 'info' }],
        },
      }),
      _fetch: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    mockImportTemplate = vi.fn().mockResolvedValue(undefined);

    // Capture console.log output
    consoleOutput = [];
    originalLog = console.log;
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('runs full lifecycle: create → template → start → invoke → poll → done', async () => {
    const { runHeadless } = await import('../headless.ts');

    await runHeadless({
      apiClient: mockClient,
      repoPath: '/test/project',
      template: 'project-autonomous',
      entryPoint: 'dev',
      task: 'Add login page',
      importSessionTemplate: mockImportTemplate,
    });

    // Verify API calls
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryPath: '/test/project' })
    );
    expect(mockImportTemplate).toHaveBeenCalledWith('sess-aaaa-bbbb-cccc-ddddeeee0000', 'project-autonomous', { quiet: true });
    expect(mockClient.startSession).toHaveBeenCalledWith('sess-aaaa-bbbb-cccc-ddddeeee0000');
    expect(mockClient._fetch).toHaveBeenCalledWith(
      'POST',
      '/api/sessions/sess-aaaa-bbbb-cccc-ddddeeee0000/invoke/dev',
      expect.objectContaining({ body: { inputs: { repoPath: '/test/project', task: 'Add login page', workingDir: '/test/project' } } })
    );

    // Verify structured output
    const output = consoleOutput.join('\n');
    expect(output).toContain('Task: Add login page');
    expect(output).toContain('Creating session...');
    expect(output).toContain('sess-aaaa-bbbb-cccc-ddddeeee0000');
    expect(output).toContain('Importing template: project-autonomous');
    expect(output).toContain('Template imported');
    expect(output).toContain('Session started');
    expect(output).toContain('Invoking: dev');
    expect(output).toContain('✓ Plan');
    expect(output).toContain('Task done');
    expect(output).toContain('Task completed successfully');

    // Verify final summary
    expect(output).toContain('[SUMRY] Duration:');
    expect(output).toContain('[SUMRY] Nodes: 1 completed');
    expect(output).toContain('[SUMRY] Session: sess-aaaa-bbbb-cccc-ddddeeee0000');
  });

  it('reports errors from execution tree', async () => {
    mockClient.getSession.mockResolvedValue({
      status: 'idle',
      variables: {
        _executionTree: [
          { name: 'Plan', status: 'completed' },
          { name: 'Implement', status: 'error', error: 'syntax error' },
        ],
        _executionLog: [],
      },
    });

    const { runHeadless } = await import('../headless.ts');

    await runHeadless({
      apiClient: mockClient,
      repoPath: '/test/project',
      task: 'Break something',
      importSessionTemplate: mockImportTemplate,
    });

    const output = consoleOutput.join('\n');
    expect(output).toContain('✓ Plan');
    expect(output).toContain('✗ Implement: syntax error');
    expect(output).toContain('Task completed with errors');
  });

  it('handles API failure gracefully', async () => {
    mockClient.createSession.mockRejectedValue(new Error('Connection refused'));

    const { runHeadless } = await import('../headless.ts');

    // Mock process.exit to avoid actually exiting
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT'); });

    try {
      await runHeadless({
        apiClient: mockClient,
        repoPath: '/test/project',
        task: 'fail task',
        importSessionTemplate: mockImportTemplate,
      });
    } catch (e: any) {
      expect(e.message).toBe('EXIT');
    }

    const output = consoleOutput.join('\n');
    expect(output).toContain('Connection refused');
    mockExit.mockRestore();
  });

  it('recognizes backend "done" status as completed', async () => {
    // Backend uses "done" not "completed" for finished nodes
    mockClient.getSession.mockResolvedValue({
      status: 'idle',
      variables: {
        _executionTree: [
          { name: 'Prepare', status: 'done' },
          { name: 'Plan', status: 'done' },
          { name: 'Implement', status: 'done' },
        ],
        _executionLog: [],
      },
    });

    const { runHeadless } = await import('../headless.ts');

    await runHeadless({
      apiClient: mockClient,
      repoPath: '/test/project',
      task: 'test done status',
      importSessionTemplate: mockImportTemplate,
    });

    const output = consoleOutput.join('\n');
    expect(output).toContain('✓ Prepare');
    expect(output).toContain('✓ Plan');
    expect(output).toContain('✓ Implement');
    expect(output).toContain('Task completed successfully');
    expect(output).toContain('Nodes: 3 completed');
  });

  it('output lines are parseable with timestamp format', async () => {
    const { runHeadless } = await import('../headless.ts');

    await runHeadless({
      apiClient: mockClient,
      repoPath: '/test/project',
      task: 'test format',
      importSessionTemplate: mockImportTemplate,
    });

    // Every non-empty line should match the format [HH:MM:SS] [LEVEL] message
    const timestampPattern = /^\[\d{2}:\d{2}:\d{2}\] \[\w+\s*\] .+$/;
    for (const line of consoleOutput) {
      if (line.trim() === '') continue;
      expect(line).toMatch(timestampPattern);
    }
  });
});
