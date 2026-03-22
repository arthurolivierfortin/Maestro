/**
 * Tests for PermissionsPanel, PermissionsWidget, and integrations.
 *
 * Phase 63-D: Visual diff of parent/child block permissions.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text } from 'ink';
import { FocusProvider } from '../hooks/useFocusProvider.ts';
import { PermissionsPanel } from '../components/PermissionsPanel.ts';
import type { BlockPermissionRule } from '../components/PermissionsPanel.ts';

// ── Helpers ─────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── PermissionsPanel Tests ──────────────────────────────────────

describe('PermissionsPanel', () => {
  afterEach(() => cleanup());

  it('renders blocks in white (effective) and gray (filtered)', async () => {
    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: ['file-read', 'file-write'],
        parentBlocks: ['file-read', 'file-write', 'shell-execute', 'directory-list'],
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');

    // Effective blocks shown with o prefix
    expect(frame).toContain('o file-read');
    expect(frame).toContain('o file-write');

    // Filtered blocks shown with . prefix
    expect(frame).toContain('. shell-execute');
    expect(frame).toContain('. directory-list');

    // Title
    expect(frame).toContain('PERMISSIONS');
  });

  it('shows all blocks in white when effectiveBlocks = ["*"]', async () => {
    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: ['*'],
        parentBlocks: ['file-read', 'file-write', 'shell-execute'],
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');

    // All parent blocks should be white (with o prefix)
    expect(frame).toContain('o file-read');
    expect(frame).toContain('o file-write');
    expect(frame).toContain('o shell-execute');

    // Wildcard indicator
    expect(frame).toContain('AllowedBlocks: *');

    // No gray items
    expect(frame).not.toContain('. file-read');
    expect(frame).not.toContain('. file-write');
    expect(frame).not.toContain('. shell-execute');
  });

  it('shows no gray items when no parent (ceiling mode)', async () => {
    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: ['file-read', 'file-write', 'shell-execute'],
        parentBlocks: [],
        title: 'PERMISSIONS (ceiling)',
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');

    // Title includes ceiling
    expect(frame).toContain('PERMISSIONS (ceiling)');

    // All effective blocks are white
    expect(frame).toContain('o file-read');
    expect(frame).toContain('o file-write');
    expect(frame).toContain('o shell-execute');

    // No gray items at all
    expect(frame).not.toContain('. ');
  });

  it('shows deny rule with X in red and reason text', async () => {
    const blockRules: BlockPermissionRule[] = [
      { pattern: 'shell-execute', permission: 'Denied', reason: 'security' },
    ];

    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: ['file-read'],
        parentBlocks: ['file-read', 'shell-execute'],
        blockRules,
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');

    // Denied block with X and reason
    expect(frame).toContain('X shell-execute');
    expect(frame).toContain('(security)');

    // Available block still shows normally
    expect(frame).toContain('o file-read');

    // Rules section at bottom
    expect(frame).toContain('Rules:');
  });

  it('shows parent name when provided', async () => {
    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: ['file-read'],
        parentBlocks: ['file-read', 'file-write'],
        parentName: 'Dev Session (s-456)',
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Parent: Dev Session (s-456)');
  });

  it('shows empty state when no blocks defined', async () => {
    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: [],
        parentBlocks: [],
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('(no blocks defined)');
  });

  it('sorts blocks alphabetically', async () => {
    const { lastFrame } = render(
      h(PermissionsPanel, {
        effectiveBlocks: ['z-tool', 'a-tool', 'm-tool'],
        parentBlocks: [],
      }),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    const lines = frame.split('\n');
    const blockLines = lines.filter(l => l.includes('o '));
    expect(blockLines.length).toBe(3);
    // First block should be a-tool, last should be z-tool
    expect(blockLines[0]).toContain('a-tool');
    expect(blockLines[2]).toContain('z-tool');
  });
});

// ── PermissionsWidget Tests ─────────────────────────────────────

describe('PermissionsWidget', () => {
  afterEach(() => cleanup());

  it('fetches API and renders PermissionsPanel', async () => {
    // Dynamic import to avoid hoisting issues
    const { PermissionsWidget } = await import('../components/widgets/PermissionsWidget.ts');

    const mockApiClient = {
      get: vi.fn().mockResolvedValue({
        sessionId: 'abc-123',
        sessionName: 'Test Session',
        effective: { allowedBlocks: ['file-read', 'file-write'] },
        parentEffective: { allowedBlocks: ['file-read', 'file-write', 'shell-execute'] },
        parentId: 'parent-456',
        blockRules: [],
      }),
    };

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(PermissionsWidget, {
          apiClient: mockApiClient,
          focused: true,
          sessionId: 'abc-123',
        }),
      ),
    );
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Should have fetched the API
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/sessions/abc-123/permissions/effective');

    // Should show blocks
    expect(frame).toContain('o file-read');
    expect(frame).toContain('o file-write');
    expect(frame).toContain('. shell-execute');

    // Should show CLI hint
    expect(frame).toContain('Pour modifier');
  });

  it('shows loading state when no data', async () => {
    const { PermissionsWidget } = await import('../components/widgets/PermissionsWidget.ts');

    const mockApiClient = {
      get: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    };

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(PermissionsWidget, {
          apiClient: mockApiClient,
          focused: true,
          sessionId: 'abc-123',
        }),
      ),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Loading permissions');
  });
});

// ── SessionMonitorWidget Integration ────────────────────────────

describe('SessionMonitorWidget with PermissionsPanel', () => {
  afterEach(() => cleanup());

  it('renders permissions panel when data is available', async () => {
    const { SessionMonitorWidget } = await import('../components/widgets/SessionMonitorWidget.ts');

    const mockApiClient = {
      get: vi.fn().mockResolvedValue({
        sessionId: 'sess-1234',
        sessionName: 'Test Session',
        effective: { allowedBlocks: ['file-read'] },
        parentEffective: { allowedBlocks: ['file-read', 'file-write'] },
        parentId: 'parent-5678',
        blockRules: [],
      }),
    };

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(SessionMonitorWidget, {
          apiClient: mockApiClient,
          focused: true,
          sessionId: 'sess-1234',
        }),
      ),
    );
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Should show session ID
    expect(frame).toContain('sess-123');

    // Should show permissions panel content
    expect(frame).toContain('PERMISSIONS');
    expect(frame).toContain('o file-read');
    expect(frame).toContain('. file-write');
  });
});

// ── BlockDetailWidget Tools Requis ──────────────────────────────

describe('BlockDetailWidget TOOLS REQUIS', () => {
  afterEach(() => cleanup());

  it('shows tools requis panel when block has tool references', async () => {
    const { BlockDetailWidget } = await import('../components/widgets/BlockDetailWidget.ts');

    const mockBlock = {
      id: 'test-agent',
      name: 'Test Agent',
      blockType: 'agent',
      version: '1.0.0',
      isAtomic: false,
      capabilities: ['tool-calling'],
      config: {
        nodes: [
          { id: 'init', type: 'set-variable', variable: '_agentDone', value: 'false' },
          {
            id: 'loop', type: 'while', condition: 'true', maxIterations: '5',
            nodes: [
              { id: 'read', blockRef: 'conversation-read', inputs: {} },
              { id: 'call', blockRef: 'inference', inputs: {} },
              { id: 'append', blockRef: 'conversation-append', inputs: {} },
              { id: 'parse', blockRef: 'response-parser', inputs: {} },
              {
                id: 'route', type: 'conditional', condition: 'type',
                branches: {
                  'tool-call': {
                    nodes: [
                      { id: 'dispatch', blockRef: 'tool-dispatcher', inputs: {} },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const mockApiClient = {
      getBlock: vi.fn().mockResolvedValue(mockBlock),
    };

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(BlockDetailWidget, {
          apiClient: mockApiClient,
          focused: true,
          blockId: 'test-agent',
        }),
      ),
    );
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Should show TOOLS REQUIS panel
    expect(frame).toContain('TOOLS REQUIS');
    expect(frame).toContain('o tool-dispatcher');

    // Infrastructure blocks should be filtered out
    expect(frame).not.toContain('o conversation-read');
    expect(frame).not.toContain('o conversation-append');
    expect(frame).not.toContain('o inference');
    expect(frame).not.toContain('o response-parser');

    // Should show the info text
    expect(frame).toContain('Ce block utilise');
  });
});
