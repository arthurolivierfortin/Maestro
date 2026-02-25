// @ts-nocheck
/**
 * Tests for spatial navigation — PageRegistry + useSpatialNav hook.
 *
 * The hook tests use a lightweight wrapper component rendered via
 * ink-testing-library with stdin-driven state transitions.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, useState, useRef, useEffect } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text, useInput } from 'ink';
import { createDefaultRegistry, PageRegistry } from '../registry/index.ts';
import { useSpatialNav } from '../hooks/useSpatialNav.ts';

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── PageRegistry Standalone Tests ────────────────────────────────

describe('PageRegistry direction hints', () => {
  it('agent (0,0) has 4 direction hints', () => {
    const reg = createDefaultRegistry();
    const agent = reg.getById('agent')!;
    const hints = reg.getDirectionHints(agent.position);
    expect(hints).toHaveLength(4);
    const dirs = hints.map(h => h.direction).sort();
    expect(dirs).toEqual(['down', 'left', 'right', 'up']);
  });

  it('catalog (-1,0) has 1 direction hint (right→agent)', () => {
    const reg = createDefaultRegistry();
    const catalog = reg.getById('catalog')!;
    const hints = reg.getDirectionHints(catalog.position);
    expect(hints).toHaveLength(1);
    expect(hints[0].direction).toBe('right');
    expect(hints[0].page.id).toBe('agent');
  });

  it('execution (0,-1) has 1 direction hint (down→agent)', () => {
    const reg = createDefaultRegistry();
    const execution = reg.getById('execution')!;
    const hints = reg.getDirectionHints(execution.position);
    expect(hints).toHaveLength(1);
    expect(hints[0].direction).toBe('down');
    expect(hints[0].page.id).toBe('agent');
  });

  it('models (0,1) has 1 direction hint (up→agent)', () => {
    const reg = createDefaultRegistry();
    const models = reg.getById('models')!;
    const hints = reg.getDirectionHints(models.position);
    expect(hints).toHaveLength(1);
    expect(hints[0].direction).toBe('up');
    expect(hints[0].page.id).toBe('agent');
  });

  it('spaces (1,0) has 1 direction hint (left→agent)', () => {
    const reg = createDefaultRegistry();
    const spaces = reg.getById('spaces')!;
    const hints = reg.getDirectionHints(spaces.position);
    expect(hints).toHaveLength(1);
    expect(hints[0].direction).toBe('left');
    expect(hints[0].page.id).toBe('agent');
  });
});

// ── useSpatialNav Hook Tests ────────────────────────────────────
// Uses a wrapper component that maps single-char stdin to hook methods.
// Press 'U'=up, 'D'=down, 'L'=left, 'R'=right, 'H'=goHome,
// 'G'=goTo('models'), 'Q'=quickSwitch, 'O'=openDetail, 'C'=closeDetail,
// 'T'=rotateRing(true), 'Z'=goTo('catalog')

const NavTestHarness = ({ initialPageId }: { initialPageId?: string }) => {
  const [registry] = useState(() => createDefaultRegistry());
  const nav = useSpatialNav(registry, initialPageId || 'agent');

  useInput((input) => {
    switch (input) {
      case 'U': nav.navigate('up'); break;
      case 'D': nav.navigate('down'); break;
      case 'L': nav.navigate('left'); break;
      case 'R': nav.navigate('right'); break;
      case 'H': nav.goHome(); break;
      case 'G': nav.goTo('models'); break;
      case 'Q': nav.quickSwitch(); break;
      case 'O': nav.openDetail({ type: 'block-detail', id: 'x1' }); break;
      case 'C': nav.closeDetail(); break;
      case 'T': nav.rotateRing(true); break;
      case 'Z': nav.goTo('catalog'); break;
    }
  });

  return h(Text, null, [
    `page:${nav.currentPageId}`,
    nav.previousPageId ? ` prev:${nav.previousPageId}` : '',
    nav.detailScreen ? ` detail:${nav.detailScreen.type}:${nav.detailScreen.id}` : '',
    ` hints:${nav.directionHints.length}`,
  ].join(''));
};

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

describe('useSpatialNav', () => {
  afterEach(() => cleanup());

  it('starts on agent page with 4 direction hints', async () => {
    const { lastFrame } = render(h(NavTestHarness, {}));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:agent');
    expect(frame).toContain('hints:4');
  });

  it('navigate("up") from agent goes to execution', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('U');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:execution');
    expect(frame).toContain('prev:agent');
  });

  it('navigate("left") from agent goes to catalog', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('L');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:catalog');
  });

  it('navigate("right") from agent goes to spaces', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('R');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:spaces');
  });

  it('navigate("down") from agent goes to models', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('D');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:models');
  });

  it('navigate in empty direction is no-op', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    // Navigate up to execution (0,-1), then up again (0,-2) — empty
    stdin.write('U');
    await delay();
    stdin.write('U');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:execution'); // stays
  });

  it('goHome() returns to agent and clears detailScreen', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    // Navigate away + open detail
    stdin.write('L'); // go to catalog
    await delay();
    stdin.write('O'); // open detail
    await delay();
    expect(stripAnsi(lastFrame() || '')).toContain('page:catalog');
    expect(stripAnsi(lastFrame() || '')).toContain('detail:block-detail:x1');

    // Go home
    stdin.write('H');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:agent');
    expect(frame).not.toContain('detail:');
  });

  it('goTo("models") navigates directly', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('G'); // goTo('models')
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:models');
    expect(frame).toContain('prev:agent');
  });

  it('quickSwitch() toggles between current and previous', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    // Navigate to catalog
    stdin.write('Z'); // goTo('catalog')
    await delay();
    expect(stripAnsi(lastFrame() || '')).toContain('page:catalog');
    expect(stripAnsi(lastFrame() || '')).toContain('prev:agent');

    // Quick switch back
    stdin.write('Q');
    await delay();
    expect(stripAnsi(lastFrame() || '')).toContain('page:agent');
    expect(stripAnsi(lastFrame() || '')).toContain('prev:catalog');

    // Quick switch forward again
    stdin.write('Q');
    await delay();
    expect(stripAnsi(lastFrame() || '')).toContain('page:catalog');
  });

  it('openDetail / closeDetail within a page', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('O'); // openDetail
    await delay();

    let frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:agent');
    expect(frame).toContain('detail:block-detail:x1');

    stdin.write('C'); // closeDetail
    await delay();

    frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:agent');
    expect(frame).not.toContain('detail:');
  });

  it('directionHints from catalog has only 1 hint (right→agent)', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    stdin.write('Z'); // goTo('catalog')
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:catalog');
    expect(frame).toContain('hints:1');
  });

  it('rotateRing(true) cycles through non-center pages', async () => {
    const { lastFrame, stdin } = render(h(NavTestHarness, {}));
    await delay();
    // Go to catalog first
    stdin.write('Z');
    await delay();
    expect(stripAnsi(lastFrame() || '')).toContain('page:catalog');

    // Rotate clockwise — should go to next ring page
    stdin.write('T');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    // Should move to a different ring page (not catalog)
    expect(frame).not.toContain('page:catalog');
    // Must be one of: execution, spaces, models
    const pageMatch = frame.match(/page:(\w+)/);
    expect(['execution', 'spaces', 'models']).toContain(pageMatch?.[1]);
  });
});
