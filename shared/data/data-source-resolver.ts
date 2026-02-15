/**
 * Phase 23: DataSourceResolver — resolves data bindings to concrete data.
 * Used by WidgetRenderer to feed data to widgets.
 *
 * Supports:
 * - 'variable': resolve from session variables ($.variables._phases)
 * - 'api': resolve from API endpoint (/api/sessions, /api/health)
 * - 'static': return config data directly
 * - 'signalr': placeholder for Phase 24 real-time data
 */

import type { DataSourceConfig } from '../types/widget.js';
import type { IApiClient } from '../types/api-client.js';
import type { SessionVariables } from '../types/session.js';

export interface ResolverContext {
  /** API client for fetching data */
  apiClient?: IApiClient;
  /** Current session variables (for variable bindings) */
  sessionVariables?: SessionVariables;
  /** Current session ID */
  sessionId?: string;
  /** Monitor widgets config */
  monitorWidgets?: unknown[];
}

/**
 * Resolve a data source config to its actual data value.
 */
export async function resolveDataSource(
  config: DataSourceConfig,
  context: ResolverContext
): Promise<unknown> {
  switch (config.type) {
    case 'variable':
      return resolveVariable(config.path, context);

    case 'api':
      return resolveApi(config.path, context);

    case 'static':
      return config.path;

    case 'signalr':
      // Phase 24: Will be resolved by SignalR subscription
      return null;

    default:
      return null;
  }
}

/**
 * Resolve a $.variables.xxx path from session data.
 */
function resolveVariable(path: string, context: ResolverContext): unknown {
  if (!context.sessionVariables) return null;

  // Parse path: $.variables._phases → sessionVariables._phases
  // Also supports: $.monitorWidgets → monitorWidgets
  const parts = path.replace(/^\$\./, '').split('.');

  let current: unknown = null;

  if (parts[0] === 'variables') {
    current = context.sessionVariables;
    parts.shift(); // Remove 'variables'
  } else if (parts[0] === 'monitorWidgets') {
    return context.monitorWidgets;
  } else {
    // Direct variable name
    current = context.sessionVariables;
  }

  // Walk the path
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Resolve data from an API endpoint.
 */
async function resolveApi(path: string, context: ResolverContext): Promise<unknown> {
  if (!context.apiClient) return null;

  try {
    // Use the _fetch method from the API client
    const client = context.apiClient as unknown as { _fetch: (method: string, path: string) => Promise<unknown> };
    if (typeof client._fetch === 'function') {
      return await client._fetch('GET', path);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a simple data binding path (e.g., '$.variables._phases')
 * from session data. Synchronous variant for immediate use.
 */
export function resolveBindingSync(
  path: string,
  variables?: SessionVariables,
  monitorWidgets?: unknown[]
): unknown {
  return resolveVariable(path, {
    sessionVariables: variables,
    monitorWidgets,
  });
}
