// @ts-nocheck
/**
 * Built-in pages — the 5 default pages registered at init.
 *
 * Components are placeholders for now — real components will be
 * created in sub-phases 41-C (Agent), 41-D (Execution), 41-E (list pages).
 */

import { createElement as h } from 'react';
import { Text } from 'ink';
import type { PageDefinition } from './types.ts';

// Placeholder components — replaced in later sub-phases
const PlaceholderAgent = () => h(Text, null, 'Agent');
const PlaceholderExecution = () => h(Text, null, 'Execution');
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
    component: PlaceholderAgent,
  },
  {
    id: 'execution',
    label: 'Execution',
    shortLabel: 'Exec',
    icon: '↑',
    position: { x: 0, y: -1 },
    component: PlaceholderExecution,
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
