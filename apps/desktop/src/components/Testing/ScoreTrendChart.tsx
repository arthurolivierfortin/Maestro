/**
 * ScoreTrendChart Component
 * Simple SVG-based trend chart for test scores
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { BlockTestRun } from '../../types/test.types';
import './ScoreTrendChart.scss';

interface ScoreTrendChartProps {
  runs: BlockTestRun[];
  height?: number;
}

interface DataPoint {
  x: number;
  y: number;
  score: number;
  label: string;
  runId: string;
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  runs,
  height = 200,
}) => {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 600;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { dataPoints, trend, avgScore } = useMemo(() => {
    // Filter only completed runs with metrics
    const completedRuns = runs
      .filter((r) => r.status === 'Completed' && r.metrics)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (completedRuns.length === 0) {
      return { dataPoints: [], trend: 'stable' as const, avgScore: 0 };
    }

    const points: DataPoint[] = completedRuns.map((run, index) => ({
      x: (index / Math.max(completedRuns.length - 1, 1)) * chartWidth,
      y: chartHeight - ((run.metrics!.overallScore / 100) * chartHeight),
      score: run.metrics!.overallScore,
      label: new Date(run.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      runId: run.id,
    }));

    // Calculate trend
    const scores = completedRuns.map((r) => r.metrics!.overallScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
    if (scores.length >= 2) {
      const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg > firstAvg + 5) trendDirection = 'improving';
      else if (secondAvg < firstAvg - 5) trendDirection = 'declining';
    }

    return { dataPoints: points, trend: trendDirection, avgScore: avg };
  }, [runs, chartWidth, chartHeight]);

  if (dataPoints.length === 0) {
    return (
      <div className="score-trend-chart score-trend-chart--empty">
        <p>No completed test runs to display</p>
      </div>
    );
  }

  // Create SVG path
  const linePath = dataPoints
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Create area path (for gradient fill)
  const areaPath = `${linePath} L ${dataPoints[dataPoints.length - 1].x} ${chartHeight} L ${dataPoints[0].x} ${chartHeight} Z`;

  const trendIcon = {
    improving: <TrendingUp size={16} />,
    declining: <TrendingDown size={16} />,
    stable: <Minus size={16} />,
  };

  const trendLabel = {
    improving: 'Improving',
    declining: 'Declining',
    stable: 'Stable',
  };

  return (
    <div className="score-trend-chart">
      <div className="score-trend-chart__header">
        <h4>Score Trend</h4>
        <div className={`score-trend-chart__trend score-trend-chart__trend--${trend}`}>
          {trendIcon[trend]}
          <span>{trendLabel[trend]}</span>
          <span className="score-trend-chart__avg">Avg: {avgScore.toFixed(0)}</span>
        </div>
      </div>

      <svg
        className="score-trend-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value) => {
            const y = chartHeight - (value / 100) * chartHeight;
            return (
              <g key={value}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray="4,4"
                />
                <text
                  x={-10}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--color-text-tertiary)"
                  fontSize="10"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {dataPoints.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="var(--color-bg-primary)"
                stroke="var(--color-primary)"
                strokeWidth="2"
                className="score-trend-chart__point"
              />
              <title>{`${point.label}: ${point.score}`}</title>

              {/* X-axis labels (show every Nth label based on data length) */}
              {(i === 0 || i === dataPoints.length - 1 || dataPoints.length <= 5 || i % Math.ceil(dataPoints.length / 5) === 0) && (
                <text
                  x={point.x}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fill="var(--color-text-tertiary)"
                  fontSize="10"
                >
                  {point.label}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default ScoreTrendChart;
