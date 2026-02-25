/**
 * PageRegistry — Central registry of all pages in the spatial grid.
 *
 * Navigation, StatusBar, CommandPalette, HelpOverlay all read from this.
 * Adding a page = one register() call + one component. Everything else
 * is computed automatically.
 *
 * See: docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md section 1b + 20b
 */

import type { PageDefinition, Position, Direction, DirectionHint } from './types.ts';
import { BUILT_IN_PAGES } from './built-in-pages.ts';

const DELTAS: Record<Direction, Position> = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

export class PageRegistry {
  private pages: Map<string, PageDefinition> = new Map();
  private grid: Map<string, PageDefinition> = new Map();

  register(def: PageDefinition): void {
    if (this.pages.has(def.id)) {
      throw new Error(`PageRegistry: duplicate page id "${def.id}"`);
    }
    const key = posKey(def.position);
    if (this.grid.has(key)) {
      const existing = this.grid.get(key)!;
      throw new Error(
        `PageRegistry: position (${def.position.x},${def.position.y}) already occupied by "${existing.id}"`
      );
    }
    this.pages.set(def.id, def);
    this.grid.set(key, def);
  }

  getById(id: string): PageDefinition | undefined {
    return this.pages.get(id);
  }

  getAt(pos: Position): PageDefinition | undefined {
    return this.grid.get(posKey(pos));
  }

  getAll(): PageDefinition[] {
    return Array.from(this.pages.values());
  }

  /**
   * Ring = non-center pages sorted by angle around (0,0).
   * Used for Ctrl+Left/Right rotation from edge pages.
   */
  getRing(): PageDefinition[] {
    return this.getAll()
      .filter(p => !(p.position.x === 0 && p.position.y === 0))
      .sort((a, b) =>
        Math.atan2(a.position.y, a.position.x) -
        Math.atan2(b.position.y, b.position.x)
      );
  }

  /**
   * Direction hints from a given position — only shows occupied directions.
   * StatusBar uses this to auto-generate navigation indicators.
   */
  getDirectionHints(pos: Position): DirectionHint[] {
    const hints: DirectionHint[] = [];
    for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
      const target: Position = {
        x: pos.x + DELTAS[dir].x,
        y: pos.y + DELTAS[dir].y,
      };
      const page = this.getAt(target);
      if (page) {
        hints.push({ direction: dir, page });
      }
    }
    return hints;
  }
}

/**
 * Create a registry pre-populated with the 5 built-in pages.
 */
export function createDefaultRegistry(): PageRegistry {
  const registry = new PageRegistry();
  for (const def of BUILT_IN_PAGES) {
    registry.register(def);
  }
  return registry;
}
