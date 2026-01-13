/**
 * Base Block Editor
 *
 * Shared layout and functionality for all type-specific block editors.
 * Provides consistent header, save/cancel actions, and editor container.
 */

import { ReactNode, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlockIcon } from '../icons';
import { Button } from '../common';
import type { Block, BlockConfig } from '../../types/block.types';
import './BaseBlockEditor.scss';

export interface BaseBlockEditorProps {
  block: Block;
  onSave: (config: BlockConfig) => void;
  onCancel?: () => void;
  children: ReactNode;
  hasUnsavedChanges?: boolean;
}

export function BaseBlockEditor({
  block,
  onSave,
  onCancel,
  children,
  hasUnsavedChanges = false,
}: BaseBlockEditorProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }

    if (onCancel) {
      onCancel();
    } else {
      navigate('/foundry');
    }
  }, [hasUnsavedChanges, onCancel, navigate]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      onSave(block.config);
      // Navigate back after successful save
      navigate('/foundry');
    } catch (error) {
      console.error('Failed to save block:', error);
      alert('Failed to save block. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [block.config, onSave, navigate]);

  return (
    <div className="base-block-editor">
      {/* Header */}
      <div className="base-block-editor__header">
        <div className="base-block-editor__title-row">
          <BlockIcon type={block.blockType} size={32} />
          <div className="base-block-editor__title-group">
            <h1 className="base-block-editor__title">{block.name}</h1>
            <span className="base-block-editor__type-badge">{block.blockType}</span>
          </div>
        </div>

        <div className="base-block-editor__actions">
          {hasUnsavedChanges && (
            <span className="base-block-editor__unsaved-indicator">Unsaved changes</span>
          )}
          <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="base-block-editor__content">{children}</div>
    </div>
  );
}
