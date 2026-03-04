/**
 * Tests for CatalogScreen capability display (Phase 49-B).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

function createMockApiClient(blocks: any[] = []) {
  return {
    listBlocks: vi.fn().mockResolvedValue(blocks),
    listSessions: vi.fn().mockResolvedValue([]),
  };
}

describe('CatalogScreen — Capabilities', () => {
  afterEach(() => cleanup());

  it('shows capability tags in inline row', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([
      {
        id: 'file-edit',
        name: 'File Edit',
        blockType: 'tool',
        version: '1.0.0',
        capabilities: ['filesystem', 'read', 'write'],
        description: 'Edit files',
      },
    ]);

    const { lastFrame } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Should show condensed capabilities inline
    expect(frame).toContain('filesystem,read,write');
  });

  it('shows capability badges in expanded view', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([
      {
        id: 'git-status',
        name: 'Git Status',
        blockType: 'tool',
        version: '1.0.0',
        capabilities: ['shell', 'git'],
        description: 'Show git status',
      },
    ]);

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    // Expand the selected row
    stdin.write(' '); // space to expand
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');

    // Expanded view should show capability badges
    expect(frame).toContain('[shell]');
    expect(frame).toContain('[git]');
    expect(frame).toContain('capabilities:');
  });

  it('handles blocks without capabilities gracefully', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([
      {
        id: 'no-caps',
        name: 'No Caps Block',
        blockType: 'tool',
        version: '1.0.0',
        description: 'No capabilities defined',
      },
    ]);

    const { lastFrame } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    expect(frame).toContain('No Caps Block');
    // Should not crash, should not show "capabilities:" label
  });

  it('truncates to 3 capabilities in inline view', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([
      {
        id: 'many-caps',
        name: 'Many Caps',
        blockType: 'tool',
        version: '1.0.0',
        capabilities: ['a', 'b', 'c', 'd', 'e'],
        description: 'Has many capabilities',
      },
    ]);

    const { lastFrame } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');

    // Should show first 3 only
    expect(frame).toContain('a,b,c');
    // Should NOT show d,e in inline
    expect(frame).not.toContain('a,b,c,d');
  });

  it('shows all capabilities in expanded view', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([
      {
        id: 'many-caps',
        name: 'Many Caps',
        blockType: 'tool',
        version: '1.0.0',
        capabilities: ['a', 'b', 'c', 'd', 'e'],
        description: 'Has many capabilities',
      },
    ]);

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    stdin.write(' '); // expand
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');

    // All capabilities shown in expanded view
    expect(frame).toContain('[a]');
    expect(frame).toContain('[b]');
    expect(frame).toContain('[c]');
    expect(frame).toContain('[d]');
    expect(frame).toContain('[e]');
  });
});
