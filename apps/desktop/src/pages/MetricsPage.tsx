/**
 * Metrics Dashboard Page (Phase 9)
 *
 * Page for viewing workflow execution metrics and analytics.
 */

import React, { useEffect, useState, useMemo, ReactNode } from 'react';
import { Hash, DollarSign, Type, Clock, CheckCircle2 } from 'lucide-react';
import { useMetricsStore } from '../store/metricsStore';
import type { WorkflowExecutionMetrics } from '../types';
import './MetricsPage.scss';

// ============= Sub-Components =============

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
}) => {
  return (
    <div className="metric-card">
      <div className="metric-card__header">
        {icon && <span className="metric-card__icon">{icon}</span>}
        <span className="metric-card__title">{title}</span>
      </div>
      <div className="metric-card__value">{value}</div>
      {(subtitle || trendValue) && (
        <div className="metric-card__footer">
          {subtitle && <span className="metric-card__subtitle">{subtitle}</span>}
          {trendValue && (
            <span className={`metric-card__trend metric-card__trend--${trend}`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

interface ExecutionRowProps {
  execution: WorkflowExecutionMetrics;
  onClick: (id: string) => void;
}

const ExecutionRow: React.FC<ExecutionRowProps> = ({ execution, onClick }) => {
  const successRate = execution.successRate * 100;
  const statusClass = execution.status.toLowerCase();

  return (
    <div className="execution-row" onClick={() => onClick(execution.executionId)}>
      <div className="execution-row__info">
        <span className="execution-row__id">{execution.executionId.substring(0, 8)}...</span>
        <span className={`execution-row__status execution-row__status--${statusClass}`}>
          {execution.status}
        </span>
      </div>
      <div className="execution-row__workflow">
        {execution.workflowName || execution.workflowId.substring(0, 8)}
      </div>
      <div className="execution-row__metrics">
        <span className="execution-row__metric">
          <span className="execution-row__metric-label">Duration</span>
          <span className="execution-row__metric-value">
            {(execution.totalDurationMs / 1000).toFixed(2)}s
          </span>
        </span>
        <span className="execution-row__metric">
          <span className="execution-row__metric-label">Tokens</span>
          <span className="execution-row__metric-value">
            {execution.totalTokens.toLocaleString()}
          </span>
        </span>
        <span className="execution-row__metric">
          <span className="execution-row__metric-label">Cost</span>
          <span className="execution-row__metric-value">
            ${execution.totalCostUsd.toFixed(4)}
          </span>
        </span>
        <span className="execution-row__metric">
          <span className="execution-row__metric-label">Success</span>
          <span
            className={`execution-row__metric-value ${
              successRate === 100
                ? 'execution-row__metric-value--success'
                : successRate > 0
                ? 'execution-row__metric-value--partial'
                : 'execution-row__metric-value--failed'
            }`}
          >
            {successRate.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className="execution-row__time">
        {new Date(execution.startedAt).toLocaleString()}
      </div>
    </div>
  );
};

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}) => {
  return (
    <div className="date-range-picker">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className="date-range-picker__input"
      />
      <span className="date-range-picker__separator">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className="date-range-picker__input"
      />
    </div>
  );
};

// ============= Main Page =============

const MetricsPage: React.FC = () => {
  const recentMetrics = useMetricsStore((s) => s.recentMetrics);
  const aggregatedMetrics = useMetricsStore((s) => s.aggregatedMetrics);
  const isLoading = useMetricsStore((s) => s.isLoading);
  const error = useMetricsStore((s) => s.error);

  const loadRecentMetrics = useMetricsStore((s) => s.loadRecentMetrics);
  const loadAggregatedMetrics = useMetricsStore((s) => s.loadAggregatedMetrics);
  const loadExecutionMetrics = useMetricsStore((s) => s.loadExecutionMetrics);
  const clearError = useMetricsStore((s) => s.clearError);

  const [, setSelectedExecution] = useState<string | null>(null);

  // Date filters
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(lastWeek.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    loadRecentMetrics(20);
    loadAggregatedMetrics({ startDate, endDate });
  }, [loadRecentMetrics, loadAggregatedMetrics, startDate, endDate]);

  const handleExecutionClick = (executionId: string) => {
    setSelectedExecution(executionId);
    loadExecutionMetrics(executionId);
  };

  // Compute summary stats
  const summaryStats = useMemo(() => {
    if (!recentMetrics.length) {
      return {
        totalExecutions: 0,
        totalCost: 0,
        totalTokens: 0,
        avgDuration: 0,
        successRate: 0,
      };
    }

    const totalExecutions = recentMetrics.length;
    const totalCost = recentMetrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
    const totalTokens = recentMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const avgDuration =
      recentMetrics.reduce((sum, m) => sum + m.totalDurationMs, 0) / totalExecutions;
    const successRate =
      (recentMetrics.filter((m) => m.status === 'Completed').length / totalExecutions) * 100;

    return { totalExecutions, totalCost, totalTokens, avgDuration, successRate };
  }, [recentMetrics]);

  return (
    <div className="metrics-page">
      {/* Header */}
      <header className="metrics-page__header">
        <div className="metrics-page__title">
          <h1>Metrics Dashboard</h1>
          <span className="metrics-page__subtitle">Workflow execution analytics</span>
        </div>
        <div className="metrics-page__actions">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
          <button
            className="btn-secondary"
            onClick={() => {
              loadRecentMetrics(20);
              loadAggregatedMetrics({ startDate, endDate });
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="metrics-page__summary">
        <MetricCard
          icon={<Hash size={18} />}
          title="Total Executions"
          value={summaryStats.totalExecutions}
          subtitle="Last 20 executions"
        />
        <MetricCard
          icon={<DollarSign size={18} />}
          title="Total Cost"
          value={`$${summaryStats.totalCost.toFixed(4)}`}
          subtitle="API usage costs"
        />
        <MetricCard
          icon={<Type size={18} />}
          title="Total Tokens"
          value={summaryStats.totalTokens.toLocaleString()}
          subtitle="Input + Output"
        />
        <MetricCard
          icon={<Clock size={18} />}
          title="Avg Duration"
          value={`${(summaryStats.avgDuration / 1000).toFixed(2)}s`}
          subtitle="Per execution"
        />
        <MetricCard
          icon={<CheckCircle2 size={18} />}
          title="Success Rate"
          value={`${summaryStats.successRate.toFixed(0)}%`}
          trend={summaryStats.successRate >= 90 ? 'up' : summaryStats.successRate >= 70 ? 'neutral' : 'down'}
        />
      </div>

      {/* Aggregated Metrics */}
      {aggregatedMetrics && (
        <div className="metrics-page__section">
          <h2 className="metrics-page__section-title">Period Summary</h2>
          <div className="aggregated-stats">
            <div className="aggregated-stat">
              <span className="aggregated-stat__label">Executions</span>
              <span className="aggregated-stat__value">{aggregatedMetrics.executionCount}</span>
            </div>
            <div className="aggregated-stat">
              <span className="aggregated-stat__label">Avg Duration</span>
              <span className="aggregated-stat__value">
                {(aggregatedMetrics.averageDurationMs / 1000).toFixed(2)}s
              </span>
            </div>
            <div className="aggregated-stat">
              <span className="aggregated-stat__label">Min Duration</span>
              <span className="aggregated-stat__value">
                {(aggregatedMetrics.minDurationMs / 1000).toFixed(2)}s
              </span>
            </div>
            <div className="aggregated-stat">
              <span className="aggregated-stat__label">Max Duration</span>
              <span className="aggregated-stat__value">
                {(aggregatedMetrics.maxDurationMs / 1000).toFixed(2)}s
              </span>
            </div>
            <div className="aggregated-stat">
              <span className="aggregated-stat__label">Success Rate</span>
              <span className="aggregated-stat__value">
                {(aggregatedMetrics.successRate * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Model Breakdown */}
          {aggregatedMetrics.modelBreakdown.length > 0 && (
            <div className="model-breakdown">
              <h3 className="model-breakdown__title">Model Usage</h3>
              <div className="model-breakdown__list">
                {aggregatedMetrics.modelBreakdown.map((model) => (
                  <div key={model.modelId} className="model-breakdown__item">
                    <span className="model-breakdown__model">{model.modelId}</span>
                    <span className="model-breakdown__calls">{model.callCount} calls</span>
                    <span className="model-breakdown__tokens">
                      {model.totalTokens.toLocaleString()} tokens
                    </span>
                    <span className="model-breakdown__cost">${model.totalCostUsd.toFixed(4)}</span>
                    <span className="model-breakdown__latency">
                      {model.averageLatencyMs.toFixed(0)}ms avg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Executions */}
      <div className="metrics-page__section">
        <h2 className="metrics-page__section-title">Recent Executions</h2>
        <div className="metrics-page__content">
          {isLoading && recentMetrics.length === 0 ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading metrics...</p>
            </div>
          ) : recentMetrics.length === 0 ? (
            <div className="empty-state">
              <h2>No Metrics Yet</h2>
              <p>Execute some workflows to see metrics here.</p>
            </div>
          ) : (
            <div className="executions-list">
              {recentMetrics.map((execution) => (
                <ExecutionRow
                  key={execution.executionId}
                  execution={execution}
                  onClick={handleExecutionClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricsPage;
