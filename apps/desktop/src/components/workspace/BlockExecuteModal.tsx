/**
 * Block Execute Modal
 *
 * Modal for executing a block with optional input parameters.
 * Allows users to specify inputs and context before execution.
 */

import React, { useState, useCallback } from 'react';
import { blockService, BlockExecutionResult } from '../../services/blockService';
import type { Block } from '../../types/block.types';
import './BlockExecuteModal.scss';

interface BlockExecuteModalProps {
  block: Block;
  workspaceId?: string;
  onClose: () => void;
  onExecuted?: (result: BlockExecutionResult) => void;
}

export const BlockExecuteModal: React.FC<BlockExecuteModalProps> = ({
  block,
  workspaceId: _workspaceId,
  onClose,
  onExecuted,
}) => {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<BlockExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get expected inputs from block definition
  const expectedInputs = block.inputs || [];

  const handleInputChange = useCallback((key: string, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      // Parse JSON inputs where applicable
      const parsedInputs: Record<string, any> = {};
      for (const [key, value] of Object.entries(inputs)) {
        try {
          // Attempt to parse as JSON
          parsedInputs[key] = JSON.parse(value);
        } catch {
          // Keep as string if not valid JSON
          parsedInputs[key] = value;
        }
      }

      const executionResult = await blockService.execute(block.id, parsedInputs);
      setResult(executionResult);
      onExecuted?.(executionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    if (!isExecuting) {
      onClose();
    }
  };

  const getBlockTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      tool: '🔧',
      agent: '🤖',
      workflow: '🔄',
      prompt: '💬',
      inference: '🧠',
      task: '📋',
      default: '📦',
    };
    return icons[type] || icons.default;
  };

  return (
    <div className="block-execute-modal-overlay" onClick={handleClose}>
      <div className="block-execute-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="block-execute-modal__header">
          <div className="block-execute-modal__title">
            <span className="block-execute-modal__icon">
              {getBlockTypeIcon(block.blockType)}
            </span>
            <span>Execute: {block.name}</span>
          </div>
          <button
            className="block-execute-modal__close"
            onClick={handleClose}
            disabled={isExecuting}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="block-execute-modal__content">
          {/* Block Info */}
          <div className="block-execute-modal__info">
            <span className="block-execute-modal__type">{block.blockType}</span>
            {block.metadata?.description && (
              <p className="block-execute-modal__description">
                {block.metadata.description}
              </p>
            )}
          </div>

          {/* Inputs Section */}
          <div className="block-execute-modal__section">
            <h3>Inputs</h3>
            {expectedInputs.length > 0 ? (
              <div className="block-execute-modal__inputs">
                {expectedInputs.map((input: any) => (
                  <div key={input.name || input.id} className="block-execute-modal__input-field">
                    <label>
                      {input.name || input.id}
                      {input.required && <span className="required">*</span>}
                    </label>
                    {input.description && (
                      <span className="block-execute-modal__input-hint">
                        {input.description}
                      </span>
                    )}
                    <input
                      type="text"
                      placeholder={input.type === 'object' ? '{ "key": "value" }' : input.default || ''}
                      value={inputs[input.name || input.id] || ''}
                      onChange={e => handleInputChange(input.name || input.id, e.target.value)}
                      disabled={isExecuting}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="block-execute-modal__no-inputs">
                No inputs required for this block.
              </p>
            )}
          </div>

          {/* Custom Input */}
          <div className="block-execute-modal__section">
            <h3>Additional Input (JSON)</h3>
            <textarea
              className="block-execute-modal__json-input"
              placeholder='{"customKey": "customValue"}'
              value={inputs._custom || ''}
              onChange={e => handleInputChange('_custom', e.target.value)}
              disabled={isExecuting}
              rows={3}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="block-execute-modal__error">
              <span className="block-execute-modal__error-icon">❌</span>
              {error}
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className={`block-execute-modal__result block-execute-modal__result--${result.status}`}>
              <div className="block-execute-modal__result-header">
                <span className="block-execute-modal__result-status">
                  {result.status === 'completed' && '✅'}
                  {result.status === 'failed' && '❌'}
                  {result.status === 'running' && '⏳'}
                  {result.status === 'pending' && '🕐'}
                  {' '}{result.status.toUpperCase()}
                </span>
                {result.duration && (
                  <span className="block-execute-modal__result-duration">
                    {result.duration}ms
                  </span>
                )}
              </div>
              {result.output && (
                <pre className="block-execute-modal__result-output">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              )}
              {result.error && (
                <pre className="block-execute-modal__result-error">
                  {result.error}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="block-execute-modal__footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isExecuting}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              className="btn btn-primary"
              onClick={handleExecute}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <span className="spinner"></span>
                  Executing...
                </>
              ) : (
                <>▶ Execute</>
              )}
            </button>
          )}
          {result && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              Run Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockExecuteModal;
