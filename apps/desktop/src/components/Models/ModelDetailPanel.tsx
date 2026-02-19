/**
 * Model Detail Panel
 *
 * Status-aware detail view for a selected model.
 * Shows different content based on model status.
 */

import {
  CheckCircle,
  Download,
  Circle,
  AlertCircle,
  Eye,
  Wrench,
  Zap,
  DollarSign,
  MessageSquare,
  Plus,
  Settings,
  Play,
} from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import { getStatusDisplayInfo } from '../../types/modelStatus.types';
import { getProviderDisplayName } from '../../data/modelCatalog';
import './ModelDetailPanel.scss';

interface ModelDetailPanelProps {
  model: ModelCatalogEntry;
  onConfigure: () => void;
  onAddToCompare: () => void;
  isInCompare: boolean;
}

export function ModelDetailPanel({
  model,
  onConfigure,
  onAddToCompare,
  isInCompare,
}: ModelDetailPanelProps) {
  const statusInfo = getStatusDisplayInfo(model.status);

  // Format price
  const formatPrice = (pricePerMillion?: number) => {
    if (pricePerMillion === undefined || pricePerMillion === 0) return 'Free';
    if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(3)}/1M`;
    return `$${pricePerMillion.toFixed(2)}/1M`;
  };

  // Format context window
  const formatContext = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M tokens`;
    return `${Math.round(tokens / 1000)}K tokens`;
  };

  // Get status icon
  const StatusIcon = () => {
    switch (statusInfo.icon) {
      case 'check':
        return <CheckCircle size={16} />;
      case 'download':
        return <Download size={16} />;
      case 'alert':
        return <AlertCircle size={16} />;
      default:
        return <Circle size={16} />;
    }
  };

  return (
    <div className="model-detail-panel">
      {/* Header */}
      <div className="model-detail-panel__header">
        <h2 className="model-detail-panel__title">{model.displayName}</h2>
        <div className={`model-detail-panel__status model-detail-panel__status--${statusInfo.colorClass}`}>
          <StatusIcon />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Provider & Description */}
      <div className="model-detail-panel__section">
        <div className="model-detail-panel__provider">
          Provider: {getProviderDisplayName(model.provider)}
        </div>
        {model.description && (
          <p className="model-detail-panel__description">{model.description}</p>
        )}
      </div>

      {/* Specifications */}
      <div className="model-detail-panel__section">
        <h3 className="model-detail-panel__section-title">Specifications</h3>
        <div className="model-detail-panel__specs">
          <div className="model-detail-panel__spec">
            <MessageSquare size={14} />
            <span className="model-detail-panel__spec-label">Context</span>
            <span className="model-detail-panel__spec-value">
              {formatContext(model.specs.contextWindow)}
            </span>
          </div>
          <div className="model-detail-panel__spec">
            <DollarSign size={14} />
            <span className="model-detail-panel__spec-label">Input</span>
            <span className="model-detail-panel__spec-value">
              {formatPrice(model.specs.inputPricePerMillion)}
            </span>
          </div>
          <div className="model-detail-panel__spec">
            <DollarSign size={14} />
            <span className="model-detail-panel__spec-label">Output</span>
            <span className="model-detail-panel__spec-value">
              {formatPrice(model.specs.outputPricePerMillion)}
            </span>
          </div>
          {model.specs.parameterCount && (
            <div className="model-detail-panel__spec">
              <Zap size={14} />
              <span className="model-detail-panel__spec-label">Parameters</span>
              <span className="model-detail-panel__spec-value">{model.specs.parameterCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div className="model-detail-panel__section">
        <h3 className="model-detail-panel__section-title">Capabilities</h3>
        <div className="model-detail-panel__capabilities">
          {model.specs.supportsVision && (
            <span className="model-detail-panel__capability">
              <Eye size={12} /> Vision
            </span>
          )}
          {model.specs.supportsToolUse && (
            <span className="model-detail-panel__capability">
              <Wrench size={12} /> Tool Use
            </span>
          )}
          {model.specs.supportsStreaming && (
            <span className="model-detail-panel__capability">
              <Zap size={12} /> Streaming
            </span>
          )}
          {model.specs.capabilities.map((cap) => (
            <span key={cap} className="model-detail-panel__capability">
              {cap}
            </span>
          ))}
        </div>
      </div>

      {/* Quality Tier */}
      <div className="model-detail-panel__section">
        <h3 className="model-detail-panel__section-title">Quality</h3>
        <div className={`model-detail-panel__quality model-detail-panel__quality--${model.specs.qualityTier}`}>
          {model.specs.qualityTier.charAt(0).toUpperCase() + model.specs.qualityTier.slice(1)}
        </div>
      </div>

      {/* Status-Specific Content */}
      {model.status === 'ready' && model.configuration && (
        <div className="model-detail-panel__section">
          <h3 className="model-detail-panel__section-title">Configuration</h3>
          <div className="model-detail-panel__config">
            {model.configuration.apiEndpoint && (
              <div className="model-detail-panel__config-item">
                <span className="model-detail-panel__config-label">Endpoint:</span>
                <span className="model-detail-panel__config-value">
                  {model.configuration.apiEndpoint}
                </span>
              </div>
            )}
            <div className="model-detail-panel__config-item">
              <span className="model-detail-panel__config-label">API Key:</span>
              <span className="model-detail-panel__config-value">
                {model.configuration.hasApiKey ? '****...****' : 'Not set'}
              </span>
            </div>
            {model.configuration.lastTested && (
              <div className="model-detail-panel__config-item">
                <span className="model-detail-panel__config-label">Last tested:</span>
                <span className="model-detail-panel__config-value">
                  {model.configuration.lastTested}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {model.status === 'available' && model.setupInfo && (
        <div className="model-detail-panel__section model-detail-panel__section--highlight">
          <h3 className="model-detail-panel__section-title">Ready to Setup</h3>
          <p className="model-detail-panel__setup-info">
            {model.setupInfo.setupType === 'download'
              ? 'This model can be downloaded and run locally.'
              : 'This model can be automatically configured via LLM-Provider.'}
          </p>
          {model.setupInfo.requirements && (
            <ul className="model-detail-panel__requirements">
              {model.setupInfo.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {model.status === 'not_configured' && model.configurationSteps && (
        <div className="model-detail-panel__section model-detail-panel__section--muted">
          <h3 className="model-detail-panel__section-title">Setup Required</h3>
          <p className="model-detail-panel__setup-info">
            To use this model, complete the following steps:
          </p>
          <ol className="model-detail-panel__steps">
            {model.configurationSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Actions */}
      <div className="model-detail-panel__actions">
        {model.status === 'ready' && (
          <>
            <button className="model-detail-panel__action model-detail-panel__action--primary">
              <Play size={16} />
              Test
            </button>
            <button className="model-detail-panel__action" onClick={onConfigure}>
              <Settings size={16} />
              Edit
            </button>
          </>
        )}

        {model.status === 'available' && (
          <button className="model-detail-panel__action model-detail-panel__action--primary" onClick={onConfigure}>
            <Download size={16} />
            {model.setupInfo?.setupType === 'download' ? 'Download & Setup' : 'Setup'}
          </button>
        )}

        {model.status === 'not_configured' && (
          <button className="model-detail-panel__action model-detail-panel__action--primary" onClick={onConfigure}>
            <Settings size={16} />
            Configure
          </button>
        )}

        {!isInCompare && (
          <button className="model-detail-panel__action" onClick={onAddToCompare}>
            <Plus size={16} />
            Add to Compare
          </button>
        )}
      </div>
    </div>
  );
}
