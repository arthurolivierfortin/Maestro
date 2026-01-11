/**
 * Block Edit Page
 *
 * Edit page for individual blocks. Routes atomic blocks here for editing
 * while composite blocks (workflows) go to the Canvas editor.
 *
 * Phase 4g.2: Type-specific editors will be added in future enhancements.
 * For now, this provides a basic edit layout with block metadata.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useBlockStore } from '../store';
import { BlockIcon } from '../components/icons';
import { Button } from '../components/common';
import './BlockEditPage.scss';

export function BlockEditPage() {
  const { blockId } = useParams<{ blockId: string }>();
  const navigate = useNavigate();
  const { getBlock } = useBlockStore();

  // Get the block from store
  const block = blockId ? getBlock(blockId) : undefined;

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

  // Handle back to foundry
  const handleBack = () => {
    navigate('/foundry');
  };

  // Handle save (placeholder for future implementation)
  const handleSave = () => {
    console.log('Save block:', block);
    // TODO: Implement save logic with type-specific editors
  };

  return (
    <div className="block-edit-page">
      {/* Header */}
      <div className="block-edit-page__header">
        <div className="block-edit-page__title-row">
          <BlockIcon type={block.blockType} size={32} />
          <div className="block-edit-page__title-group">
            <h1 className="block-edit-page__title">{block.name}</h1>
            <span className="block-edit-page__type-badge">{block.blockType}</span>
          </div>
        </div>

        <div className="block-edit-page__actions">
          <Button variant="secondary" onClick={handleBack}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="block-edit-page__section">
        <h2 className="block-edit-page__section-title">Block Information</h2>
        <div className="block-edit-page__metadata">
          <div className="block-edit-page__field">
            <label>Name</label>
            <div className="block-edit-page__value">{block.name}</div>
          </div>

          <div className="block-edit-page__field">
            <label>Type</label>
            <div className="block-edit-page__value">{block.blockType}</div>
          </div>

          {block.metadata.description && (
            <div className="block-edit-page__field">
              <label>Description</label>
              <div className="block-edit-page__value">{block.metadata.description}</div>
            </div>
          )}

          <div className="block-edit-page__field">
            <label>Status</label>
            <div className="block-edit-page__value">
              <span className={`block-edit-page__status block-edit-page__status--${block.metadata.status}`}>
                {block.metadata.status}
              </span>
            </div>
          </div>

          {block.metadata.tags.length > 0 && (
            <div className="block-edit-page__field">
              <label>Tags</label>
              <div className="block-edit-page__tags">
                {block.metadata.tags.map((tag) => (
                  <span key={tag} className="block-edit-page__tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {block.capabilities && block.capabilities.length > 0 && (
            <div className="block-edit-page__field">
              <label>Capabilities</label>
              <div className="block-edit-page__tags">
                {block.capabilities.map((capability) => (
                  <span key={capability} className="block-edit-page__tag">
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="block-edit-page__field">
            <label>Created</label>
            <div className="block-edit-page__value">
              {new Date(block.metadata.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="block-edit-page__field">
            <label>Last Updated</label>
            <div className="block-edit-page__value">
              {new Date(block.metadata.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Placeholder */}
      <div className="block-edit-page__section">
        <h2 className="block-edit-page__section-title">Configuration</h2>
        <div className="block-edit-page__editor-placeholder">
          <p>
            Type-specific editor for <strong>{block.blockType}</strong> blocks will be implemented in
            Phase 4g.2.
          </p>
          <p className="block-edit-page__editor-hint">
            Configuration: <code>{JSON.stringify(block.config, null, 2)}</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default BlockEditPage;
