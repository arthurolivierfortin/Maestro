/**
 * Model Catalog Tests
 *
 * Tests the status determination logic in the model catalog.
 */

import { describe, it, expect } from 'vitest';
import {
  getModelCatalog,
  toCatalogEntry,
  ALL_MODEL_DEFINITIONS,
} from '../modelCatalog';

describe('modelCatalog', () => {
  describe('toCatalogEntry', () => {
    it('should mark cloud model as not_configured when not in configuredModels', () => {
      const gpt4o = ALL_MODEL_DEFINITIONS.find(d => d.id === 'gpt-4o')!;
      const entry = toCatalogEntry(gpt4o, new Set(), new Set());

      expect(entry.status).toBe('not_configured');
    });

    it('should mark cloud model as ready when in configuredModels by id', () => {
      const gpt4o = ALL_MODEL_DEFINITIONS.find(d => d.id === 'gpt-4o')!;
      const entry = toCatalogEntry(gpt4o, new Set(['gpt-4o']), new Set());

      expect(entry.status).toBe('ready');
    });

    it('should mark cloud model as ready when in configuredModels by name', () => {
      const gpt4o = ALL_MODEL_DEFINITIONS.find(d => d.id === 'gpt-4o')!;
      const entry = toCatalogEntry(gpt4o, new Set(['gpt-4o']), new Set());

      expect(entry.status).toBe('ready');
    });

    it('should mark local model as available when not downloaded', () => {
      const llama = ALL_MODEL_DEFINITIONS.find(d => d.id === 'llama-3.1-8b')!;
      const entry = toCatalogEntry(llama, new Set(), new Set());

      expect(entry.status).toBe('available');
      expect(entry.setupInfo?.setupType).toBe('download');
    });

    it('should mark local model as ready when in availableLocalModels', () => {
      const llama = ALL_MODEL_DEFINITIONS.find(d => d.id === 'llama-3.1-8b')!;
      // The availableLocalModels set should contain the model's name (not id)
      const entry = toCatalogEntry(llama, new Set(), new Set(['llama3.1:8b']));

      expect(entry.status).toBe('ready');
    });

    it('should mark LLM Provider model as available when provider not running', () => {
      const deepseek = ALL_MODEL_DEFINITIONS.find(d => d.id === 'deepseek-coder-llm-provider')!;
      const entry = toCatalogEntry(deepseek, new Set(), new Set());

      // LLM Provider models have isLocalModel: true, so they should be available
      expect(entry.status).toBe('available');
    });

    it('should mark LLM Provider model as ready when model is loaded', () => {
      const deepseek = ALL_MODEL_DEFINITIONS.find(d => d.id === 'deepseek-coder-llm-provider')!;
      // The model name in the catalog is 'deepseek-ai/deepseek-coder-1.3b-instruct'
      const availableModels = new Set(['deepseek-ai/deepseek-coder-1.3b-instruct']);
      const entry = toCatalogEntry(deepseek, new Set(), availableModels);

      expect(entry.status).toBe('ready');
    });
  });

  describe('getModelCatalog', () => {
    it('should return all models with correct status', () => {
      const configuredIds = new Set(['gpt-4o']);
      const availableLocal = new Set(['deepseek-ai/deepseek-coder-1.3b-instruct']);

      const catalog = getModelCatalog(configuredIds, availableLocal);

      // GPT-4o should be ready (configured)
      const gpt4o = catalog.find(m => m.id === 'gpt-4o');
      expect(gpt4o?.status).toBe('ready');

      // DeepSeek should be ready (available locally)
      const deepseek = catalog.find(m => m.id === 'deepseek-coder-llm-provider');
      expect(deepseek?.status).toBe('ready');

      // Other cloud models should be not_configured
      const claude = catalog.find(m => m.id === 'claude-3-5-sonnet');
      expect(claude?.status).toBe('not_configured');

      // Other local models should be available
      const llama = catalog.find(m => m.id === 'llama-3.1-8b');
      expect(llama?.status).toBe('available');
    });

    it('should handle empty sets', () => {
      const catalog = getModelCatalog(new Set(), new Set());

      // All cloud models should be not_configured
      const cloudModels = catalog.filter(m =>
        m.provider === 'openai' || m.provider === 'anthropic' || m.provider === 'google'
      );
      cloudModels.forEach(m => {
        expect(m.status).toBe('not_configured');
      });

      // All local/ollama models should be available
      const localModels = catalog.filter(m =>
        m.provider === 'ollama' || m.provider === 'local' || m.provider === 'llm-provider'
      );
      localModels.forEach(m => {
        expect(m.status).toBe('available');
      });
    });
  });

  describe('LLM Provider model definition', () => {
    it('should have deepseek-coder-llm-provider in catalog', () => {
      const deepseek = ALL_MODEL_DEFINITIONS.find(d => d.id === 'deepseek-coder-llm-provider');

      expect(deepseek).toBeDefined();
      expect(deepseek?.name).toBe('deepseek-ai/deepseek-coder-1.3b-instruct');
      expect(deepseek?.isLocalModel).toBe(true);
      expect(deepseek?.provider).toBe('llm-provider');
    });

    it('should match model name from LLM Provider response', () => {
      // This is what LLM Provider returns
      const llmProviderModelName = 'deepseek-ai/deepseek-coder-1.3b-instruct';

      // Find the catalog entry by name
      const catalogEntry = ALL_MODEL_DEFINITIONS.find(d => d.name === llmProviderModelName);

      expect(catalogEntry).toBeDefined();
      expect(catalogEntry?.id).toBe('deepseek-coder-llm-provider');
    });
  });
});
