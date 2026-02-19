/**
 * Model transforms — Pure functions for LLM model data processing.
 * Zero dependencies. Used by both TUI and Frontend.
 */

export interface ModelEntry {
  id?: string;
  name?: string;
  model_id?: string;
  [key: string]: unknown;
}

/**
 * Normalizes a model entry (which can be a string or an object) to a consistent shape.
 */
export function normalizeModelEntry(model: string | ModelEntry): { id: string; name: string } {
  if (typeof model === 'string') {
    return { id: model, name: model };
  }
  const id = model.id || model.name || model.model_id || 'unknown';
  const name = model.name || model.id || model.model_id || 'Unknown';
  return { id, name };
}

/**
 * Extracts the model name from a model entry (string or object).
 */
export function getModelName(model: string | ModelEntry): string {
  return normalizeModelEntry(model).name;
}

/**
 * Checks if a model entry matches the active model name.
 */
export function isActiveModel(model: string | ModelEntry, activeModelName: string | null): boolean {
  if (!activeModelName) return false;
  const { id, name } = normalizeModelEntry(model);
  return id === activeModelName || name === activeModelName;
}
