/**
 * Tree utilities — pure functions for flattening and manipulating execution trees.
 *
 * Used by WorkflowTree and PhaseWorkflow components in both TUI and frontend.
 */

import type { ExecutionNode, ExecutionTree } from '../types/session.js';

/** A flattened tree node for rendering in a list view. */
export interface FlatNode {
  id: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  parentId: string | null;
  label: string;
  data: Record<string, unknown>;
}

/**
 * Flattens an execution tree into FlatNode[] respecting the expanded set.
 * Each FlatNode contains: id, depth, hasChildren, isExpanded, parentId, label, data.
 */
export const flattenExecutionTree = (
  nodes: ExecutionNode[] | null | undefined,
  expandedSet: Set<string>,
  depth: number = 0,
  parentId: string | null = null
): FlatNode[] => {
  const result: FlatNode[] = [];
  if (!nodes || !Array.isArray(nodes)) return result;

  for (const node of nodes) {
    const id = node.id || `node-${depth}-${result.length}`;
    const children = node.children;
    const hasChildren = Array.isArray(children) && children.length > 0;
    const isExpanded = expandedSet.has(id);

    result.push({
      id,
      depth,
      hasChildren,
      isExpanded,
      parentId,
      label: node.name || node.id || 'node',
      data: node as unknown as Record<string, unknown>,
    });

    if (hasChildren && isExpanded) {
      result.push(...flattenExecutionTree(children, expandedSet, depth + 1, id));
    }
  }
  return result;
};

/**
 * Auto-expands ancestors of running/active nodes.
 * Returns a new Set with those ancestor IDs added.
 */
export const autoExpandRunningPath = (
  nodes: ExecutionNode[] | null | undefined,
  expandedSet: Set<string>,
  parentChain: string[] = []
): Set<string> => {
  const toExpand = new Set(expandedSet);
  if (!nodes || !Array.isArray(nodes)) return toExpand;

  for (const node of nodes) {
    const status = (node.status || '').toLowerCase();
    const isActive = status === 'running' || status === 'active';
    const children = node.children;
    const hasChildren = Array.isArray(children) && children.length > 0;

    if (isActive) {
      for (const ancestorId of parentChain) {
        toExpand.add(ancestorId);
      }
      if (hasChildren) {
        toExpand.add(node.id);
      }
    }

    if (hasChildren) {
      const childResult = autoExpandRunningPath(
        children,
        toExpand,
        [...parentChain, node.id]
      );
      for (const id of childResult) toExpand.add(id);
    }
  }
  return toExpand;
};

/**
 * Extracts the raw exec tree nodes array from an executionTree variable.
 * Handles both array and object ({ nodes, children }) formats.
 */
export const getExecNodes = (executionTree: ExecutionTree | Record<string, unknown> | null | undefined): ExecutionNode[] => {
  if (!executionTree) return [];
  if (Array.isArray(executionTree)) return executionTree;
  const obj = executionTree as Record<string, unknown>;
  return (obj.nodes || obj.children || []) as ExecutionNode[];
};

/**
 * Clones execution tree nodes with a forced status override.
 * Used to show done phases (all blocks done) and pending phases (all blocks pending).
 */
export const cloneTreeWithStatus = (
  nodes: ExecutionNode[] | null | undefined,
  overrideStatus: string
): ExecutionNode[] => {
  if (!Array.isArray(nodes)) return [];
  return nodes.map(node => ({
    ...node,
    status: overrideStatus as ExecutionNode['status'],
    children: Array.isArray(node.children)
      ? cloneTreeWithStatus(node.children, overrideStatus)
      : [],
  }));
};

/**
 * Recursively flatten an execution tree node into a FlatNode result array.
 * phasePrefix namespaces IDs so different phases don't collide.
 * phaseStatus propagates the parent phase's status for styling.
 */
export const flattenExecNode = (
  node: ExecutionNode,
  result: FlatNode[],
  depth: number,
  parentId: string,
  expandedSet: Set<string>,
  phasePrefix: string,
  phaseStatus: string
): void => {
  const rawId = node.id || `exec-${depth}-${result.length}`;
  const id = phasePrefix ? `${phasePrefix}/${rawId}` : rawId;
  const children = node.children;
  const hasChildren = Array.isArray(children) && children.length > 0;
  const isExpanded = expandedSet.has(id);

  result.push({
    id,
    depth,
    hasChildren,
    isExpanded,
    parentId,
    label: node.name || node.id || 'node',
    data: { ...(node as unknown as Record<string, unknown>), _type: 'exec', _phaseStatus: phaseStatus },
  });

  if (hasChildren && isExpanded) {
    for (const child of children) {
      flattenExecNode(child, result, depth + 1, id, expandedSet, phasePrefix, phaseStatus);
    }
  }
};

/**
 * Flattens phases + execution tree into a single FlatNode[] for interactive rendering.
 *
 * - Done phases: expandable — collapsed shows summary, expanded shows detail
 * - Running phase: auto-expanded with execution tree children
 * - Pending phases: expandable with pending-status nodes
 */
export const flattenPhaseWorkflow = (
  phases: Array<{ id?: string; name?: string; status?: string; result?: Record<string, unknown> }> | null | undefined,
  executionTree: ExecutionTree | Record<string, unknown> | null | undefined,
  expandedSet: Set<string>
): FlatNode[] => {
  const result: FlatNode[] = [];
  if (!Array.isArray(phases) || phases.length === 0) return result;

  const execNodes = getExecNodes(executionTree);

  for (const phase of phases) {
    const status = (phase.status || 'pending').toLowerCase();
    const phaseId = phase.id || phase.name || 'phase';
    const isDone = status === 'done' || status === 'completed';
    const isRunning = status === 'running' || status === 'active';

    const hasChildren = execNodes.length > 0;
    const isExpanded = expandedSet.has(phaseId);

    result.push({
      id: phaseId,
      depth: 0,
      hasChildren,
      isExpanded,
      parentId: null,
      label: phase.name || phase.id || 'Phase',
      data: { ...phase, _type: 'phase' },
    });

    if (hasChildren && isExpanded) {
      let phaseNodes: ExecutionNode[];
      if (isRunning) {
        phaseNodes = execNodes;
      } else if (isDone) {
        phaseNodes = cloneTreeWithStatus(execNodes, 'done');
      } else {
        phaseNodes = cloneTreeWithStatus(execNodes, 'pending');
      }

      for (const node of phaseNodes) {
        flattenExecNode(node, result, 1, phaseId, expandedSet, phaseId, status);
      }

      if (isDone && phase.result) {
        const r = phase.result;
        const parts: string[] = [];
        if (r.iterations !== undefined) parts.push(`${r.iterations} iter`);
        if (typeof r.fitness === 'number') parts.push(`fitness ${Math.round(r.fitness * 100)}%`);
        if (r.tokenCount) parts.push(`~${r.tokenCount} tok`);
        if (parts.length > 0) {
          result.push({
            id: phaseId + '__summary',
            depth: 1,
            hasChildren: false,
            isExpanded: false,
            parentId: phaseId,
            label: parts.join(', '),
            data: { _type: 'detail', status: 'done', field: 'summary' },
          });
        }
      }
    }
  }

  return result;
};
