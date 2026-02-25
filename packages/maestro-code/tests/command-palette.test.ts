// @ts-nocheck
/**
 * Tests for CommandPalette component (Phase 41-G).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

// ── Mocks ─────────────────────────────────────────────────────

const { mockPanel, mockShortcut } = vi.hoisted(() => ({
  mockPanel: vi.fn(),
  mockShortcut: vi.fn(),
}));

vi.mock('@maestro/tui/components', () => ({
  Panel: mockPanel,
  Shortcut: mockShortcut,
}));

vi.mock('@maestro/tui/hooks', () => ({
  useSelectableList: ({ itemCount }: any) => ({
    selectedIndex: 0,
    moveUp: vi.fn(),
    moveDown: vi.fn(),
    pageUp: vi.fn(),
    pageDown: vi.fn(),
    jumpTo: vi.fn(),
    reset: vi.fn(),
    scrollStart: 0,
    visibleCount: Math.min(itemCount, 12),
    canScrollUp: false,
    canScrollDown: itemCount > 12,
    positionLabel: itemCount > 0 ? `1/${itemCount}` : '0/0',
  }),
  useAnimationTick: () => 0,
}));

vi.mock('@maestro/tui/theme', () => ({
  inkTheme: { shortcut: { key: 'cyan' } },
  primary: (t: string) => h(Text, null, t),
  muted: (t: string) => h(Text, null, t),
  bold: (t: string) => h(Text, null, t),
  spinnerFrame: () => '⠋',
  breathingDot: () => '●',
}));

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── Helper: create a test registry ───────────────────────────

async function createTestRegistry() {
  const { PageRegistry } = await import('../registry/PageRegistry.ts');
  const registry = new PageRegistry();
  registry.register({
    id: 'agent', label: 'Agent', shortLabel: 'Agt', icon: '🤖',
    position: { x: 0, y: 0 }, component: () => null,
  });
  registry.register({
    id: 'catalog', label: 'Catalog', shortLabel: 'Cat', icon: '📦',
    position: { x: -1, y: 0 }, component: () => null,
  });
  registry.register({
    id: 'models', label: 'Models', shortLabel: 'Mod', icon: '🧠',
    position: { x: 0, y: 1 }, component: () => null,
  });
  return registry;
}

// ── Tests ────────────────────────────────────────────────────

describe('CommandPalette', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    // Panel renders title as Text + children in a Box (not nested in Text)
    mockPanel.mockImplementation((props: any) =>
      h(Box, { flexDirection: 'column' },
        h(Text, null, `[PANEL:${props.title}]`),
        props.children,
      )
    );
    mockShortcut.mockImplementation((props: any) =>
      h(Text, null, `[${props.k}]${props.label}`)
    );
  });

  it('renders with title COMMAND PALETTE', async () => {
    const { CommandPalette } = await import('../components/CommandPalette.ts');
    const registry = await createTestRegistry();
    const { lastFrame } = render(h(CommandPalette, {
      registry,
      onExecute: vi.fn(),
      onClose: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('COMMAND PALETTE');
  });

  it('shows navigation items from registry', async () => {
    const { CommandPalette } = await import('../components/CommandPalette.ts');
    const registry = await createTestRegistry();
    const { lastFrame } = render(h(CommandPalette, {
      registry,
      onExecute: vi.fn(),
      onClose: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Go to Agent');
    expect(frame).toContain('Go to Catalog');
    expect(frame).toContain('Go to Models');
  });

  it('shows action items', async () => {
    const { CommandPalette } = await import('../components/CommandPalette.ts');
    const registry = await createTestRegistry();
    const { lastFrame } = render(h(CommandPalette, {
      registry,
      onExecute: vi.fn(),
      onClose: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Show Help');
    expect(frame).toContain('Toggle Voice Mode');
    expect(frame).toContain('Quit');
  });

  it('shows slash command items', async () => {
    const { CommandPalette } = await import('../components/CommandPalette.ts');
    const registry = await createTestRegistry();
    const { lastFrame } = render(h(CommandPalette, {
      registry,
      onExecute: vi.fn(),
      onClose: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('/catalog');
    expect(frame).toContain('/spaces');
    expect(frame).toContain('/help');
  });

  it('shows result count', async () => {
    const { CommandPalette } = await import('../components/CommandPalette.ts');
    const registry = await createTestRegistry();
    const { lastFrame } = render(h(CommandPalette, {
      registry,
      onExecute: vi.fn(),
      onClose: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    // Should have at least 3 nav + 5 actions + 6 slash = 14 results
    expect(frame).toContain('results');
  });

  it('shows category headers', async () => {
    const { CommandPalette } = await import('../components/CommandPalette.ts');
    const registry = await createTestRegistry();
    const { lastFrame } = render(h(CommandPalette, {
      registry,
      onExecute: vi.fn(),
      onClose: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Navigation');
    expect(frame).toContain('Actions');
    expect(frame).toContain('Slash Commands');
  });
});
