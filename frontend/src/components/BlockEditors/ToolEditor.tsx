/**
 * Tool Editor
 *
 * Type-specific editor for tool blocks.
 * Includes tool type, command/script, arguments, and environment variables.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, ToolBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface ToolEditorProps {
  block: Block<ToolBlockConfig>;
}

export function ToolEditor({ block }: ToolEditorProps) {
  const { updateBlock } = useBlockStore();
  const [config, setConfig] = useState<ToolBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: ToolBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback(
    (field: keyof ToolBlockConfig, value: unknown) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Tool Configuration</h2>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="toolType">
            Tool Type
          </label>
          <select
            id="toolType"
            className="base-block-editor__select"
            value={config.toolType}
            onChange={(e) => handleFieldChange('toolType', e.target.value)}
          >
            <option value="Bash">Bash</option>
            <option value="Git">Git</option>
            <option value="FileSystem">File System</option>
            <option value="HTTP">HTTP</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {config.toolType !== 'Custom' && (
          <div className="base-block-editor__field">
            <label className="base-block-editor__label" htmlFor="command">
              Command
            </label>
            <input
              id="command"
              type="text"
              className="base-block-editor__input"
              value={config.command || ''}
              onChange={(e) => handleFieldChange('command', e.target.value)}
              placeholder="e.g., ls -la"
            />
          </div>
        )}

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="script">
            Script
          </label>
          <textarea
            id="script"
            className="base-block-editor__textarea"
            value={config.script || ''}
            onChange={(e) => handleFieldChange('script', e.target.value)}
            placeholder="Enter script code..."
            rows={15}
            style={{ fontFamily: 'monospace' }}
          />
          <p className="base-block-editor__help-text">
            Multi-line script or code to execute. Leave empty if using command only.
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="workingDirectory">
            Working Directory
          </label>
          <input
            id="workingDirectory"
            type="text"
            className="base-block-editor__input"
            value={config.workingDirectory || ''}
            onChange={(e) => handleFieldChange('workingDirectory', e.target.value)}
            placeholder="/path/to/directory"
          />
        </div>
      </div>
    </BaseBlockEditor>
  );
}
