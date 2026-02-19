/**
 * Health transforms — Pure functions for health/LLM response parsing.
 * Zero dependencies. Used by both TUI and Frontend.
 */

export interface HealthResponse {
  status?: string;
  version?: string;
  latencyMs?: number;
  error?: boolean | string;
  [key: string]: unknown;
}

export interface LLMHealthResponse {
  status?: string;
  activeModel?: string;
  model?: string;
  model_id?: string;
  backend?: string;
  framework?: string;
  device?: string;
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
  vramUsed?: number;
  vramTotal?: number;
  error?: boolean | string;
  [key: string]: unknown;
}

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  detail?: string;
  latencyMs?: number;
}

/**
 * Extracts the active model name from an LLM health response.
 * Handles the 3 possible field names: activeModel, model, model_id.
 */
export function extractActiveModel(health: LLMHealthResponse | null | undefined): string | null {
  if (!health) return null;
  return (health.activeModel || health.model || health.model_id || null) as string | null;
}

/**
 * Checks if a health response indicates a healthy service.
 */
export function isServiceHealthy(health: HealthResponse | null | undefined): boolean {
  if (!health) return false;
  if (health.error) return false;
  if (health.status === 'healthy' || health.status === 'ready') return true;
  // If no error field and we got a response, consider it healthy
  return health.error === undefined || health.error === false;
}

/**
 * Converts a health response to a normalized ServiceHealth object.
 */
export function toServiceHealth(
  name: string,
  health: HealthResponse | null | undefined,
  latencyMs?: number
): ServiceHealth {
  const healthy = isServiceHealthy(health);
  return {
    name,
    status: health ? (healthy ? 'healthy' : 'degraded') : 'down',
    detail: health
      ? (healthy ? (health.version as string) || 'Running' : `Error: ${health.error || health.status}`)
      : 'Unreachable',
    latencyMs,
  };
}

/**
 * Converts an LLM health response to a normalized ServiceHealth object.
 */
export function toLLMServiceHealth(
  health: LLMHealthResponse | null | undefined
): ServiceHealth {
  const healthy = isServiceHealthy(health);
  const model = extractActiveModel(health);
  return {
    name: 'LLM Provider',
    status: health ? (healthy ? 'healthy' : 'degraded') : 'down',
    detail: healthy ? (model || 'No model loaded') : 'Unreachable',
  };
}

/**
 * Extracts max tokens from LLM health/status response.
 */
export function extractMaxTokens(health: LLMHealthResponse | null | undefined): number | null {
  if (!health) return null;
  return (health.maxTokens || health.max_tokens || null) as number | null;
}

/**
 * Extracts device info from LLM health response.
 */
export function extractDevice(health: LLMHealthResponse | null | undefined): string {
  if (!health) return '-';
  return (health.device || '-') as string;
}

/**
 * Extracts backend/framework info from LLM health response.
 */
export function extractBackend(health: LLMHealthResponse | null | undefined): string {
  if (!health) return '-';
  return (health.backend || health.framework || '-') as string;
}
