/**
 * PhaseWorkflow — Merged phase + workflow tree view with expand/collapse.
 *
 * Ink equivalent of the blessed PhaseWorkflowComponent.
 *
 * When treeNav is provided: interactive flat list with cursor + expand/collapse.
 * When treeNav is null: backward-compatible render.
 *
 * - Done phases: expandable — collapsed shows summary, expanded shows detail
 * - Running phase: auto-expanded with execution tree children
 * - Pending phases: leaf nodes (no children)
 *
 * Props: { session, context, treeNav }
 */

import { createElement as h, useMemo, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  icons, dim, muted, bold,
  statusColor, statusIcon, truncate,
  Badge, theme,
} from '../theme.js';

// ── Flatten helper ────────────────────────────────────────────

/**
 * Flattens phases into FlatNode[].
 * Phases are depth-0 nodes. Running phase children are execution tree nodes.
 * Done phase children are summary lines. Pending phases have no children.
 */
const flattenPhaseWorkflow = (phases, executionTree, expandedSet) => {
  const result = [];
  if (!Array.isArray(phases) || phases.length === 0) return result;

  for (const phase of phases) {
    const status = (phase.status || 'pending').toLowerCase();
    const phaseId = phase.id || phase.name || 'phase';
    const isDone = status === 'done' || status === 'completed';
    const isRunning = status === 'running' || status === 'active';

    // Determine children
    let hasChildren = false;
    if (isRunning) {
      const nodes = executionTree
        ? (Array.isArray(executionTree) ? executionTree : (executionTree.nodes || executionTree.children || []))
        : [];
      hasChildren = nodes.length > 0;
    } else if (isDone) {
      hasChildren = true; // summary children
    }

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
      if (isRunning) {
        // Add execution tree nodes as children
        const nodes = executionTree
          ? (Array.isArray(executionTree) ? executionTree : (executionTree.nodes || executionTree.children || []))
          : [];
        for (const node of nodes) {
          flattenExecNode(node, result, 1, phaseId, expandedSet);
        }
      } else if (isDone) {
        // Add summary line as child
        const r = phase.result || {};
        const iter = r.iterations || '?';
        const fitness = typeof r.fitness === 'number'
          ? Math.round(r.fitness * 100) + '%' : '?';
        const parts = [`${iter} iter`, `fitness ${fitness}`];
        if (r.tokenCount) parts.push(`~${r.tokenCount} tok`);

        result.push({
          id: phaseId + '__summary',
          depth: 1,
          hasChildren: false,
          isExpanded: false,
          parentId: phaseId,
          label: parts.join(', '),
          data: { _type: 'summary', status: 'done' },
        });
      }
    }
  }

  return result;
};

/** Recursively flatten execution tree nodes into result. */
const flattenExecNode = (node, result, depth, parentId, expandedSet) => {
  const id = node.id || `exec-${depth}-${result.length}`;
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
    data: { ...node, _type: 'exec' },
  });

  if (hasChildren && isExpanded) {
    for (const child of children) {
      flattenExecNode(child, result, depth + 1, id, expandedSet);
    }
  }
};

// ── FlatPhaseRow ──────────────────────────────────────────────

