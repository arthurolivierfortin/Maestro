/**
 * ModelSelector Component
 *
 * Dropdown selector for choosing models in agent blocks.
 */

import { useMemo } from 'react';
import { useModelStore } from '../../store/modelStore';
import { ProviderIcon, getProviderName } from '../icons/ProviderIcons';
import type { Model, ModelProvider } from '../../types/model.types';
import './ModelSelector.scss';

export interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  onlyAvailable?: boolean;
  placeholder?: string;
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  onlyAvailable = false,
  placeholder = 'Select a model...',
}: ModelSelectorProps) {
  const models = useModelStore((state) => state.models);
  const defaultModelId = useModelStore((state) => state.defaultModelId);

  // Filter and group models by provider
  const modelsByProvider = useMemo(() => {
    let modelList = Array.from(models.values());

    if (onlyAvailable) {
      modelList = modelList.filter((m) => m.isAvailable);
    }

    const grouped = new Map<string, Model[]>();
    modelList.forEach((model) => {
      const provider = model.provider;
      if (!grouped.has(provider)) {
        grouped.set(provider, []);
      }
      grouped.get(provider)!.push(model);
    });

    // Sort models within each provider group
    grouped.forEach((models) => {
      models.sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    return grouped;
  }, [models, onlyAvailable]);

  const selectedModel = value ? models.get(value) : null;

  return (
    <div className="model-selector">
      <select
        className="model-selector__select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {Array.from(modelsByProvider.entries()).map(([provider, providerModels]) => (
          <optgroup key={provider} label={getProviderName(provider as ModelProvider)}>
            {providerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
                {model.id === defaultModelId ? ' (Default)' : ''}
                {!model.isAvailable ? ' (Offline)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selectedModel && (
        <div className="model-selector__preview">
          <ProviderIcon provider={selectedModel.provider} size={16} />
          <span className="model-selector__preview-name">{selectedModel.displayName}</span>
          {!selectedModel.isAvailable && (
            <span className="model-selector__preview-status">Offline</span>
          )}
        </div>
      )}
    </div>
  );
}
