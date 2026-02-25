// @ts-nocheck
/**
 * Tests for demo mode in list pages (Phase 41-G).
 *
 * Verifies that CatalogPage, SpacesPage, ModelsPage show
 * mock data when demoMode=true and apiClient=null.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

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

// ── CatalogPage Demo Tests ───────────────────────────────────

describe('CatalogPage — demo mode', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockCatalogScreen.mockImplementation(() => h(Text, null, 'CatalogScreen'));
  });

  it('shows demo blocks when demoMode=true and no apiClient', async () => {
    const { CatalogPage } = await import('../pages/CatalogPage.ts');
    const { lastFrame } = render(h(CatalogPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: true,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('[DEMO]');
    expect(frame).toContain('12 blocks');
    expect(frame).toContain('Code Analyzer');
    expect(frame).toContain('File Read');
  });

  it('shows "No API client" when demoMode=false and no apiClient', async () => {
    const { CatalogPage } = await import('../pages/CatalogPage.ts');
    const { lastFrame } = render(h(CatalogPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: false,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No API client');
  });

  it('shows block fitness percentages in demo mode', async () => {
    const { CatalogPage } = await import('../pages/CatalogPage.ts');
    const { lastFrame } = render(h(CatalogPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: true,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('87%');  // Code Analyzer
    expect(frame).toContain('95%');  // File Read
  });
});

// ── SpacesPage Demo Tests ────────────────────────────────────

describe('SpacesPage — demo mode', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockSpacesScreen.mockImplementation(() => h(Text, null, 'SpacesScreen'));
  });

  it('shows demo repos/workspaces/sessions when demoMode=true', async () => {
    const { SpacesPage } = await import('../pages/SpacesPage.ts');
    const { lastFrame } = render(h(SpacesPage, {
      apiClient: null,
      height: 30,
      onQuit: vi.fn(),
      demoMode: true,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('[DEMO]');
    expect(frame).toContain('Repos (3)');
    expect(frame).toContain('Cantante');
    expect(frame).toContain('Workspaces (2)');
    expect(frame).toContain('Development');
    expect(frame).toContain('Sessions (5)');
    expect(frame).toContain('Cantante - File Tree Module');
  });

  it('shows "No API client" when demoMode=false', async () => {
    const { SpacesPage } = await import('../pages/SpacesPage.ts');
    const { lastFrame } = render(h(SpacesPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: false,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No API client');
  });
});

// ── ModelsPage Demo Tests ────────────────────────────────────

describe('ModelsPage — demo mode', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockModelsScreen.mockImplementation(() => h(Text, null, 'ModelsScreen'));
  });

  it('shows demo models when demoMode=true', async () => {
    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: true,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('[DEMO]');
    expect(frame).toContain('6 providers');
    expect(frame).toContain('Claude Sonnet');
    expect(frame).toContain('Qwen 2.5 Coder');
  });

  it('shows model latency and tokens/sec for available models', async () => {
    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: true,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('850ms');  // Claude Sonnet latency
    expect(frame).toContain('42t/s');  // Claude Sonnet tokens/sec
  });

  it('shows offline status for unavailable models', async () => {
    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: true,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('offline');  // SmolLM2
  });

  it('shows "No API client" when demoMode=false', async () => {
    const { ModelsPage } = await import('../pages/ModelsPage.ts');
    const { lastFrame } = render(h(ModelsPage, {
      apiClient: null,
      height: 20,
      onQuit: vi.fn(),
      demoMode: false,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No API client');
  });
});
