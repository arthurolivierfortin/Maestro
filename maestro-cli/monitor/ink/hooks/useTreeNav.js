/**
 * useTreeNav — Generic tree navigation hook for expand/collapse tree panels.
 *
 * Manages cursor position and expanded node set. Any tree component can use it
 * by producing FlatNode[] and calling setFlatNodes().
 *
 * FlatNode shape:
 *   { id, depth, hasChildren, isExpanded, parentId, label, data }
 *
 * Keyboard behavior (file-system style):
 *   Up/Down   — move cursor
 *   Left      — collapse selected (or move to parent if already collapsed)
 *   Right     — expand selected (or move to first child if already expanded)
 *   Enter/Space — toggle expand/collapse
 *
 * Usage:
 *   const treeNav = useTreeNav();
 *   // In component: compute flatNodes, call treeNav.setFlatNodes(flatNodes)
 *   // Render: use treeNav.cursor for highlight, treeNav.isExpanded(id) for icons
 */

import { useState, useCallback, useRef } from 'react';

const useTreeNav = (initialExpanded = []) => {
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set(initialExpanded));
  const flatNodesRef = useRef([]);

  // Called by the component to report visible flat nodes. Only clamps if needed.
  const setFlatNodes = useCallback((nodes) => {
    const arr = nodes || [];
    flatNodesRef.current = arr;
    if (arr.length === 0) {
      setCursor(0);
    } else {
      setCursor(prev => {
        const clamped = Math.min(prev, arr.length - 1);
        return clamped === prev ? prev : clamped; // no-op if unchanged
      });
    }
  }, []);

  // Get the currently selected flat node
  const getSelectedNode = useCallback(() => {
    const nodes = flatNodesRef.current;
    if (nodes.length === 0) return null;
    const idx = Math.min(cursor, nodes.length - 1);
    return nodes[idx] || null;
  }, [cursor]);

  // Check if a node id is in the expanded set
  const isExpanded = useCallback((id) => {
    return expanded.has(id);
  }, [expanded]);

  // Move cursor up
  const moveUp = useCallback(() => {
    setCursor(prev => Math.max(0, prev - 1));
  }, []);

  // Move cursor down
  const moveDown = useCallback(() => {
    const max = flatNodesRef.current.length - 1;
    setCursor(prev => Math.min(Math.max(0, max), prev + 1));
  }, []);

  // Left: if expanded, collapse. If collapsed, move to parent.
  const moveLeft = useCallback(() => {
    const nodes = flatNodesRef.current;
    if (nodes.length === 0) return;
    const idx = Math.min(cursor, nodes.length - 1);
    const node = nodes[idx];
    if (!node) return;

    if (node.hasChildren && expanded.has(node.id)) {
      // Collapse this node
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    } else if (node.parentId) {
      // Move to parent
      const parentIdx = nodes.findIndex(n => n.id === node.parentId);
      if (parentIdx >= 0) {
        setCursor(parentIdx);
      }
    }
  }, [cursor, expanded]);

  // Right: if has children and collapsed, expand. If expanded, move to first child.
  const moveRight = useCallback(() => {
    const nodes = flatNodesRef.current;
    if (nodes.length === 0) return;
    const idx = Math.min(cursor, nodes.length - 1);
    const node = nodes[idx];
    if (!node || !node.hasChildren) return;

    if (!expanded.has(node.id)) {
      // Expand this node
      setExpanded(prev => new Set(prev).add(node.id));
    } else {
      // Move to first child (next item in flat list with greater depth)
      if (idx + 1 < nodes.length && nodes[idx + 1].depth > node.depth) {
        setCursor(idx + 1);
      }
    }
  }, [cursor, expanded]);

  // Toggle expand/collapse of node at cursor (or specific id)
  const toggle = useCallback((id) => {
    const nodes = flatNodesRef.current;
    let targetId = id;
    if (!targetId) {
      const idx = Math.min(cursor, nodes.length - 1);
      const node = nodes[idx];
      if (!node || !node.hasChildren) return;
      targetId = node.id;
    }
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  }, [cursor]);

  // Expand a specific node (no-op if already expanded)
  const expand = useCallback((id) => {
    setExpanded(prev => {
      if (prev.has(id)) return prev; // same reference → no re-render
      return new Set(prev).add(id);
    });
  }, []);

  // Collapse a specific node (no-op if already collapsed)
  const collapse = useCallback((id) => {
    setExpanded(prev => {
      if (!prev.has(id)) return prev; // same reference → no re-render
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Expand all nodes that have children
  const expandAll = useCallback(() => {
    const nodes = flatNodesRef.current;
    const allIds = new Set();
    // We need to expand based on the full tree, but we only have flat nodes.
    // Expand everything that currently has children.
    for (const node of nodes) {
      if (node.hasChildren) allIds.add(node.id);
    }
    setExpanded(allIds);
  }, []);

  // Collapse all
  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  // Set cursor to specific index
  const setCursorIndex = useCallback((index) => {
    const max = flatNodesRef.current.length - 1;
    setCursor(Math.max(0, Math.min(Math.max(0, max), index)));
  }, []);

  return {
    cursor,
    expanded,
    setFlatNodes,
    getSelectedNode,
    isExpanded,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
    setCursorIndex,
  };
};

export { useTreeNav };
