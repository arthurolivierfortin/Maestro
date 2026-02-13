/**
 * Shared UI Types — Widget, Page, and DataSource definitions.
 * Used by both frontend web and TUI monitors.
 */

// ── Widget System ──

export type WidgetType =
  | 'health'
  | 'stat'
  | 'metric-card'
  | 'chart'
  | 'list'
  | 'table'
  | 'log'
  | 'progress'
  | 'status'
  | 'timeline'
  | 'custom';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  dataSource?: DataSourceConfig;
  config?: Record<string, unknown>;
  span?: number; // grid column span (1-4, default 1)
  refreshMs?: number; // auto-refresh interval
}

// ── Data Source System ──

export type DataSourceType = 'api' | 'signalr' | 'session-var' | 'static';

export interface DataSourceConfig {
  type: DataSourceType;
  /** API path (for 'api' type) */
  path?: string;
  /** SignalR hub and event (for 'signalr' type) */
  hub?: string;
  event?: string;
  /** Session variable key (for 'session-var' type) */
  variableKey?: string;
  sessionId?: string;
  /** Static data (for 'static' type) */
  data?: unknown;
  /** Transform function name to apply to raw data */
  transform?: string;
}

// ── Page System ──

export type PageLayout = 'dashboard' | 'detail' | 'list' | 'split' | 'full';

export interface PageConfig {
  id: string;
  title: string;
  icon?: string;
  layout: PageLayout;
  route?: string;
  widgets: WidgetConfig[];
  /** Page-level data sources available to all widgets */
  dataSources?: Record<string, DataSourceConfig>;
  /** Navigation group */
  navGroup?: string;
  /** Sort order within nav group */
  navOrder?: number;
}

// ── Navigation ──

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  route: string;
  group?: string;
  order?: number;
  badge?: string | number;
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  order?: number;
}

// ── Status ──

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface StatusInfo {
  service: string;
  status: ServiceStatus;
  detail?: string;
  latencyMs?: number;
}
