/**
 * ModelListItem Component
 *
 * List item displaying a model summary.
 * Supports three-tier status system:
 * - ready: Full color icon (configured and working)
 * - available: Grayscale icon (can be auto-setup)
 * - not_configured: Faded icon (requires manual setup)
 */

import { Check, Download, Settings } from 'lucide-react';
import { ProviderIcon, getProviderName } from '../icons/ProviderIcons';
import type { ProviderIconStatus } from '../icons/ProviderIcons';
import { CapabilityIcon, getCapabilityShortName } from '../icons/CapabilityIcons';
import { getCostTier } from '../../types/model.types';
import type { Model } from '../../types/model.types';
import './ModelListItem.scss';

export type ModelItemStatus = 'ready' | 'available' | 'not_configured' | 'downloading' | 'error';

export interface ModelListItemProps {
  model: Model;
  isSelected: boolean;
  onSelect: () => void;
  /** Status affects icon styling: ready=color, available=grayscale, not_configured=faded */
  status?: ModelItemStatus;
}

export function ModelListItem({ model, isSelected, onSelect, status }: ModelListItemProps) {
  const costTier = getCostTier(model);

  // Determine status from model if not explicitly provided
  const effectiveStatus: ModelItemStatus = status ?? (model.isAvailable ? 'ready' : 'not_configured');

  const costSymbol = {
    free: 'FREE',
    low: '$',
    medium: '$$',
    high: '$$$',
    premium: '$$$$',
  }[costTier];

  // Get status badge info
  const getStatusBadge = () => {
    switch (effectiveStatus) {
      case 'ready':
        return null; // No badge needed for ready
      case 'available':
        return { label: 'Setup', icon: Download, className: 'available' };
      case 'not_configured':
        return { label: 'Configure', icon: Settings, className: 'not-configured' };
      case 'downloading':
        return { label: 'Downloading', icon: null, className: 'downloading' };
      case 'error':
        return { label: 'Error', icon: null, className: 'error' };
      default:
        return null;
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div
      className={`model-list-item model-list-item--${effectiveStatus} ${isSelected ? 'model-list-item--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="model-list-item__header">
        <ProviderIcon
          provider={model.provider}
          size={20}
          status={effectiveStatus as ProviderIconStatus}
        />
        <div className="model-list-item__name-container">
          <div className="model-list-item__name">{model.displayName}</div>
          <div className="model-list-item__provider">{getProviderName(model.provider)}</div>
        </div>
        <div className="model-list-item__badges">
          {model.isLocal && effectiveStatus === 'ready' && (
            <span className="model-list-item__badge model-list-item__badge--local">Local</span>
          )}
          {statusBadge && (
            <span className={`model-list-item__badge model-list-item__badge--${statusBadge.className}`}>
              {statusBadge.icon && <statusBadge.icon size={10} />}
              {statusBadge.label}
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

      {effectiveStatus === 'ready' && (
        <div className="model-list-item__status model-list-item__status--online">
          <Check size={12} />
        </div>
      )}
    </div>
  );
}
