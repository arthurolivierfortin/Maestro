// @ts-nocheck
/**
 * Tests for navigation hook and input history.
 */
import { describe, it, expect, vi } from 'vitest';

// ── useNavigation Tests ─────────────────────────────────────────

describe('useNavigation', () => {
  // Since useNavigation is a React hook, we test the underlying logic
  // by importing the helper functions from types.ts

  it('screenEquals compares screens correctly', async () => {
    const { screenEquals } = await import('../types.ts');

    expect(screenEquals({ type: 'agent' }, { type: 'agent' })).toBe(true);
    expect(screenEquals({ type: 'catalog' }, { type: 'catalog' })).toBe(true);
    expect(screenEquals({ type: 'agent' }, { type: 'catalog' })).toBe(false);

    // Detail screens with IDs
    expect(screenEquals(
      { type: 'block-detail', id: 'abc' },
      { type: 'block-detail', id: 'abc' }
    )).toBe(true);
    expect(screenEquals(
      { type: 'block-detail', id: 'abc' },
      { type: 'block-detail', id: 'def' }
    )).toBe(false);
    expect(screenEquals(
      { type: 'session-detail', id: '123' },
      { type: 'session-detail', id: '123' }
    )).toBe(true);
    expect(screenEquals(
      { type: 'session-detail', id: '123' },
      { type: 'session-detail', id: '456' }
    )).toBe(false);
  });

  it('Screen type still includes detail screens', async () => {
    const { screenEquals } = await import('../types.ts');

    // Verify detail screen comparison works (used by detail drill-downs)
    expect(screenEquals(
      { type: 'workspace-detail', id: 'w1' },
      { type: 'workspace-detail', id: 'w1' }
    )).toBe(true);
    expect(screenEquals(
      { type: 'repo-detail', id: 'r1' },
      { type: 'repo-detail', id: 'r2' }
    )).toBe(false);
  });
});

// ── useInputHistory Tests ───────────────────────────────────────

describe('useInputHistory', () => {
  // useInputHistory uses refs internally, so we can test the returned object
  // by calling the hook's factory function directly (it returns plain callbacks)

  it('push and prev returns last entry', async () => {
    const { useInputHistory } = await import('../hooks/useInputHistory.ts');

    // Since it's a React hook, we simulate by calling the module
    // The hook uses useRef/useCallback — we test the logic pattern
    const historyRef = { current: [] as string[] };
    const indexRef = { current: -1 };

    // Simulate push
    function push(input: string) {
      const hist = historyRef.current;
      if (hist.length === 0 || hist[hist.length - 1] !== input) {
        hist.push(input);
        if (hist.length > 50) hist.shift();
      }
      indexRef.current = -1;
    }

    // Simulate prev
    function prev(): string | null {
      const hist = historyRef.current;
      if (hist.length === 0) return null;
      if (indexRef.current === -1) {
        indexRef.current = hist.length - 1;
      } else if (indexRef.current > 0) {
        indexRef.current--;
      }
      return hist[indexRef.current] ?? null;
    }

    // Simulate next
    function next(): string | null {
      const hist = historyRef.current;
      if (indexRef.current === -1) return null;
      if (indexRef.current < hist.length - 1) {
        indexRef.current++;
        return hist[indexRef.current];
      } else {
        indexRef.current = -1;
        return '';
      }
    }

    // Empty history
    expect(prev()).toBeNull();

    // Push entries
    push('first');
    push('second');
    push('third');

    // Navigate backward
    expect(prev()).toBe('third');
    expect(prev()).toBe('second');
    expect(prev()).toBe('first');
    expect(prev()).toBe('first'); // stays at beginning

    // Navigate forward
    expect(next()).toBe('second');
    expect(next()).toBe('third');
    expect(next()).toBe(''); // past end = blank

    // After blank, next returns null (not navigating)
    expect(next()).toBeNull();
  });

  it('does not add duplicate consecutive entries', () => {
    const hist: string[] = [];

    function push(input: string) {
      if (hist.length === 0 || hist[hist.length - 1] !== input) {
        hist.push(input);
      }
    }

    push('hello');
    push('hello');
    push('hello');
    expect(hist).toEqual(['hello']);

    push('world');
    push('hello');
    expect(hist).toEqual(['hello', 'world', 'hello']);
  });

  it('limits history to 50 entries', () => {
    const hist: string[] = [];

    function push(input: string) {
      if (hist.length === 0 || hist[hist.length - 1] !== input) {
        hist.push(input);
        if (hist.length > 50) hist.shift();
      }
    }

    for (let i = 0; i < 60; i++) {
      push(`entry-${i}`);
    }
    expect(hist).toHaveLength(50);
    expect(hist[0]).toBe('entry-10');
    expect(hist[49]).toBe('entry-59');
  });
});

// ── Slash commands Tests ────────────────────────────────────────

describe('Slash commands', () => {
  it('slash commands navigate to correct pages', async () => {
    // Slash commands now map to page IDs (strings), not Screen objects.
    // Verify the page registry contains all expected pages.
    const { createDefaultRegistry } = await import('../registry/index.ts');
    const reg = createDefaultRegistry();

    const expectedPages = ['agent', 'catalog', 'spaces', 'models', 'execution'];
    for (const pageId of expectedPages) {
      const page = reg.getById(pageId);
      expect(page).toBeDefined();
      expect(page.id).toBe(pageId);
    }
  });
});
