/**
 * Shared TUI Components — Barrel export.
 */

export { Panel } from './Panel.ts';
export { NavBar } from './NavBar.ts';
export { StatusBar } from './StatusBar.ts';
export { Breadcrumb, buildBreadcrumbs } from './Breadcrumb.ts';
export { WidgetRenderer } from './WidgetRenderer.ts';
export { PersistentStatusBar } from './PersistentStatusBar.ts';

// Phase 2-A: Micro-components
export { Shortcut } from './Shortcut.ts';
export type { ShortcutProps } from './Shortcut.ts';
export { KV } from './KV.ts';
export type { KVProps } from './KV.ts';
export { StatusIndicator } from './StatusIndicator.ts';
export type { StatusIndicatorProps } from './StatusIndicator.ts';
export { ProgressBar } from './ProgressBar.ts';
export type { ProgressBarProps } from './ProgressBar.ts';

// Phase 2-B: Composite components
export { TabBar } from './TabBar.ts';
export type { TabDef, TabBarProps } from './TabBar.ts';
export { AppHeader } from './AppHeader.ts';
export type { HeaderItem, AppHeaderProps } from './AppHeader.ts';
export { AppStatusBar } from './AppStatusBar.ts';
export type { AppStatusBarProps } from './AppStatusBar.ts';
export { DataTable } from './DataTable.ts';
export type { Column, DataTableProps } from './DataTable.ts';
