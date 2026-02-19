/**
 * TestRunCard Component
 * Card display for a test run summary
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Bot,
  Wrench,
  GitBranch,
  Layers,
} from 'lucide-react';
import type { BlockTestRun } from '../../types/test.types';
import './TestRunCard.scss';

interface TestRunCardProps {
  testRun: BlockTestRun;
  onDelete?: (id: string) => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  Pending: { icon: <Clock size={14} />, className: 'pending', label: 'Pending' },
  Running: { icon: <Play size={14} />, className: 'running', label: 'Running' },
  AwaitingEvaluation: { icon: <AlertCircle size={14} />, className: 'awaiting', label: 'Awaiting Evaluation' },
  Completed: { icon: <CheckCircle size={14} />, className: 'completed', label: 'Completed' },
  Failed: { icon: <XCircle size={14} />, className: 'failed', label: 'Failed' },
  Cancelled: { icon: <XCircle size={14} />, className: 'cancelled', label: 'Cancelled' },
};

const blockTypeIcons: Record<string, React.ReactNode> = {
  agent: <Bot size={16} />,
  tool: <Wrench size={16} />,
  workflow: <GitBranch size={16} />,
  task: <Layers size={16} />,
};

export const TestRunCard: React.FC<TestRunCardProps> = ({ testRun, onDelete }) => {
  const navigate = useNavigate();
  const status = statusConfig[testRun.status] || statusConfig.Pending;
  const blockIcon = blockTypeIcons[testRun.blockType] || <Layers size={16} />;

  const progressPercent = testRun.totalIterations > 0
    ? Math.round((testRun.evaluatedIterations / testRun.totalIterations) * 100)
    : 0;

  const handleClick = () => {
    navigate(`/testing/${testRun.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(testRun.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="test-run-card" onClick={handleClick}>
      <div className="test-run-card__header">
        <div className="test-run-card__block-type">
          {blockIcon}
          <span>{testRun.blockType}</span>
        </div>
        <div className={`test-run-card__status test-run-card__status--${status.className}`}>
          {status.icon}
          <span>{status.label}</span>
        </div>
      </div>

      <div className="test-run-card__body">
        <h3 className="test-run-card__name">{testRun.name}</h3>
        <p className="test-run-card__block-id">{testRun.blockId}</p>

        {testRun.variantId && (
          <div className="test-run-card__variant">
            Variant: <strong>{testRun.variantId}</strong>
          </div>
        )}

        <div className="test-run-card__progress">
          <div className="test-run-card__progress-bar">
            <div
              className="test-run-card__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="test-run-card__progress-text">
            {testRun.evaluatedIterations}/{testRun.totalIterations} evaluated
          </span>
        </div>

        {testRun.metrics && (
          <div className="test-run-card__score">
            <span className="test-run-card__score-label">Score</span>
            <span
              className={`test-run-card__score-value test-run-card__score-value--${
                testRun.metrics.overallScore >= 80
                  ? 'high'
                  : testRun.metrics.overallScore >= 60
                  ? 'medium'
                  : 'low'
              }`}
            >
              {testRun.metrics.overallScore}
            </span>
          </div>
        )}
      </div>

      <div className="test-run-card__footer">
        <span className="test-run-card__date">{formatDate(testRun.createdAt)}</span>
        <span className="test-run-card__evaluator">{testRun.evaluatorType}</span>
        {onDelete && (
          <button
            className="test-run-card__delete"
            onClick={handleDelete}
            title="Delete test run"
          >
            <XCircle size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TestRunCard;
