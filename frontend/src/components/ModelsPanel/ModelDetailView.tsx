/**
 * ModelDetailView Component
 *
 * Detailed view of a single model.
 */

import { useState } from 'react';
import { Edit2, Trash2, TestTube, ExternalLink } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { ProviderIcon, getProviderName } from '../icons/ProviderIcons';
import { CapabilityIcon, getCapabilityName } from '../icons/CapabilityIcons';
import { getCostTier } from '../../types/model.types';
import type { Model } from '../../types/model.types';
import './ModelDetailView.scss';

export interface ModelDetailViewProps {
  model: Model;
}

export function ModelDetailView({ model }: ModelDetailViewProps) {
  const removeModel = useModelStore((state) => state.removeModel);
  const testModelConnection = useModelStore((state) => state.testModelConnection);
  const defaultModelId = useModelStore((state) => state.defaultModelId);
  const setDefaultModel = useModelStore((state) => state.setDefaultModel);

  const [isTesting, setIsTesting] = useState(false);

  const costTier = getCostTier(model);
  const isDefault = defaultModelId === model.id;

  const handleTest = async () => {
    setIsTesting(true);
    await testModelConnection(model.id);
    setIsTesting(false);
  };

  const handleSetDefault = () => {
    setDefaultModel(model.id);
  };

  const handleEdit = () => {
    // TODO: Open edit modal
    console.log('Edit model:', model.id);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${model.displayName}"?`)) {
      removeModel(model.id);
    }
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return 'Free';
    return `$${(cost * 1000).toFixed(4)}/1k tokens`;
  };

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M tokens`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k tokens`;
    return `${tokens} tokens`;
  };

  return (
    <div className="model-detail">
      <div className="model-detail__header">
        <div className="model-detail__title-row">
          <ProviderIcon provider={model.provider} size={32} />
          <div className="model-detail__title-info">
            <h3 className="model-detail__title">{model.displayName}</h3>
            <div className="model-detail__subtitle">{getProviderName(model.provider)}</div>
          </div>
        </div>
        <div className="model-detail__actions">
          <button className="model-detail__action-btn" onClick={handleTest} disabled={isTesting}>
            <TestTube size={16} />
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button className="model-detail__action-btn" onClick={handleEdit}>
            <Edit2 size={16} />
          </button>
          <button className="model-detail__action-btn model-detail__action-btn--danger" onClick={handleDelete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {model.description && (
        <div className="model-detail__description">{model.description}</div>
      )}

      <div className="model-detail__section">
        <h4 className="model-detail__section-title">Status</h4>
        <div className="model-detail__badges">
          <div className={`model-detail__badge model-detail__badge--${model.isAvailable ? 'success' : 'error'}`}>
            {model.isAvailable ? 'Available' : 'Unavailable'}
          </div>
          {model.isLocal && (
            <div className="model-detail__badge model-detail__badge--info">Local</div>
          )}
          {isDefault && (
            <div className="model-detail__badge model-detail__badge--primary">Default</div>
          )}
        </div>
        {!isDefault && (
          <button className="model-detail__set-default-btn" onClick={handleSetDefault}>
            Set as Default
          </button>
        )}
      </div>

      <div className="model-detail__section">
        <h4 className="model-detail__section-title">Capabilities</h4>
        <div className="model-detail__capabilities">
          {model.capabilities.map((cap) => (
            <div key={cap} className="model-detail__capability">
              <CapabilityIcon capability={cap} size={16} />
              <span>{getCapabilityName(cap)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="model-detail__section">
        <h4 className="model-detail__section-title">Specifications</h4>
        <div className="model-detail__specs">
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Context Window:</span>
            <span className="model-detail__spec-value">{formatContextWindow(model.contextWindow)}</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Max Output:</span>
            <span className="model-detail__spec-value">{formatContextWindow(model.maxOutputTokens)}</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Speed Rating:</span>
            <span className="model-detail__spec-value">{model.speedRating}/10</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Streaming:</span>
            <span className="model-detail__spec-value">{model.supportsStreaming ? 'Yes' : 'No'}</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Tool Calls:</span>
            <span className="model-detail__spec-value">{model.supportsToolCalls ? 'Yes' : 'No'}</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Vision:</span>
            <span className="model-detail__spec-value">{model.supportsVision ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div className="model-detail__section">
        <h4 className="model-detail__section-title">Cost</h4>
        <div className="model-detail__specs">
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Input Tokens:</span>
            <span className="model-detail__spec-value">{formatCost(model.costPerInputToken)}</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Output Tokens:</span>
            <span className="model-detail__spec-value">{formatCost(model.costPerOutputToken)}</span>
          </div>
          <div className="model-detail__spec">
            <span className="model-detail__spec-label">Cost Tier:</span>
            <span className="model-detail__spec-value">{costTier}</span>
          </div>
        </div>
      </div>

      {Object.keys(model.qualityRatings).length > 0 && (
        <div className="model-detail__section">
          <h4 className="model-detail__section-title">Quality Ratings</h4>
          <div className="model-detail__quality-ratings">
            {Object.entries(model.qualityRatings).map(([taskType, rating]) => (
              <div key={taskType} className="model-detail__quality-rating">
                <span className="model-detail__quality-label">{taskType}:</span>
                <div className="model-detail__quality-bar">
                  <div
                    className="model-detail__quality-fill"
                    style={{ width: `${(rating / 10) * 100}%` }}
                  />
                </div>
                <span className="model-detail__quality-value">{rating}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {model.strengths && model.strengths.length > 0 && (
        <div className="model-detail__section">
          <h4 className="model-detail__section-title">Strengths</h4>
          <ul className="model-detail__list">
            {model.strengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {model.weaknesses && model.weaknesses.length > 0 && (
        <div className="model-detail__section">
          <h4 className="model-detail__section-title">Weaknesses</h4>
          <ul className="model-detail__list">
            {model.weaknesses.map((weakness, i) => (
              <li key={i}>{weakness}</li>
            ))}
          </ul>
        </div>
      )}

      {model.apiEndpoint && (
        <div className="model-detail__section">
          <h4 className="model-detail__section-title">API Endpoint</h4>
          <div className="model-detail__endpoint">
            <code>{model.apiEndpoint}</code>
            <button
              className="model-detail__endpoint-btn"
              onClick={() => window.open(model.apiEndpoint, '_blank')}
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
