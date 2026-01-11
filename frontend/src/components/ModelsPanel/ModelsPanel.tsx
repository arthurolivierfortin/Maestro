/**
 * ModelsPanel Component
 *
 * Main panel for viewing and managing AI models.
 * Supports both preset models and custom model configuration.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { loadPresetModels } from '../../data/modelPresets';
import { ModelListItem } from './ModelListItem';
import { ModelDetailView } from './ModelDetailView';
import { ModelConfigForm } from '../ModelConfigForm';
import { modelService } from '../../services/modelService';
import type { Model } from '../../types/model.types';
import type { CreateModelDto } from '../../services/interfaces/IModelService';
import './ModelsPanel.scss';

export function ModelsPanel() {
  const models = useModelStore((state) => state.models);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const addModel = useModelStore((state) => state.addModel);

  const [selectedModel, setSelectedModelLocal] = useState<Model | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    setShowAddModal(true);
    setSubmitError(null);
  };

  /**
   * Handle form submission for adding a new model
   */
  const handleSubmitModel = useCallback(
    async (dto: CreateModelDto) => {
      try {
        const newModel = await modelService.create(dto);
        addModel(newModel);
        setShowAddModal(false);
        setSelectedModel(newModel.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add model';
        setSubmitError(message);
        throw error; // Re-throw so form shows error
      }
    },
    [addModel, setSelectedModel]
  );

  /**
   * Handle test connection
   */
  const handleTestConnection = useCallback(async (dto: CreateModelDto) => {
    const result = await modelService.testConnection(dto.id || '', dto.apiEndpoint);
    return result.success;
  }, []);

  /**
   * Close the add modal
   */
  const handleCloseModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
  }, []);

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

      {/* Add Model Modal */}
      {showAddModal && (
        <div
          className="models-panel__modal-overlay"
          onClick={handleCloseModal}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseModal()}
          role="dialog"
          aria-modal="true"
          aria-label="Add model dialog"
          tabIndex={-1}
        >
          <div
            className="models-panel__modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="document"
          >
            <ModelConfigForm
              onSubmit={handleSubmitModel}
              onCancel={handleCloseModal}
              onTestConnection={handleTestConnection}
            />
            {submitError && <div className="models-panel__modal-error">{submitError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
