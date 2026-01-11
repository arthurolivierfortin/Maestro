/**
 * Block System Demo Page
 *
 * Demonstrates the Phase 4b Block Architecture with sample blocks.
 */

import { useBlockActions } from '../hooks';
import { Button } from '../components/common';
import { allSampleBlocks } from '../data/sampleBlocks';
import { useNavigate } from 'react-router-dom';
import { useBlockStore } from '../store/blockStore';
import './BlockDemoPage.scss';

export function BlockDemoPage() {
  const { getRootBlock, clear } = useBlockActions();
  const { setBlocks } = useBlockStore();
  const navigate = useNavigate();

  // Initialize sample blocks for Foundry
  const initializeSampleBlocks = () => {
    clear(); // Clear any existing blocks

    // Convert array of blocks to Map
    const blocksMap = new Map(allSampleBlocks.map((block) => [block.id, block]));

    // Set blocks in store
    setBlocks(blocksMap, null);

    console.log(`Initialized ${allSampleBlocks.length} sample blocks`);

    // Navigate to Foundry to see them
    navigate('/foundry');
  };

  return (
    <div className="block-demo-page">
      <div className="demo-header">
        <h1>Block System & Foundry Demo</h1>
        <p>
          Initialize sample blocks and explore them in the new Foundry page - a unified interface
          for discovering and managing all block types.
        </p>
      </div>

      <div className="demo-controls">
        <Button onClick={initializeSampleBlocks} variant="primary">
          Initialize Sample Blocks for Foundry
        </Button>
        <Button onClick={clear} variant="secondary">
          Clear All Blocks
        </Button>
      </div>

      <div className="demo-info">
        <h2>Current State</h2>
        {getRootBlock() ? (
          <div className="state-card">
            <h3>{getRootBlock()!.name}</h3>
            <p>
              <strong>Type:</strong> {getRootBlock()!.blockType}
            </p>
            <p>
              <strong>Children:</strong> {getRootBlock()!.children?.length || 0}
            </p>
            <p>
              <strong>Atomic:</strong> {getRootBlock()!.isAtomic ? 'Yes' : 'No'}
            </p>
          </div>
        ) : (
          <p className="empty-state">
            No blocks in store. Click "Initialize Sample Blocks for Foundry" to create demo blocks.
          </p>
        )}
      </div>

      <div className="demo-features">
        <h2>Features Demonstrated</h2>
        <ul>
          <li>
            <strong>Foundry Page:</strong> Unified interface for managing all block types
          </li>
          <li>
            <strong>Block Discovery:</strong> Search and filter blocks by type, capability, tags
          </li>
          <li>
            <strong>Block Store:</strong> Enhanced with filtering, search, export/import
          </li>
          <li>
            <strong>Sample Blocks:</strong> Agents, tools, prompts, workflows, decisions
          </li>
        </ul>
      </div>

      <div className="demo-instructions">
        <h2>Try It Out</h2>
        <ol>
          <li>Click "Initialize Sample Blocks for Foundry" to create demo blocks</li>
          <li>You'll be redirected to the Foundry page</li>
          <li>Use the sidebar to filter by block type (Agents, Tools, Prompts, etc.)</li>
          <li>Try the search bar to find blocks by name</li>
          <li>Filter by type or capability using the dropdown pills</li>
          <li>Hover over blocks to see quick actions (Edit, Duplicate, Delete)</li>
          <li>Click a block to view details</li>
          <li>Try refreshing the page - your state is preserved!</li>
        </ol>
      </div>
    </div>
  );
}

export default BlockDemoPage;
