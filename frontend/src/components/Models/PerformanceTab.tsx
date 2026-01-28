/**
 * Performance Tab
 *
 * Shows model benchmarks, usage statistics, and performance comparisons.
 */

import { useState, useMemo } from 'react';
import { Play, BarChart3, Clock, DollarSign, Zap } from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import './PerformanceTab.scss';

interface PerformanceTabProps {
  catalog: ModelCatalogEntry[];
}

interface BenchmarkResult {
  modelId: string;
  modelName: string;
  tokensPerSecond: number;
  timeToFirstToken: number;
  lastBenchmarked?: string;
}

interface UsageStats {
  totalTokens: number;
  totalCost: number;
  byModel: {
    modelId: string;
    modelName: string;
    tokens: number;
    cost: number;
    percentage: number;
  }[];
}

export function PerformanceTab({ catalog }: PerformanceTabProps) {
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Get ready models only (for benchmarking)
  const readyModels = useMemo(() => {
    return catalog.filter(m => m.status === 'ready');
  }, [catalog]);

  // Mock benchmark data
  const [benchmarks] = useState<BenchmarkResult[]>([
    { modelId: 'gpt-4o', modelName: 'GPT-4o', tokensPerSecond: 120, timeToFirstToken: 800 },
    { modelId: 'gpt-4o-mini', modelName: 'GPT-4o Mini', tokensPerSecond: 180, timeToFirstToken: 400 },
    { modelId: 'claude-3-5-sonnet', modelName: 'Claude 3.5 Sonnet', tokensPerSecond: 95, timeToFirstToken: 650 },
  ]);

  // Mock usage data
  const [usageStats] = useState<UsageStats>({
    totalTokens: 1250000,
    totalCost: 45.23,
    byModel: [
      { modelId: 'gpt-4o', modelName: 'GPT-4o', tokens: 850000, cost: 32.50, percentage: 68 },
      { modelId: 'gpt-4o-mini', modelName: 'GPT-4o Mini', tokens: 300000, cost: 8.40, percentage: 24 },
      { modelId: 'claude-3-5-sonnet', modelName: 'Claude 3.5 Sonnet', tokens: 100000, cost: 4.33, percentage: 8 },
    ],
  });

  // Run benchmark
  const handleRunBenchmark = async () => {
    if (!selectedModelId) return;
    setIsRunningBenchmark(true);
    // TODO: Implement actual benchmarking
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRunningBenchmark(false);
  };

  // Get max values for bar scaling
  const maxTokensPerSecond = Math.max(...benchmarks.map(b => b.tokensPerSecond));

  return (
    <div className="performance-tab">
      {/* Benchmark Section */}
      <div className="performance-tab__section">
        <div className="performance-tab__section-header">
          <h3>
            <Zap size={18} />
            Model Benchmarks
          </h3>
          <div className="performance-tab__benchmark-controls">
            <select
              value={selectedModelId || ''}
              onChange={(e) => setSelectedModelId(e.target.value || null)}
            >
              <option value="">Select model...</option>
              {readyModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
            <button
              className="performance-tab__run-btn"
              onClick={handleRunBenchmark}
              disabled={!selectedModelId || isRunningBenchmark}
            >
              <Play size={14} />
              {isRunningBenchmark ? 'Running...' : 'Run Benchmark'}
            </button>
          </div>
        </div>

        {/* Throughput Chart */}
        <div className="performance-tab__chart">
          <h4>Tokens per Second</h4>
          <div className="performance-tab__bars">
            {benchmarks.map((benchmark) => (
              <div key={benchmark.modelId} className="performance-tab__bar-row">
                <span className="performance-tab__bar-label">{benchmark.modelName}</span>
                <div className="performance-tab__bar-container">
                  <div
                    className="performance-tab__bar"
                    style={{ width: `${(benchmark.tokensPerSecond / maxTokensPerSecond) * 100}%` }}
                  />
                  <span className="performance-tab__bar-value">{benchmark.tokensPerSecond} tok/s</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latency Table */}
        <div className="performance-tab__latency">
          <h4>
            <Clock size={16} />
            Time to First Token
          </h4>
          <table className="performance-tab__table">
            <thead>
              <tr>
                <th>Model</th>
                <th>TTFT</th>
                <th>Throughput</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((benchmark) => (
                <tr key={benchmark.modelId}>
                  <td>{benchmark.modelName}</td>
                  <td>{benchmark.timeToFirstToken}ms</td>
                  <td>{benchmark.tokensPerSecond} tok/s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Statistics Section */}
      <div className="performance-tab__section">
        <div className="performance-tab__section-header">
          <h3>
            <BarChart3 size={18} />
            Usage Statistics (Last 30 Days)
          </h3>
        </div>

        {/* Summary Cards */}
        <div className="performance-tab__summary">
          <div className="performance-tab__summary-card">
            <div className="performance-tab__summary-icon">
              <Zap size={24} />
            </div>
            <div className="performance-tab__summary-content">
              <span className="performance-tab__summary-value">
                {(usageStats.totalTokens / 1000000).toFixed(2)}M
              </span>
              <span className="performance-tab__summary-label">Total Tokens</span>
            </div>
          </div>
          <div className="performance-tab__summary-card">
            <div className="performance-tab__summary-icon">
              <DollarSign size={24} />
            </div>
            <div className="performance-tab__summary-content">
              <span className="performance-tab__summary-value">
                ${usageStats.totalCost.toFixed(2)}
              </span>
              <span className="performance-tab__summary-label">Total Cost</span>
            </div>
          </div>
        </div>

        {/* Usage by Model */}
        <div className="performance-tab__usage-breakdown">
          <h4>Usage by Model</h4>
          <div className="performance-tab__usage-bars">
            {usageStats.byModel.map((usage) => (
              <div key={usage.modelId} className="performance-tab__usage-row">
                <div className="performance-tab__usage-info">
                  <span className="performance-tab__usage-name">{usage.modelName}</span>
                  <span className="performance-tab__usage-stats">
                    {(usage.tokens / 1000).toFixed(0)}K tokens | ${usage.cost.toFixed(2)}
                  </span>
                </div>
                <div className="performance-tab__usage-bar-container">
                  <div
                    className="performance-tab__usage-bar"
                    style={{ width: `${usage.percentage}%` }}
                  />
                  <span className="performance-tab__usage-percentage">{usage.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {readyModels.length === 0 && (
        <div className="performance-tab__empty">
          <BarChart3 size={48} />
          <h3>No Ready Models</h3>
          <p>Configure at least one model to view performance metrics.</p>
        </div>
      )}
    </div>
  );
}
