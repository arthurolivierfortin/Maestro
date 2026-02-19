// @ts-nocheck
/**
 * Tests for useSelectableList hook.
 * Stdin-driven approach.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { useInput, Text } from 'ink';
import { useSelectableList } from '../hooks/useSelectableList.ts';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

/**
 * Keys: d=moveDown, u=moveUp, D=pageDown, U=pageUp, j=jumpTo(7), r=reset
 */
function ListHarness({ options }: { options: any }) {
  const list = useSelectableList(options);

  useInput((input) => {
    switch (input) {
      case 'd': list.moveDown(); break;
      case 'u': list.moveUp(); break;
      case 'D': list.pageDown(); break;
      case 'U': list.pageUp(); break;
      case 'j': list.jumpTo(7); break;
      case 'r': list.reset(); break;
    }
  });

  return h(Text, null,
    `idx=${list.selectedIndex}|pos=${list.positionLabel}|up=${list.canScrollUp}|dn=${list.canScrollDown}|vis=${list.visibleCount}`
  );
}

function getIdx(frame: string): number {
  const text = stripAnsi(frame || '');
  const m = text.match(/idx=(\d+)/);
  return m ? parseInt(m[1]) : -1;
}

function getState(frame: string) {
  const text = stripAnsi(frame || '');
  return {
    idx: parseInt(text.match(/idx=(\d+)/)?.[1] || '-1'),
    pos: text.match(/pos=([^|]+)/)?.[1] || '',
    canScrollUp: text.includes('up=true'),
    canScrollDown: text.includes('dn=true'),
    visibleCount: parseInt(text.match(/vis=(\d+)/)?.[1] || '0'),
  };
}

describe('useSelectableList', () => {
  afterEach(() => cleanup());

  it('initial selectedIndex is 0', async () => {
    const { lastFrame } = render(h(ListHarness, { options: { itemCount: 5 } }));
    await delay();
    expect(getIdx(lastFrame())).toBe(0);
  });

  it('initial selectedIndex respects initialIndex', async () => {
    const { lastFrame } = render(h(ListHarness, { options: { itemCount: 5, initialIndex: 3 } }));
    await delay();
    expect(getIdx(lastFrame())).toBe(3);
  });

  it('moveDown increments selection', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 5 } }));
    await delay();
    stdin.write('d');
    await delay();
    expect(getIdx(lastFrame())).toBe(1);
  });

  it('moveUp decrements selection', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 5, initialIndex: 2 } }));
    await delay();
    stdin.write('u');
    await delay();
    expect(getIdx(lastFrame())).toBe(1);
  });

  it('moveDown stops at last item without wrap', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 3, initialIndex: 2 } }));
    await delay();
    stdin.write('d');
    await delay();
    expect(getIdx(lastFrame())).toBe(2);
  });

  it('moveUp stops at first item without wrap', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 3 } }));
    await delay();
    stdin.write('u');
    await delay();
    expect(getIdx(lastFrame())).toBe(0);
  });

  it('moveDown wraps to first when wrap=true', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 3, initialIndex: 2, wrap: true } }));
    await delay();
    stdin.write('d');
    await delay();
    expect(getIdx(lastFrame())).toBe(0);
  });

  it('moveUp wraps to last when wrap=true', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 3, wrap: true } }));
    await delay();
    stdin.write('u');
    await delay();
    expect(getIdx(lastFrame())).toBe(2);
  });

  it('pageDown jumps by pageSize', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 20, pageSize: 5 } }));
    await delay();
    stdin.write('D');
    await delay();
    expect(getIdx(lastFrame())).toBe(5);
  });

  it('pageUp jumps back by pageSize', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 20, pageSize: 5, initialIndex: 10 } }));
    await delay();
    stdin.write('U');
    await delay();
    expect(getIdx(lastFrame())).toBe(5);
  });

  it('pageDown clamps to last item', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 10, pageSize: 5, initialIndex: 7 } }));
    await delay();
    stdin.write('D');
    await delay();
    expect(getIdx(lastFrame())).toBe(9);
  });

  it('jumpTo sets specific index', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 10 } }));
    await delay();
    stdin.write('j'); // jumpTo(7)
    await delay();
    expect(getIdx(lastFrame())).toBe(7);
  });

  it('reset returns to 0', async () => {
    const { lastFrame, stdin } = render(h(ListHarness, { options: { itemCount: 10, initialIndex: 5 } }));
    await delay();
    stdin.write('r');
    await delay();
    expect(getIdx(lastFrame())).toBe(0);
  });

  it('positionLabel shows "X/Y" format', async () => {
    const { lastFrame } = render(h(ListHarness, { options: { itemCount: 10, initialIndex: 3 } }));
    await delay();
    const { pos } = getState(lastFrame());
    expect(pos).toBe('4/10');
  });

  it('positionLabel shows "0/0" for empty list', async () => {
    const { lastFrame } = render(h(ListHarness, { options: { itemCount: 0 } }));
    await delay();
    const { pos } = getState(lastFrame());
    expect(pos).toBe('0/0');
  });

  it('scroll window: canScrollDown when items exceed pageSize', async () => {
    const { lastFrame } = render(h(ListHarness, { options: { itemCount: 20, pageSize: 5 } }));
    await delay();
    const state = getState(lastFrame());
    expect(state.canScrollDown).toBe(true);
    expect(state.canScrollUp).toBe(false);
  });

  it('scroll window: all visible when no pageSize', async () => {
    const { lastFrame } = render(h(ListHarness, { options: { itemCount: 5 } }));
    await delay();
    const state = getState(lastFrame());
    expect(state.visibleCount).toBe(5);
    expect(state.canScrollUp).toBe(false);
    expect(state.canScrollDown).toBe(false);
  });
});