const FlatPhaseRow = ({ node, isSelected }) => {
  const data = node.data;
  const depth = node.depth;
  const indent = '  '.repeat(depth);

  // Different rendering for different types
  if (data._type === 'summary') {
    // Summary line: dimmed info
    const parts = [];
    if (isSelected) {
      parts.push(h(Text, { key: 'cur', color: theme.tree.cursor }, '> '));
    } else {
      parts.push(h(Text, { key: 'cur' }, '  '));
    }
    parts.push(h(Text, { key: 'indent' }, indent));
    parts.push(h(Text, { key: 'sp' }, '  ')); // align with expand icon space
    parts.push(dim(node.label));
    return h(Box, { flexDirection: 'row' }, ...parts);
  }

  if (data._type === 'exec') {
    // Execution tree node
    const status = (data.status || 'pending').toLowerCase();
    const icon = statusIcon(status);
    const col = statusColor(status);
    const isActive = status === 'running' || status === 'active';

    let expandIcon = '  ';
    if (node.hasChildren) {
      expandIcon = node.isExpanded ? icons.expanded + ' ' : icons.collapsed + ' ';
    }

    const parts = [];
    if (isSelected) {
      parts.push(h(Text, { key: 'cur', color: theme.tree.cursor }, '> '));
    } else {
      parts.push(h(Text, { key: 'cur' }, '  '));
    }
    parts.push(h(Text, { key: 'indent' }, indent));
    if (node.hasChildren) {
      parts.push(h(Text, { key: 'exp', color: theme.tree.expandIcon }, expandIcon));
    } else {
      parts.push(h(Text, { key: 'exp' }, expandIcon));
    }
    parts.push(h(Text, { key: 'icon', color: col }, icon));
    parts.push(h(Text, { key: 'sp' }, ' '));
    const nameColor = isSelected ? theme.tree.cursor : undefined;
    parts.push(h(Text, { key: 'name', color: nameColor, bold: isSelected || isActive }, node.label));
    parts.push(h(Text, { key: 'bsp' }, '  '));
    parts.push(h(Badge, { key: 'badge', status }));
    if (isActive) {
      parts.push(h(Text, { key: 'arrow', color: 'cyan' }, ` ${icons.arrow}`));
    }
    return h(Box, { flexDirection: 'row' }, ...parts);
  }

  // Phase node (depth 0)
  const status = (data.status || 'pending').toLowerCase();
  const icon = statusIcon(status);
  const col = statusColor(status);
  const isActive = status === 'running' || status === 'active';

  let expandIcon = '  ';
  if (node.hasChildren) {
    expandIcon = node.isExpanded ? icons.expanded + ' ' : icons.collapsed + ' ';
  }

  const parts = [];
  if (isSelected) {
    parts.push(h(Text, { key: 'cur', color: theme.tree.cursor }, '> '));
  } else {
    parts.push(h(Text, { key: 'cur' }, '  '));
  }
  parts.push(h(Text, { key: 'indent' }, indent));
  if (node.hasChildren) {
    parts.push(h(Text, { key: 'exp', color: theme.tree.expandIcon }, expandIcon));
  } else {
    parts.push(h(Text, { key: 'exp' }, expandIcon));
  }
  parts.push(h(Text, { key: 'icon', color: col }, icon));
  parts.push(h(Text, { key: 'sp' }, ' '));
  const nameColor = isSelected ? theme.tree.cursor : undefined;
  parts.push(h(Text, { key: 'name', color: nameColor, bold: isSelected || isActive }, node.label));
  parts.push(h(Text, { key: 'bsp' }, ' '));
  parts.push(h(Badge, { key: 'badge', status }));
  if (isActive) {
    parts.push(h(Text, { key: 'arrow', color: 'cyan' }, ` ${icons.arrow}`));
  }
  return h(Box, { flexDirection: 'row' }, ...parts);
};

// ── Legacy rendering (when treeNav is null) ───────────────────

