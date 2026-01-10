/**
 * Block System Demo Page
 *
 * Demonstrates the Phase 4b Block Architecture with a sample workflow.
 */

import { useBlockActions } from '../hooks';
import { Button } from '../components/common';
import './BlockDemoPage.scss';

export function BlockDemoPage() {
  const { getRootBlock, createBlock, clear } = useBlockActions();

  // Initialize demo workflow
  const initializeDemoWorkflow = () => {
    clear(); // Clear any existing blocks

    // Create root workflow
    const workflow = createBlock('workflow', null, {
      name: 'Feature Development Pipeline',
    });

    if (!workflow) return;

    // Add trigger
    createBlock('trigger', workflow.id, {
      name: 'Manual Start',
      position: { x: 100, y: 100 },
    });

    // Add main task
    const task = createBlock('task', workflow.id, {
      name: 'Implement Feature',
      position: { x: 300, y: 100 },
    });

    if (!task) return;

    // Add planner agent to task
    const plannerAgent = createBlock('agent', task.id, {
      name: 'Planner Agent',
      position: { x: 100, y: 50 },
    });

    if (plannerAgent) {
      // Add prompt to planner agent
      createBlock('prompt', plannerAgent.id, {
        name: 'Planning Prompt',
        position: { x: 50, y: 50 },
      });
    }

    // Add coder agent to task
    createBlock('agent', task.id, {
      name: 'Coder Agent',
      position: { x: 300, y: 50 },
    });

    // Add validator to task
    createBlock('validator', task.id, {
      name: 'Code Validator',
      position: { x: 500, y: 50 },
    });

    // Add decision node
    createBlock('decision', workflow.id, {
      name: 'Tests Passed?',
      position: { x: 500, y: 100 },
    });
  };

  const rootBlock = getRootBlock();

  return (
    <div className="block-demo-page">
      <div className="demo-header">
        <h1>Block System Demo</h1>
        <p>
          This page demonstrates the Phase 4b Block Architecture with a sample workflow. Use the
          Block Explorer sidebar to navigate the hierarchy.
        </p>
      </div>

      <div className="demo-controls">
        <Button onClick={initializeDemoWorkflow} variant="primary">
          Initialize Demo Workflow
        </Button>
        <Button onClick={clear} variant="secondary">
          Clear All Blocks
        </Button>
      </div>

      <div className="demo-info">
        <h2>Current State</h2>
        {rootBlock ? (
          <div className="state-card">
            <h3>{rootBlock.name}</h3>
            <p>
              <strong>Type:</strong> {rootBlock.blockType}
            </p>
            <p>
              <strong>Children:</strong> {rootBlock.children?.length || 0}
            </p>
            <p>
              <strong>Atomic:</strong> {rootBlock.isAtomic ? 'Yes' : 'No'}
            </p>
          </div>
        ) : (
          <p className="empty-state">No workflow initialized. Click "Initialize Demo Workflow" to start.</p>
        )}
      </div>

      <div className="demo-features">
        <h2>Features Demonstrated</h2>
        <ul>
          <li>
            <strong>Recursive Block System:</strong> Blocks can contain other blocks (workflow →
            task → agent → prompt)
          </li>
          <li>
            <strong>Type Validation:</strong> Nesting rules enforced (e.g., prompts can only be in
            agents)
          </li>
          <li>
            <strong>Block Explorer:</strong> Navigate the hierarchy using the sidebar
          </li>
          <li>
            <strong>Breadcrumb Navigation:</strong> See your current path at the top
          </li>
          <li>
            <strong>Drill-Down:</strong> Double-click composite blocks to enter them
          </li>
          <li>
            <strong>Context Menu:</strong> Right-click blocks for actions (Rename, Duplicate,
            Delete)
          </li>
          <li>
            <strong>Undo/Redo:</strong> Full history support (try Ctrl+Z / Ctrl+Shift+Z)
          </li>
          <li>
            <strong>LocalStorage Persistence:</strong> State survives page refresh
          </li>
        </ul>
      </div>

      <div className="demo-instructions">
        <h2>Try It Out</h2>
        <ol>
          <li>Click "Initialize Demo Workflow" to create the sample workflow</li>
          <li>Look at the Block Explorer sidebar - you'll see the workflow hierarchy</li>
          <li>Click on different blocks to select them</li>
          <li>Double-click "Implement Feature" task to navigate into it</li>
          <li>Double-click "Planner Agent" to see its prompt</li>
          <li>Use the breadcrumb at the top to navigate back</li>
          <li>Right-click any block for more options</li>
          <li>Try refreshing the page - your state is preserved!</li>
        </ol>
      </div>
    </div>
  );
}

export default BlockDemoPage;
