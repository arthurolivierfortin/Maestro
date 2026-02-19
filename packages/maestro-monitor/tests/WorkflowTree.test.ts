// @ts-nocheck
/**
 * WorkflowTree regression tests.
 *
 * Tests the running-child-indicator bug fix: when a node is collapsed
 * but has running children, it should show an indicator (e.g. ● 2).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Text } from 'ink';
import { WorkflowTree } from '../components/WorkflowTree.ts';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// Build a mock execution tree for testing
function makeTree(nodes: any[]) {
  return {
    session: {
      activeWorkflow: 'test-workflow',
      executionTree: nodes,
    },
    context: {
      activeWorkflow: 'test-workflow',
      executionTree: nodes,
    },
  };
}

describe('WorkflowTree', () => {
  afterEach(() => cleanup());

  it('renders nodes from execution tree (legacy mode, no treeNav)', async () => {
    const nodes = [
      { id: 'plan', name: 'Plan', status: 'completed', type: 'workflow' },
      { id: 'build', name: 'Build', status: 'running', type: 'workflow' },
    ];
    const { session, context } = makeTree(nodes);
    const { lastFrame } = render(h(WorkflowTree, { session, context, treeNav: null }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Plan');
    expect(frame).toContain('Build');
  });

  it('shows empty state when no workflow', async () => {
    const { lastFrame } = render(h(WorkflowTree, {
      session: {},
      context: {},
      treeNav: null,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('no active workflow');
  });

  it('collapsed node with running children shows indicator (interactive mode)', async () => {
    const nodes = [
      {
        id: 'root',
        name: 'Pipeline',
        status: 'running',
        type: 'workflow',
        children: [
          { id: 'child1', name: 'Step1', status: 'running', type: 'node' },
          { id: 'child2', name: 'Step2', status: 'running', type: 'node' },
          { id: 'child3', name: 'Step3', status: 'completed', type: 'node' },
        ],
      },
    ];

    // Create a mock treeNav where root is NOT expanded (collapsed)
    const expandedSet = new Set<string>(); // nothing expanded
    const mockTreeNav = {
      cursor: 0,
      expanded: expandedSet,
      expand: () => {},
      collapse: () => {},
      toggle: () => {},
      moveUp: () => {},
      moveDown: () => {},
      moveLeft: () => {},
      moveRight: () => {},
      setFlatNodes: () => {},
      getSelectedNode: () => null,
    };

    const { session, context } = makeTree(nodes);
    const { lastFrame } = render(h(WorkflowTree, { session, context, treeNav: mockTreeNav }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');

    // The root node "Pipeline" should be shown
    expect(frame).toContain('Pipeline');

    // The running child indicator should show "●2" (2 running children: child1, child2)
    // The icon is the bullet character ● (U+25CF)
    expect(frame).toContain('\u25CF2');
  });

  it('collapsed node without running children shows no indicator', async () => {
    const nodes = [
      {
        id: 'root',
        name: 'Pipeline',
        status: 'completed',
        type: 'workflow',
        children: [
          { id: 'child1', name: 'Step1', status: 'completed', type: 'node' },
          { id: 'child2', name: 'Step2', status: 'completed', type: 'node' },
        ],
      },
    ];

    const expandedSet = new Set<string>();
    const mockTreeNav = {
      cursor: 0,
      expanded: expandedSet,
      expand: () => {},
      collapse: () => {},
      toggle: () => {},
      moveUp: () => {},
      moveDown: () => {},
      moveLeft: () => {},
      moveRight: () => {},
      setFlatNodes: () => {},
      getSelectedNode: () => null,
    };

    const { session, context } = makeTree(nodes);
    const { lastFrame } = render(h(WorkflowTree, { session, context, treeNav: mockTreeNav }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Pipeline');
    // Should NOT show the running indicator
    expect(frame).not.toContain('\u25CF2');
    expect(frame).not.toContain('\u25CF1');
  });
});
