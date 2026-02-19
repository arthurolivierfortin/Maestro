/**
 * ModelsPanel Component
 *
 * Main panel for viewing and managing AI models.
 * Features:
 * - Tab-based layout (All Models, Local, System Info, Performance)
 * - Shows ALL models (configured + catalog) with three-tier status
 * - Search and filtering
 * - Provider grouping with collapsible sections
 * - Model comparison
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  Cpu,
  BarChart3,
  GitCompare,
  X,
} from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { loadPresetModels } from '../../data/modelPresets';
import { ModelListItem } from './ModelListItem';
import type { ModelItemStatus } from './ModelListItem';
import { ModelConfigForm } from '../ModelConfigForm';
import { modelService } from '../../services/modelService';
import { getProviderDisplayName } from '../../data/modelCatalog';
import { useModelStatus } from '../../hooks/useModelStatus';
import { ProviderIcon } from '../icons/ProviderIcons';
import { SystemInfoTab } from '../Models/SystemInfoTab';
import { PerformanceTab } from '../Models/PerformanceTab';
import { ModelCompareDialog } from '../Models/ModelCompareDialog';
import type { Model, ModelProvider } from '../../types/model.types';
import { useNavigate } from 'react-router-dom';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import type { CreateModelDto } from '../../services/interfaces/IModelService';
import './ModelsPanel.scss';

type TabId = 'all' | 'system' | 'performance';
type StatusFilter = 'all' | 'ready' | 'available' | 'not_configured';

const TABS: { id: TabId; label: string; icon: typeof Layers }[] = [
  { id: 'all', label: 'All Models', icon: Layers },
  { id: 'system', label: 'System Info', icon: Cpu },
  { id: 'performance', label: 'Performance', icon: BarChart3 },
];

interface ProviderGroup {
  provider: string;
  models: ModelCatalogEntry[];
}

/**
 * Group catalog entries by provider
 */
function groupByProvider(catalog: ModelCatalogEntry[]): ProviderGroup[] {
  const grouped = new Map<string, ModelCatalogEntry[]>();

  catalog.forEach((entry) => {
    const existing = grouped.get(entry.provider) || [];
    existing.push(entry);
    grouped.set(entry.provider, existing);
  });

  return Array.from(grouped.entries()).map(([provider, models]) => ({
    provider,
    models,
  }));
}

