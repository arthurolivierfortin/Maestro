// @ts-nocheck
/**
 * Tests for useScroll hook.
 * Uses ink-testing-library with stdin-driven actions (proven pattern from App.test.ts).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, useEffect } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { useInput, Text } from 'ink';
import { useScroll } from '../hooks/useScroll.ts';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

/**
 * Test component: renders offset as text, responds to stdin for actions.
 * Keys: d=scrollDown(3), u=scrollUp(3), T=scrollToTop, B=scrollToBottom,
 *        s=setMaxScroll(main,50), S=setMaxScroll(main,10), r=reset(main), R=reset(),
 *        2=scrollDown(panel-b,5), 3=setMaxScroll(panel-b,50), x=scrollTo(main,15)
 */
function ScrollHarness() {
  const scroll = useScroll();

  useEffect(() => {
    // Set a reasonable default max for most tests
  }, []);

  useInput((input) => {
    switch (input) {
      case 'd': scroll.scrollDown('main', 3); break;
      case 'u': scroll.scrollUp('main', 3); break;
      case 'T': scroll.scrollToTop('main'); break;
      case 'B': scroll.scrollToBottom('main'); break;
      case 's': scroll.setMaxScroll('main', 50); break;
      case 'S': scroll.setMaxScroll('main', 10); break;
      case 'r': scroll.reset('main'); break;
      case 'R': scroll.reset(); break;
      case 'x': scroll.scrollTo('main', 15); break;
      case 'D': scroll.scrollDown('main', 500); break;
      // Panel B operations for multi-panel tests
      case '2': scroll.scrollDown('b', 5); break;
      case '3': scroll.setMaxScroll('b', 50); break;
    }
  });

  return h(Text, null,
    `main=${scroll.getOffset('main')}|b=${scroll.getOffset('b')}`
  );
}

function getOffsets(frame: string): { main: number; b: number } {
  const text = stripAnsi(frame || '');
  const mainMatch = text.match(/main=(\d+)/);
  const bMatch = text.match(/b=(\d+)/);
  return {
    main: mainMatch ? parseInt(mainMatch[1]) : -1,
    b: bMatch ? parseInt(bMatch[1]) : -1,
  };
}

describe('useScroll', () => {
  afterEach(() => cleanup());

  it('initial offset is 0', async () => {
    const { lastFrame } = render(h(ScrollHarness));
    await delay();
    const { main } = getOffsets(lastFrame());
    expect(main).toBe(0);
  });

  it('scrollDown increments offset', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('s'); // setMaxScroll(main, 50)
    await delay();
    stdin.write('d'); // scrollDown(main, 3)
    await delay();
    const { main } = getOffsets(lastFrame());
    expect(main).toBe(3);
  });

  it('scrollUp decrements offset', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('s'); // setMaxScroll(main, 50)
    await delay();
    stdin.write('d'); // +3
    stdin.write('d'); // +3 = 6
    await delay();
    stdin.write('u'); // -3 = 3
    await delay();
    const { main } = getOffsets(lastFrame());
    expect(main).toBe(3);
  });

  it('scrollUp does not go below 0', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('u'); // scrollUp at 0
    await delay();
    const { main } = getOffsets(lastFrame());
    expect(main).toBe(0);
  });

  it('scrollDown respects setMaxScroll', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('S'); // setMaxScroll(main, 10)
    await delay();
    stdin.write('d'); // +3
    stdin.write('d'); // +3 = 6
    stdin.write('d'); // +3 = 9
    stdin.write('d'); // +3 → clamped to 10
    await delay();
    const { main } = getOffsets(lastFrame());
    expect(main).toBe(10);
  });

  it('scrollDown without setMaxScroll does not cap at 200 (old bug)', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('D'); // scrollDown(main, 500) — no max set
    await delay();
    const { main } = getOffsets(lastFrame());
    expect(main).toBe(500);
  });

  it('scrollToTop sets offset to 0', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('s'); // setMaxScroll(main, 50)
    await delay();
    stdin.write('d'); // +3
    stdin.write('d'); // +3 = 6
    await delay();
    expect(getOffsets(lastFrame()).main).toBe(6);
    stdin.write('T'); // scrollToTop
    await delay();
    expect(getOffsets(lastFrame()).main).toBe(0);
  });

  it('scrollToTop is no-op when already at 0', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('T'); // scrollToTop at 0
    await delay();
    expect(getOffsets(lastFrame()).main).toBe(0);
  });

  it('scrollToBottom sets offset to max', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('S'); // setMaxScroll(main, 10)
    await delay();
    stdin.write('B'); // scrollToBottom
    await delay();
    expect(getOffsets(lastFrame()).main).toBe(10);
  });

  it('scrollToBottom is no-op without setMaxScroll', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('B'); // scrollToBottom — no max set
    await delay();
    expect(getOffsets(lastFrame()).main).toBe(0);
  });

  it('scrollTo clamps to [0, max]', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('S'); // setMaxScroll(main, 10)
    await delay();
    stdin.write('x'); // scrollTo(main, 15) → clamped to 10
    await delay();
    expect(getOffsets(lastFrame()).main).toBe(10);
  });

  it('multi-panel: offsets are independent', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('s'); // setMaxScroll(main, 50)
    stdin.write('3'); // setMaxScroll(b, 50)
    await delay();
    stdin.write('d'); // main +3
    stdin.write('2'); // b +5
    await delay();
    const { main, b } = getOffsets(lastFrame());
    expect(main).toBe(3);
    expect(b).toBe(5);
  });

  it('reset clears a specific panel', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('s'); // setMaxScroll(main, 50)
    stdin.write('3'); // setMaxScroll(b, 50)
    await delay();
    stdin.write('d'); // main +3
    stdin.write('2'); // b +5
    await delay();
    stdin.write('r'); // reset(main)
    await delay();
    const { main, b } = getOffsets(lastFrame());
    expect(main).toBe(0);
    expect(b).toBe(5);
  });

  it('reset without panel clears all', async () => {
    const { lastFrame, stdin } = render(h(ScrollHarness));
    await delay();
    stdin.write('s'); // setMaxScroll(main, 50)
    stdin.write('3'); // setMaxScroll(b, 50)
    await delay();
    stdin.write('d'); // main +3
    stdin.write('2'); // b +5
    await delay();
    stdin.write('R'); // reset()
    await delay();
    const { main, b } = getOffsets(lastFrame());
    expect(main).toBe(0);
    expect(b).toBe(0);
  });
});
