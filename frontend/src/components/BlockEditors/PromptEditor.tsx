/**
 * Prompt Editor
 *
 * Type-specific editor for prompt blocks.
 * Includes template editor with variable detection and preview.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, PromptBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface PromptEditorProps {
  block: Block<PromptBlockConfig>;
}

export function PromptEditor({ block }: PromptEditorProps) {
  const { updateBlock } = useBlockStore();
  const [config, setConfig] = useState<PromptBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  // Detect variables in template (e.g., {{variableName}})
  const detectedVariables = useMemo(() => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = [...(config.template || '').matchAll(regex)];
    return [...new Set(matches.map((m) => m[1]))];
  }, [config.template]);

  const handleSave = useCallback(
    (updatedConfig: PromptBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof PromptBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Prompt Template</h2>
        <p className="base-block-editor__section-description">
          Create a reusable prompt template with variables using {'{{'} variableName {'}}'} syntax.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="template">
            Template
          </label>
          <textarea
            id="template"
            className="base-block-editor__textarea"
            value={config.template}
            onChange={(e) => handleFieldChange('template', e.target.value)}
            placeholder="Enter prompt template with {{variables}}..."
            rows={15}
          />
          <p className="base-block-editor__help-text">
            Use {'{{'} variableName {'}}'} syntax for placeholders that will be replaced at runtime.
          </p>
        </div>
      </div>

      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Detected Variables</h2>
        <p className="base-block-editor__section-description">
          Variables automatically detected from your template.
        </p>

        {detectedVariables.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {detectedVariables.map((varName) => (
              <li
                key={varName}
                style={{
                  padding: '8px 12px',
                  marginBottom: '4px',
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              >
                {'{{'} {varName} {'}}'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="base-block-editor__help-text">
            No variables detected. Add {'{{'} variableName {'}}'} to your template to define
            variables.
          </p>
        )}
      </div>
    </BaseBlockEditor>
  );
}
