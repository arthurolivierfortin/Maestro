// @ts-nocheck
/**
 * Tests for list pages: CatalogPage, SpacesPage, ModelsPage.
 *
 * Monitor components are mocked to avoid network calls.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createElement as h, useEffect } from 'react';
import { Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

// Helper: creates a mock component that calls a callback via useEffect (avoids setState-during-render warning)
function MockWithEffect(props: any, callbackKey: string, arg: string) {
  useEffect(() => {
    if (props[callbackKey]) props[callbackKey](arg);
  }, []);
  return h(Text, null, 'MockScreen');
}

// ── Mocks ─────────────────────────────────────────────────────

const { mockCatalogScreen, mockBlockDetail } = vi.hoisted(() => ({
  mockCatalogScreen: vi.fn(),
  mockBlockDetail: vi.fn(),
}));
vi.mock('@maestro/monitor/components/CatalogScreen.ts', () => ({
  CatalogScreen: mockCatalogScreen,
}));
vi.mock('@maestro/monitor/components/BlockDetail.ts', () => ({
  BlockDetail: mockBlockDetail,
}));

const { mockSpacesScreen, mockSessionMonitor, mockWorkspaceDetail, mockRepoDetail } = vi.hoisted(() => ({
  mockSpacesScreen: vi.fn(),
  mockSessionMonitor: vi.fn(),
  mockWorkspaceDetail: vi.fn(),
  mockRepoDetail: vi.fn(),
}));
vi.mock('@maestro/monitor/components/SpacesScreen.ts', () => ({
  SpacesScreen: mockSpacesScreen,
}));
vi.mock('@maestro/monitor/components/SessionMonitor.ts', () => ({
  SessionMonitor: mockSessionMonitor,
}));
vi.mock('@maestro/monitor/components/WorkspaceDetail.ts', () => ({
  WorkspaceDetail: mockWorkspaceDetail,
}));
vi.mock('@maestro/monitor/components/RepoDetail.ts', () => ({
  RepoDetail: mockRepoDetail,
}));

const { mockModelsScreen, mockModelDetail } = vi.hoisted(() => ({
  mockModelsScreen: vi.fn(),
  mockModelDetail: vi.fn(),
}));
vi.mock('@maestro/monitor/components/ModelsScreen.ts', () => ({
  ModelsScreen: mockModelsScreen,
}));
vi.mock('@maestro/monitor/components/ModelDetail.ts', () => ({
  ModelDetail: mockModelDetail,
}));

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── CatalogPage Tests ─────────────────────────────────────────

describe('CatalogPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockCatalogScreen.mockImplementation((props: any) =>
      h(Text, null, 'CatalogScreen:rendered')
    );
    mockBlockDetail.mockImplementation((props: any) =>
      h(Text, null, 'BlockDetail:' + props.blockId)
    );
  });

  it('shows "No API client" when apiClient is null', async () => {
    const { CatalogPage } = await import('../pages/CatalogPage.ts');
    const { lastFrame } = render(h(CatalogPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Catalog');
    expect(frame).toContain('No API client');
  });

  it('renders CatalogScreen when apiClient is present', async () => {
    const { CatalogPage } = await import('../pages/CatalogPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(CatalogPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('CatalogScreen:rendered');
  });

  it('navigates to block detail when onBlockSelect is called', async () => {
    mockCatalogScreen.mockImplementation((props: any) => {
      useEffect(() => {
        if (props.onBlockSelect) props.onBlockSelect('test-block-123');
      }, []);
      return h(Text, null, 'CatalogScreen');
    });

    const { CatalogPage } = await import('../pages/CatalogPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(CatalogPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('BlockDetail:test-block-123');
  });
});

// ── SpacesPage Tests ──────────────────────────────────────────

describe('SpacesPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockSpacesScreen.mockImplementation((props: any) =>
      h(Text, null, 'SpacesScreen:rendered')
    );
    mockSessionMonitor.mockImplementation((props: any) =>
      h(Text, null, 'SessionMonitor:' + props.sessionId)
    );
    mockWorkspaceDetail.mockImplementation((props: any) =>
      h(Text, null, 'WorkspaceDetail:' + props.workspaceId)
    );
    mockRepoDetail.mockImplementation((props: any) =>
      h(Text, null, 'RepoDetail:' + props.repoId)
    );
  });

  it('shows "No API client" when apiClient is null', async () => {
    const { SpacesPage } = await import('../pages/SpacesPage.ts');
    const { lastFrame } = render(h(SpacesPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Spaces');
    expect(frame).toContain('No API client');
  });

  it('renders SpacesScreen when apiClient is present', async () => {
    const { SpacesPage } = await import('../pages/SpacesPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(SpacesPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('SpacesScreen:rendered');
  });

  it('navigates to session detail when onSessionSelect is called', async () => {
    mockSpacesScreen.mockImplementation((props: any) => {
      useEffect(() => {
        if (props.onSessionSelect) props.onSessionSelect('session-abc-123');
      }, []);
      return h(Text, null, 'SpacesScreen');
    });

    const { SpacesPage } = await import('../pages/SpacesPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(SpacesPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('SessionMonitor:session-abc-123');
  });

  it('navigates to workspace detail when onWorkspaceSelect is called', async () => {
    mockSpacesScreen.mockImplementation((props: any) => {
      useEffect(() => {
        if (props.onWorkspaceSelect) props.onWorkspaceSelect('ws-456');
      }, []);
      return h(Text, null, 'SpacesScreen');
    });

    const { SpacesPage } = await import('../pages/SpacesPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(SpacesPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('WorkspaceDetail:ws-456');
  });
});

// ── ModelsPage Tests ──────────────────────────────────────────

describe('ModelsPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockModelsScreen.mockImplementation((props: any) =>
      h(Text, null, 'ModelsScreen:rendered')
    );
    mockModelDetail.mockImplementation((props: any) =>
      h(Text, null, 'ModelDetail:' + props.modelId)
    );
  });

  it('shows "No API client" when apiClient is null', async () => {
    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Models');
    expect(frame).toContain('No API client');
  });

  it('renders ModelsScreen when apiClient is present', async () => {
    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('ModelsScreen:rendered');
  });

  it('navigates to model detail when onModelSelect is called', async () => {
    mockModelsScreen.mockImplementation((props: any) => {
      useEffect(() => {
        if (props.onModelSelect) props.onModelSelect('gpt-4o-mini');
      }, []);
      return h(Text, null, 'ModelsScreen');
    });

    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: mockClient,
      height: 20,
      onQuit: vi.fn(),
    }));
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('ModelDetail:gpt-4o-mini');
  });
});
