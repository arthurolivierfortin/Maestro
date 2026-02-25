/**
 * Maestro Code — Pages barrel export.
 */

export { AgentPage, deriveVisualState } from './AgentPage.ts';
export type { AgentPageProps } from './AgentPage.ts';

export { ExecutionPage } from './ExecutionPage.ts';
export type { ExecutionPageProps } from './ExecutionPage.ts';

export { CatalogPage } from './CatalogPage.ts';
export type { CatalogPageProps } from './CatalogPage.ts';

export { SpacesPage } from './SpacesPage.ts';
export type { SpacesPageProps } from './SpacesPage.ts';

export { ModelsPage } from './ModelsPage.ts';
export type { ModelsPageProps } from './ModelsPage.ts';

// Detail pages
export {
  BlockDetailPage,
  SessionDetailPage,
  WorkspaceDetailPage,
  RepoDetailPage,
  ModelDetailPage,
} from './details/index.ts';
