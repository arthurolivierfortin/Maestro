/**
 * Widget Registry — Registers widget types and their metadata.
 * Platform-agnostic: actual rendering is done by platform-specific adapters.
 */

import type { WidgetType, WidgetConfig } from './types';

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  defaultSpan: number;
  defaultRefreshMs?: number;
  configSchema?: Record<string, string>; // key -> type hint
}

const registry = new Map<WidgetType, WidgetDefinition>();

export function registerWidget(definition: WidgetDefinition): void {
  registry.set(definition.type, definition);
}

export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return registry.get(type);
}

export function getAllWidgetTypes(): WidgetDefinition[] {
  return Array.from(registry.values());
}

export function validateWidgetConfig(config: WidgetConfig): string[] {
  const errors: string[] = [];
  if (!config.id) errors.push('Widget must have an id');
  if (!config.type) errors.push('Widget must have a type');
  if (!registry.has(config.type)) errors.push(`Unknown widget type: ${config.type}`);
  return errors;
}

// ── Built-in widget registrations ──

registerWidget({
  type: 'health',
  name: 'Health Status',
  description: 'Shows service health with status indicator',
  defaultSpan: 1,
  defaultRefreshMs: 5000,
});

registerWidget({
  type: 'stat',
  name: 'Statistic',
  description: 'Single value with label and optional trend',
  defaultSpan: 1,
});

registerWidget({
  type: 'metric-card',
  name: 'Metric Card',
  description: 'Metric value with sparkline or bar',
  defaultSpan: 1,
  defaultRefreshMs: 10000,
});

registerWidget({
  type: 'chart',
  name: 'Chart',
  description: 'Line, bar, or area chart',
  defaultSpan: 2,
  defaultRefreshMs: 15000,
});

registerWidget({
  type: 'list',
  name: 'List',
  description: 'Scrollable list with items',
  defaultSpan: 1,
});

registerWidget({
  type: 'table',
  name: 'Data Table',
  description: 'Tabular data with sorting',
  defaultSpan: 2,
});

registerWidget({
  type: 'log',
  name: 'Log Viewer',
  description: 'Scrolling log output',
  defaultSpan: 2,
  defaultRefreshMs: 2000,
});

registerWidget({
  type: 'progress',
  name: 'Progress',
  description: 'Progress bar with percentage',
  defaultSpan: 1,
});

registerWidget({
  type: 'status',
  name: 'Status Indicator',
  description: 'Multi-service status grid',
  defaultSpan: 1,
  defaultRefreshMs: 5000,
});

registerWidget({
  type: 'timeline',
  name: 'Timeline',
  description: 'Chronological event timeline',
  defaultSpan: 2,
});

registerWidget({
  type: 'custom',
  name: 'Custom',
  description: 'Custom widget with arbitrary content',
  defaultSpan: 1,
});
