/**
 * Block Edit Page
 *
 * Redirect page for atomic block editing.
 * Redirects to canvas with atomic edit mode enabled.
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBlockStore } from '../store';
import { useNavigationStore } from '../store/navigationStore';

export function BlockEditPage() {
  const { blockId } = useParams<{ blockId: string }>();
  const navigate = useNavigate();
  const { getBlock } = useBlockStore();
  const { enterAtomicBlockEdit } = useNavigationStore();

  // Get the block from store
  const block = blockId ? getBlock(blockId) : undefined;

  useEffect(() => {
    if (!blockId || !block) {
      navigate('/foundry');
      return;
    }

    // If block is composite, redirect to canvas
    if (!block.isAtomic) {
      navigate(`/canvas/${blockId}`);
      return;
    }

    // Enter atomic block edit mode and navigate to canvas
    enterAtomicBlockEdit(blockId);
    navigate('/canvas');
  }, [blockId, block, navigate, enterAtomicBlockEdit]);

  // Show nothing - we're redirecting
  return null;
}

export default BlockEditPage;
