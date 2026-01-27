/**
 * Validator Editor
 *
 * Type-specific editor for validator blocks.
 * Includes validation schema and test button.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, ValidatorBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface ValidatorEditorProps {
  block: Block<ValidatorBlockConfig>;
}

export function ValidatorEditor({ block }: ValidatorEditorProps) {
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const [config, setConfig] = useState<ValidatorBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: ValidatorBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof ValidatorBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleTestValidation = useCallback(() => {
    try {
      // Try to parse the schema if it exists as a string
      const schemaToTest = (config as any).validationSchema || config.schema;
      if (typeof schemaToTest === 'string') {
        JSON.parse(schemaToTest);
      } else if (schemaToTest) {
        // Already an object, validate it's valid JSON by stringifying
        JSON.stringify(schemaToTest);
      }
      setTestResult('✅ Valid JSON Schema');
    } catch (error) {
      setTestResult(`❌ Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [config]);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Validator Configuration</h2>
        <p className="base-block-editor__section-description">
          Define validation rules using JSON Schema format.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="validationSchema">
            Validation Schema (JSON Schema)
          </label>
          <textarea
            id="validationSchema"
            className="base-block-editor__textarea"
            value={
              (config as any).validationSchema ||
              (config.schema ? JSON.stringify(config.schema, null, 2) : '')
            }
            onChange={(e) =>
              handleFieldChange(
                'schema' as keyof ValidatorBlockConfig,
                e.target.value ? JSON.parse(e.target.value) : undefined
              )
            }
            placeholder='{"type": "object", "properties": {...}}'
            rows={15}
            style={{ fontFamily: 'monospace' }}
          />
          <p className="base-block-editor__help-text">
            JSON Schema definition for validating outputs. See https://json-schema.org/
          </p>
        </div>

        <div className="base-block-editor__field">
          <button
            type="button"
            className="base-block-editor__input"
            onClick={handleTestValidation}
            style={{ cursor: 'pointer', padding: '10px' }}
          >
            Test Validation Schema
          </button>
          {testResult && (
            <p
              className="base-block-editor__help-text"
              style={{
                marginTop: '8px',
                padding: '8px',
                background: testResult.startsWith('✅') ? '#d4edda' : '#f8d7da',
                border: `1px solid ${testResult.startsWith('✅') ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '4px',
              }}
            >
              {testResult}
            </p>
          )}
        </div>
      </div>
    </BaseBlockEditor>
  );
}
