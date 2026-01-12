/**
 * Canvas Page
 *
 * Visual workflow editor with palette and canvas.
 */

import { useRef } from 'react';
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
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const blockType = event.dataTransfer.getData('application/reactflow-blocktype') as BlockType;

    if (!blockType) return;

    // Get the default block configuration from registry
    const defaultBlock = BlockTypeRegistry.getDefaultBlock(blockType);

    // Generate unique ID
    const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate position relative to canvas
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const position = {
      x: canvasRect ? event.clientX - canvasRect.left : 100,
      y: canvasRect ? event.clientY - canvasRect.top : 100,
    };

    // Create block with position at drop location
    const newBlock = {
      ...defaultBlock,
      id: blockId,
      parentId: currentParentId,
      position,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user',
        tags: [],
        status: 'active' as const,
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
      <ExecutionBar workflowId={workflowId} />
      
      <div className="canvas-page__content">
        <div className="canvas-page__palette">
          <div className="canvas-page__palette-header">
            <h3>Block Palette</h3>
          </div>
          <BlockPalette />
        </div>
        <div 
          ref={canvasRef}
          className="canvas-page__canvas" 
          onDrop={handleDrop} 
          onDragOver={handleDragOver}
        >
          <BlockCanvas parentId={currentParentId} onDrillDown={handleDrillDown} />
        </div>
      </div>
    </div>
  );
}

export default CanvasPage;
