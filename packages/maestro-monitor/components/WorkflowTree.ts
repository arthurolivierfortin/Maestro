// @ts-nocheck
/**
 * WorkflowTree — Hierarchical execution tree display with expand/collapse.
 *
 * Ink equivalent of the blessed WorkflowTreeComponent.
 *
 * When treeNav prop is provided: interactive flatten-then-render with cursor.
 * When treeNav is null: backward-compatible fully-expanded render.
 *
 * Props: { session, context, treeNav }
 */

import { createElement as h, useMemo, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  icons, dim, bold,
  statusColor, statusIcon, truncate,
  Badge, TypeBadge, theme,
} from '../theme.ts';
import { flattenExecutionTree, autoExpandRunningPath } from '@maestro/tui/utils';

// ── Running children counter ────────────────────────────────────

function countRunningChildren(node: any): number {
  const children = node?.children;
  if (!Array.isArray(children)) return 0;
  return children.reduce((count: number, child: any) => {
    const status = (child.status || '').toLowerCase();
    const isRunning = status === 'running' || status === 'in_progress' || status === 'active';
    return count + (isRunning ? 1 : 0) + countRunningChildren(child);
  }, 0);
}

// ── FlatTreeNodeRow ────────────────────────────────────────────

/**
 * Renders a single flat tree node row with indent, expand icon, status, name, badge.
 */
const FlatTreeNodeRow = ({ node, isSelected, depth }) => {
  const data = node.data;
  const status = (data.status || 'pending').toLowerCase();
  const icon = statusIcon(status);
  const col = statusColor(status);
  const isActive = status === 'running' || status === 'active';

  // Indentation
  const indent = '  ' + '  '.repeat(depth);

  // Expand/collapse icon
  let expandIcon = '  ';
  if (node.hasChildren) {
    expandIcon = node.isExpanded ? icons.expanded + ' ' : icons.collapsed + ' ';
  }

  const nameColor = isSelected ? theme.tree.cursor : undefined;
  const nameBold = isSelected ? theme.tree.selectedBold : isActive;

  const parts = [];

  // Cursor indicator
  if (isSelected) {
    parts.push(h(Text, { key: 'cur', color: theme.tree.cursor }, '> '));
  } else {
    parts.push(h(Text, { key: 'cur' }, '  '));
  }

  // Indent
  parts.push(h(Text, { key: 'indent' }, indent));

  // Expand icon
  if (node.hasChildren) {
    parts.push(h(Text, { key: 'exp', color: theme.tree.expandIcon }, expandIcon));
  } else {
    parts.push(h(Text, { key: 'exp' }, expandIcon));
  }

  // Status icon
  parts.push(h(Text, { key: 'icon', color: col }, icon));
  parts.push(h(Text, { key: 'sp' }, ' '));

  // Name
  parts.push(h(Text, { key: 'name', color: nameColor, bold: nameBold }, node.label));

  // TypeBadge (shows block type instead of redundant status)
  parts.push(h(Text, { key: 'bsp' }, '  '));
  parts.push(h(TypeBadge, { key: 'badge', type: data.type || data.nodeType || 'node' }));

  // Arrow for active
  if (isActive) {
    parts.push(h(Text, { key: 'arrow', color: 'cyan' }, ` ${icons.arrow}`));
  }

  // Running children indicator for collapsed nodes
  if (node.hasChildren && !node.isExpanded) {
    const runningCount = countRunningChildren(node.data);
    if (runningCount > 0) {
      parts.push(h(Text, { key: 'running', color: theme.status.running }, ` ${icons.running}${runningCount}`));
    }
  }

  // Trailing clear: overwrite leftover chars when status text shrinks
  parts.push(h(Text, { key: 'clr' }, '     '));

  return h(Box, { flexDirection: 'row' }, ...parts);
};

