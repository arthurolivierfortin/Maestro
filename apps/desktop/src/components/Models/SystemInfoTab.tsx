/**
 * System Info Tab
 *
 * Displays hardware specifications and model recommendations.
 * Clean UI matching the All Models tab style.
 */

import { useState, useEffect } from 'react';
import { Cpu, MemoryStick, Monitor, Settings, RefreshCw, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { ProviderIcon } from '../icons/ProviderIcons';
import type { ModelProvider } from '../../types/model.types';
import './SystemInfoTab.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface SystemSpecs {
  cpu: {
    name: string;
    cores: number;
    threads: number;
    frequency: string;
  };
  memory: {
    total: number;
    available: number;
    type: string;
  };
  gpu: {
    name: string;
    vram: number;
    cudaVersion?: string;
  }[];
  os: {
    name: string;
    version: string;
    architecture: string;
  };
}

interface ModelRecommendation {
  modelName: string;
  modelId: string;
  provider: ModelProvider;
  reason: string;
  canRun: boolean;
  runOn: 'cpu' | 'gpu';
}

export function SystemInfoTab() {
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch hardware capabilities from LLM Provider via backend proxy
      const capsResponse = await fetch(`${API_BASE}/api/provider/capabilities`);

      if (capsResponse.ok) {
        const caps = await capsResponse.json();
        const gpus: SystemSpecs['gpu'] = [];

        if (caps.gpu?.available) {
          gpus.push({
            name: caps.gpu.name || 'Unknown GPU',
            vram: caps.gpu.vramTotalGb || 0,
            cudaVersion: caps.gpu.cudaVersion,
          });
        }

        setSpecs({
          cpu: {
            name: caps.cpu?.name || 'Unknown CPU',
            cores: caps.cpu?.coresPhysical || 0,
            threads: caps.cpu?.coresLogical || 0,
            frequency: caps.cpu?.architecture || '',
          },
          memory: {
            total: Math.round(caps.ram?.totalGb || 0),
            available: Math.round(caps.ram?.availableGb || 0),
            type: '',
          },
          gpu: gpus,
          os: {
            name: caps.platform || 'Unknown',
            version: caps.torchVersion ? `PyTorch ${caps.torchVersion}` : '',
            architecture: caps.cpu?.architecture || '',
          },
        });

        // Fetch recommended models
        const modelsResponse = await fetch(`${API_BASE}/api/provider/models`);
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const recommended = (modelsData.models || [])
            .filter((m: any) => m.recommended)
            .slice(0, 5)
            .map((m: any) => ({
              modelName: m.name || m.modelId,
              modelId: m.modelId,
              provider: 'local' as ModelProvider,
              reason: `${m.parametersB}B params, ${m.vramRequired?.toFixed(1) || '?'}GB VRAM${m.isLocal ? ' (cached)' : ''}`,
              canRun: m.canRunFp16 || m.canRunInt8,
              runOn: caps.gpu?.available ? 'gpu' as const : 'cpu' as const,
            }));
          setRecommendations(recommended.length > 0 ? recommended : defaultRecommendations());
        } else {
          setRecommendations(defaultRecommendations());
        }
      } else {
        setSpecs(null);
        setRecommendations(defaultRecommendations());
      }
    } catch {
      setSpecs(null);
      setRecommendations(defaultRecommendations());
    } finally {
      setIsLoading(false);
    }
  };

  const defaultRecommendations = (): ModelRecommendation[] => [
    {
      modelName: 'Claude 3.5 Sonnet',
      modelId: 'claude-3.5-sonnet',
      provider: 'anthropic',
      reason: 'Cloud-based, no hardware requirements',
      canRun: true,
      runOn: 'cpu',
    },
    {
      modelName: 'GPT-4o',
      modelId: 'gpt-4o',
      provider: 'openai',
      reason: 'Cloud-based, no hardware requirements',
      canRun: true,
      runOn: 'cpu',
    },
  ];

  const formatMemory = (gb: number) => `${gb} GB`;

  const getMemoryUsagePercent = () => {
    if (!specs) return 0;
    return ((specs.memory.total - specs.memory.available) / specs.memory.total) * 100;
  };

  if (isLoading) {
    return (
      <div className="system-info-tab system-info-tab--loading">
        <RefreshCw size={32} className="spinning" />
        <p>Detecting system specifications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-info-tab system-info-tab--error">
        <AlertTriangle size={32} />
        <p>{error}</p>
        <button className="system-info-tab__retry-btn" onClick={fetchSystemInfo}>
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="system-info-tab">
      {/* Hardware Specs Section */}
      <div className="system-info-tab__section">
        <div className="system-info-tab__section-header">
          <Settings size={18} />
          <h3>Hardware Specifications</h3>
          <button className="system-info-tab__refresh-btn" onClick={fetchSystemInfo} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {specs ? (
          <div className="system-info-tab__cards">
            {/* CPU Card */}
            <div className="system-info-tab__card">
              <div className="system-info-tab__card-icon system-info-tab__card-icon--cpu">
                <Cpu size={20} />
              </div>
              <div className="system-info-tab__card-content">
                <span className="system-info-tab__card-label">Processor</span>
                <span className="system-info-tab__card-value">{specs.cpu.name}</span>
                <span className="system-info-tab__card-detail">
                  {specs.cpu.cores} cores / {specs.cpu.threads} threads @ {specs.cpu.frequency}
                </span>
              </div>
            </div>

            {/* Memory Card */}
            <div className="system-info-tab__card">
              <div className="system-info-tab__card-icon system-info-tab__card-icon--memory">
                <MemoryStick size={20} />
              </div>
              <div className="system-info-tab__card-content">
                <span className="system-info-tab__card-label">Memory</span>
                <span className="system-info-tab__card-value">{formatMemory(specs.memory.total)} {specs.memory.type}</span>
                <div className="system-info-tab__memory-bar">
                  <div
                    className="system-info-tab__memory-fill"
                    style={{ width: `${getMemoryUsagePercent()}%` }}
                  />
                </div>
                <span className="system-info-tab__card-detail">
                  {formatMemory(specs.memory.available)} available
                </span>
              </div>
            </div>

            {/* GPU Cards */}
            {specs.gpu.map((gpu, index) => (
              <div key={index} className="system-info-tab__card">
                <div className="system-info-tab__card-icon system-info-tab__card-icon--gpu">
                  <Monitor size={20} />
                </div>
                <div className="system-info-tab__card-content">
                  <span className="system-info-tab__card-label">
                    Graphics{specs.gpu.length > 1 ? ` ${index + 1}` : ''}
                  </span>
                  <span className="system-info-tab__card-value">{gpu.name}</span>
                  <span className="system-info-tab__card-detail">
                    {gpu.vram} GB VRAM
                    {gpu.cudaVersion && ` • CUDA ${gpu.cudaVersion}`}
                  </span>
                </div>
                {gpu.cudaVersion && (
                  <span className="system-info-tab__badge system-info-tab__badge--success">
                    CUDA Ready
                  </span>
                )}
              </div>
            ))}

            {/* OS Card */}
            <div className="system-info-tab__card system-info-tab__card--compact">
              <div className="system-info-tab__card-icon system-info-tab__card-icon--os">
                <Zap size={20} />
              </div>
              <div className="system-info-tab__card-content">
                <span className="system-info-tab__card-label">Operating System</span>
                <span className="system-info-tab__card-value">
                  {specs.os.name} {specs.os.version} ({specs.os.architecture})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="system-info-tab__pending">
            <div className="system-info-tab__pending-icon">
              <Settings size={24} />
            </div>
            <div className="system-info-tab__pending-content">
              <span className="system-info-tab__pending-title">Hardware Detection Coming Soon</span>
              <span className="system-info-tab__pending-description">
                Automatic hardware detection will be available in a future update.
                For now, cloud-based models are recommended as they don't require local resources.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      <div className="system-info-tab__section">
        <div className="system-info-tab__section-header">
          <CheckCircle size={18} />
          <h3>Recommended Models</h3>
          <span className="system-info-tab__section-subtitle">Based on your hardware</span>
        </div>

        <div className="system-info-tab__recommendations">
          {recommendations.map((rec) => (
            <div
              key={rec.modelId}
              className={`system-info-tab__recommendation ${
                rec.canRun ? 'system-info-tab__recommendation--compatible' : 'system-info-tab__recommendation--incompatible'
              }`}
            >
              <div className="system-info-tab__recommendation-icon">
                <ProviderIcon
                  provider={rec.provider}
                  size={24}
                  status={rec.canRun ? 'ready' : 'not_configured'}
                />
              </div>
              <div className="system-info-tab__recommendation-content">
                <span className="system-info-tab__recommendation-name">{rec.modelName}</span>
                <span className="system-info-tab__recommendation-reason">{rec.reason}</span>
              </div>
              <div className="system-info-tab__recommendation-meta">
                <span className={`system-info-tab__run-badge system-info-tab__run-badge--${rec.runOn}`}>
                  {rec.runOn.toUpperCase()}
                </span>
                {rec.canRun ? (
                  <CheckCircle size={16} className="system-info-tab__status-icon--success" />
                ) : (
                  <AlertTriangle size={16} className="system-info-tab__status-icon--warning" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="system-info-tab__legend">
        <span className="system-info-tab__legend-item system-info-tab__legend-item--compatible">
          Compatible
        </span>
        <span className="system-info-tab__legend-item system-info-tab__legend-item--incompatible">
          Requires More Resources
        </span>
      </div>
    </div>
  );
}
