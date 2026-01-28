/**
 * Model List Item
 *
 * Status-aware list item for displaying a model in the catalog.
 * Visual treatment varies based on status (ready, available, not_configured).
 */

import { CheckCircle, Download, Circle, Loader, AlertCircle, Plus, Minus, Settings } from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import { getStatusDisplayInfo, getPrimaryAction } from '../../types/modelStatus.types';
import './ModelListItem.scss';

interface ModelListItemProps {
  model: ModelCatalogEntry;
  isSelected: boolean;
  isInCompare: boolean;
  onSelect: () => void;
  onAddToCompare: () => void;
  onRemoveFromCompare: () => void;
  onConfigure: () => void;
}

export function ModelListItem({
  model,
  isSelected,
  isInCompare,
  onSelect,
  onAddToCompare,
  onRemoveFromCompare,
  onConfigure,
}: ModelListItemProps) {
  const statusInfo = getStatusDisplayInfo(model.status);
  const primaryAction = getPrimaryAction(model.status);

  // Get status icon
  const StatusIcon = () => {
    switch (statusInfo.icon) {
      case 'check':
        return <CheckCircle size={14} />;
      case 'download':
        return <Download size={14} />;
      case 'loader':
        return <Loader size={14} className="spinning" />;
      case 'alert':
        return <AlertCircle size={14} />;
      default:
        return <Circle size={14} />;
    }
  };

  // Handle primary action click
  const handlePrimaryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (primaryAction.action === 'configure' || primaryAction.action === 'setup') {
      onConfigure();
    }
    // TODO: Handle test and retry actions
  };

  // Handle compare toggle
  const handleCompareToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInCompare) {
      onRemoveFromCompare();
    } else {
      onAddToCompare();
    }
  };

  return (
    <div
      className={`model-list-item model-list-item--${model.status} ${isSelected ? 'model-list-item--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {/* Status Indicator */}
      <div className={`model-list-item__status model-list-item__status--${statusInfo.colorClass}`}>
        <StatusIcon />
      </div>

      {/* Model Info */}
      <div className="model-list-item__info">
        <span className="model-list-item__name">{model.displayName}</span>
        <span className="model-list-item__meta">
          {model.specs.contextWindow >= 1000000
            ? `${(model.specs.contextWindow / 1000000).toFixed(1)}M ctx`
            : `${Math.round(model.specs.contextWindow / 1000)}K ctx`}
          {model.specs.parameterCount && ` | ${model.specs.parameterCount}`}
        </span>
      </div>

      {/* Status Badge */}
      <span className={`model-list-item__badge model-list-item__badge--${statusInfo.colorClass}`}>
        {model.status === 'downloading' && model.downloadProgress !== undefined
          ? `${model.downloadProgress}%`
          : statusInfo.label}
      </span>

      {/* Actions */}
      <div className="model-list-item__actions">
        {/* Compare Toggle */}
        <button
          className={`model-list-item__action ${isInCompare ? 'model-list-item__action--active' : ''}`}
          onClick={handleCompareToggle}
          title={isInCompare ? 'Remove from compare' : 'Add to compare'}
        >
          {isInCompare ? <Minus size={14} /> : <Plus size={14} />}
        </button>

        {/* Primary Action */}
        {primaryAction.action !== 'none' && model.status !== 'downloading' && (
          <button
            className={`model-list-item__action model-list-item__action--primary`}
            onClick={handlePrimaryAction}
            title={primaryAction.label}
          >
            {primaryAction.action === 'configure' || primaryAction.action === 'setup' ? (
              <Settings size={14} />
            ) : (
              primaryAction.label
            )}
          </button>
        )}
      </div>
    </div>
  );
}
