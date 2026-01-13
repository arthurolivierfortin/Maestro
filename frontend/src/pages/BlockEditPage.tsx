/**
 * Block Edit Page
 *
 * Page for editing atomic blocks with a dedicated editor.
 * Non-atomic blocks are redirected to the canvas page.
 */

import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBlockStore } from '../store';
import { useNavigationStore } from '../store/navigationStore';
import { EditorWrapper } from '../components/EditorWrapper';
import { ArrowLeft } from 'lucide-react';
import './BlockEditPage.scss';

export function BlockEditPage() {
  const { blockId } = useParams<{ blockId: string }>();
  const navigate = useNavigate();
  const { getBlock } = useBlockStore();
  const popOne = useNavigationStore((s) => s.popOne);
  const canGoUp = useNavigationStore((s) => s.canGoUp);

  // Get the block from store
  const block = blockId ? getBlock(blockId) : undefined;

  useEffect(() => {
    if (!blockId || !block) {
      // Prefer to pop navigation stack if possible to preserve breadcrumb
      if (canGoUp()) {
        popOne();
      } else {
        navigate('/foundry');
      }
      return;
    }

    // If block is composite (not atomic), redirect to canvas
    if (!block.isAtomic) {
      navigate(`/canvas/${blockId}`, { replace: true });
      return;
    }
  }, [blockId, block, navigate, popOne, canGoUp]);

  // Loading/not found state
  if (!block) {
    return (
      <div className="block-edit-page block-edit-page--loading">
        <p>Loading block...</p>
      </div>
    );
  }

  // Render editor for atomic block
  return (
    <div className="block-edit-page">
      <div className="block-edit-page__header">
        <Link to="/foundry" className="block-edit-page__back">
          <ArrowLeft size={16} />
          <span>Back to Foundry</span>
        </Link>
        <h1 className="block-edit-page__title">{block.name}</h1>
      </div>
      <div className="block-edit-page__content">
        <EditorWrapper block={block} />
      </div>
    </div>
  );
}

export default BlockEditPage;
