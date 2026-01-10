/**
 * ModelsPanel Component
 *
 * Main panel for viewing and managing AI models.
 */

import { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { loadPresetModels } from '../../data/modelPresets';
import { ModelListItem } from './ModelListItem';
import { ModelDetailView } from './ModelDetailView';
import type { Model } from '../../types/model.types';
import './ModelsPanel.scss';

export function ModelsPanel() {
  const models = useModelStore((state) => state.models);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const addModel = useModelStore((state) => state.addModel);

  const [selectedModel, setSelectedModelLocal] = useState<Model | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load preset models on first mount if no models exist
  useEffect(() => {
    if (models.size === 0) {
      const existingIds = new Set(Array.from(models.keys()));
      loadPresetModels(addModel, existingIds);
    }
  }, []); // Only run on mount

  // Sync selected model
  useEffect(() => {
    if (selectedModelId) {
      const model = models.get(selectedModelId);
      setSelectedModelLocal(model || null);
    } else {
      setSelectedModelLocal(null);
    }
  }, [selectedModelId, models]);

  const handleSelectModel = (model: Model) => {
    setSelectedModel(model.id);
  };

  const handleResetToDefaults = () => {
    setIsLoading(true);
    const existingIds = new Set<string>();
    loadPresetModels(addModel, existingIds);
    setIsLoading(false);
  };

  const handleAddModel = () => {
    // TODO: Open modal to add custom model
    console.log('Add model clicked');
  };

  const modelList = Array.from(models.values()).sort((a, b) => {
    // Sort by provider, then by name
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className="models-panel">
      <div className="models-panel__header">
        <h2 className="models-panel__title">Models</h2>
        <div className="models-panel__actions">
          <button
            className="models-panel__action-btn"
            onClick={handleResetToDefaults}
            title="Reset to default models"
            disabled={isLoading}
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="models-panel__action-btn"
            onClick={handleAddModel}
            title="Add custom model"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="models-panel__body">
        {isLoading ? (
          <div className="models-panel__loading">Loading models...</div>
        ) : modelList.length === 0 ? (
          <div className="models-panel__empty">
            <p>No models configured.</p>
            <button className="models-panel__add-btn" onClick={handleResetToDefaults}>
              Load Default Models
            </button>
          </div>
        ) : (
          <div className="models-panel__content">
            <div className="models-panel__list">
              {modelList.map((model) => (
                <ModelListItem
                  key={model.id}
                  model={model}
                  isSelected={selectedModelId === model.id}
                  onSelect={() => handleSelectModel(model)}
                />
              ))}
            </div>
            {selectedModel && (
              <div className="models-panel__detail">
                <ModelDetailView model={selectedModel} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
