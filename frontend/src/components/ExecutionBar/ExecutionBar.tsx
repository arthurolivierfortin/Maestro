/**
 * ExecutionBar Component
 *
 * Toolbar for controlling workflow execution (Run, Pause, Resume, Cancel)
 */

import { Play, Pause, RotateCcw, X, AlertCircle } from 'lucide-react';
import { useExecutionStore } from '../../store/executionStore';
import type { ExecutionStatus } from '../../types/execution.types';
import './ExecutionBar.scss';

export interface ExecutionBarProps {
  workflowId: string | null;
  onExecutionStart?: () => void;
}

export function ExecutionBar({ workflowId, onExecutionStart }: ExecutionBarProps) {
  const {
    currentExecution,
    isLoading,
    error,
    startExecution,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    clearError,
  } = useExecutionStore();

  const handleRun = async () => {
    if (!workflowId) return;
    
    if (onExecutionStart) {
      onExecutionStart();
    }
    
    await startExecution(workflowId);
  };

  const handlePause = async () => {
    if (!currentExecution) return;
    await pauseExecution(currentExecution.id);
  };

  const handleResume = async () => {
    if (!currentExecution) return;
    await resumeExecution(currentExecution.id);
  };

  const handleCancel = async () => {
    if (!currentExecution) return;
    if (confirm('Cancel execution?')) {
      await cancelExecution(currentExecution.id);
    }
  };

  const isRunning = currentExecution?.status === 'Running';
  const isPaused = currentExecution?.status === 'Paused';
  const isCompleted =
    currentExecution?.status === 'Completed' ||
    currentExecution?.status === 'Failed' ||
    currentExecution?.status === 'Cancelled';

  const getStatusColor = (status?: ExecutionStatus): string => {
    switch (status) {
      case 'Running':
        return 'running';
      case 'Paused':
        return 'paused';
      case 'Completed':
        return 'completed';
      case 'Failed':
        return 'failed';
      case 'Cancelled':
        return 'cancelled';
      default:
        return '';
    }
  };

  return (
    <div className="execution-bar">
      <div className="execution-bar__controls">
        {/* Run Button */}
        {!currentExecution || isCompleted ? (
          <button
            className="execution-bar__button execution-bar__button--primary"
            onClick={handleRun}
            disabled={!workflowId || isLoading}
            title="Run workflow"
          >
            <Play size={18} />
            <span>Run</span>
          </button>
        ) : null}

        {/* Pause/Resume Button */}
        {isRunning && (
          <button
            className="execution-bar__button"
            onClick={handlePause}
            disabled={isLoading}
            title="Pause execution"
          >
            <Pause size={18} />
            <span>Pause</span>
          </button>
        )}

        {isPaused && (
          <button
            className="execution-bar__button execution-bar__button--primary"
            onClick={handleResume}
            disabled={isLoading}
            title="Resume execution"
          >
            <RotateCcw size={18} />
            <span>Resume</span>
          </button>
        )}

        {/* Cancel Button */}
        {(isRunning || isPaused) && (
          <button
            className="execution-bar__button execution-bar__button--danger"
            onClick={handleCancel}
            disabled={isLoading}
            title="Cancel execution"
          >
            <X size={18} />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Status Display */}
      {currentExecution && (
        <div className="execution-bar__status">
          <div className={`execution-bar__status-indicator execution-bar__status-indicator--${getStatusColor(currentExecution.status)}`}>
            <span className="execution-bar__status-dot" />
            <span className="execution-bar__status-text">{currentExecution.status}</span>
          </div>

          {currentExecution.status === 'Running' && currentExecution.nodeExecutions && (
            <div className="execution-bar__progress">
              <span className="execution-bar__progress-text">
                {currentExecution.nodeExecutions.filter(n => n.status === 'Completed').length} /{' '}
                {currentExecution.nodeExecutions.length} nodes
              </span>
            </div>
          )}

          {currentExecution.duration !== undefined && (
            <div className="execution-bar__duration">
              <span>{formatDuration(currentExecution.duration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="execution-bar__error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            className="execution-bar__error-close"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