export function ModelsPanel() {
  const navigate = useNavigate();
  const models = useModelStore((state) => state.models);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const addModel = useModelStore((state) => state.addModel);

  // Use the shared model status hook for consistent status logic
  const { catalog, isLoading: isDetectingModels, refresh: refreshModels } = useModelStatus();

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  // Comparison state
  const [compareModels, setCompareModels] = useState<ModelCatalogEntry[]>([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);

  // Group catalog by provider
  const groupedCatalog = useMemo(() => groupByProvider(catalog), [catalog]);

  // Initialize expanded providers
  useEffect(() => {
    if (expandedProviders.size === 0 && groupedCatalog.length > 0) {
      setExpandedProviders(new Set(groupedCatalog.map((g: ProviderGroup) => g.provider)));
    }
  }, [groupedCatalog]);

  // Filter catalog based on search and status
  const filteredGroupedCatalog = useMemo((): ProviderGroup[] => {
    return groupedCatalog
      .map((group: ProviderGroup) => {
        const filteredModels = group.models.filter((model: ModelCatalogEntry) => {
          // Search filter
          const matchesSearch =
            !searchQuery ||
            model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            model.provider.toLowerCase().includes(searchQuery.toLowerCase());

          // Status filter
          const matchesStatus = statusFilter === 'all' || model.status === statusFilter;

          return matchesSearch && matchesStatus;
        });

        return { ...group, models: filteredModels };
      })
      .filter((group: ProviderGroup) => group.models.length > 0);
  }, [groupedCatalog, searchQuery, statusFilter]);

  // Load preset models on first mount if no models exist
  useEffect(() => {
    if (models.size === 0) {
      const existingIds = new Set(Array.from(models.keys()));
      loadPresetModels(addModel, existingIds);
    }
  }, []);

  // Sync expanded model from store
  useEffect(() => {
    if (selectedModelId) {
      setExpandedModelId(selectedModelId);
    }
  }, [selectedModelId]);

  const toggleProvider = (provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  // Single click - toggle inline details
  const handleModelClick = (entry: ModelCatalogEntry) => {
    if (expandedModelId === entry.id) {
      setExpandedModelId(null);
    } else {
      setExpandedModelId(entry.id);
      // If it's a configured model, also select it in the store
      if (entry.status === 'ready' && models.has(entry.id)) {
        setSelectedModel(entry.id);
      }
    }
  };

  // Double click - navigate to model detail page
  const handleModelDoubleClick = (entry: ModelCatalogEntry) => {
    navigate(`/models/${entry.id}`);
  };

  const handleResetToDefaults = async () => {
    setIsLoading(true);
    const existingIds = new Set<string>();
    loadPresetModels(addModel, existingIds);
    // Refresh to detect local models
    await refreshModels();
    setIsLoading(false);
  };

  const handleAddModel = () => {
    setShowAddModal(true);
    setSubmitError(null);
  };

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
        throw error;
      }
    },
    [addModel, setSelectedModel]
  );

  const handleTestConnection = useCallback(async (dto: CreateModelDto) => {
    const result = await modelService.testConnection(dto.id || '', dto.apiEndpoint);
    return result.success;
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
  }, []);

  // Comparison handlers
  const handleAddToCompare = (entry: ModelCatalogEntry) => {
    if (compareModels.length < 4 && !compareModels.find((m) => m.id === entry.id)) {
      setCompareModels([...compareModels, entry]);
    }
  };

  const handleRemoveFromCompare = (modelId: string) => {
    setCompareModels(compareModels.filter((m) => m.id !== modelId));
  };

  const handleCompare = () => {
    if (compareModels.length >= 2) {
      setShowCompareDialog(true);
    }
  };

  // Handle configure model
  const handleConfigureModel = (entry: ModelCatalogEntry) => {
    setExpandedModelId(entry.id);
    setShowAddModal(true);
  };

  // Convert catalog entry to Model for detail view
  const catalogEntryToModel = (entry: ModelCatalogEntry): Model => {
    const existingModel = models.get(entry.id);
    if (existingModel) return existingModel;

    // Create a minimal Model from catalog entry
    return {
      id: entry.id,
      provider: entry.provider as ModelProvider,
      displayName: entry.displayName,
      description: entry.description,
      capabilities: entry.specs.capabilities as any[],
      contextWindow: entry.specs.contextWindow,
      costPerInputToken: (entry.specs.inputPricePerMillion || 0) / 1000000,
      costPerOutputToken: (entry.specs.outputPricePerMillion || 0) / 1000000,
      speedRating: 5,
      qualityRatings: {},
      strengths: [],
      weaknesses: [],
      maxOutputTokens: Math.min(entry.specs.contextWindow / 4, 4096),
      supportsStreaming: entry.specs.supportsStreaming ?? true,
      supportsToolCalls: entry.specs.supportsToolUse ?? false,
      supportsVision: entry.specs.supportsVision ?? false,
      isLocal: entry.provider === 'local' || entry.provider === 'ollama',
      isAvailable: entry.status === 'ready',
    };
  };

  // Render All Models tab content
  const renderAllModelsTab = () => (
    <div className="models-panel__all-models">
      {/* Search and Filter Bar */}
      <div className="models-panel__toolbar">
        <div className="models-panel__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="models-panel__filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All Status</option>
          <option value="ready">Ready</option>
          <option value="available">Available</option>
          <option value="not_configured">Not Configured</option>
        </select>
      </div>

      {/* Compare Bar */}
      {compareModels.length > 0 && (
        <div className="models-panel__compare-bar">
          <span className="models-panel__compare-label">
            <GitCompare size={14} /> Compare ({compareModels.length}/4):
          </span>
          <div className="models-panel__compare-chips">
            {compareModels.map((m) => (
              <span key={m.id} className="models-panel__compare-chip">
                {m.displayName}
                <button onClick={() => handleRemoveFromCompare(m.id)}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <button
            className="models-panel__compare-btn"
            onClick={handleCompare}
            disabled={compareModels.length < 2}
          >
            Compare
          </button>
        </div>
      )}

      {/* Model List with Provider Groups */}
      <div className="models-panel__content">
        <div className="models-panel__list">
          {filteredGroupedCatalog.map((group) => (
            <div key={group.provider} className="models-panel__provider-group">
              <button
                className="models-panel__provider-header"
                onClick={() => toggleProvider(group.provider)}
              >
                <span className="models-panel__provider-arrow">
                  {expandedProviders.has(group.provider) ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
                <ProviderIcon provider={group.provider as ModelProvider} size={18} />
                <span className="models-panel__provider-name">
                  {getProviderDisplayName(group.provider)}
                </span>
                <span className="models-panel__provider-count">{group.models.length}</span>
              </button>

              {expandedProviders.has(group.provider) && (
                <div className="models-panel__provider-models">
                  {group.models.map((entry) => {
                    const model = catalogEntryToModel(entry);
                    const isExpanded = expandedModelId === entry.id;

                    return (
                      <div key={entry.id} className="models-panel__model-wrapper">
                        <ModelListItem
                          model={model}
                          isSelected={isExpanded}
                          onSelect={() => handleModelClick(entry)}
                          onDoubleClick={() => handleModelDoubleClick(entry)}
                          status={entry.status as ModelItemStatus}
                        />
                        {/* Inline detail panel */}
                        {isExpanded && (
                          <div className="models-panel__inline-detail">
                            <div className="models-panel__inline-detail-content">
                              <p className="models-panel__inline-description">
                                {entry.description || 'No description available.'}
                              </p>
                              <div className="models-panel__inline-specs">
                                <span>
                                  Context: {entry.specs.contextWindow >= 1000000
                                    ? `${(entry.specs.contextWindow / 1000000).toFixed(1)}M`
                                    : `${Math.round(entry.specs.contextWindow / 1000)}K`} tokens
                                </span>
                                <span>
                                  Input: {entry.specs.inputPricePerMillion === 0
                                    ? 'Free'
                                    : `$${entry.specs.inputPricePerMillion}/1M`}
                                </span>
                                <span>
                                  Output: {entry.specs.outputPricePerMillion === 0
                                    ? 'Free'
                                    : `$${entry.specs.outputPricePerMillion}/1M`}
                                </span>
                              </div>
                              <div className="models-panel__inline-capabilities">
                                {entry.specs.supportsVision && <span className="models-panel__inline-cap">Vision</span>}
                                {entry.specs.supportsToolUse && <span className="models-panel__inline-cap">Tools</span>}
                                {entry.specs.supportsStreaming && <span className="models-panel__inline-cap">Streaming</span>}
                              </div>
                            </div>
                            <div className="models-panel__inline-actions">
                              <button
                                className="models-panel__inline-btn"
                                onClick={() => handleModelDoubleClick(entry)}
                              >
                                View Details
                              </button>
                              {!compareModels.find((m) => m.id === entry.id) && (
                                <button
                                  className="models-panel__inline-btn"
                                  onClick={() => handleAddToCompare(entry)}
                                  disabled={compareModels.length >= 4}
                                >
                                  <GitCompare size={12} />
                                  Compare
                                </button>
                              )}
                              {entry.status !== 'ready' && (
                                <button
                                  className="models-panel__inline-btn models-panel__inline-btn--primary"
                                  onClick={() => handleConfigureModel(entry)}
                                >
                                  Configure
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {filteredGroupedCatalog.length === 0 && (
            <div className="models-panel__empty-search">
              No models match your search
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="models-panel__legend">
        <span className="models-panel__legend-item models-panel__legend-item--ready">
          Ready
        </span>
        <span className="models-panel__legend-item models-panel__legend-item--available">
          Available
        </span>
        <span className="models-panel__legend-item models-panel__legend-item--not-configured">
          Not Configured
        </span>
      </div>
    </div>
  );

  return (
    <div className="models-panel">
      <div className="models-panel__header">
        <h2 className="models-panel__title">Models</h2>
        <div className="models-panel__actions">
          <button
            className="models-panel__action-btn"
            onClick={handleResetToDefaults}
            title="Refresh models"
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

      {/* Tabs */}
      <div className="models-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`models-panel__tab ${activeTab === tab.id ? 'models-panel__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="models-panel__body">
        {isLoading || isDetectingModels ? (
          <div className="models-panel__loading">Loading models...</div>
        ) : (
          <>
            {activeTab === 'all' && renderAllModelsTab()}
            {activeTab === 'system' && <SystemInfoTab />}
            {activeTab === 'performance' && <PerformanceTab catalog={catalog} />}
          </>
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

      {/* Compare Dialog */}
      {showCompareDialog && (
        <ModelCompareDialog
          models={compareModels}
          onClose={() => setShowCompareDialog(false)}
          onRemove={handleRemoveFromCompare}
        />
      )}
    </div>
  );
}
