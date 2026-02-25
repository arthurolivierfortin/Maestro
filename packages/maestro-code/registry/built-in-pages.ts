// @ts-nocheck
/**
 * Built-in pages — the 5 default pages registered at init.
 *
 * Agent (41-C) and Execution (41-D) have real components.
 * Catalog, Spaces, Models are placeholders until 41-E.
 *
 * NOTE: The `component` field is informational — App.ts renderPage()
 * handles actual rendering via switch/case with proper props.
 */

import { createElement as h } from 'react';
import { Text } from 'ink';
import type { PageDefinition } from './types.ts';
import { AgentPage } from '../pages/AgentPage.ts';
import { ExecutionPage } from '../pages/ExecutionPage.ts';

// Placeholder components — replaced in 41-E
const PlaceholderCatalog = () => h(Text, null, 'Catalog');
const PlaceholderSpaces = () => h(Text, null, 'Spaces');
const PlaceholderModels = () => h(Text, null, 'Models');

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
    component: PlaceholderCatalog,
  },
  {
    id: 'spaces',
    label: 'Spaces',
    shortLabel: 'Spc',
    icon: '→',
    position: { x: 1, y: 0 },
    component: PlaceholderSpaces,
  },
  {
    id: 'models',
    label: 'Models',
    shortLabel: 'Mod',
    icon: '↓',
    position: { x: 0, y: 1 },
    component: PlaceholderModels,
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
