/**
 * ModelListItem Component
 *
 * List item displaying a model summary.
 */

import { Check } from 'lucide-react';
import { ProviderIcon, getProviderName } from '../icons/ProviderIcons';
import { CapabilityIcon, getCapabilityShortName } from '../icons/CapabilityIcons';
import { getCostTier } from '../../types/model.types';
import type { Model } from '../../types/model.types';
import './ModelListItem.scss';

export interface ModelListItemProps {
  model: Model;
  isSelected: boolean;
  onSelect: () => void;
}

export function ModelListItem({ model, isSelected, onSelect }: ModelListItemProps) {
  const costTier = getCostTier(model);

  const costSymbol = {
    free: 'FREE',
    low: '$',
    medium: '$$',
    high: '$$$',
    premium: '$$$$',
  }[costTier];

  return (
    <div
      className={`model-list-item ${isSelected ? 'model-list-item--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="model-list-item__header">
        <ProviderIcon provider={model.provider} size={20} />
        <div className="model-list-item__name-container">
          <div className="model-list-item__name">{model.displayName}</div>
          <div className="model-list-item__provider">{getProviderName(model.provider)}</div>
        </div>
        <div className="model-list-item__badges">
          {model.isLocal && (
            <span className="model-list-item__badge model-list-item__badge--local">Local</span>
          )}
          {!model.isAvailable && (
            <span className="model-list-item__badge model-list-item__badge--unavailable">
              Offline
            </span>
          )}
        </div>
      </div>

      <div className="model-list-item__meta">
        <div className="model-list-item__capabilities">
          {model.capabilities.slice(0, 4).map((cap) => (
            <div
              key={cap}
              className="model-list-item__capability"
              title={getCapabilityShortName(cap)}
            >
              <CapabilityIcon capability={cap} size={14} />
            </div>
          ))}
          {model.capabilities.length > 4 && (
            <span className="model-list-item__capability-more">
              +{model.capabilities.length - 4}
            </span>
          )}
        </div>
        <div className="model-list-item__cost">{costSymbol}</div>
      </div>

      <div
        className={`model-list-item__status model-list-item__status--${model.isAvailable ? 'online' : 'offline'}`}
      >
        {model.isAvailable && <Check size={12} />}
      </div>
    </div>
  );
}
