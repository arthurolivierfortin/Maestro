import React, { useEffect, useState } from 'react';
import { fetchLLMHealth, fetchLLMModels } from '../../services/chatService';

interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
}

interface ModelOption {
  modelId: string;
  name: string;
  parametersB?: number;
  recommended?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange }) => {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [healthData, modelsData] = await Promise.allSettled([
          fetchLLMHealth(),
          fetchLLMModels(),
        ]);

        if (cancelled) return;

        if (healthData.status === 'fulfilled') {
          setActiveModel(healthData.value.activeModel || null);
        }

        if (modelsData.status === 'fulfilled' && modelsData.value.models) {
          setModels(
            modelsData.value.models.map((m: any) => ({
              modelId: m.modelId,
              name: m.name || m.modelId,
              parametersB: m.parametersB,
              recommended: m.recommended,
            }))
          );
        }
      } catch {
        // Models unavailable
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const selected = value || activeModel || '';

  return (
    <div className="model-selector">
      <label className="model-selector__label">Model:</label>
      <select
        className="model-selector__select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        {!selected && <option value="">Select a model...</option>}
        {activeModel && !models.find((m) => m.modelId === activeModel) && (
          <option value={activeModel}>{activeModel} (active)</option>
        )}
        {models.map((m) => (
          <option key={m.modelId} value={m.modelId}>
            {m.name} ({m.parametersB}B){m.recommended ? ' *' : ''}
            {m.modelId === activeModel ? ' (active)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
};
