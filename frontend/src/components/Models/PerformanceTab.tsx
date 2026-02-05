/**
 * Performance Tab
 *
 * Shows model benchmarks, usage statistics, and performance comparisons.
 * Fetches real data from the backend API.
 */

import { useState, useEffect, useMemo } from 'react';
import { Play, BarChart3, Clock, DollarSign, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import type { ModelCatalogEntry } from '../../types/modelStatus.types';
import './PerformanceTab.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface PerformanceTabProps {
  catalog: ModelCatalogEntry[];
}

interface BenchmarkResult {
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

interface ModelUsage {
  modelId: string;
  modelName: string;
  tokens: number;
  cost: number;
  requests: number;
  percentage: number;
}

interface UsageStats {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  byModel: ModelUsage[];
  daily: { date: string; tokens: number; cost: number }[];
}

export function PerformanceTab({ catalog }: PerformanceTabProps) {
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    byModel: [],
    daily: [],
  });

  // Get ready models only (for benchmarking)
  const readyModels = useMemo(() => {
    return catalog.filter(m => m.status === 'ready');
  }, [catalog]);

  // Fetch metrics on mount
  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/performance`);
      if (response.ok) {
        const data = await response.json();
        setBenchmarks(data.benchmarks || []);
        setUsageStats(data.usage || {
          totalTokens: 0,
          totalCost: 0,
          totalRequests: 0,
          byModel: [],
          daily: [],
        });
      } else {
        setError('Failed to load performance metrics');
      }
    } catch {
      setError('Could not connect to performance API');
    } finally {
      setIsLoading(false);
    }
  };

  // Run benchmark
  const handleRunBenchmark = async () => {
    if (!selectedModelId) return;
    setIsRunningBenchmark(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/performance/benchmarks/${selectedModelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello, please write a short greeting.' }),
      });

      if (response.ok) {
        const result = await response.json();
        // Add or update benchmark in list
        setBenchmarks(prev => {
          const existing = prev.findIndex(b => b.modelId === result.modelId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result;
            return updated;
          }
          return [...prev, result];
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Benchmark failed');
      }
    } catch {
      setError('Failed to run benchmark');
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  // Get max values for bar scaling
  const maxTokensPerSecond = benchmarks.length > 0
    ? Math.max(...benchmarks.map(b => b.tokensPerSecond))
    : 100;

  if (isLoading) {
    return (
      <div className="performance-tab performance-tab--loading">
        <RefreshCw size={32} className="spinning" />
        <p>Loading performance metrics...</p>
      </div>
    );
  }

  return (
    <div className="performance-tab">
      {error && (
        <div className="performance-tab__error">
          <AlertCircle size={16} />
          {error}
          <button onClick={fetchMetrics}>Retry</button>
        </div>
      )}

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
            <button
              className="performance-tab__refresh-btn"
              onClick={fetchMetrics}
              title="Refresh metrics"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {benchmarks.length > 0 ? (
          <>
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
                Benchmark Results
              </h4>
              <table className="performance-tab__table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>TTFT</th>
                    <th>Throughput</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((benchmark) => (
                    <tr key={benchmark.modelId}>
                      <td>{benchmark.modelName}</td>
                      <td>{benchmark.timeToFirstToken}ms</td>
                      <td>{benchmark.tokensPerSecond} tok/s</td>
                      <td>
                        <span className={`performance-tab__status performance-tab__status--${benchmark.success ? 'success' : 'error'}`}>
                          {benchmark.success ? 'OK' : 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="performance-tab__empty-benchmarks">
            <Zap size={32} />
            <p>No benchmarks yet. Select a model and run a benchmark to see results.</p>
          </div>
        )}
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
                {usageStats.totalTokens > 1000000
                  ? `${(usageStats.totalTokens / 1000000).toFixed(2)}M`
                  : usageStats.totalTokens > 1000
                  ? `${(usageStats.totalTokens / 1000).toFixed(1)}K`
                  : usageStats.totalTokens}
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
          <div className="performance-tab__summary-card">
            <div className="performance-tab__summary-icon">
              <BarChart3 size={24} />
            </div>
            <div className="performance-tab__summary-content">
              <span className="performance-tab__summary-value">
                {usageStats.totalRequests}
              </span>
              <span className="performance-tab__summary-label">Total Requests</span>
            </div>
          </div>
        </div>

        {/* Usage by Model */}
        {usageStats.byModel.length > 0 ? (
          <div className="performance-tab__usage-breakdown">
            <h4>Usage by Model</h4>
            <div className="performance-tab__usage-bars">
              {usageStats.byModel.map((usage) => (
                <div key={usage.modelId} className="performance-tab__usage-row">
                  <div className="performance-tab__usage-info">
                    <span className="performance-tab__usage-name">{usage.modelName}</span>
                    <span className="performance-tab__usage-stats">
                      {usage.tokens > 1000 ? `${(usage.tokens / 1000).toFixed(0)}K` : usage.tokens} tokens | ${usage.cost.toFixed(2)} | {usage.requests} requests
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
        ) : (
          <div className="performance-tab__empty-usage">
            <BarChart3 size={32} />
            <p>No usage data yet. Usage will be tracked as you use models.</p>
          </div>
        )}
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
