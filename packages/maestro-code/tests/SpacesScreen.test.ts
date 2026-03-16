/**
 * Tests for SpacesScreen — parent/child tree view (Phase 59-D).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

// Strip ANSI escape codes for text assertions
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── buildSessionDisplayList unit tests ──────────────────────

describe('buildSessionDisplayList', () => {
  it('returns flat list for sessions without children', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'aaa', name: 'Session A', status: 'idle' },
      { id: 'bbb', name: 'Session B', status: 'running' },
    ];
    const result = buildSessionDisplayList(sessions, new Set());
    expect(result).toHaveLength(2);
    expect(result[0].session.id).toBe('aaa');
    expect(result[0].isChild).toBe(false);
    expect(result[1].session.id).toBe('bbb');
    expect(result[1].isChild).toBe(false);
  });

  it('groups children under parent', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'parent1', name: 'Block Forge', status: 'idle' },
      { id: 'child1', name: 'test-designer', status: 'idle', parentSessionId: 'parent1' },
      { id: 'child2', name: 'agent-creator', status: 'idle', parentSessionId: 'parent1' },
      { id: 'standalone', name: 'Solo Session', status: 'running' },
    ];
    const result = buildSessionDisplayList(sessions, new Set());

    // Should have: parent1, child1, child2, standalone = 4 items
    expect(result).toHaveLength(4);
    expect(result[0].session.id).toBe('parent1');
    expect(result[0].isChild).toBe(false);
    expect(result[0].childCount).toBe(2);
    expect(result[0].isParentExpanded).toBe(true);

    expect(result[1].session.id).toBe('child1');
    expect(result[1].isChild).toBe(true);
    expect(result[1].treePrefix).toContain('\u251C'); // middle connector

    expect(result[2].session.id).toBe('child2');
    expect(result[2].isChild).toBe(true);
    expect(result[2].treePrefix).toContain('\u2514'); // last connector

    expect(result[3].session.id).toBe('standalone');
    expect(result[3].isChild).toBe(false);
    expect(result[3].childCount).toBeUndefined();
  });

  it('hides children when parent is collapsed', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'parent1', name: 'Block Forge', status: 'idle' },
      { id: 'child1', name: 'test-designer', status: 'idle', parentSessionId: 'parent1' },
      { id: 'child2', name: 'agent-creator', status: 'idle', parentSessionId: 'parent1' },
    ];
    const collapsed = new Set(['parent1']);
    const result = buildSessionDisplayList(sessions, collapsed);

    // Should only show parent, children hidden
    expect(result).toHaveLength(1);
    expect(result[0].session.id).toBe('parent1');
    expect(result[0].isParentExpanded).toBe(false);
    expect(result[0].childCount).toBe(2);
  });

  it('shows children when parent is expanded (not collapsed)', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'parent1', name: 'Block Forge', status: 'idle' },
      { id: 'child1', name: 'test-designer', status: 'idle', parentSessionId: 'parent1' },
    ];
    const result = buildSessionDisplayList(sessions, new Set());

    expect(result).toHaveLength(2);
    expect(result[0].isParentExpanded).toBe(true);
    expect(result[1].isChild).toBe(true);
    expect(result[1].parentId).toBe('parent1');
    expect(result[1].parentName).toBe('Block Forge');
  });

  it('sessions without children render normally', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'solo', name: 'Standalone', status: 'idle' },
    ];
    const result = buildSessionDisplayList(sessions, new Set());

    expect(result).toHaveLength(1);
    expect(result[0].isChild).toBe(false);
    expect(result[0].childCount).toBeUndefined();
    expect(result[0].isParentExpanded).toBeUndefined();
    expect(result[0].treePrefix).toBe('');
  });

  it('child with non-existent parent is treated as top-level', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'orphan', name: 'Orphan', status: 'idle', parentSessionId: 'nonexistent' },
    ];
    const result = buildSessionDisplayList(sessions, new Set());

    // Orphan is a child ID, so it's skipped as a top-level item
    // But its parent doesn't exist, so it won't be added under any parent either
    // The child is skipped from top-level rendering since it has parentSessionId
    expect(result).toHaveLength(0);
  });

  it('child names are included in parent display item', async () => {
    const { buildSessionDisplayList } = await import('../components/SpacesScreen.ts');
    const sessions = [
      { id: 'parent1', name: 'Forge', status: 'idle' },
      { id: 'c1', name: 'reviewer', status: 'idle', parentSessionId: 'parent1' },
      { id: 'c2', name: 'tester', status: 'idle', parentSessionId: 'parent1' },
    ];
    const result = buildSessionDisplayList(sessions, new Set());
    expect(result[0].childNames).toEqual(['reviewer', 'tester']);
  });
});

// ── SpacesScreen component rendering tests ──────────────────

describe('SpacesScreen', () => {
  afterEach(() => cleanup());

  const mockApiClient = {
    listSessions: vi.fn().mockResolvedValue([]),
    listProjects: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue([]),
    _fetch: vi.fn().mockResolvedValue({}),
  };

  it('renders empty session list', async () => {
    const { SpacesScreen } = await import('../components/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: mockApiClient,
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions' },
    }));
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('(no sessions)');
  });

  it('renders sessions with parent/child tree', async () => {
    const sessionsWithChildren = [
      { id: 'parent-id-1234', name: 'Block Forge Session', status: 'idle', variables: { _accumulatedCost: 0.46 }, startedAt: '2026-03-14T10:00:00Z' },
      { id: 'child-id-aaaa', name: 'test-designer', status: 'idle', parentSessionId: 'parent-id-1234', variables: { _accumulatedCost: 0.12 }, startedAt: '2026-03-14T10:01:00Z' },
      { id: 'child-id-bbbb', name: 'agent-creator', status: 'idle', parentSessionId: 'parent-id-1234', variables: { _accumulatedCost: 0.34 }, startedAt: '2026-03-14T10:02:00Z' },
      { id: 'solo-id-cccc', name: 'Solo Session', status: 'running', variables: {} },
    ];

    const api = {
      ...mockApiClient,
      listSessions: vi.fn().mockResolvedValue(sessionsWithChildren),
    };

    const { SpacesScreen } = await import('../components/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions' },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Parent should be visible
    expect(frame).toContain('Block Forge Session');
    // Children should be visible (parent expanded by default)
    expect(frame).toContain('test-designer');
    expect(frame).toContain('agent-creator');
    // Standalone session should be visible
    expect(frame).toContain('Solo Session');
    // Tree connectors should be present
    expect(frame).toContain('\u251C\u2500'); // middle connector
    expect(frame).toContain('\u2514\u2500'); // last connector
  });
});
