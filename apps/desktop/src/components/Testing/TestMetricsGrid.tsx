/**
 * TestMetricsGrid Component
 * Displays test run metrics in a grid of cards
 */

import React from 'react';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { BlockTestRunMetrics } from '../../types/test.types';
import './TestMetricsGrid.scss';

interface TestMetricsGridProps {
  metrics: BlockTestRunMetrics;
  totalIterations: number;
  completedIterations: number;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subvalue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subvalue,
  variant = 'default',
}) => (
  <div className={`metric-card metric-card--${variant}`}>
    <div className="metric-card__icon">{icon}</div>
    <div className="metric-card__content">
      <span className="metric-card__value">{value}</span>
      <span className="metric-card__label">{label}</span>
      {subvalue && <span className="metric-card__subvalue">{subvalue}</span>}
    </div>
  </div>
);

export const TestMetricsGrid: React.FC<TestMetricsGridProps> = ({
  metrics,
  totalIterations,
  completedIterations,
}) => {
  const getScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  const completionRate = totalIterations > 0
    ? Math.round((metrics.evaluatedCount / totalIterations) * 100)
    : 0;

  const variance = metrics.scoreVariance;
  const isConsistent = variance < 100; // Low variance = consistent

  return (
    <div className="test-metrics-grid">
      <MetricCard
        icon={<Target size={20} />}
        label="Overall Score"
        value={metrics.overallScore}
        subvalue="out of 100"
        variant={getScoreVariant(metrics.overallScore)}
      />

      <MetricCard
        icon={<TrendingUp size={20} />}
        label="Best Score"
        value={metrics.maxScore}
        variant="success"
      />

      <MetricCard
        icon={<TrendingDown size={20} />}
        label="Lowest Score"
        value={metrics.minScore}
        variant={metrics.minScore < 60 ? 'danger' : 'default'}
      />

      <MetricCard
        icon={<Activity size={20} />}
        label="Variance"
        value={variance.toFixed(1)}
        subvalue={isConsistent ? 'Consistent' : 'Variable'}
        variant={isConsistent ? 'success' : 'warning'}
      />

      <MetricCard
        icon={<CheckCircle size={20} />}
        label="Evaluated"
        value={`${metrics.evaluatedCount}/${metrics.totalCount}`}
        subvalue={`${completionRate}% complete`}
      />

      <MetricCard
        icon={<Clock size={20} />}
        label="Iterations"
        value={completedIterations}
        subvalue={`of ${totalIterations} total`}
      />

      {Object.keys(metrics.criterionAverages).length > 0 && (
        <div className="test-metrics-grid__criteria">
          <h4>
            <BarChart3 size={16} />
            Criteria Breakdown
          </h4>
          <div className="test-metrics-grid__criteria-list">
            {Object.entries(metrics.criterionAverages).map(([name, score]) => (
              <div key={name} className="test-metrics-grid__criterion">
                <span className="test-metrics-grid__criterion-name">{name}</span>
                <div className="test-metrics-grid__criterion-bar">
                  <div
                    className={`test-metrics-grid__criterion-fill test-metrics-grid__criterion-fill--${getScoreVariant(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className={`test-metrics-grid__criterion-score test-metrics-grid__criterion-score--${getScoreVariant(score)}`}>
                  {score.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestMetricsGrid;
