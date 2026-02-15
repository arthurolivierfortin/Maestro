/**
 * Phase 23: Widget Registry — central catalog of widget types.
 * Framework-agnostic: stores definitions and component factories.
 * TUI (Ink) and Frontend (React DOM) register their own renderers.
 */

import type { WidgetDefinition } from '../types/widget.js';

export type WidgetComponentFactory = (props: WidgetRenderProps) => unknown;

export interface WidgetRenderProps {
  id: string;
  title?: string;
  data: unknown;
  config?: Record<string, unknown>;
  width?: number;
  height?: number;
}

interface WidgetEntry {
  definition: WidgetDefinition;
  component?: WidgetComponentFactory;
}

class WidgetRegistryImpl {
  private widgets = new Map<string, WidgetEntry>();

  /**
   * Register a widget type with its definition and optional component factory.
   */
  register(definition: WidgetDefinition, component?: WidgetComponentFactory): void {
    this.widgets.set(definition.type, { definition, component });
  }

  /**
   * Set the component factory for an already-registered widget type.
   * Used when TUI/Frontend registers renderers after definitions.
   */
  setComponent(type: string, component: WidgetComponentFactory): void {
    const entry = this.widgets.get(type);
    if (entry) {
      entry.component = component;
    }
  }

  /**
   * Get a widget entry by type.
   */
  get(type: string): WidgetEntry | undefined {
    return this.widgets.get(type);
  }

  /**
   * Get the component factory for a widget type.
   */
  getComponent(type: string): WidgetComponentFactory | undefined {
    return this.widgets.get(type)?.component;
  }

  /**
   * Get the definition for a widget type.
   */
  getDefinition(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type)?.definition;
  }

  /**
   * List all registered widget types.
   */
  list(): WidgetDefinition[] {
    return Array.from(this.widgets.values()).map(e => e.definition);
  }

  /**
   * Check if a widget type is registered.
   */
  has(type: string): boolean {
    return this.widgets.has(type);
  }

  /**
   * Number of registered widget types.
   */
  get size(): number {
    return this.widgets.size;
  }
}

/** Global widget registry singleton */
export const WidgetRegistry = new WidgetRegistryImpl();

/**
 * Register built-in widget definitions (framework-agnostic metadata).
 * Component factories are registered separately by each platform.
 */
export function registerBuiltinWidgets(): void {
  const builtins: WidgetDefinition[] = [
    {
      type: 'phase-list',
      name: 'Phase List',
      description: 'Displays session phases with status indicators',
      requiredBindings: ['$.variables._phases'],
    },
    {
      type: 'execution-tree',
      name: 'Execution Tree',
      description: 'Interactive tree view of the execution graph',
      requiredBindings: ['$.variables._executionTree'],
    },
    {
      type: 'execution-log',
      name: 'Execution Log',
      description: 'Real-time execution log entries',
      requiredBindings: ['$.variables._executionLog'],
    },
    {
      type: 'llm-activity',
      name: 'LLM Activity',
      description: 'LLM inference activity feed',
      requiredBindings: ['$.variables._llmActivity'],
    },
    {
      type: 'metrics',
      name: 'Metrics Panel',
      description: 'Session metrics (fitness, iterations, tokens)',
      requiredBindings: ['$.variables'],
    },
    {
      type: 'artifacts',
      name: 'Artifacts',
      description: 'Files produced by the session',
      requiredBindings: ['$.variables._artifacts'],
    },
    {
      type: 'variables',
      name: 'Variables',
      description: 'Session variables explorer',
      requiredBindings: ['$.variables'],
    },
    {
      type: 'command-log',
      name: 'Command Log',
      description: 'Shell command history',
      requiredBindings: ['$.variables._commandLog'],
    },
    {
      type: 'filesystem',
      name: 'Filesystem',
      description: 'Repository file tree',
    },
    {
      type: 'phase-workflow',
      name: 'Phase Workflow',
      description: 'Visual workflow for active phase',
      requiredBindings: ['$.variables._executionTree', '$.variables._activeWorkflow'],
    },
    {
      type: 'health',
      name: 'Health Status',
      description: 'Service health indicators',
    },
    {
      type: 'session-list',
      name: 'Session List',
      description: 'List of sessions with status',
    },
    {
      type: 'widgets',
      name: 'Custom Widgets',
      description: 'User-defined widgets from monitor config',
      requiredBindings: ['$.monitorWidgets'],
    },
  ];

  for (const def of builtins) {
    if (!WidgetRegistry.has(def.type)) {
      WidgetRegistry.register(def);
    }
  }
}