// ── Legacy recursive rendering (when treeNav is null) ──────────

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
    h(Text, { key: 'sp' }, ' '),
    isActive
      ? h(Text, { key: 'name', bold: true }, name)
      : h(Text, { key: 'name' }, name),
    h(Text, { key: 'bsp' }, '  '),
    h(TypeBadge, { key: 'badge', type: node.type || node.nodeType || 'node' }),
  ];

  if (isActive) {
    lineParts.push(h(Text, { key: 'arrow', color: 'cyan' }, ` ${icons.arrow}`));
  }

  children.push(h(Box, { key: 'line', flexDirection: 'row' }, ...lineParts));

  if (isActive && node.output) {
    const brief = truncate(String(node.output).replace(/[\n\r]+/g, ' '), 60);
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

// ── Main component ─────────────────────────────────────────────

const WorkflowTree = ({ session, context = {}, treeNav = null }) => {
  const workflow = context.activeWorkflow || session?.activeWorkflow;
  const executionTree = context.executionTree || session?.executionTree;

  const nodes = useMemo(() => {
    if (!executionTree) return [];
    return Array.isArray(executionTree)
      ? executionTree
      : (executionTree.nodes || executionTree.children || []);
  }, [executionTree]);

  // Destructure stable refs from treeNav to avoid re-renders
  const tnExpanded = treeNav?.expanded;
  const tnExpand = treeNav?.expand;
  const tnSetFlatNodes = treeNav?.setFlatNodes;

  // Auto-expand running paths on data change (stable deps only)
  useEffect(() => {
    if (!tnExpand || !tnExpanded || nodes.length === 0) return;
    const newExpanded = autoExpandRunningPath(nodes, tnExpanded);
    for (const id of newExpanded) {
      if (!tnExpanded.has(id)) {
        tnExpand(id);
      }
    }
  }, [nodes, tnExpanded, tnExpand]);

  // IMPORTANT: All hooks must be called unconditionally (React rules of hooks).
  // Flatten execution tree — guarded for null treeNav.
  const flatNodes = useMemo(() => {
    if (!tnExpanded || nodes.length === 0) return [];
    return flattenExecutionTree(nodes, tnExpanded);
  }, [nodes, tnExpanded]);

  // Report flat nodes to treeNav
  useEffect(() => {
    if (!tnSetFlatNodes) return;
    tnSetFlatNodes(flatNodes);
  }, [flatNodes, tnSetFlatNodes]);

  // Interactive mode: render flat list
  if (treeNav) {
    if (!workflow && nodes.length === 0) {
      return h(Box, { flexDirection: 'column' },
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          dim('(no active workflow)'),
        ),
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          dim('invoke: maestro session invoke <id> <entry-point>'),
        ),
      );
    }

    if (flatNodes.length === 0 && workflow) {
      return h(Box, { flexDirection: 'column' },
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          h(Text, { color: 'cyan' }, icons.running),
          h(Text, null, ' '),
          h(Text, { bold: true }, workflow),
          h(Text, null, '  '),
          h(Badge, { status: 'running' }),
        ),
      );
    }

    return h(Box, { flexDirection: 'column' },
      ...flatNodes.map((fNode, i) =>
        h(FlatTreeNodeRow, {
          key: fNode.id,
          node: fNode,
          isSelected: i === treeNav.cursor,
          depth: fNode.depth,
        })
      )
    );
  }

  // Legacy mode (no treeNav): full recursive render
  const children = [];

  if (!workflow && !executionTree) {
    children.push(
      h(Box, { key: 'empty', flexDirection: 'column' },
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          dim('(no active workflow)'),
        ),
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          dim('invoke: maestro session invoke <id> <entry-point>'),
        ),
      )
    );
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  if (nodes.length > 0) {
    children.push(h(TreeNodes, { key: 'tree', nodes, indent: '  ' }));
  } else if (workflow) {
    children.push(
      h(Box, { key: 'wf', flexDirection: 'row' },
        h(Text, null, '  '),
        h(Text, { color: 'cyan' }, icons.running),
        h(Text, null, ' '),
        h(Text, { bold: true }, workflow),
        h(Text, null, '  '),
        h(Badge, { status: 'running' }),
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { WorkflowTree, flattenExecutionTree, autoExpandRunningPath };
