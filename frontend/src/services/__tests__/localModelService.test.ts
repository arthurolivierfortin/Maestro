/**
 * Local Model Service Tests
 *
 * Tests the detection and management of local models (Ollama, LLM Provider).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkOllama,
  checkLLMProvider,
  detectLocalModels,
  getOllamaModelName,
  CATALOG_TO_OLLAMA_MAP,
} from '../localModelService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('localModelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkOllama', () => {
    it('should return available=true with models when Ollama is running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3.1:8b', size: 4700000000, modified_at: '2024-01-15T10:00:00Z' },
            { name: 'mistral:7b', size: 3800000000, modified_at: '2024-01-14T10:00:00Z' },
          ],
        }),
      });

      const result = await checkOllama();

      expect(result.provider).toBe('ollama');
      expect(result.available).toBe(true);
      expect(result.models).toHaveLength(2);
      expect(result.models[0].name).toBe('llama3.1:8b');
      expect(result.models[0].provider).toBe('ollama');
      expect(result.error).toBeUndefined();
    });

    it('should return available=false when Ollama is not running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await checkOllama();

      expect(result.provider).toBe('ollama');
      expect(result.available).toBe(false);
      expect(result.models).toHaveLength(0);
      expect(result.error).toBeDefined();
    });

    it('should return available=false when Ollama returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await checkOllama();

      expect(result.available).toBe(false);
      expect(result.error).toBe('Ollama not responding');
    });

    it('should handle empty model list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const result = await checkOllama();

      expect(result.available).toBe(true);
      expect(result.models).toHaveLength(0);
    });
  });

  describe('checkLLMProvider', () => {
    it('should return available=true with models when LLM Provider is running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o' },
            { id: 'claude-3-5-sonnet' },
          ],
        }),
      });

      const result = await checkLLMProvider();

      expect(result.provider).toBe('llm-provider');
      expect(result.available).toBe(true);
      expect(result.models).toHaveLength(2);
      expect(result.models[0].name).toBe('gpt-4o');
      expect(result.models[0].provider).toBe('llm-provider');
    });

    it('should return available=false when LLM Provider is not running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await checkLLMProvider();

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('detectLocalModels', () => {
    it('should check both Ollama and LLM Provider', async () => {
      // First call for Ollama
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.1:8b', size: 4700000000 }],
        }),
      });

      // Second call for LLM Provider
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4o' }],
        }),
      });

      const result = await detectLocalModels();

      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].provider).toBe('ollama');
      expect(result.providers[1].provider).toBe('llm-provider');
      expect(result.availableModels.has('llama3.1:8b')).toBe(true);
      expect(result.availableModels.has('gpt-4o')).toBe(true);
    });

    it('should return empty availableModels when both providers are down', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await detectLocalModels();

      expect(result.availableModels.size).toBe(0);
      expect(result.providers[0].available).toBe(false);
      expect(result.providers[1].available).toBe(false);
    });
  });

  describe('getOllamaModelName', () => {
    it('should return correct Ollama name for catalog IDs', () => {
      expect(getOllamaModelName('llama-3.1-8b')).toBe('llama3.1:8b');
      expect(getOllamaModelName('llama-3.2-3b')).toBe('llama3.2:3b');
      expect(getOllamaModelName('codellama-7b')).toBe('codellama:7b');
      expect(getOllamaModelName('mixtral-8x7b')).toBe('mixtral:8x7b');
    });

    it('should return undefined for unknown catalog IDs', () => {
      expect(getOllamaModelName('unknown-model')).toBeUndefined();
      expect(getOllamaModelName('gpt-4o')).toBeUndefined();
    });
  });

  describe('CATALOG_TO_OLLAMA_MAP', () => {
    it('should contain mappings for common local models', () => {
      expect(CATALOG_TO_OLLAMA_MAP).toHaveProperty('llama-3.1-8b');
      expect(CATALOG_TO_OLLAMA_MAP).toHaveProperty('llama-3.2-3b');
      expect(CATALOG_TO_OLLAMA_MAP).toHaveProperty('codellama-7b');
      expect(CATALOG_TO_OLLAMA_MAP).toHaveProperty('mixtral-8x7b');
      expect(CATALOG_TO_OLLAMA_MAP).toHaveProperty('mistral-7b');
    });

    it('should not contain cloud model IDs', () => {
      expect(CATALOG_TO_OLLAMA_MAP).not.toHaveProperty('gpt-4o');
      expect(CATALOG_TO_OLLAMA_MAP).not.toHaveProperty('claude-3-5-sonnet');
    });
  });
});

describe('Model Status Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly identify ready local models', async () => {
    // Ollama running with llama model
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3.1:8b', size: 4700000000 }],
      }),
    });

    // LLM Provider not running
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await detectLocalModels();

    // llama3.1:8b should be in available models
    expect(result.availableModels.has('llama3.1:8b')).toBe(true);

    // This model should be considered "ready" when building the catalog
    // because it's present in availableModels
  });

  it('should correctly identify models that need download', async () => {
    // Ollama running but empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    });

    // LLM Provider not running
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await detectLocalModels();

    // No models available
    expect(result.availableModels.size).toBe(0);

    // But Ollama is running, so downloads should be possible
    expect(result.providers[0].available).toBe(true);
    expect(result.providers[0].models).toHaveLength(0);
  });
});

describe('LLM Provider Custom Format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse LLM Provider custom format with active model', async () => {
    // This is the exact format returned by the real LLM Provider
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: {
          'deepseek-ai/deepseek-coder-1.3b-instruct': {
            model_id: 'deepseek-ai/deepseek-coder-1.3b-instruct',
            loaded_at: 1769644488.1573732,
            load_time_s: 4.43085789680481,
            device: 'cuda',
            is_active: true,
            context_length: 16384,
            max_output_tokens: 4096,
            capabilities: ['chat', 'completion', 'code'],
          },
        },
        active_model: 'deepseek-ai/deepseek-coder-1.3b-instruct',
      }),
    });

    const result = await checkLLMProvider();

    expect(result.available).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].name).toBe('deepseek-ai/deepseek-coder-1.3b-instruct');
    expect(result.models[0].id).toBe('deepseek-ai/deepseek-coder-1.3b-instruct');
    expect(result.models[0].provider).toBe('llm-provider');
  });

  it('should add LLM Provider model to availableModels set', async () => {
    // Ollama not running
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    // LLM Provider running with deepseek model
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: {
          'deepseek-ai/deepseek-coder-1.3b-instruct': {
            model_id: 'deepseek-ai/deepseek-coder-1.3b-instruct',
            is_active: true,
          },
        },
        active_model: 'deepseek-ai/deepseek-coder-1.3b-instruct',
      }),
    });

    const result = await detectLocalModels();

    // The LLM Provider should be detected as available
    expect(result.providers[1].available).toBe(true);
    expect(result.providers[1].models).toHaveLength(1);

    // The model name should be in availableModels
    expect(result.availableModels.has('deepseek-ai/deepseek-coder-1.3b-instruct')).toBe(true);
  });
});
