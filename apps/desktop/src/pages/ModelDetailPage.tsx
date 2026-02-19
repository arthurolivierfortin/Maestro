/**
 * Model Detail Page
 *
 * Full page view for a specific model.
 * Matches the original ModelDetailView style.
 * Includes real benchmark data from the API.
 * Uses consistent model status logic via useModelStatus hook.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  TestTube,
  ExternalLink,
  Play,
  Zap,
  Clock,
  RefreshCw,
  AlertCircle,
  Download,
  Settings,
} from 'lucide-react';
import { useModelStore } from '../store/modelStore';
import { ALL_MODEL_DEFINITIONS } from '../data/modelCatalog';
import { useModelStatus } from '../hooks/useModelStatus';
import { ProviderIcon, getProviderName } from '../components/icons/ProviderIcons';
import { CapabilityIcon, getCapabilityName } from '../components/icons/CapabilityIcons';
import { getCostTier } from '../types/model.types';
import type { Model, ModelProvider } from '../types/model.types';
import type { ModelStatus } from '../types/modelStatus.types';
import './ModelDetailPage.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface BenchmarkData {
  modelId: string;
  modelName: string;
  tokensPerSecond: number;
  timeToFirstToken: number;
  totalTokens?: number;
  totalTimeMs?: number;
  success?: boolean;
  error?: string;
  timestamp?: string;
}

export default function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const models = useModelStore((state) => state.models);
  const removeModel = useModelStore((state) => state.removeModel);
  const testModelConnection = useModelStore((state) => state.testModelConnection);
  const defaultModelId = useModelStore((state) => state.defaultModelId);
  const setDefaultModel = useModelStore((state) => state.setDefaultModel);

  // Use the model status hook for consistent status logic
  const { getModelStatus, canDownload, setupModel, localProviders, refresh } = useModelStatus();

  const [isTesting, setIsTesting] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [isLoadingBenchmark, setIsLoadingBenchmark] = useState(false);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Find model in store or create from catalog
  const { model, catalogEntry } = useMemo(() => {
    const storeModel = id ? models.get(id) : undefined;
    const catalogDef = ALL_MODEL_DEFINITIONS.find(
      (m) => m.id === id || m.name === id
    );

    // If we have a store model, use it
    if (storeModel) {
      return { model: storeModel, catalogEntry: catalogDef };
    }

    // Otherwise, create a minimal model from catalog entry
    if (catalogDef) {
      const syntheticModel: Model = {
        id: catalogDef.id,
        provider: catalogDef.provider as ModelProvider,
        displayName: catalogDef.displayName,
        description: catalogDef.description,
        capabilities: catalogDef.specs.capabilities as any[],
        contextWindow: catalogDef.specs.contextWindow,
        costPerInputToken: (catalogDef.specs.inputPricePerMillion || 0) / 1000000,
        costPerOutputToken: (catalogDef.specs.outputPricePerMillion || 0) / 1000000,
        speedRating: 5,
        qualityRatings: {},
        strengths: [],
        weaknesses: [],
        maxOutputTokens: Math.min(catalogDef.specs.contextWindow / 4, 4096),
        supportsStreaming: catalogDef.specs.supportsStreaming ?? true,
        supportsToolCalls: catalogDef.specs.supportsToolUse ?? false,
        supportsVision: catalogDef.specs.supportsVision ?? false,
        isLocal: catalogDef.isLocalModel ?? false,
        isAvailable: false,
        apiEndpoint: catalogDef.defaultEndpoint,
      };
      return { model: syntheticModel, catalogEntry: catalogDef };
    }

    return { model: undefined, catalogEntry: undefined };
  }, [id, models]);

  // Fetch benchmark data for this model
  useEffect(() => {
    if (!id) return;

    const fetchBenchmark = async () => {
      setIsLoadingBenchmark(true);
      setBenchmarkError(null);

      try {
        const response = await fetch(`${API_BASE}/api/performance`);
        if (response.ok) {
          const data = await response.json();
          const benchmarks = data.benchmarks || [];
          const modelBenchmark = benchmarks.find((b: BenchmarkData) => b.modelId === id);
          setBenchmark(modelBenchmark || null);
        }
      } catch {
        // Silently fail - benchmarks are optional
        setBenchmark(null);
      } finally {
        setIsLoadingBenchmark(false);
      }
    };

    fetchBenchmark();
  }, [id]);

  // Run benchmark for this model
  const handleRunBenchmark = async () => {
    if (!model) return;
    setIsRunningBenchmark(true);
    setBenchmarkError(null);

    try {
      const response = await fetch(`${API_BASE}/api/performance/benchmarks/${model.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello, please write a short greeting.' }),
      });

      if (response.ok) {
        const result = await response.json();
        setBenchmark(result);
      } else {
        const errorData = await response.json();
        setBenchmarkError(errorData.error || 'Benchmark failed');
      }
    } catch {
      setBenchmarkError('Failed to run benchmark. Is the backend running?');
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  if (!model) {
    return (
      <div className="model-detail-page">
        <div className="model-detail-page__back-header">
          <button className="model-detail-page__back-btn" onClick={() => navigate('/models')}>
            <ArrowLeft size={16} />
            Back to Models
          </button>
        </div>
        <div className="model-detail-page__not-found">
          <h2>Model Not Found</h2>
          <p>The model with ID "{id}" could not be found.</p>
          <button onClick={() => navigate('/models')}>Go to Models</button>
        </div>
      </div>
    );
  }

  const costTier = getCostTier(model);
  const isDefault = defaultModelId === model.id;

  // Get consistent status from the hook
  const modelStatus: ModelStatus = id ? getModelStatus(id) : 'not_configured';
  const isConfigured = modelStatus === 'ready';
  const isAvailableForSetup = modelStatus === 'available';
  const canDownloadModel = id ? canDownload(id) : false;

  // Check if Ollama is available for local models
  const ollamaAvailable = localProviders.some(p => p.provider === 'ollama' && p.available);

  const handleBack = () => {
    navigate('/models');
  };

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
      navigate('/models');
    }
  };

  const handleDownload = async () => {
    if (!id) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const success = await setupModel(id, (progress) => {
        setDownloadProgress(progress);
      });

      if (success) {
        // Refresh to update status
        await refresh();
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
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
    <div className="model-detail-page">
      {/* Back header */}
      <div className="model-detail-page__back-header">
        <button className="model-detail-page__back-btn" onClick={handleBack}>
          <ArrowLeft size={16} />
          Back to Models
        </button>
      </div>

      {/* Main content - matches ModelDetailView */}
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
            {isConfigured && (
              <button
                className="model-detail__action-btn"
                onClick={handleTest}
                disabled={isTesting}
              >
                <TestTube size={16} />
                {isTesting ? 'Testing...' : 'Test'}
              </button>
            )}
            <button className="model-detail__action-btn" onClick={handleEdit}>
              <Edit2 size={16} />
            </button>
            {isConfigured && (
              <button
                className="model-detail__action-btn model-detail__action-btn--danger"
                onClick={handleDelete}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {model.description && (
          <div className="model-detail__description">{model.description}</div>
        )}

        <div className="model-detail__section">
          <h4 className="model-detail__section-title">Status</h4>
          <div className="model-detail__badges">
            <div
              className={`model-detail__badge model-detail__badge--${
                modelStatus === 'ready' ? 'success' :
                modelStatus === 'available' ? 'info' :
                modelStatus === 'downloading' ? 'warning' : 'muted'
              }`}
            >
              {modelStatus === 'ready' ? 'Ready' :
               modelStatus === 'available' ? 'Available' :
               modelStatus === 'downloading' ? 'Downloading' : 'Not Configured'}
            </div>
            {model.isLocal && (
              <div className="model-detail__badge model-detail__badge--info">Local</div>
            )}
            {isDefault && (
              <div className="model-detail__badge model-detail__badge--primary">Default</div>
            )}
          </div>

          {/* Download progress bar */}
          {isDownloading && (
            <div className="model-detail__download-progress">
              <div className="model-detail__download-bar">
                <div
                  className="model-detail__download-fill"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className="model-detail__download-text">
                Downloading... {downloadProgress}%
              </span>
            </div>
          )}

          {/* Actions based on status */}
          <div className="model-detail__status-actions">
            {!isDefault && isConfigured && (
              <button className="model-detail__set-default-btn" onClick={handleSetDefault}>
                Set as Default
              </button>
            )}

            {/* Download button for local models */}
            {canDownloadModel && !isDownloading && (
              <button
                className="model-detail__setup-btn model-detail__setup-btn--download"
                onClick={handleDownload}
              >
                <Download size={16} />
                Download Model
              </button>
            )}

            {/* Show why download is not available */}
            {isAvailableForSetup && !canDownloadModel && catalogEntry?.isLocalModel && !ollamaAvailable && (
              <div className="model-detail__setup-notice">
                <AlertCircle size={14} />
                <span>Install and start Ollama to download this model</span>
              </div>
            )}

            {/* Configure button for cloud models */}
            {modelStatus === 'not_configured' && !catalogEntry?.isLocalModel && (
              <button
                className="model-detail__setup-btn"
                onClick={handleEdit}
              >
                <Settings size={16} />
                Configure API Key
              </button>
            )}
          </div>
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
            {catalogEntry?.specs.parameterCount && (
              <div className="model-detail__spec">
                <span className="model-detail__spec-label">Parameters:</span>
                <span className="model-detail__spec-value">{catalogEntry.specs.parameterCount}</span>
              </div>
            )}
            <div className="model-detail__spec">
              <span className="model-detail__spec-label">Context Window:</span>
              <span className="model-detail__spec-value">
                {formatContextWindow(model.contextWindow)}
              </span>
            </div>
            <div className="model-detail__spec">
              <span className="model-detail__spec-label">Max Output:</span>
              <span className="model-detail__spec-value">
                {formatContextWindow(model.maxOutputTokens)}
              </span>
            </div>
            <div className="model-detail__spec">
              <span className="model-detail__spec-label">Speed Rating:</span>
              <span className="model-detail__spec-value">{model.speedRating}/10</span>
            </div>
            <div className="model-detail__spec">
              <span className="model-detail__spec-label">Streaming:</span>
              <span className="model-detail__spec-value">
                {model.supportsStreaming ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="model-detail__spec">
              <span className="model-detail__spec-label">Tool Calls:</span>
              <span className="model-detail__spec-value">
                {model.supportsToolCalls ? 'Yes' : 'No'}
              </span>
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

        {/* Benchmark Section */}
        <div className="model-detail__section">
          <div className="model-detail__section-header">
            <h4 className="model-detail__section-title">
              <Zap size={16} />
              Performance Benchmark
            </h4>
            {isConfigured && (
              <button
                className="model-detail__benchmark-btn"
                onClick={handleRunBenchmark}
                disabled={isRunningBenchmark}
              >
                {isRunningBenchmark ? (
                  <>
                    <RefreshCw size={14} className="spinning" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run Benchmark
                  </>
                )}
              </button>
            )}
          </div>

          {benchmarkError && (
            <div className="model-detail__benchmark-error">
              <AlertCircle size={14} />
              {benchmarkError}
            </div>
          )}

          {!isConfigured && !benchmark && (
            <div className="model-detail__benchmark-notice">
              <AlertCircle size={16} />
              <span>Benchmarks require the model to be configured with an API key or running locally.</span>
            </div>
          )}

          {isLoadingBenchmark ? (
            <div className="model-detail__benchmark-loading">
              <RefreshCw size={16} className="spinning" />
              Loading benchmark data...
            </div>
          ) : benchmark ? (
            <div className="model-detail__benchmark-results">
              <div className="model-detail__benchmark-grid">
                <div className="model-detail__benchmark-stat">
                  <div className="model-detail__benchmark-value">
                    <Zap size={18} />
                    {benchmark.tokensPerSecond}
                  </div>
                  <div className="model-detail__benchmark-label">tokens/sec</div>
                </div>
                <div className="model-detail__benchmark-stat">
                  <div className="model-detail__benchmark-value">
                    <Clock size={18} />
                    {benchmark.timeToFirstToken}ms
                  </div>
                  <div className="model-detail__benchmark-label">Time to First Token</div>
                </div>
                {benchmark.totalTokens && (
                  <div className="model-detail__benchmark-stat">
                    <div className="model-detail__benchmark-value">{benchmark.totalTokens}</div>
                    <div className="model-detail__benchmark-label">Total Tokens</div>
                  </div>
                )}
                {benchmark.totalTimeMs && (
                  <div className="model-detail__benchmark-stat">
                    <div className="model-detail__benchmark-value">{benchmark.totalTimeMs}ms</div>
                    <div className="model-detail__benchmark-label">Total Time</div>
                  </div>
                )}
              </div>
              {benchmark.timestamp && (
                <div className="model-detail__benchmark-timestamp">
                  Last run: {new Date(benchmark.timestamp).toLocaleString()}
                </div>
              )}
              {benchmark.success === false && benchmark.error && (
                <div className="model-detail__benchmark-error">
                  <AlertCircle size={14} />
                  {benchmark.error}
                </div>
              )}
            </div>
          ) : (
            <div className="model-detail__benchmark-empty">
              <Zap size={24} />
              <p>No benchmark data available.</p>
              {isConfigured ? (
                <p>Click "Run Benchmark" to test this model's performance.</p>
              ) : (
                <p>Configure this model to run benchmarks.</p>
              )}
            </div>
          )}
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
                      style={{ width: `${((rating ?? 0) / 10) * 100}%` }}
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

        {/* Setup instructions for non-configured models */}
        {!isConfigured && catalogEntry?.configurationSteps && (
          <div className="model-detail__section">
            <h4 className="model-detail__section-title">Setup Instructions</h4>
            <ol className="model-detail__list model-detail__list--numbered">
              {catalogEntry.configurationSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
