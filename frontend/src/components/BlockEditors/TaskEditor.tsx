/**
 * Task Editor
 *
 * Type-specific editor for task blocks.
 * Includes description, inputs, outputs, and validation rules.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, TaskBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface TaskEditorProps {
  block: Block<TaskBlockConfig>;
}

export function TaskEditor({ block }: TaskEditorProps) {
  const { updateBlock } = useBlockStore();
  const [config, setConfig] = useState<TaskBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: TaskBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof TaskBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Task Configuration</h2>
        <p className="base-block-editor__section-description">
          Define the task description, expected inputs, and outputs.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="base-block-editor__textarea"
            value={config.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Describe what this task does..."
            rows={6}
          />
          <p className="base-block-editor__help-text">
            Clear description of the task's purpose and expected behavior.
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="expectedInput">
            Expected Input (Optional)
          </label>
          <textarea
            id="expectedInput"
            className="base-block-editor__textarea"
            value={(config as any).expectedInput || ''}
            onChange={(e) =>
              handleFieldChange('expectedInput' as keyof TaskBlockConfig, e.target.value)
            }
            placeholder="Describe expected input format..."
            rows={4}
          />
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="expectedOutput">
            Expected Output (Optional)
          </label>
          <textarea
            id="expectedOutput"
            className="base-block-editor__textarea"
            value={(config as any).expectedOutput || ''}
            onChange={(e) =>
              handleFieldChange('expectedOutput' as keyof TaskBlockConfig, e.target.value)
            }
            placeholder="Describe expected output format..."
            rows={4}
          />
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="timeout">
            Timeout (seconds)
          </label>
          <input
            id="timeout"
            type="number"
            className="base-block-editor__input"
            value={config.timeout || ''}
            onChange={(e) => handleFieldChange('timeout', parseInt(e.target.value) || undefined)}
            placeholder="300"
          />
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="maxRetries">
            Max Retries
          </label>
          <input
            id="maxRetries"
            type="number"
            className="base-block-editor__input"
            value={config.maxRetries || ''}
            onChange={(e) => handleFieldChange('maxRetries', parseInt(e.target.value) || undefined)}
            placeholder="3"
          />
        </div>
      </div>
    </BaseBlockEditor>
  );
}
