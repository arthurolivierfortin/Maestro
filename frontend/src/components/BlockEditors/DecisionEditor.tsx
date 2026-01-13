/**
 * Decision Editor
 *
 * Type-specific editor for decision blocks.
 * Includes condition expression and branch configuration.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, DecisionBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface DecisionEditorProps {
  block: Block<DecisionBlockConfig>;
}

export function DecisionEditor({ block }: DecisionEditorProps) {
  const { updateBlock } = useBlockStore();
  const [config, setConfig] = useState<DecisionBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: DecisionBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof DecisionBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Decision Configuration</h2>
        <p className="base-block-editor__section-description">
          Define conditional logic to control workflow branching.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="condition">
            Condition Expression
          </label>
          <textarea
            id="condition"
            className="base-block-editor__textarea"
            value={config.condition}
            onChange={(e) => handleFieldChange('condition', e.target.value)}
            placeholder="input.value > 10 && input.status === 'active'"
            rows={6}
            style={{ fontFamily: 'monospace' }}
          />
          <p className="base-block-editor__help-text">
            JavaScript expression that evaluates to true/false. Use `input` to access workflow data.
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="trueLabel">
            True Branch Label
          </label>
          <input
            id="trueLabel"
            type="text"
            className="base-block-editor__input"
            value={config.trueLabel || ''}
            onChange={(e) => handleFieldChange('trueLabel', e.target.value)}
            placeholder="Yes / True / Success"
          />
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="falseLabel">
            False Branch Label
          </label>
          <input
            id="falseLabel"
            type="text"
            className="base-block-editor__input"
            value={config.falseLabel || ''}
            onChange={(e) => handleFieldChange('falseLabel', e.target.value)}
            placeholder="No / False / Failure"
          />
        </div>
      </div>
    </BaseBlockEditor>
  );
}
