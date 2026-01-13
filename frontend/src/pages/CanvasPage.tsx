/**
 * Canvas Page
 *
 * Visual workflow editor with palette and canvas.
 * This page is used for editing non-atomic (composite) blocks.
 */

import { useParams } from 'react-router-dom';
import { useBlockStore } from '../store/blockStore';
import { useNavigation } from '../hooks/useNavigation';
import { BlockCanvas } from '../components/BlockCanvas';
import { BlockPalette } from '../components/BlockPalette';
import { ExecutionBar } from '../components/ExecutionBar';
import { BlockTypeRegistry } from '../registry';
import { useCanvasShortcuts } from '../hooks/useCanvasShortcuts';
import type { BlockType } from '../types/block.types';
import './CanvasPage.scss';

export function CanvasPage() {
  const { blockId } = useParams<{ blockId: string }>();
  const { navigateToBlock } = useNavigation();
  const { addBlock, getRootBlock } = useBlockStore();

  // Current parent is the block we're viewing the canvas of
  const currentParentId = blockId || null;

  // Get the root block (workflow) for execution
  const rootBlock = getRootBlock();
  const workflowId = rootBlock?.id || null;

  // Enable keyboard shortcuts
  useCanvasShortcuts({ enabled: true, parentId: currentParentId });

  const handleDrillDown = (drillBlockId: string) => {
    navigateToBlock(drillBlockId);
  };

  const handleDrop = (event: React.DragEvent, flowPosition: { x: number; y: number }) => {
    const blockType = event.dataTransfer.getData('application/reactflow-blocktype') as BlockType;

    if (!blockType) {
      return;
    }

    try {
      // Get the default block configuration from registry
      const defaultBlock = BlockTypeRegistry.getDefaultBlock(blockType);

      // Generate unique ID
      const newBlockId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Determine parent: if at root level (currentParentId === null),
      // add as child of the root workflow block
      const effectiveParentId = currentParentId ?? rootBlock?.id ?? null;

      // Create block with position at drop location
      const newBlock = {
        ...defaultBlock,
        id: newBlockId,
        parentId: effectiveParentId,
        position: flowPosition,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user',
          tags: [],
          status: 'active' as const,
        },
      };

      addBlock(effectiveParentId, newBlock);
    } catch (error) {
      console.error('[CanvasPage] Error creating block:', error);
    }
  };

  // Show normal canvas
  return (
    <div className="canvas-page">
      <ExecutionBar workflowId={workflowId} />

      <div className="canvas-page__content">
        <div className="canvas-page__palette">
          <div className="canvas-page__palette-header">
            <h3>Block Palette</h3>
          </div>
          <BlockPalette />
        </div>
        <div className="canvas-page__canvas">
          <BlockCanvas
            parentId={currentParentId}
            onDrillDown={handleDrillDown}
            onDrop={handleDrop}
          />
        </div>
      </div>
    </div>
  );
}

export default CanvasPage;
