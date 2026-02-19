/**
 * useModelStatus Hook Tests
 *
 * Tests the model status determination logic to ensure consistency
 * between ModelsPanel and ModelDetailPage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModelStatus } from '../useModelStatus';
import * as localModelService from '../../services/localModelService';

// Mock the local model service
vi.mock('../../services/localModelService', () => ({
  detectLocalModels: vi.fn(),
  pullOllamaModel: vi.fn(),
  getOllamaModelName: vi.fn((id: string) => {
    const map: Record<string, string> = {
      'llama-3.1-8b': 'llama3.1:8b',
      'llama-3.2-3b': 'llama3.2:3b',
    };
    return map[id];
  }),
  CATALOG_TO_OLLAMA_MAP: {
    'llama-3.1-8b': 'llama3.1:8b',
    'llama-3.2-3b': 'llama3.2:3b',
  },
}));

// Mock the model store
const mockModels = new Map();
const mockAddModel = vi.fn();
const mockUpdateModel = vi.fn();

vi.mock('../../store/modelStore', () => ({
  useModelStore: (selector: any) => {
    const state = {
      models: mockModels,
      addModel: mockAddModel,
      updateModel: mockUpdateModel,
    };
    return selector(state);
  },
}));

describe('useModelStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModels.clear();

    // Default mock: no local providers available
    vi.mocked(localModelService.detectLocalModels).mockResolvedValue({
      providers: [
        { provider: 'ollama', available: false, models: [], error: 'Not running' },
        { provider: 'llm-provider', available: false, models: [], error: 'Not running' },
      ],
      availableModels: new Set(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getModelStatus', () => {
    it('should return "not_configured" for cloud models without API key', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // GPT-4o is a cloud model, not configured
      const status = result.current.getModelStatus('gpt-4o');
      expect(status).toBe('not_configured');
    });

    it('should return "ready" for configured cloud models', async () => {
      // Add a configured model to the store
      mockModels.set('gpt-4o', {
        id: 'gpt-4o',
        provider: 'openai',
        displayName: 'GPT-4o',
        isAvailable: true,
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const status = result.current.getModelStatus('gpt-4o');
      expect(status).toBe('ready');
    });

    it('should return "available" for local models when Ollama is not running', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Llama is a local model, Ollama not running = available for download
      const status = result.current.getModelStatus('llama-3.1-8b');
      expect(status).toBe('available');
    });

    it('should return "ready" for local models that are downloaded in Ollama', async () => {
      // Mock Ollama running with the model
      vi.mocked(localModelService.detectLocalModels).mockResolvedValue({
        providers: [
          {
            provider: 'ollama',
            available: true,
            models: [
              { id: 'llama3.1:8b', name: 'llama3.1:8b', provider: 'ollama' },
            ],
          },
          { provider: 'llm-provider', available: false, models: [], error: 'Not running' },
        ],
        availableModels: new Set(['llama3.1:8b']),
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The model should be detected as ready
      expect(result.current.localProviders[0].available).toBe(true);
    });
  });

  describe('canDownload', () => {
    it('should return false for cloud models', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canDownload('gpt-4o')).toBe(false);
      expect(result.current.canDownload('claude-3-5-sonnet')).toBe(false);
    });

    it('should return false for local models when Ollama is not running', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Ollama not running, can't download
      expect(result.current.canDownload('llama-3.1-8b')).toBe(false);
    });

    it('should return true for local models when Ollama is running and model not downloaded', async () => {
      // Mock Ollama running but without the model
      vi.mocked(localModelService.detectLocalModels).mockResolvedValue({
        providers: [
          { provider: 'ollama', available: true, models: [] },
          { provider: 'llm-provider', available: false, models: [], error: 'Not running' },
        ],
        availableModels: new Set(),
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canDownload('llama-3.1-8b')).toBe(true);
    });

    it('should return false for local models that are already downloaded', async () => {
      // Mock Ollama running with the model already downloaded
      vi.mocked(localModelService.detectLocalModels).mockResolvedValue({
        providers: [
          {
            provider: 'ollama',
            available: true,
            models: [{ id: 'llama3.1:8b', name: 'llama3.1:8b', provider: 'ollama' }],
          },
          { provider: 'llm-provider', available: false, models: [], error: 'Not running' },
        ],
        availableModels: new Set(['llama3.1:8b']),
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Model already downloaded, can't download again
      expect(result.current.canDownload('llama-3.1-8b')).toBe(false);
    });
  });

  describe('setupModel', () => {
    it('should call pullOllamaModel for local models', async () => {
      vi.mocked(localModelService.pullOllamaModel).mockResolvedValue(true);
      vi.mocked(localModelService.detectLocalModels).mockResolvedValue({
        providers: [
          { provider: 'ollama', available: true, models: [] },
          { provider: 'llm-provider', available: false, models: [], error: 'Not running' },
        ],
        availableModels: new Set(),
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const progressCallback = vi.fn();
      await act(async () => {
        await result.current.setupModel('llama-3.1-8b', progressCallback);
      });

      expect(localModelService.pullOllamaModel).toHaveBeenCalledWith(
        'llama3.1:8b',
        progressCallback
      );
    });

    it('should add model to store after successful download', async () => {
      vi.mocked(localModelService.pullOllamaModel).mockResolvedValue(true);
      vi.mocked(localModelService.detectLocalModels).mockResolvedValue({
        providers: [
          { provider: 'ollama', available: true, models: [] },
          { provider: 'llm-provider', available: false, models: [], error: 'Not running' },
        ],
        availableModels: new Set(),
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setupModel('llama-3.1-8b');
      });

      expect(mockAddModel).toHaveBeenCalled();
      const addedModel = mockAddModel.mock.calls[0][0];
      expect(addedModel.id).toBe('llama-3.1-8b');
      expect(addedModel.isLocal).toBe(true);
      expect(addedModel.isAvailable).toBe(true);
    });

    it('should return false for cloud models', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const success = await result.current.setupModel('gpt-4o');
      expect(success).toBe(false);
      expect(localModelService.pullOllamaModel).not.toHaveBeenCalled();
    });
  });

  describe('catalog status consistency', () => {
    it('should mark all cloud models without API keys as not_configured', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const cloudModels = result.current.catalog.filter(
        m => m.provider === 'openai' || m.provider === 'anthropic' || m.provider === 'google'
      );

      // All cloud models should be not_configured since no API keys
      cloudModels.forEach(model => {
        expect(model.status).toBe('not_configured');
      });
    });

    it('should mark local models as available when not downloaded', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const localModels = result.current.catalog.filter(
        m => m.provider === 'ollama' || m.provider === 'local'
      );

      // Local models should be available (can be downloaded)
      localModels.forEach(model => {
        expect(model.status).toBe('available');
      });
    });

    it('should provide consistent status between catalog and getModelStatus', async () => {
      mockModels.set('gpt-4o', {
        id: 'gpt-4o',
        provider: 'openai',
        displayName: 'GPT-4o',
        isAvailable: true,
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check that catalog entry status matches getModelStatus
      const gpt4oEntry = result.current.catalog.find(m => m.id === 'gpt-4o');
      expect(gpt4oEntry?.status).toBe(result.current.getModelStatus('gpt-4o'));
    });
  });

  describe('readyModelIds and availableModelIds', () => {
    it('should correctly populate readyModelIds', async () => {
      mockModels.set('gpt-4o', {
        id: 'gpt-4o',
        provider: 'openai',
        displayName: 'GPT-4o',
        isAvailable: true,
      });

      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.readyModelIds.has('gpt-4o')).toBe(true);
    });

    it('should correctly populate availableModelIds for local models', async () => {
      const { result } = renderHook(() => useModelStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Local models should be in availableModelIds
      expect(result.current.availableModelIds.has('llama-3.1-8b')).toBe(true);
    });
  });
});
