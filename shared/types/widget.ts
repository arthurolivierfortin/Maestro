/**
 * Phase 23: Widget type system for configurable UI components.
 * Used by both TUI (Ink) and Frontend (React DOM).
 */

export interface WidgetDefinition {
  /** Unique widget type identifier (e.g., 'phase-list', 'execution-log') */
  type: string;
  /** Human-readable display name */
  name: string;
  /** Short description */
  description?: string;
  /** Default configuration for this widget type */
  defaultConfig?: Record<string, unknown>;
  /** Data source bindings this widget requires */
  requiredBindings?: string[];
}

export interface WidgetInstance {
  /** Instance ID (unique within a page/layout) */
  id: string;
  /** Widget type — resolves to a WidgetDefinition */
  type: string;
  /** Display title (overrides definition name) */
  title?: string;
  /** Data binding path (e.g., '$.variables._phases', '/api/sessions') */
  dataPath?: string;
  /** Data source configuration */
  dataSource?: DataSourceConfig;
  /** Widget-specific configuration */
  config?: Record<string, unknown>;
}

export interface DataSourceConfig {
  /** Source type */
  type: 'api' | 'signalr' | 'variable' | 'static';
  /** API path or variable path */
  path: string;
  /** Polling interval in ms (for 'api' type) */
  interval?: number;
  /** Transform function name to apply to data */
  transform?: string;
}

export interface LayoutZone {
  /** Zone identifier */
  id: string;
  /** Widget instances placed in this zone */
  widgets: WidgetInstance[];
  /** Zone size hints */
  flex?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface PageLayout {
  /** Layout type: 'single', 'split-h', 'split-v', 'grid' */
  type: 'single' | 'split-h' | 'split-v' | 'grid';
  /** Layout zones */
  zones: LayoutZone[];
}
