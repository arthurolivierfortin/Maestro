/**
 * All Models Tab
 *
 * Main view showing all models grouped by provider with status indicators.
 * Supports filtering by status and searching.
 */

import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { ModelListItem } from './ModelListItem';
import { ModelDetailPanel } from './ModelDetailPanel';
import {
  groupCatalogByProvider,
  filterCatalogByStatus,
  searchCatalog,
  getProviderDisplayName,
} from '../../data/modelCatalog';
import type { ModelCatalogEntry, ModelStatus } from '../../types/modelStatus.types';
import './AllModelsTab.scss';

interface AllModelsTabProps {
  catalog: ModelCatalogEntry[];
  compareModels: ModelCatalogEntry[];
  onAddToCompare: (model: ModelCatalogEntry) => void;
  onRemoveFromCompare: (modelId: string) => void;
  onConfigure: (model: ModelCatalogEntry) => void;
}

type StatusFilter = 'all' | ModelStatus;

export function AllModelsTab({
  catalog,
  compareModels,
  onAddToCompare,
  onRemoveFromCompare,
  onConfigure,
}: AllModelsTabProps) {
  const [selectedModel, setSelectedModel] = useState<ModelCatalogEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  // Filter and search catalog
  const filteredCatalog = useMemo(() => {
    let result = catalog;

    // Apply status filter
    if (statusFilter !== 'all') {
      result = filterCatalogByStatus(result, [statusFilter]);
    }

    // Apply search
    if (searchQuery.trim()) {
      result = searchCatalog(result, searchQuery);
    }

    return result;
  }, [catalog, statusFilter, searchQuery]);

  // Group by provider
  const groupedCatalog = useMemo(() => {
    return groupCatalogByProvider(filteredCatalog);
  }, [filteredCatalog]);

  // Initialize expanded providers
  useMemo(() => {
    if (expandedProviders.size === 0) {
      setExpandedProviders(new Set(groupedCatalog.keys()));
    }
  }, []);

  // Toggle provider expansion
  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  // Check if model is in compare list
  const isInCompare = (modelId: string) => {
    return compareModels.some(m => m.id === modelId);
  };

  // Count models by status
  const statusCounts = useMemo(() => {
    return {
      all: catalog.length,
      ready: catalog.filter(m => m.status === 'ready').length,
      available: catalog.filter(m => m.status === 'available').length,
      not_configured: catalog.filter(m => m.status === 'not_configured').length,
    };
  }, [catalog]);

  return (
    <div className="all-models-tab">
      {/* Toolbar */}
      <div className="all-models-tab__toolbar">
        {/* Search */}
        <div className="all-models-tab__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div className="all-models-tab__filter">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All ({statusCounts.all})</option>
            <option value="ready">Ready ({statusCounts.ready})</option>
            <option value="available">Available ({statusCounts.available})</option>
            <option value="not_configured">Setup Required ({statusCounts.not_configured})</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="all-models-tab__content">
        {/* Model List */}
        <div className="all-models-tab__list">
          {Array.from(groupedCatalog.entries()).map(([provider, models]) => (
            <div key={provider} className="all-models-tab__provider-group">
              {/* Provider Header */}
              <button
                className="all-models-tab__provider-header"
                onClick={() => toggleProvider(provider)}
              >
                <span className={`all-models-tab__provider-arrow ${expandedProviders.has(provider) ? 'expanded' : ''}`}>
                  {expandedProviders.has(provider) ? '>' : '>'}
                </span>
                <span className="all-models-tab__provider-name">
                  {getProviderDisplayName(provider)}
                </span>
                <span className="all-models-tab__provider-count">
                  ({models.length} models)
                </span>
              </button>

              {/* Provider Models */}
              {expandedProviders.has(provider) && (
                <div className="all-models-tab__provider-models">
                  {models.map((model) => (
                    <ModelListItem
                      key={model.id}
                      model={model}
                      isSelected={selectedModel?.id === model.id}
                      isInCompare={isInCompare(model.id)}
                      onSelect={() => setSelectedModel(model)}
                      onAddToCompare={() => onAddToCompare(model)}
                      onRemoveFromCompare={() => onRemoveFromCompare(model.id)}
                      onConfigure={() => onConfigure(model)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {filteredCatalog.length === 0 && (
            <div className="all-models-tab__empty">
              <p>No models match your search criteria.</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="all-models-tab__detail">
          {selectedModel ? (
            <ModelDetailPanel
              model={selectedModel}
              onConfigure={() => onConfigure(selectedModel)}
              onAddToCompare={() => onAddToCompare(selectedModel)}
              isInCompare={isInCompare(selectedModel.id)}
            />
          ) : (
            <div className="all-models-tab__detail-placeholder">
              <p>Select a model to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="all-models-tab__legend">
        <span className="all-models-tab__legend-item all-models-tab__legend-item--ready">
          Ready
        </span>
        <span className="all-models-tab__legend-item all-models-tab__legend-item--available">
          Available
        </span>
        <span className="all-models-tab__legend-item all-models-tab__legend-item--not-configured">
          Setup Required
        </span>
      </div>
    </div>
  );
}
