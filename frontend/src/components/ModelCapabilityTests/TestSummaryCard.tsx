/**
 * TestSummaryCard
 *
 * Displays the overall test score and classification.
 */

import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TestSummary, TestClassification } from '../../types/modelTest.types';

interface TestSummaryCardProps {
  summary: TestSummary;
}

const classificationColors: Record<TestClassification, string> = {
  Excellent: '#22c55e',
  Good: '#84cc16',
  Medium: '#eab308',
  Weak: '#f97316',
  Insufficient: '#ef4444',
};

const classificationIcons: Record<TestClassification, React.ReactNode> = {
  Excellent: <TrendingUp size={20} />,
  Good: <TrendingUp size={20} />,
  Medium: <Minus size={20} />,
  Weak: <TrendingDown size={20} />,
  Insufficient: <TrendingDown size={20} />,
};

export function TestSummaryCard({ summary }: TestSummaryCardProps) {
  const { totalScore, maxScore, percentage, classification } = summary;
  const color = classificationColors[classification];

  // Calculate the stroke dasharray for the circular progress
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="test-summary-card">
      <div className="test-summary-card__header">
        <Award size={20} />
        <h4>Overall Score</h4>
      </div>

      <div className="test-summary-card__content">
        {/* Circular progress */}
        <div className="test-summary-card__progress">
          <svg viewBox="0 0 100 100" className="test-summary-card__circle">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="test-summary-card__score">
            <span className="test-summary-card__percentage">{percentage}%</span>
            <span className="test-summary-card__fraction">
              {totalScore}/{maxScore}
            </span>
          </div>
        </div>

        {/* Classification badge */}
        <div
          className="test-summary-card__classification"
          style={{ backgroundColor: color }}
        >
          {classificationIcons[classification]}
          <span>{classification}</span>
        </div>
      </div>
    </div>
  );
}
