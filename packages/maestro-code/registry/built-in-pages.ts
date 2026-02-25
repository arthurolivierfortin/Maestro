// @ts-nocheck
/**
 * Built-in pages — the 5 default pages registered at init.
 *
 * All pages have real components (41-C through 41-E).
 *
 * NOTE: The `component` field is informational — App.ts renderPage()
 * handles actual rendering via switch/case with proper props.
 */

import type { PageDefinition } from './types.ts';
import { AgentPage } from '../pages/AgentPage.ts';
import { ExecutionPage } from '../pages/ExecutionPage.ts';
import { CatalogPage } from '../pages/CatalogPage.ts';
import { SpacesPage } from '../pages/SpacesPage.ts';
import { ModelsPage } from '../pages/ModelsPage.ts';

export const BUILT_IN_PAGES: PageDefinition[] = [
  {
    id: 'agent',
    label: 'Agent',
    shortLabel: 'Agent',
    icon: '●',
    position: { x: 0, y: 0 },
    component: AgentPage,
  },
  {
    id: 'execution',
    label: 'Execution',
    shortLabel: 'Exec',
    icon: '↑',
    position: { x: 0, y: -1 },
    component: ExecutionPage,
  },
  {
    id: 'catalog',
    label: 'Catalog',
    shortLabel: 'Cat',
    icon: '←',
    position: { x: -1, y: 0 },
    component: CatalogPage,
  },
  {
    id: 'spaces',
    label: 'Spaces',
    shortLabel: 'Spc',
    icon: '→',
    position: { x: 1, y: 0 },
    component: SpacesPage,
  },
  {
    id: 'models',
    label: 'Models',
    shortLabel: 'Mod',
    icon: '↓',
    position: { x: 0, y: 1 },
    component: ModelsPage,
  },
];

/**
 * Register all built-in pages into a registry.
 */
export function registerBuiltInPages(registry: { register: (def: PageDefinition) => void }): void {
  for (const def of BUILT_IN_PAGES) {
    registry.register(def);
  }
}
