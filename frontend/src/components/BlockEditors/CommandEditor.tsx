/**
 * Command Editor
 *
 * Type-specific editor for command blocks (formerly tool blocks).
 * Includes command type, command/script, arguments, and environment variables.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, CommandBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface CommandEditorProps {
  block: Block<CommandBlockConfig>;
}

export function CommandEditor({ block }: CommandEditorProps) {
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const [config, setConfig] = useState<CommandBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: CommandBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof CommandBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Command Configuration</h2>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="commandType">
            Command Type
          </label>
          <select
            id="commandType"
            className="base-block-editor__select"
            value={config.commandType}
            onChange={(e) => handleFieldChange('commandType', e.target.value)}
          >
            <option value="Bash">Bash</option>
            <option value="Git">Git</option>
            <option value="FileSystem">File System</option>
            <option value="HTTP">HTTP</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {config.commandType !== 'Custom' && (
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

/**
 * @deprecated Use CommandEditor instead. Alias for backward compatibility.
 */
export const ToolEditor = CommandEditor;
