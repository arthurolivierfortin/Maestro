/**
 * Model Configure Dialog
 *
 * Dialog for configuring a model (API key, endpoint, etc.)
 * Content varies based on model status and provider.
 */

import { useState } from 'react';
import { X, Key, Globe, AlertCircle, CheckCircle, Download, Settings } from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import { getStatusDisplayInfo } from '../../types/modelStatus.types';
import { getProviderDisplayName } from '../../data/modelCatalog';
import './ModelConfigureDialog.scss';

interface ModelConfigureDialogProps {
  model: ModelCatalogEntry;
  onClose: () => void;
  onSave: (config: { apiKey?: string; endpoint?: string }) => Promise<void>;
}

export function ModelConfigureDialog({ model, onClose, onSave }: ModelConfigureDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState(model.configuration?.apiEndpoint || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const statusInfo = getStatusDisplayInfo(model.status);
  const isLocalModel = model.provider === 'local' || model.provider === 'llm-provider';

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave({ apiKey: apiKey || undefined, endpoint: endpoint || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle test connection
  const handleTest = async () => {
    setTestResult(null);
    setError(null);

    try {
      // TODO: Implement actual connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTestResult('success');
    } catch (err) {
      setTestResult('error');
      setError('Connection test failed');
    }
  };

  // Handle download (for local models)
  const handleDownload = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // TODO: Implement model download
      await new Promise(resolve => setTimeout(resolve, 2000));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download model');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="model-configure-dialog__overlay" onClick={onClose}>
      <div className="model-configure-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="model-configure-dialog__header">
          <div className="model-configure-dialog__title">
            <Settings size={20} />
            <h2>{model.status === 'available' ? 'Setup' : 'Configure'} {model.displayName}</h2>
          </div>
          <button className="model-configure-dialog__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Status Badge */}
        <div className={`model-configure-dialog__status model-configure-dialog__status--${statusInfo.colorClass}`}>
          {statusInfo.label}
        </div>

        {/* Content */}
        <div className="model-configure-dialog__content">
          {/* Model Info */}
          <div className="model-configure-dialog__info">
            <span className="model-configure-dialog__provider">
              Provider: {getProviderDisplayName(model.provider)}
            </span>
            {model.description && (
              <p className="model-configure-dialog__description">{model.description}</p>
            )}
          </div>

          {/* Configuration Steps (for not_configured models) */}
          {model.status === 'not_configured' && model.configurationSteps && (
            <div className="model-configure-dialog__steps">
              <h4>Setup Steps:</h4>
              <ol>
                {model.configurationSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Download Info (for available local models) */}
          {model.status === 'available' && isLocalModel && (
            <div className="model-configure-dialog__download-info">
              <Download size={24} />
              <h4>Ready to Download</h4>
              <p>This model will be downloaded and configured automatically.</p>
              {model.setupInfo?.requirements && (
                <div className="model-configure-dialog__requirements">
                  <h5>Requirements:</h5>
                  <ul>
                    {model.setupInfo.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* API Key Input (for cloud providers) */}
          {!isLocalModel && (
            <div className="model-configure-dialog__field">
              <label>
                <Key size={14} />
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={model.configuration?.hasApiKey ? '••••••••' : 'Enter API key...'}
              />
              <span className="model-configure-dialog__hint">
                Your API key is stored locally and never sent to our servers.
              </span>
            </div>
          )}

          {/* Endpoint Input */}
          <div className="model-configure-dialog__field">
            <label>
              <Globe size={14} />
              API Endpoint {isLocalModel ? '' : '(Optional)'}
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={isLocalModel ? 'http://localhost:11434' : 'Leave empty for default'}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`model-configure-dialog__test-result model-configure-dialog__test-result--${testResult}`}>
              {testResult === 'success' ? (
                <>
                  <CheckCircle size={16} />
                  Connection successful
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  Connection failed
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="model-configure-dialog__error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="model-configure-dialog__footer">
          <button className="model-configure-dialog__btn" onClick={onClose}>
            Cancel
          </button>

          {!isLocalModel && (
            <button
              className="model-configure-dialog__btn"
              onClick={handleTest}
              disabled={isSaving}
            >
              Test Connection
            </button>
          )}

          {model.status === 'available' && isLocalModel ? (
            <button
              className="model-configure-dialog__btn model-configure-dialog__btn--primary"
              onClick={handleDownload}
              disabled={isSaving}
            >
              <Download size={16} />
              {isSaving ? 'Downloading...' : 'Download & Setup'}
            </button>
          ) : (
            <button
              className="model-configure-dialog__btn model-configure-dialog__btn--primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
