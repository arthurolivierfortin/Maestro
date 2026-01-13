/**
 * Canvas Page
 *
 * Visual workflow editor with palette and canvas.
 */

import { useNavigationStore } from '../store/navigationStore';
import { useBlockStore } from '../store/blockStore';
import { BlockCanvas } from '../components/BlockCanvas';
import { BlockPalette } from '../components/BlockPalette';
import { ExecutionBar } from '../components/ExecutionBar';
import { BlockTypeRegistry } from '../registry';
import { useCanvasShortcuts } from '../hooks/useCanvasShortcuts';
import type { BlockType } from '../types/block.types';
import './CanvasPage.scss';

export function CanvasPage() {
  const { currentPath, navigateInto } = useNavigationStore();
  const { addBlock, getRootBlock } = useBlockStore();

  // Get current parent ID (last item in path, or null for root)
  const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

  // Get the root block (workflow) for execution
  const rootBlock = getRootBlock();
  const workflowId = rootBlock?.id || null;

  // Enable keyboard shortcuts
  useCanvasShortcuts({ enabled: true, parentId: currentParentId });

  const handleDrillDown = (blockId: string) => {
    navigateInto(blockId);
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
      const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine parent: if at root level (currentParentId === null), 
      // add as child of the root workflow block
      const effectiveParentId = currentParentId ?? rootBlock?.id ?? null;

      // Create block with position at drop location
      const newBlock = {
        ...defaultBlock,
        id: blockId,
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
