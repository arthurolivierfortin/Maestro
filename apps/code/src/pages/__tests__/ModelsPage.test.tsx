import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelsPage } from '../ModelsPage';

vi.mock('../../hooks/useProviderData', () => ({
  useProviderData: vi.fn(),
}));

import { useProviderData } from '../../hooks/useProviderData';

const defaultReturn = {
  health: null,
  models: null,
  activeProvider: null,
  stats: null,
  isLoading: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useProviderData).mockReturnValue(defaultReturn);
});

describe('ModelsPage', () => {
  it('shows loading state', () => {
    vi.mocked(useProviderData).mockReturnValue({ ...defaultReturn, isLoading: true });

    render(<ModelsPage />);

    expect(screen.getByText('Loading provider data...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useProviderData).mockReturnValue({ ...defaultReturn, error: 'Connection refused' });

    render(<ModelsPage />);

    expect(screen.getByText('Error: Connection refused')).toBeDefined();
  });

  it('shows health badge when health data loaded', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      health: { status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false, cudaDeviceName: null },
    });

    render(<ModelsPage />);

    expect(screen.getByText('healthy')).toBeDefined();
  });

  it('shows active model info when health has activeModel', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      health: { status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false, cudaDeviceName: null },
    });

    render(<ModelsPage />);

    expect(screen.getByText('gpt-4')).toBeDefined();
  });

  it('shows models list when models available', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      models: {
        hardware: null,
        summary: null,
        count: 1,
        models: [{
          modelId: 'gpt-4', name: 'GPT-4', description: null, category: 'chat', size: '175B',
          parametersB: 175, contextLength: 128000,
          vramFp16Gb: 0, vramInt8Gb: 0, vramInt4Gb: 0,
          capabilities: [], license: null, recommended: true,
          canRunFp16: true, canRunInt8: true, canRunInt4: true,
          recommendedPrecision: null, quantizationRequired: null,
          vramRequired: 0, isLocal: false, isAvailable: true,
          inputTokenPricePerMillion: null, outputTokenPricePerMillion: null,
        }],
      },
    });

    render(<ModelsPage />);

    expect(screen.getByText('GPT-4')).toBeDefined();
  });

  it('shows empty state when no models', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      models: { hardware: null, summary: null, count: 0, models: [] },
    });

    render(<ModelsPage />);

    expect(screen.getByText('No models available.')).toBeDefined();
  });

  it('shows stats when available', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      stats: {
        totalRequests: 42, totalErrors: 1, errorRate: 0.02,
        promptTokens: 500, completionTokens: 300, totalTokens: 800,
        latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0, avgLatencyMs: 100,
        perModel: [],
      },
    });

    render(<ModelsPage />);

    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('800')).toBeDefined();
  });
});
