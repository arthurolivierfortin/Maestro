import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelRow } from '../ModelRow';
import type { CompatibleModel } from '../../services/providerService';

const baseModel: CompatibleModel = {
  modelId: 'gpt-4',
  name: 'GPT-4',
  description: 'Large model',
  category: 'chat',
  size: '175B',
  parametersB: 175,
  contextLength: 128000,
  vramFp16Gb: 0,
  vramInt8Gb: 0,
  vramInt4Gb: 0,
  capabilities: ['chat', 'code'],
  license: 'proprietary',
  recommended: true,
  canRunFp16: true,
  canRunInt8: true,
  canRunInt4: true,
  recommendedPrecision: 'fp16',
  quantizationRequired: null,
  vramRequired: 0,
  isLocal: false,
  isAvailable: true,
  inputTokenPricePerMillion: null,
  outputTokenPricePerMillion: null,
};

describe('ModelRow', () => {
  it('renders model name and category', () => {
    render(<ModelRow model={baseModel} />);

    expect(screen.getByText('GPT-4')).toBeDefined();
    expect(screen.getByText('chat')).toBeDefined();
  });

  it('shows RECOMMENDED badge when recommended', () => {
    render(<ModelRow model={baseModel} />);

    expect(screen.getByText('RECOMMENDED')).toBeDefined();
  });

  it('hides RECOMMENDED badge when not recommended', () => {
    render(<ModelRow model={{ ...baseModel, recommended: false }} />);

    expect(screen.queryByText('RECOMMENDED')).toBeNull();
  });

  it('hides category when null', () => {
    render(<ModelRow model={{ ...baseModel, category: null }} />);

    expect(screen.getByText('GPT-4')).toBeDefined();
    expect(screen.queryByText('chat')).toBeNull();
  });
});
