// @ts-nocheck
/**
 * Tests for PageRegistry — spatial grid navigation registry.
 * Phase 41-A foundation tests.
 */
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { Text } from 'ink';
import { PageRegistry, createDefaultRegistry } from '../registry/PageRegistry.ts';
import { BUILT_IN_PAGES } from '../registry/built-in-pages.ts';
import type { PageDefinition } from '../registry/types.ts';

// ── Helper ────────────────────────────────────────────────────────

function makePage(id: string, x: number, y: number): PageDefinition {
  return {
    id,
    label: id,
    shortLabel: id.slice(0, 3),
    icon: '*',
    position: { x, y },
    component: () => h(Text, null, id),
  };
}

// ── register + getById ────────────────────────────────────────────

describe('PageRegistry', () => {
  it('register + getById retrieves the page', () => {
    const reg = new PageRegistry();
    const page = makePage('test', 0, 0);
    reg.register(page);

    expect(reg.getById('test')).toBe(page);
  });

  it('getById returns undefined for unknown id', () => {
    const reg = new PageRegistry();
    expect(reg.getById('nonexistent')).toBeUndefined();
  });

  // ── getAt ─────────────────────────────────────────────────────

  it('getAt returns page at coordinates', () => {
    const reg = new PageRegistry();
    const page = makePage('center', 0, 0);
    reg.register(page);

    expect(reg.getAt({ x: 0, y: 0 })).toBe(page);
  });

  it('getAt returns undefined for empty cell', () => {
    const reg = new PageRegistry();
    reg.register(makePage('a', 0, 0));

    expect(reg.getAt({ x: 1, y: 1 })).toBeUndefined();
  });

  // ── getAll ────────────────────────────────────────────────────

  it('getAll returns all registered pages', () => {
    const reg = createDefaultRegistry();
    const all = reg.getAll();

    expect(all).toHaveLength(5);
    const ids = all.map(p => p.id).sort();
    expect(ids).toEqual(['agent', 'catalog', 'execution', 'models', 'spaces']);
  });

  // ── getRing ───────────────────────────────────────────────────

  it('getRing returns 4 non-center pages sorted by angle', () => {
    const reg = createDefaultRegistry();
    const ring = reg.getRing();

    expect(ring).toHaveLength(4);
    // atan2 order: (-1,0)=pi, (0,-1)=-pi/2, (1,0)=0, (0,1)=pi/2
    // sorted ascending: -pi/2, 0, pi/2, pi
    // That's: execution(0,-1), spaces(1,0), models(0,1), catalog(-1,0)
    expect(ring.map(p => p.id)).toEqual([
      'execution',  // atan2(-1, 0) = -pi/2
      'spaces',     // atan2(0, 1)  = 0
      'models',     // atan2(1, 0)  = pi/2
      'catalog',    // atan2(0, -1) = pi
    ]);
  });

  // ── getDirectionHints ─────────────────────────────────────────

  it('getDirectionHints from (0,0) returns 4 hints', () => {
    const reg = createDefaultRegistry();
    const hints = reg.getDirectionHints({ x: 0, y: 0 });

    expect(hints).toHaveLength(4);
    const dirs = hints.map(h => h.direction).sort();
    expect(dirs).toEqual(['down', 'left', 'right', 'up']);
  });

  it('getDirectionHints from (-1,0) returns only right → agent', () => {
    const reg = createDefaultRegistry();
    const hints = reg.getDirectionHints({ x: -1, y: 0 });

    expect(hints).toHaveLength(1);
    expect(hints[0].direction).toBe('right');
    expect(hints[0].page.id).toBe('agent');
  });

  it('getDirectionHints from empty area returns no hints', () => {
    const reg = createDefaultRegistry();
    const hints = reg.getDirectionHints({ x: 5, y: 5 });

    expect(hints).toHaveLength(0);
  });

  // ── Error cases ───────────────────────────────────────────────

  it('register duplicate id throws', () => {
    const reg = new PageRegistry();
    reg.register(makePage('dup', 0, 0));

    expect(() => reg.register(makePage('dup', 1, 1))).toThrow(
      'duplicate page id "dup"'
    );
  });

  it('register duplicate position throws', () => {
    const reg = new PageRegistry();
    reg.register(makePage('first', 0, 0));

    expect(() => reg.register(makePage('second', 0, 0))).toThrow(
      'position (0,0) already occupied by "first"'
    );
  });

  // ── BUILT_IN_PAGES ────────────────────────────────────────────

  it('BUILT_IN_PAGES has 5 entries with correct structure', () => {
    expect(BUILT_IN_PAGES).toHaveLength(5);
    for (const page of BUILT_IN_PAGES) {
      expect(page.id).toBeTruthy();
      expect(page.label).toBeTruthy();
      expect(page.shortLabel).toBeTruthy();
      expect(page.icon).toBeTruthy();
      expect(page.position).toBeDefined();
      expect(typeof page.position.x).toBe('number');
      expect(typeof page.position.y).toBe('number');
      expect(typeof page.component).toBe('function');
    }
  });

  it('agent page is at center (0,0)', () => {
    const agent = BUILT_IN_PAGES.find(p => p.id === 'agent');
    expect(agent).toBeDefined();
    expect(agent!.position).toEqual({ x: 0, y: 0 });
  });
});
