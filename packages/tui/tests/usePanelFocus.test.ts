// @ts-nocheck
/**
 * Tests for usePanelFocus hook.
 * Stdin-driven approach: keys trigger hook actions, lastFrame() reads state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { useInput, Text } from 'ink';
import { usePanelFocus } from '../hooks/usePanelFocus.ts';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

/**
 * Keys: n=nextFocus, p=prevFocus, 1=setFocus('a'), 2=setFocus('b'), 3=setFocus('c'),
 *        i=setFocusByIndex(2)
 */
function PanelFocusHarness({ panels }: { panels: string[] }) {
  const focus = usePanelFocus(panels);

  useInput((input) => {
    switch (input) {
      case 'n': focus.nextFocus(); break;
      case 'p': focus.prevFocus(); break;
      case '1': focus.setFocus(panels[0]); break;
      case '2': focus.setFocus(panels[1]); break;
      case '3': focus.setFocus(panels[2]); break;
      case 'i': focus.setFocusByIndex(2); break;
    }
  });

  const focused = focus.focusedPanel || 'null';
  const checks = panels.map(p => `${p}=${focus.isFocused(p) ? 'Y' : 'N'}`).join(',');
  return h(Text, null, `focused=${focused}|${checks}`);
}

function getFocused(frame: string): string {
  const text = stripAnsi(frame || '');
  const m = text.match(/focused=([^|]+)/);
  return m ? m[1] : '';
}

describe('usePanelFocus', () => {
  afterEach(() => cleanup());

  it('initial focus is the first panel', async () => {
    const { lastFrame } = render(h(PanelFocusHarness, { panels: ['tree', 'log', 'llm'] }));
    await delay();
    expect(getFocused(lastFrame())).toBe('tree');
  });

  it('nextFocus moves to the next panel', async () => {
    const { lastFrame, stdin } = render(h(PanelFocusHarness, { panels: ['tree', 'log', 'llm'] }));
    await delay();
    stdin.write('n');
    await delay();
    expect(getFocused(lastFrame())).toBe('log');
  });

  it('prevFocus moves to the previous panel', async () => {
    const { lastFrame, stdin } = render(h(PanelFocusHarness, { panels: ['tree', 'log', 'llm'] }));
    await delay();
    stdin.write('n'); // → log
    await delay();
    stdin.write('p'); // → tree
    await delay();
    expect(getFocused(lastFrame())).toBe('tree');
  });

  it('nextFocus wraps from last to first', async () => {
    const { lastFrame, stdin } = render(h(PanelFocusHarness, { panels: ['a', 'b', 'c'] }));
    await delay();
    stdin.write('n'); // → b
    stdin.write('n'); // → c
    await delay();
    expect(getFocused(lastFrame())).toBe('c');
    stdin.write('n'); // → a (wrap)
    await delay();
    expect(getFocused(lastFrame())).toBe('a');
  });

  it('prevFocus wraps from first to last', async () => {
    const { lastFrame, stdin } = render(h(PanelFocusHarness, { panels: ['a', 'b', 'c'] }));
    await delay();
    stdin.write('p'); // wrap → c
    await delay();
    expect(getFocused(lastFrame())).toBe('c');
  });

  it('isFocused returns true for the active panel', async () => {
    const { lastFrame } = render(h(PanelFocusHarness, { panels: ['tree', 'log'] }));
    await delay();
    const text = stripAnsi(lastFrame() || '');
    expect(text).toContain('tree=Y');
    expect(text).toContain('log=N');
  });

  it('setFocus jumps to a named panel', async () => {
    const { lastFrame, stdin } = render(h(PanelFocusHarness, { panels: ['a', 'b', 'c'] }));
    await delay();
    stdin.write('3'); // setFocus('c')
    await delay();
    expect(getFocused(lastFrame())).toBe('c');
  });

  it('setFocusByIndex jumps to a panel by index', async () => {
    const { lastFrame, stdin } = render(h(PanelFocusHarness, { panels: ['a', 'b', 'c'] }));
    await delay();
    stdin.write('i'); // setFocusByIndex(2) → 'c'
    await delay();
    expect(getFocused(lastFrame())).toBe('c');
  });

  it('empty panels returns null focusedPanel', async () => {
    const { lastFrame } = render(h(PanelFocusHarness, { panels: [] }));
    await delay();
    expect(getFocused(lastFrame())).toBe('null');
  });
});
