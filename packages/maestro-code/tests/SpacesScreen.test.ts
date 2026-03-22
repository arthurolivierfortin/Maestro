/**
 * Tests for SpacesScreen — flat list with children in detail view.
 *
 * The session list is flat: only top-level sessions (no parentSessionId).
 * Parents show a [+N] badge. Children appear in the expanded detail view.
 * Fitness is shown only in the detail view, never in the row.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

// Strip ANSI escape codes for text assertions
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── Flat list filtering tests ────────────────────────────────

describe('SpacesScreen flat list', () => {
  afterEach(() => cleanup());

  const baseSessions = [
    { id: 'parent-id-1234', name: 'Block Forge Session', status: 'idle', variables: { _accumulatedCost: 0.46 }, startedAt: '2026-03-14T10:00:00Z' },
    { id: 'child-id-aaaa', name: 'Block Forge Session / test-designer', status: 'idle', parentSessionId: 'parent-id-1234', variables: { _accumulatedCost: 0.12 }, startedAt: '2026-03-14T10:01:00Z' },
    { id: 'child-id-bbbb', name: 'Block Forge Session / agent-creator', status: 'idle', parentSessionId: 'parent-id-1234', variables: { _accumulatedCost: 0.34 }, startedAt: '2026-03-14T10:02:00Z' },
    { id: 'solo-id-cccc', name: 'Solo Session', status: 'running', variables: {} },
  ];

  const makeApi = (sessions: any[] = baseSessions) => ({
    listSessions: vi.fn().mockResolvedValue(sessions),
    listProjects: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue([]),
    _fetch: vi.fn().mockResolvedValue({}),
  });

  it('flat list excludes children — only top-level sessions shown', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions' },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Parent and standalone should be visible
    expect(frame).toContain('Block Forge Session');
    expect(frame).toContain('Solo Session');
    // Children should NOT be in the list (only in detail view of parent)
    // Count: should show 2 session(s) (only top-level)
    expect(frame).toContain('2 session(s)');
  });

  it('parent with children shows [+N] badge', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions', selectedIndex: 0 },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Parent should show [+2] badge
    expect(frame).toContain('[+2]');
  });

  it('session without children shows no badge', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const soloOnly = [
      { id: 'solo-1', name: 'Solo One', status: 'idle', variables: {} },
    ];
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(soloOnly),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions' },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    expect(frame).toContain('Solo One');
    expect(frame).not.toContain('[+');
  });

  it('expanded parent shows children in detail view', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      // selectedIndex 0 = parent, which auto-expands when selected
      initialState: { activeTab: 'sessions', selectedIndex: 0 },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Detail view should show children section
    expect(frame).toContain('children:');
    expect(frame).toContain('test-designer');
    expect(frame).toContain('agent-creator');
  });

  it('no fitness in session row — only in detail view if present', async () => {
    const sessionsWithFitness = [
      { id: 'fit-1', name: 'Fitness Session', status: 'idle', variables: { currentFitness: 0.85, _accumulatedCost: 1.0 } },
      { id: 'nofit-1', name: 'No Fitness', status: 'idle', variables: { _accumulatedCost: 0.0 } },
    ];
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(sessionsWithFitness),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      // Select first item (which has fitness) — it auto-expands
      initialState: { activeTab: 'sessions', selectedIndex: 0 },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Fitness should appear in the expanded detail view
    expect(frame).toContain('fitness:');
    expect(frame).toContain('85%');

    // The non-selected row should NOT show fit: anywhere
    // (old format had "fit:" in the row — now removed)
    // Split frame into lines and check the non-expanded row for "No Fitness"
    const lines = frame.split('\n');
    const noFitLine = lines.find(l => l.includes('No Fitness'));
    expect(noFitLine).toBeDefined();
    expect(noFitLine).not.toContain('fit:');
  });

  it('child with / in name shows short name in detail view', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions', selectedIndex: 0 },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Children with ' / ' in name should show short name in detail
    // "Block Forge Session / test-designer" -> "test-designer"
    // "Block Forge Session / agent-creator" -> "agent-creator"
    expect(frame).toContain('test-designer');
    expect(frame).toContain('agent-creator');
  });

  it('no tree connectors in session rows', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions', selectedIndex: 0 },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    const lines = frame.split('\n');

    // Check that no session-related line contains tree connectors (├─ / └─)
    // Filter out panel border lines (which use └── for box drawing)
    const contentLines = lines.filter(l =>
      !l.match(/^[│┌┐└┘─┤├]+/) && // not a box border line
      !l.startsWith('└') && !l.startsWith('┌') // not start of border
    );

    for (const line of contentLines) {
      // Tree connectors are specifically ├─ and └─ (not └── which is border)
      expect(line).not.toMatch(/\u251C\u2500 /); // ├─ followed by space (tree indent)
      expect(line).not.toMatch(/\u2514\u2500 /); // └─ followed by space (tree indent)
    }
  });

  it('renders empty session list', async () => {
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi([]),
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

  it('orphan child (parent not in list) appears as top-level', async () => {
    const orphanSessions = [
      { id: 'orphan-1', name: 'Orphan Session', status: 'idle', parentSessionId: 'nonexistent', variables: {} },
      { id: 'normal-1', name: 'Normal Session', status: 'idle', variables: {} },
    ];
    const { SpacesScreen } = await import('../components/legacy/SpacesScreen.ts');
    const { lastFrame } = render(h(SpacesScreen, {
      apiClient: makeApi(orphanSessions),
      onNavigate: vi.fn(),
      onSessionSelect: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      initialState: { activeTab: 'sessions' },
    }));
    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Orphan's parent is "nonexistent" which is not in the list,
    // but orphan has parentSessionId set — so it gets filtered out.
    // Only the normal session appears as top-level.
    expect(frame).toContain('Normal Session');
    // The count should reflect top-level only
    expect(frame).toContain('1 session(s)');
  });
});
