/**
 * Execution Modal Component
 *
 * Modal dialog for executing blocks and workflows with input parameters.
 */

import { useState } from 'react';
import { Play, X, Folder, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { executeBlock, executeWorkflow, type BlockExecutionResult, type WorkflowExecutionResult } from '../../services/executionService';
import './ExecutionModal.scss';

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string;
  blockName: string;
  blockType: string;
  isWorkflow?: boolean;
}

type ExecutionState = 'idle' | 'running' | 'success' | 'error';

export function ExecutionModal({
  isOpen,
  onClose,
  blockId,
  blockName,
  blockType,
  isWorkflow = false,
}: ExecutionModalProps) {
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [customInputs, setCustomInputs] = useState('{}');
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  const [result, setResult] = useState<BlockExecutionResult | WorkflowExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setExecutionState('running');
    setResult(null);
    setError(null);

    try {
      let inputs: Record<string, unknown> = {};
      try {
        inputs = JSON.parse(customInputs);
      } catch {
        // Ignore JSON parse errors, use empty object
      }

      const request = {
        inputs,
        workingDirectory: workingDirectory || undefined,
      };

      let executionResult: BlockExecutionResult | WorkflowExecutionResult;

      if (isWorkflow || blockType === 'workflow') {
        executionResult = await executeWorkflow(blockId, request);
      } else {
        executionResult = await executeBlock(blockId, request);
      }

      setResult(executionResult);
      setExecutionState(executionResult.success ? 'success' : 'error');

      if (!executionResult.success && executionResult.error) {
        setError(executionResult.error);
      }
    } catch (err) {
      setExecutionState('error');
      setError(err instanceof Error ? err.message : 'Execution failed');
    }
  };

  const handleClose = () => {
    setExecutionState('idle');
    setResult(null);
    setError(null);
    onClose();
  };

  const renderStatusIcon = () => {
    switch (executionState) {
      case 'running':
        return <Loader2 className="execution-modal__status-icon execution-modal__status-icon--running" size={24} />;
      case 'success':
        return <CheckCircle className="execution-modal__status-icon execution-modal__status-icon--success" size={24} />;
      case 'error':
        return <XCircle className="execution-modal__status-icon execution-modal__status-icon--error" size={24} />;
      default:
        return null;
    }
  };

  return (
    <div className="execution-modal__overlay" onClick={handleClose}>
      <div className="execution-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="execution-modal__header">
          <div className="execution-modal__title-row">
            <Play size={20} />
            <h2 className="execution-modal__title">
              Execute {isWorkflow || blockType === 'workflow' ? 'Workflow' : 'Block'}
            </h2>
          </div>
          <button className="execution-modal__close" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Block Info */}
        <div className="execution-modal__block-info">
          <span className="execution-modal__block-name">{blockName}</span>
          <span className="execution-modal__block-type">{blockType}</span>
        </div>

        {/* Input Form */}
        <div className="execution-modal__form">
          {/* Working Directory */}
          <div className="execution-modal__field">
            <label className="execution-modal__label">
              <Folder size={16} />
              Working Directory
            </label>
            <input
              type="text"
              className="execution-modal__input"
              placeholder="/path/to/repository"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              disabled={executionState === 'running'}
            />
            <span className="execution-modal__hint">
              Required for git-related operations
            </span>
          </div>

          {/* Custom Inputs */}
          <div className="execution-modal__field">
            <label className="execution-modal__label">
              Custom Inputs (JSON)
            </label>
            <textarea
              className="execution-modal__textarea"
              placeholder='{"key": "value"}'
              value={customInputs}
              onChange={(e) => setCustomInputs(e.target.value)}
              disabled={executionState === 'running'}
              rows={3}
            />
          </div>
        </div>

        {/* Status & Results */}
        {executionState !== 'idle' && (
          <div className={`execution-modal__results execution-modal__results--${executionState}`}>
            <div className="execution-modal__status">
              {renderStatusIcon()}
              <span>
                {executionState === 'running' && 'Executing...'}
                {executionState === 'success' && 'Execution completed successfully'}
                {executionState === 'error' && (error || 'Execution failed')}
              </span>
            </div>

            {result && (
              <div className="execution-modal__output">
                <h3>Output:</h3>
                <pre className="execution-modal__json">
                  {JSON.stringify(result.outputs || result, null, 2)}
                </pre>

                {'logs' in result && result.logs && result.logs.length > 0 && (
                  <>
                    <h3>Logs:</h3>
                    <div className="execution-modal__logs">
                      {result.logs.map((log, i) => (
                        <div key={i} className="execution-modal__log-line">{log}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="execution-modal__actions">
          <button
            className="execution-modal__button execution-modal__button--secondary"
            onClick={handleClose}
          >
            {executionState === 'idle' ? 'Cancel' : 'Close'}
          </button>
          <button
            className="execution-modal__button execution-modal__button--primary"
            onClick={handleExecute}
            disabled={executionState === 'running'}
          >
            {executionState === 'running' ? (
              <>
                <Loader2 size={16} className="execution-modal__spinner" />
                Executing...
              </>
            ) : (
              <>
                <Play size={16} />
                Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExecutionModal;
