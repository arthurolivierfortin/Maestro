/**
 * Mock Model Data
 *
 * Re-exports model presets as mock data source.
 * This centralizes mock data and allows for easy customization.
 */

// Re-export from existing presets
export {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GOOGLE_MODELS,
  OLLAMA_MODELS,
  GROQ_MODELS,
  ALL_PRESET_MODELS,
} from '../../../data/modelPresets';

import { ALL_PRESET_MODELS } from '../../../data/modelPresets';
import type { Model } from '../../../types/model.types';

/**
 * Get a copy of all mock models
 * Returns a fresh array to prevent mutation of source data
 */
export function getMockModels(): Model[] {
  return ALL_PRESET_MODELS.map((model) => ({ ...model }));
}
