/**
 * Local Model Service
 *
 * Detects and manages locally available models from:
 * - Ollama
 * - LLM Provider
 * - Other local inference servers
 */

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
const LLM_PROVIDER_URL = import.meta.env.VITE_LLM_PROVIDER_URL || 'http://localhost:8000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface LocalModelInfo {
  id: string;
  name: string;
  provider: 'ollama' | 'llm-provider' | 'local';
  size?: string;
  modifiedAt?: string;
}

export interface LocalProviderStatus {
  provider: string;
  available: boolean;
  models: LocalModelInfo[];
  error?: string;
}

/**
 * Check if Ollama is running and get available models
 */
export async function checkOllama(): Promise<LocalProviderStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { provider: 'ollama', available: false, models: [], error: 'Ollama not responding' };
    }

    const data = await response.json();
    const models: LocalModelInfo[] = (data.models || []).map((m: any) => ({
      id: m.name,
      name: m.name,
      provider: 'ollama' as const,
      size: formatSize(m.size),
      modifiedAt: m.modified_at,
    }));

    return { provider: 'ollama', available: true, models };
  } catch (error) {
    return {
      provider: 'ollama',
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Failed to connect to Ollama',
    };
  }
}

/**
 * Check if LLM Provider is running and get available models
 *
 * LLM Provider can return two formats:
 * 1. OpenAI-style: { data: [{ id: "model-id" }] }
 * 2. Custom format: { models: { "model-name": {...} }, active_model: "..." }
 */
export async function checkLLMProvider(): Promise<LocalProviderStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Route through backend proxy (/api/provider/health) first, fall back to direct
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/provider/health`, { signal: controller.signal });
    } catch {
      response = await fetch(`${LLM_PROVIDER_URL}/v1/models`, { signal: controller.signal });
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { provider: 'llm-provider', available: false, models: [], error: 'LLM Provider not responding' };
    }

    const data = await response.json();
    const models: LocalModelInfo[] = [];

    // Handle OpenAI-style format: { data: [{ id: "..." }] }
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((m: any) => {
        models.push({
          id: m.id,
          name: m.id,
          provider: 'llm-provider' as const,
        });
      });
    }
    // Handle LLM Provider custom format: { models: { "model-name": {...} } }
    else if (data.models && typeof data.models === 'object') {
      Object.keys(data.models).forEach((modelName) => {
        const modelInfo = data.models[modelName];
        models.push({
          id: modelInfo.model_id || modelName,
          name: modelName,
          provider: 'llm-provider' as const,
        });
      });
    }

    return { provider: 'llm-provider', available: true, models };
  } catch (error) {
    return {
      provider: 'llm-provider',
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Failed to connect to LLM Provider',
    };
  }
}

/**
 * Check all local providers and return available models
 */
export async function detectLocalModels(): Promise<{
  providers: LocalProviderStatus[];
  availableModels: Set<string>;
}> {
  const [ollamaStatus, llmProviderStatus] = await Promise.all([
    checkOllama(),
    checkLLMProvider(),
  ]);

  const providers = [ollamaStatus, llmProviderStatus];
  const availableModels = new Set<string>();

  providers.forEach(p => {
    if (p.available) {
      p.models.forEach(m => {
        availableModels.add(m.id);
        availableModels.add(m.name);
      });
    }
  });

  return { providers, availableModels };
}

/**
 * Pull/download a model from Ollama
 */
export async function pullOllamaModel(modelName: string, onProgress?: (progress: number) => void): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let lastProgress = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const progress = Math.round((data.completed / data.total) * 100);
            if (progress !== lastProgress) {
              lastProgress = progress;
              onProgress?.(progress);
            }
          }
          if (data.status === 'success') {
            onProgress?.(100);
            return true;
          }
        } catch {
          // Ignore parse errors for progress lines
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to pull Ollama model:', error);
    return false;
  }
}

/**
 * Delete a model from Ollama
 */
export async function deleteOllamaModel(modelName: string): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Format byte size to human readable
 */
function formatSize(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Map model catalog IDs to Ollama model names
 */
export const CATALOG_TO_OLLAMA_MAP: Record<string, string> = {
  'llama-3.1-8b': 'llama3.1:8b',
  'llama-3.2-3b': 'llama3.2:3b',
  'llama-3.1-70b': 'llama3.1:70b',
  'codellama-7b': 'codellama:7b',
  'codellama-13b': 'codellama:13b',
  'mixtral-8x7b': 'mixtral:8x7b',
  'mistral-7b': 'mistral:7b',
  'deepseek-coder': 'deepseek-coder:6.7b',
  'phi-3': 'phi3:latest',
  'qwen-2': 'qwen2:7b',
};

/**
 * Get the Ollama model name for a catalog entry
 */
export function getOllamaModelName(catalogId: string): string | undefined {
  return CATALOG_TO_OLLAMA_MAP[catalogId];
}
