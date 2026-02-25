/**
 * Page Registry — barrel export.
 */

export { PageRegistry, createDefaultRegistry } from './PageRegistry.ts';
export type {
  PageDefinition,
  PageProps,
  Direction,
  Position,
  DirectionHint,
  DetailScreenDef,
} from './types.ts';
export { BUILT_IN_PAGES, registerBuiltInPages } from './built-in-pages.ts';