const TreeNode = ({ node, prefix, childIndent }) => {
  const status = (node.status || 'pending').toLowerCase();
  const icon = statusIcon(status);
  const col = statusColor(status);
  const name = node.name || node.id || 'node';
  const isActive = status === 'running' || status === 'active';

  const children = [];

  const lineParts = [
    h(Text, { key: 'prefix' }, prefix),
    h(Text, { key: 'icon', color: col }, icon),
    h(Text, { key: 'sp', }, ' '),
    isActive
      ? h(Text, { key: 'name', bold: true }, name)
      : h(Text, { key: 'name' }, name),
    h(Text, { key: 'bsp' }, '  '),
    h(Badge, { key: 'badge', status }),
  ];

  if (isActive) {
    lineParts.push(h(Text, { key: 'arrow', color: 'cyan' }, ` ${icons.arrow}`));
  }

  children.push(h(Box, { key: 'line', flexDirection: 'row' }, ...lineParts));

  if (isActive && node.output) {
    const brief = truncate(String(node.output).replace(/[\n\r]+/g, ' '), 50);
    children.push(
      h(Box, { key: 'output', flexDirection: 'row' },
        h(Text, null, childIndent + '  '),
        dim(brief),
      )
    );
  }

  const nodeChildren = node.children;
  if (nodeChildren && Array.isArray(nodeChildren) && nodeChildren.length > 0) {
    children.push(
      h(TreeNodes, { key: 'children', nodes: nodeChildren, indent: childIndent })
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

const TreeNodes = ({ nodes, indent }) => {
  if (!nodes || nodes.length === 0) return null;

  const elements = nodes.map((node, i) => {
    const isLast = i === nodes.length - 1;
    const branch = isLast ? icons.lastBranch : icons.branch;
    const childIndent = indent + (isLast ? '    ' : icons.vertical + '   ');

    return h(TreeNode, {
      key: node.id || `node-${i}`,
      node,
      prefix: indent + branch + ' ',
      childIndent,
    });
  });

  return h(Box, { flexDirection: 'column' }, ...elements);
};

const DonePhase = ({ phase }) => {
  const name = phase.name || phase.id || 'Phase';
  const result = phase.result || {};
  const iter = result.iterations || '?';
  const fitness = typeof result.fitness === 'number'
    ? Math.round(result.fitness * 100) + '%' : '?';
  const parts = [`${iter} iter`, `fitness ${fitness}`];
  if (result.tokenCount) parts.push(`~${result.tokenCount} tok`);

  return h(Box, { flexDirection: 'row' },
    h(Text, null, '  '),
    h(Text, { color: 'green' }, icons.done),
    h(Text, null, ` ${name} `),
    h(Text, { color: 'gray' }, '[done]'),
    h(Text, null, ' '),
    h(Text, { color: 'gray' }, `(${parts.join(', ')})`),
  );
};

const RunningPhase = ({ phase, executionTree }) => {
  const name = phase.name || phase.id || 'Phase';
  const nodes = executionTree
    ? (Array.isArray(executionTree) ? executionTree : (executionTree.nodes || []))
    : [];

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row' },
      h(Text, null, '  '),
      h(Text, { color: 'cyan' }, icons.running),
      h(Text, null, ' '),
      h(Text, { bold: true }, name),
      h(Text, null, ' '),
      h(Text, { color: 'gray' }, '['),
      h(Text, { color: 'cyan' }, 'running'),
      h(Text, { color: 'gray' }, ']'),
    ),
    nodes.length > 0 ? h(TreeNodes, { nodes, indent: '    ' }) : null,
  );
};

const PendingPhase = ({ phase }) => {
  const name = phase.name || phase.id || 'Phase';
  return h(Box, { flexDirection: 'row' },
    h(Text, null, '  '),
    h(Text, { color: 'gray' }, icons.pending),
    h(Text, null, ' '),
    dim(name),
    h(Text, null, ' '),
    h(Text, { color: 'gray' }, '[...]'),
  );
};

// ── Main component ─────────────────────────────────────────────

const PhaseWorkflow = ({ session, context = {}, treeNav = null }) => {
  const phases = context.phases || session?.variables?._phases || [];
  const executionTree = context.executionTree || null;

  // Destructure stable refs from treeNav
  const tnExpanded = treeNav?.expanded;
  const tnExpand = treeNav?.expand;
  const tnSetFlatNodes = treeNav?.setFlatNodes;

  // IMPORTANT: All hooks must be called unconditionally (React rules of hooks).

  // Auto-expand running phases
  useEffect(() => {
    if (!tnExpand || !tnExpanded || !Array.isArray(phases)) return;
    for (const phase of phases) {
      const status = (phase.status || '').toLowerCase();
      if ((status === 'running' || status === 'active') && !tnExpanded.has(phase.id)) {
        tnExpand(phase.id);
      }
    }
  }, [phases, tnExpanded, tnExpand]);

  // Flatten phases — guarded for null treeNav
  const flatNodes = useMemo(() => {
    if (!tnExpanded) return [];
    return flattenPhaseWorkflow(phases, executionTree, tnExpanded);
  }, [phases, executionTree, tnExpanded]);

  // Report flat nodes to treeNav
  useEffect(() => {
    if (!tnSetFlatNodes) return;
    tnSetFlatNodes(flatNodes);
  }, [flatNodes, tnSetFlatNodes]);

  // Interactive mode: render flat list
  if (treeNav) {
    if (!Array.isArray(phases) || phases.length === 0) {
      return h(Box, { flexDirection: 'column' },
        h(Box, { key: 'empty' }, h(Text, null, '  '), dim('(no phases defined)')),
      );
    }

    return h(Box, { flexDirection: 'column' },
      ...flatNodes.map((fNode, i) =>
        h(FlatPhaseRow, {
          key: fNode.id,
          node: fNode,
          isSelected: i === treeNav.cursor,
        })
      )
    );
  }

  // Legacy mode
  const children = [];

  if (!Array.isArray(phases) || phases.length === 0) {
    children.push(h(Box, { key: 'empty' }, h(Text, null, '  '), dim('(no phases defined)')));
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const status = (phase.status || 'pending').toLowerCase();

    if (status === 'done' || status === 'completed') {
      children.push(h(DonePhase, { key: phase.id || `p-${i}`, phase }));
    } else if (status === 'running' || status === 'active') {
      children.push(h(RunningPhase, {
        key: phase.id || `p-${i}`,
        phase,
        executionTree,
      }));
    } else {
      children.push(h(PendingPhase, { key: phase.id || `p-${i}`, phase }));
    }
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { PhaseWorkflow, flattenPhaseWorkflow };
