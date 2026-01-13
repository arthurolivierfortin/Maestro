/**
 * Block Edit Page
 *
 * Edit page for individual blocks. Routes atomic blocks here for editing
 * while composite blocks (workflows) go to the Canvas editor.
 *
 * Phase 4g.2: Type-specific editors integrated.
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBlockStore } from '../store';
import { useNavigationStore } from '../store/navigationStore';
import { Button } from '../components/common';
import { getEditorForBlockType } from '../components/BlockEditors';
import './BlockEditPage.scss';

export function BlockEditPage() {
  const { blockId } = useParams<{ blockId: string }>();
  const navigate = useNavigate();
  const { getBlock } = useBlockStore();
  const { enterAtomicBlockEdit, exitAtomicBlockEdit } = useNavigationStore();

  // Get the block from store
  const block = blockId ? getBlock(blockId) : undefined;

  // Enter atomic block edit mode on mount, exit on unmount
  useEffect(() => {
    if (blockId && block?.isAtomic) {
      enterAtomicBlockEdit(blockId);
    }
    
    return () => {
      exitAtomicBlockEdit();
    };
  }, [blockId, block?.isAtomic, enterAtomicBlockEdit, exitAtomicBlockEdit]);

  // If block not found, show error
  if (!blockId || !block) {
    return (
      <div className="block-edit-page block-edit-page--not-found">
        <div className="block-edit-page__error">
          <h1>Block Not Found</h1>
          <p>The block you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate('/foundry')}>Back to Foundry</Button>
        </div>
      </div>
    );
  }

  // If block is composite, redirect to canvas
  if (!block.isAtomic) {
    navigate(`/canvas/${blockId}`);
    return null;
  }

  // Get the appropriate editor for this block type
  const EditorComponent = getEditorForBlockType(block.blockType);

  // If no editor exists for this block type, show placeholder
  if (!EditorComponent) {
    return (
      <div className="block-edit-page">
        <div className="block-edit-page__section">
          <h2 className="block-edit-page__section-title">Editor Not Available</h2>
          <p>
            No editor available for <strong>{block.blockType}</strong> blocks yet.
          </p>
          <Button onClick={() => navigate('/foundry')}>Back to Foundry</Button>
        </div>
      </div>
    );
  }

  // Render the type-specific editor
  return <EditorComponent block={block} />;
}

export default BlockEditPage;
