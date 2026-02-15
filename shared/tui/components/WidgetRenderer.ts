// @ts-nocheck
/**
 * Phase 23: WidgetRenderer — dynamically renders a widget from the registry.
 * Reads the widget type, resolves its component via WidgetRegistry, feeds data.
 */

import { createElement as h } from 'react';
import { WidgetRegistry } from '../../registry/widget-registry.js';
import { resolveBindingSync } from '../../data/data-source-resolver.js';
import type { WidgetInstance } from '../../types/widget.js';
import type { SessionVariables } from '../../types/session.js';

interface WidgetRendererProps {
  /** Widget instance to render */
  widget: WidgetInstance;
  /** Session variables for data binding */
  variables?: SessionVariables;
  /** Monitor widgets for $.monitorWidgets binding */
  monitorWidgets?: unknown[];
  /** Available width */
  width?: number;
  /** Available height */
  height?: number;
}

/**
 * Renders a single widget by looking up its component in the WidgetRegistry.
 * If the widget type is not registered, shows a placeholder.
 */
export function WidgetRenderer({
  widget,
  variables,
  monitorWidgets,
  width,
  height,
}: WidgetRendererProps) {
  const Text = require('ink').Text;
  const Box = require('ink').Box;

  const component = WidgetRegistry.getComponent(widget.type);

  if (!component) {
    // Unknown widget type — show placeholder
    return h(Box, { borderStyle: 'single', borderColor: 'gray', padding: 1 },
      h(Text, { color: 'yellow' }, `Unknown widget: ${widget.type}`)
    );
  }

  // Resolve data from binding path
  let data: unknown = null;
  if (widget.dataPath) {
    data = resolveBindingSync(widget.dataPath, variables, monitorWidgets);
  } else if (widget.dataSource) {
    data = resolveBindingSync(widget.dataSource.path, variables, monitorWidgets);
  }

  // Render the component
  return component({
    id: widget.id,
    title: widget.title,
    data,
    config: widget.config,
    width,
    height,
  });
}
