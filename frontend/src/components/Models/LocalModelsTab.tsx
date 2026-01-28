/**
 * Local Models Tab
 *
 * Focused view on local/downloadable models.
 * Shows Ollama and LLM-Provider models with download/setup options.
 * Uses same provider icons and status styling as All Models tab.
 */

import { useState } from 'react';
import { Search, RefreshCw, Download, HardDrive } from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import { getStatusDisplayInfo } from '../../types/modelStatus.types';
import { ProviderIcon } from '../icons/ProviderIcons';
import type { ProviderIconStatus } from '../icons/ProviderIcons';
import type { ModelProvider } from '../../types/model.types';
import './LocalModelsTab.scss';

interface LocalModelsTabProps {
  catalog: ModelCatalogEntry[];
  onConfigure: (model: ModelCatalogEntry) => void;
}

export function LocalModelsTab({ catalog, onConfigure }: LocalModelsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Filter by search
  const filteredModels = searchQuery.trim()
    ? catalog.filter(m =>
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : catalog;

  // Handle scan for local models
  const handleScan = async () => {
    setIsScanning(true);
    // TODO: Implement scanning for installed Ollama models
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsScanning(false);
  };

  // Get provider icon with status styling (same as All Models)
  const getProviderIconWithStatus = (model: ModelCatalogEntry) => {
    const status = model.status as ProviderIconStatus;
    return (
      <ProviderIcon
        provider={model.provider as ModelProvider}
        size={20}
        status={status}
      />
    );
  };

  // Format size (estimated)
  const getEstimatedSize = (parameterCount?: string): string => {
    if (!parameterCount) return 'Unknown';
    const num = parseFloat(parameterCount);
    if (parameterCount.includes('x')) {
      // MoE models
      return '~26 GB';
    }
    if (num <= 1.5) return '~1 GB';
    if (num <= 3) return '~2 GB';
    if (num <= 7) return '~4 GB';
    if (num <= 13) return '~7 GB';
    if (num <= 34) return '~20 GB';
    if (num <= 70) return '~40 GB';
    return '~50+ GB';
  };

  return (
    <div className="local-models-tab">
      {/* Header */}
      <div className="local-models-tab__header">
        <div className="local-models-tab__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search local models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="local-models-tab__actions">
          <button
            className="local-models-tab__action"
            onClick={handleScan}
            disabled={isScanning}
          >
            <RefreshCw size={16} className={isScanning ? 'spinning' : ''} />
            Scan for Models
          </button>
          <button className="local-models-tab__action local-models-tab__action--primary">
            <Download size={16} />
            Download Model
          </button>
        </div>
      </div>

      {/* Model Table */}
      <div className="local-models-tab__table-container">
        <table className="local-models-tab__table">
          <thead>
            <tr>
              <th>Model Name</th>
              <th>Size (Est.)</th>
              <th>Parameters</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.map((model) => {
              const statusInfo = getStatusDisplayInfo(model.status);
              return (
                <tr
                  key={model.id}
                  className={`local-models-tab__row local-models-tab__row--${model.status}`}
                >
                  <td>
                    <div className="local-models-tab__model-name">
                      {getProviderIconWithStatus(model)}
                      <div>
                        <span className="local-models-tab__name">{model.displayName}</span>
                        {model.description && (
                          <span className="local-models-tab__description">{model.description}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{getEstimatedSize(model.specs.parameterCount)}</td>
                  <td>{model.specs.parameterCount || '-'}</td>
                  <td>
                    <span className={`local-models-tab__status local-models-tab__status--${statusInfo.colorClass}`}>
                      {model.status === 'downloading' && model.downloadProgress !== undefined
                        ? `${model.downloadProgress}%`
                        : statusInfo.label}
                    </span>
                  </td>
                  <td>
                    {model.status === 'ready' && (
                      <button
                        className="local-models-tab__btn"
                        onClick={() => onConfigure(model)}
                      >
                        Test
                      </button>
                    )}
                    {model.status === 'available' && (
                      <button
                        className="local-models-tab__btn local-models-tab__btn--primary"
                        onClick={() => onConfigure(model)}
                      >
                        Setup
                      </button>
                    )}
                    {model.status === 'downloading' && (
                      <button className="local-models-tab__btn" disabled>
                        Downloading...
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredModels.length === 0 && (
          <div className="local-models-tab__empty">
            <HardDrive size={48} />
            <h3>No Local Models Found</h3>
            <p>Install Ollama and download models, or use LLM-Provider for auto-setup.</p>
          </div>
        )}
      </div>

      {/* Legend - matches All Models style */}
      <div className="local-models-tab__legend">
        <span className="local-models-tab__legend-item local-models-tab__legend-item--ready">
          Ready
        </span>
        <span className="local-models-tab__legend-item local-models-tab__legend-item--available">
          Available
        </span>
        <span className="local-models-tab__legend-item local-models-tab__legend-item--not-configured">
          Not Configured
        </span>
      </div>
    </div>
  );
}
