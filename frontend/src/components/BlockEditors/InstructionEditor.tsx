/**
 * Instruction Editor
 *
 * Type-specific editor for instruction blocks.
 * Includes file path and scope configuration.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, InstructionBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface InstructionEditorProps {
  block: Block<InstructionBlockConfig>;
}

export function InstructionEditor({ block }: InstructionEditorProps) {
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const [config, setConfig] = useState<InstructionBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: InstructionBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof InstructionBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Instruction Configuration</h2>
        <p className="base-block-editor__section-description">
          Configure the instruction file path and scope.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="filePath">
            File Path
          </label>
          <input
            id="filePath"
            type="text"
            className="base-block-editor__input"
            value={config.filePath}
            onChange={(e) => handleFieldChange('filePath', e.target.value)}
            placeholder=".github/instructions/my-instruction.md"
          />
          <p className="base-block-editor__help-text">
            Path to the instruction file (markdown format recommended).
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="scope">
            Scope (Optional)
          </label>
          <input
            id="scope"
            type="text"
            className="base-block-editor__input"
            value={(config as any).scope || ''}
            onChange={(e) =>
              handleFieldChange('scope' as keyof InstructionBlockConfig, e.target.value)
            }
            placeholder="global, workflow, or agent"
          />
          <p className="base-block-editor__help-text">
            Optional: Defines where this instruction applies.
          </p>
        </div>
      </div>
    </BaseBlockEditor>
  );
}
