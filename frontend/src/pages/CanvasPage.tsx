/**
 * Canvas Page
 *
 * Visual workflow editor with palette and canvas.
 */

import { useNavigationStore } from '../store/navigationStore';
import { useBlockStore } from '../store/blockStore';
import { BlockCanvas } from '../components/BlockCanvas';
import { BlockPalette } from '../components/BlockPalette';
import { BlockTypeRegistry } from '../registry';
import type { BlockType } from '../types/block.types';
import './CanvasPage.scss';

export function CanvasPage() {
  const { currentPath, navigateInto } = useNavigationStore();
  const { addBlock } = useBlockStore();

  // Get current parent ID (last item in path, or null for root)
  const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

  const handleDrillDown = (blockId: string) => {
    navigateInto(blockId);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const blockType = event.dataTransfer.getData('application/reactflow-blocktype') as BlockType;

    if (!blockType) return;

    // Get the default block configuration from registry
    const defaultBlock = BlockTypeRegistry.getDefaultBlock(blockType);

    // Generate unique ID
    const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create block with position at drop location
    const newBlock = {
      ...defaultBlock,
      id: blockId,
      parentId: currentParentId,
      position: { x: 100, y: 100 }, // TODO: Calculate from drop position
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user',
        tags: [],
      },
    };

    addBlock(currentParentId, newBlock);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="canvas-page">
      <div className="canvas-page__palette">
        <div className="canvas-page__palette-header">
          <h3>Block Palette</h3>
        </div>
        <BlockPalette />
      </div>
      <div className="canvas-page__canvas" onDrop={handleDrop} onDragOver={handleDragOver}>
        <BlockCanvas parentId={currentParentId} onDrillDown={handleDrillDown} />
      </div>
    </div>
  );
}

export default CanvasPage;
