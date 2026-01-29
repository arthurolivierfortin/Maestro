/**
 * TestRunDetailPage Component
 * Detailed view of a test run with iterations and evaluation
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { useTestStore } from '../store/testStore';
import { TestMetricsGrid, EvaluationForm } from '../components/Testing';
import type { BlockTestIteration, SubmitEvaluationRequest } from '../types/test.types';
import './TestRunDetailPage.scss';

export const TestRunDetailPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [expandedIteration, setExpandedIteration] = useState<string | null>(null);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [newSuggestion, setNewSuggestion] = useState('');

  const {
    currentTestRun,
    isLoading,
    isSubmitting,
    error,
    loadTestRun,
    submitEvaluation,
    submitImprovement,
    deleteTestRun,
    clearCurrentTestRun,
  } = useTestStore();

  useEffect(() => {
    if (runId) {
      loadTestRun(runId);
    }
    return () => {
      clearCurrentTestRun();
    };
  }, [runId, loadTestRun, clearCurrentTestRun]);

  const handleBack = () => {
    navigate('/testing');
  };

  const handleRefresh = () => {
    if (runId) {
      loadTestRun(runId);
    }
  };

  const handleDelete = async () => {
    if (runId && window.confirm('Are you sure you want to delete this test run?')) {
      await deleteTestRun(runId);
      navigate('/testing');
    }
  };

  const handleEvaluationSubmit = async (evaluation: SubmitEvaluationRequest) => {
    if (runId) {
      await submitEvaluation(runId, evaluation);
      setExpandedIteration(null);
    }
  };

  const handleAddSuggestion = async () => {
    if (runId && newSuggestion.trim()) {
      await submitImprovement(runId, [newSuggestion.trim()]);
      setNewSuggestion('');
      setShowSuggestionForm(false);
    }
  };

  const toggleIteration = (iterationId: string) => {
    setExpandedIteration((prev) => (prev === iterationId ? null : iterationId));
  };

  if (isLoading && !currentTestRun) {
    return (
      <div className="test-run-detail">
        <div className="test-run-detail__loading">Loading test run...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-run-detail">
        <div className="test-run-detail__error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={handleBack}>Go Back</button>
        </div>
      </div>
    );
  }

  if (!currentTestRun) {
    return (
      <div className="test-run-detail">
        <div className="test-run-detail__error">
          <AlertCircle size={20} />
          <span>Test run not found</span>
          <button onClick={handleBack}>Go Back</button>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { className: string; label: string }> = {
    Pending: { className: 'pending', label: 'Pending' },
    Running: { className: 'running', label: 'Running' },
    AwaitingEvaluation: { className: 'awaiting', label: 'Awaiting Evaluation' },
    Completed: { className: 'completed', label: 'Completed' },
    Failed: { className: 'failed', label: 'Failed' },
    Cancelled: { className: 'cancelled', label: 'Cancelled' },
  };

  const status = statusConfig[currentTestRun.status] || statusConfig.Pending;
  const pendingIterations = currentTestRun.iterations.filter((i) => !i.evaluation);

  return (
    <div className="test-run-detail">
      <header className="test-run-detail__header">
        <button className="test-run-detail__back" onClick={handleBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="test-run-detail__title">
          <h1>{currentTestRun.name}</h1>
          <div className="test-run-detail__meta">
            <span className="test-run-detail__block-type">{currentTestRun.blockType}</span>
            <span className="test-run-detail__block-id">{currentTestRun.blockId}</span>
            <span className={`test-run-detail__status test-run-detail__status--${status.className}`}>
              {status.label}
            </span>
          </div>
        </div>
        <div className="test-run-detail__actions">
          <button
            className="test-run-detail__btn test-run-detail__btn--secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
          </button>
          <button
            className="test-run-detail__btn test-run-detail__btn--danger"
            onClick={handleDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="test-run-detail__content">
        {/* Info Section */}
        <section className="test-run-detail__section">
          <h2>Test Information</h2>
          <div className="test-run-detail__info-grid">
            <div className="test-run-detail__info-item">
              <label>Variant</label>
              <span>{currentTestRun.variantId}</span>
            </div>
            {currentTestRun.variantDescription && (
              <div className="test-run-detail__info-item test-run-detail__info-item--wide">
                <label>Description</label>
                <span>{currentTestRun.variantDescription}</span>
              </div>
            )}
            <div className="test-run-detail__info-item">
              <label>Evaluator</label>
              <span>{currentTestRun.evaluatorType}</span>
            </div>
            <div className="test-run-detail__info-item">
              <label>Progress</label>
              <span>{currentTestRun.evaluatedIterations}/{currentTestRun.totalIterations} evaluated</span>
            </div>
            <div className="test-run-detail__info-item">
              <label>Created</label>
              <span>{new Date(currentTestRun.createdAt).toLocaleString()}</span>
            </div>
            {currentTestRun.completedAt && (
              <div className="test-run-detail__info-item">
                <label>Completed</label>
                <span>{new Date(currentTestRun.completedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>

        {/* Metrics Section */}
        {currentTestRun.metrics && (
          <section className="test-run-detail__section">
            <h2>Metrics</h2>
            <TestMetricsGrid
              metrics={currentTestRun.metrics}
              totalIterations={currentTestRun.totalIterations}
              completedIterations={currentTestRun.completedIterations}
            />
          </section>
        )}

        {/* Pending Evaluations Alert */}
        {pendingIterations.length > 0 && (
          <div className="test-run-detail__pending-alert">
            <Clock size={18} />
            <span>
              <strong>{pendingIterations.length}</strong> iteration(s) awaiting evaluation.
              Expand an iteration below to evaluate it.
            </span>
          </div>
        )}

        {/* Iterations Section */}
        <section className="test-run-detail__section">
          <h2>Iterations ({currentTestRun.iterations.length})</h2>
          <div className="test-run-detail__iterations">
            {currentTestRun.iterations.map((iteration) => (
              <IterationItem
                key={iteration.id}
                iteration={iteration}
                criteria={currentTestRun.criteria}
                isExpanded={expandedIteration === iteration.id}
                isSubmitting={isSubmitting}
                onToggle={() => toggleIteration(iteration.id)}
                onEvaluate={handleEvaluationSubmit}
              />
            ))}
          </div>
        </section>

        {/* Improvement Suggestions Section */}
        <section className="test-run-detail__section">
          <div className="test-run-detail__section-header">
            <h2>Improvement Suggestions</h2>
            <button
              className="test-run-detail__btn test-run-detail__btn--secondary"
              onClick={() => setShowSuggestionForm(!showSuggestionForm)}
            >
              <Lightbulb size={16} />
              Add Suggestion
            </button>
          </div>

          {showSuggestionForm && (
            <div className="test-run-detail__suggestion-form">
              <textarea
                value={newSuggestion}
                onChange={(e) => setNewSuggestion(e.target.value)}
                placeholder="Enter your improvement suggestion..."
                rows={3}
              />
              <div className="test-run-detail__suggestion-actions">
                <button
                  className="test-run-detail__btn test-run-detail__btn--secondary"
                  onClick={() => {
                    setShowSuggestionForm(false);
                    setNewSuggestion('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="test-run-detail__btn test-run-detail__btn--primary"
                  onClick={handleAddSuggestion}
                  disabled={!newSuggestion.trim() || isSubmitting}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {currentTestRun.improvementSuggestions.length > 0 ? (
            <ul className="test-run-detail__suggestions">
              {currentTestRun.improvementSuggestions.map((suggestion, index) => (
                <li key={index}>
                  <Lightbulb size={14} />
                  {suggestion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="test-run-detail__no-suggestions">
              No improvement suggestions yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

// Iteration Item Component
interface IterationItemProps {
  iteration: BlockTestIteration;
  criteria: { id: string; name: string; description: string; weight: number }[];
  isExpanded: boolean;
  isSubmitting: boolean;
  onToggle: () => void;
  onEvaluate: (evaluation: SubmitEvaluationRequest) => Promise<void>;
}

const IterationItem: React.FC<IterationItemProps> = ({
  iteration,
  criteria,
  isExpanded,
  isSubmitting,
  onToggle,
  onEvaluate,
}) => {
  const isEvaluated = !!iteration.evaluation;

  return (
    <div className={`iteration-item ${isExpanded ? 'expanded' : ''} ${isEvaluated ? 'evaluated' : 'pending'}`}>
      <button className="iteration-item__header" onClick={onToggle}>
        <span className="iteration-item__toggle">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="iteration-item__number">#{iteration.iterationNumber}</span>
        <span className={`iteration-item__success ${iteration.success ? 'yes' : 'no'}`}>
          {iteration.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {iteration.success ? 'Success' : 'Failed'}
        </span>
        <span className="iteration-item__duration">{iteration.durationMs}ms</span>
        {isEvaluated ? (
          <span className={`iteration-item__score iteration-item__score--${
            iteration.evaluation!.score >= 80 ? 'high' :
            iteration.evaluation!.score >= 60 ? 'medium' : 'low'
          }`}>
            Score: {iteration.evaluation!.score}
          </span>
        ) : (
          <span className="iteration-item__pending">
            <Clock size={14} />
            Pending Evaluation
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="iteration-item__content">
          {iteration.outputContent && (
            <div className="iteration-item__output">
              <label>Output:</label>
              <pre>{iteration.outputContent}</pre>
            </div>
          )}

          {iteration.errorMessage && (
            <div className="iteration-item__error">
              <AlertCircle size={14} />
              {iteration.errorMessage}
            </div>
          )}

          {iteration.logs.length > 0 && (
            <div className="iteration-item__logs">
              <label>Logs:</label>
              <ul>
                {iteration.logs.map((log, i) => (
                  <li key={i}>{log}</li>
                ))}
              </ul>
            </div>
          )}

          {isEvaluated ? (
            <div className="iteration-item__evaluation">
              <h4>Evaluation</h4>
              <div className="iteration-item__eval-details">
                <span>Score: <strong>{iteration.evaluation!.score}</strong></span>
                <span>Method: {iteration.evaluation!.method}</span>
                <span>Confidence: {(iteration.evaluation!.confidence * 100).toFixed(0)}%</span>
              </div>
              {iteration.evaluation!.explanation && (
                <p className="iteration-item__explanation">{iteration.evaluation!.explanation}</p>
              )}
            </div>
          ) : (
            <EvaluationForm
              iteration={iteration}
              criteria={criteria}
              onSubmit={onEvaluate}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TestRunDetailPage;
