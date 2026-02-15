/**
 * Phase 23: Page Registry — central catalog of navigable pages.
 * Framework-agnostic: stores definitions and component factories.
 * TUI (Ink) and Frontend (React DOM) register their own renderers.
 */

import type { PageDefinition } from '../types/page.js';

export type PageComponentFactory = (props: PageRenderProps) => unknown;

export interface PageRenderProps {
  pageId: string;
  onNavigate?: (pageId: string) => void;
  onDetailView?: (type: string, id: string, name?: string) => void;
  onBack?: () => void;
  onQuit?: () => void;
}

interface PageEntry {
  definition: PageDefinition;
  component?: PageComponentFactory;
}

class PageRegistryImpl {
  private pages = new Map<string, PageEntry>();

  /**
   * Register a page with its definition and optional component factory.
   */
  register(definition: PageDefinition, component?: PageComponentFactory): void {
    this.pages.set(definition.id, { definition, component });
  }

  /**
   * Set the component factory for an already-registered page.
   */
  setComponent(id: string, component: PageComponentFactory): void {
    const entry = this.pages.get(id);
    if (entry) {
      entry.component = component;
    }
  }

  /**
   * Get a page entry by ID.
   */
  get(id: string): PageEntry | undefined {
    return this.pages.get(id);
  }

  /**
   * Get the component factory for a page.
   */
  getComponent(id: string): PageComponentFactory | undefined {
    return this.pages.get(id)?.component;
  }

  /**
   * Get the definition for a page.
   */
  getDefinition(id: string): PageDefinition | undefined {
    return this.pages.get(id)?.definition;
  }

  /**
   * List all registered pages, sorted by order.
   */
  list(): PageDefinition[] {
    return Array.from(this.pages.values())
      .map(e => e.definition)
      .filter(d => d.visible !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  /**
   * List all registered pages including hidden ones.
   */
  listAll(): PageDefinition[] {
    return Array.from(this.pages.values())
      .map(e => e.definition)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  /**
   * Check if a page is registered.
   */
  has(id: string): boolean {
    return this.pages.has(id);
  }

  /**
   * Find a page by keyboard shortcut.
   */
  findByShortcut(key: string): PageDefinition | undefined {
    for (const entry of this.pages.values()) {
      if (entry.definition.shortcut === key) {
        return entry.definition;
      }
    }
    return undefined;
  }

  /**
   * Number of registered pages.
   */
  get size(): number {
    return this.pages.size;
  }
}

/** Global page registry singleton */
export const PageRegistry = new PageRegistryImpl();

/**
 * Register built-in page definitions (framework-agnostic metadata).
 * Component factories are registered separately by each platform.
 */
export function registerBuiltinPages(): void {
  const builtins: PageDefinition[] = [
    {
      id: 'home',
      name: 'Home',
      icon: '🏠',
      shortcut: 'h',
      route: '/',
      order: 0,
    },
    {
      id: 'spaces',
      name: 'Spaces',
      icon: '📦',
      shortcut: 's',
      route: '/spaces',
      order: 1,
    },
    {
      id: 'foundry',
      name: 'Foundry',
      icon: '🔨',
      shortcut: 'f',
      route: '/foundry',
      order: 2,
    },
    {
      id: 'catalog',
      name: 'Catalog',
      icon: '📚',
      shortcut: 'c',
      route: '/catalog',
      order: 3,
    },
    {
      id: 'models',
      name: 'Models',
      icon: '🤖',
      shortcut: 'm',
      route: '/models',
      order: 4,
    },
  ];

  for (const def of builtins) {
    if (!PageRegistry.has(def.id)) {
      PageRegistry.register(def);
    }
  }
}
