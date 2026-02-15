/**
 * Phase 23: Page type system for configurable multi-page navigation.
 * Used by both TUI (Ink) and Frontend (React DOM).
 */

import type { PageLayout } from './widget.js';

export interface PageDefinition {
  /** Unique page identifier (e.g., 'home', 'spaces', 'catalog') */
  id: string;
  /** Display name */
  name: string;
  /** Navigation icon (emoji or icon name) */
  icon?: string;
  /** Keyboard shortcut (single char) */
  shortcut?: string;
  /** Route path (for frontend router) */
  route?: string;
  /** Layout configuration */
  layout?: PageLayout;
  /** Data sources this page requires at load time */
  dataSources?: Record<string, import('./widget.js').DataSourceConfig>;
  /** Whether this page is visible in navigation */
  visible?: boolean;
  /** Sort order in navigation */
  order?: number;
}

export interface NavigationState {
  /** Current active page ID */
  currentPage: string;
  /** Navigation history stack (for back navigation) */
  stack: NavigationEntry[];
  /** Detail view (overrides page when set) */
  detailView?: DetailView;
}

export interface NavigationEntry {
  page: string;
  detailView?: DetailView;
}

export interface DetailView {
  /** Detail type (e.g., 'session', 'workspace', 'model', 'block') */
  type: string;
  /** Resource ID being viewed */
  id: string;
  /** Optional display name */
  name?: string;
}

export interface BreadcrumbItem {
  label: string;
  page?: string;
  detailType?: string;
  detailId?: string;
}
