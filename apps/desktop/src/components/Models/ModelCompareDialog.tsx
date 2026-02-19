/**
 * Model Compare Dialog
 *
 * Side-by-side comparison of selected models.
 * Works with any models regardless of status.
 */

import { X, CheckCircle, Download, Circle, DollarSign, MessageSquare, Eye, Wrench, Zap } from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import { getStatusDisplayInfo } from '../../types/modelStatus.types';
import { getProviderDisplayName } from '../../data/modelCatalog';
import './ModelCompareDialog.scss';

interface ModelCompareDialogProps {
  models: ModelCatalogEntry[];
  onClose: () => void;
  onRemove: (modelId: string) => void;
}

export function ModelCompareDialog({ models, onClose, onRemove }: ModelCompareDialogProps) {
  // Format price
  const formatPrice = (pricePerMillion?: number) => {
    if (pricePerMillion === undefined || pricePerMillion === 0) return 'Free';
    if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(3)}`;
    return `$${pricePerMillion.toFixed(2)}`;
  };

  // Format context window
  const formatContext = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    return `${Math.round(tokens / 1000)}K`;
  };

  // Get status icon
  const StatusIcon = ({ status }: { status: ModelCatalogEntry['status'] }) => {
    const info = getStatusDisplayInfo(status);
    switch (info.icon) {
      case 'check':
        return <CheckCircle size={14} className={`compare-status--${info.colorClass}`} />;
      case 'download':
        return <Download size={14} className={`compare-status--${info.colorClass}`} />;
      default:
        return <Circle size={14} className={`compare-status--${info.colorClass}`} />;
    }
  };

  return (
    <div className="model-compare-dialog__overlay" onClick={onClose}>
      <div className="model-compare-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="model-compare-dialog__header">
          <h2>Compare Models</h2>
          <button className="model-compare-dialog__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Comparison Table */}
        <div className="model-compare-dialog__content">
          <table className="model-compare-dialog__table">
            <thead>
              <tr>
                <th className="model-compare-dialog__label-cell">Property</th>
                {models.map((model) => (
                  <th key={model.id} className="model-compare-dialog__model-cell">
                    <div className="model-compare-dialog__model-header">
                      <span className="model-compare-dialog__model-name">{model.displayName}</span>
                      <button
                        className="model-compare-dialog__remove"
                        onClick={() => onRemove(model.id)}
                        title="Remove from comparison"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Status */}
              <tr>
                <td className="model-compare-dialog__label-cell">Status</td>
                {models.map((model) => {
                  const statusInfo = getStatusDisplayInfo(model.status);
                  return (
                    <td key={model.id} className="model-compare-dialog__value-cell">
                      <span className={`model-compare-dialog__status model-compare-dialog__status--${statusInfo.colorClass}`}>
                        <StatusIcon status={model.status} />
                        {statusInfo.label}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Provider */}
              <tr>
                <td className="model-compare-dialog__label-cell">Provider</td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {getProviderDisplayName(model.provider)}
                  </td>
                ))}
              </tr>

              {/* Context Window */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <MessageSquare size={14} /> Context Window
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {formatContext(model.specs.contextWindow)}
                  </td>
                ))}
              </tr>

              {/* Input Cost */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <DollarSign size={14} /> Input Cost (per 1M)
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {formatPrice(model.specs.inputPricePerMillion)}
                  </td>
                ))}
              </tr>

              {/* Output Cost */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <DollarSign size={14} /> Output Cost (per 1M)
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {formatPrice(model.specs.outputPricePerMillion)}
                  </td>
                ))}
              </tr>

              {/* Parameters */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <Zap size={14} /> Parameters
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {model.specs.parameterCount || '-'}
                  </td>
                ))}
              </tr>

              {/* Vision Support */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <Eye size={14} /> Vision
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {model.specs.supportsVision ? (
                      <CheckCircle size={16} className="model-compare-dialog__check" />
                    ) : (
                      <span className="model-compare-dialog__na">-</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Tool Use */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <Wrench size={14} /> Tool Use
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {model.specs.supportsToolUse ? (
                      <CheckCircle size={16} className="model-compare-dialog__check" />
                    ) : (
                      <span className="model-compare-dialog__na">-</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Streaming */}
              <tr>
                <td className="model-compare-dialog__label-cell">
                  <Zap size={14} /> Streaming
                </td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    {model.specs.supportsStreaming ? (
                      <CheckCircle size={16} className="model-compare-dialog__check" />
                    ) : (
                      <span className="model-compare-dialog__na">-</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Quality Tier */}
              <tr>
                <td className="model-compare-dialog__label-cell">Quality Tier</td>
                {models.map((model) => (
                  <td key={model.id} className="model-compare-dialog__value-cell">
                    <span className={`model-compare-dialog__quality model-compare-dialog__quality--${model.specs.qualityTier}`}>
                      {model.specs.qualityTier.charAt(0).toUpperCase() + model.specs.qualityTier.slice(1)}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer with actions for non-ready models */}
        <div className="model-compare-dialog__footer">
          {models.filter(m => m.status !== 'ready').map((model) => (
            <button key={model.id} className="model-compare-dialog__action">
              {model.status === 'available' ? 'Download' : 'Configure'} {model.displayName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
