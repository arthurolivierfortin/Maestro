import { useState, useCallback, useRef } from 'react';
import type { FlatNode } from '../../../shared/utils/tree.ts';

interface UseTreeNavReturn {
  cursor: number;
  expanded: Set<string>;
  setFlatNodes: (nodes: FlatNode[]) => void;
  getSelectedNode: () => FlatNode | null;
  isExpanded: (id: string) => boolean;
  moveUp: () => void;
  moveDown: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  toggle: (id?: string) => void;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setCursorIndex: (index: number) => void;
}

const useTreeNav = (initialExpanded: string[] = []): UseTreeNavReturn => {
  const [cursor, setCursor] = useState<number>(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialExpanded));
  const flatNodesRef = useRef<FlatNode[]>([]);

  const setFlatNodes = useCallback((nodes: FlatNode[]): void => {
    const arr = nodes || [];
    flatNodesRef.current = arr;
    if (arr.length === 0) {
      setCursor(0);
    } else {
      setCursor(prev => {
        const clamped = Math.min(prev, arr.length - 1);
        return clamped === prev ? prev : clamped;
      });
    }
  }, []);

  const getSelectedNode = useCallback((): FlatNode | null => {
    const nodes = flatNodesRef.current;
    if (nodes.length === 0) return null;
    const idx = Math.min(cursor, nodes.length - 1);
    return nodes[idx] || null;
  }, [cursor]);

  const isExpanded = useCallback((id: string): boolean => {
    return expanded.has(id);
  }, [expanded]);

  const moveUp = useCallback((): void => {
    setCursor(prev => Math.max(0, prev - 1));
  }, []);

  const moveDown = useCallback((): void => {
    const max = flatNodesRef.current.length - 1;
    setCursor(prev => Math.min(Math.max(0, max), prev + 1));
  }, []);

  const moveLeft = useCallback((): void => {
    const nodes = flatNodesRef.current;
    if (nodes.length === 0) return;
    const idx = Math.min(cursor, nodes.length - 1);
    const node = nodes[idx];
    if (!node) return;
    if (node.hasChildren && expanded.has(node.id)) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    } else if (node.parentId) {
      const parentIdx = nodes.findIndex(n => n.id === node.parentId);
      if (parentIdx >= 0) {
        setCursor(parentIdx);
      }
    }
  }, [cursor, expanded]);

  const moveRight = useCallback((): void => {
    const nodes = flatNodesRef.current;
    if (nodes.length === 0) return;
    const idx = Math.min(cursor, nodes.length - 1);
    const node = nodes[idx];
    if (!node || !node.hasChildren) return;
    if (!expanded.has(node.id)) {
      setExpanded(prev => new Set(prev).add(node.id));
    } else {
      if (idx + 1 < nodes.length && nodes[idx + 1].depth > node.depth) {
        setCursor(idx + 1);
      }
    }
  }, [cursor, expanded]);

  const toggle = useCallback((id?: string): void => {
    const nodes = flatNodesRef.current;
    let targetId = id;
    if (!targetId) {
      const idx = Math.min(cursor, nodes.length - 1);
      const node = nodes[idx];
      if (!node || !node.hasChildren) return;
      targetId = node.id;
    }
    const finalId = targetId;
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(finalId)) {
        next.delete(finalId);
      } else {
        next.add(finalId);
      }
      return next;
    });
  }, [cursor]);

  const expand = useCallback((id: string): void => {
    setExpanded(prev => {
      if (prev.has(id)) return prev;
      return new Set(prev).add(id);
    });
  }, []);

  const collapse = useCallback((id: string): void => {
    setExpanded(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((): void => {
    const nodes = flatNodesRef.current;
    const allIds = new Set<string>();
    for (const node of nodes) {
      if (node.hasChildren) allIds.add(node.id);
    }
    setExpanded(allIds);
  }, []);

  const collapseAll = useCallback((): void => {
    setExpanded(new Set());
  }, []);

  const setCursorIndex = useCallback((index: number): void => {
    const max = flatNodesRef.current.length - 1;
    setCursor(Math.max(0, Math.min(Math.max(0, max), index)));
  }, []);

  return {
    cursor, expanded, setFlatNodes, getSelectedNode, isExpanded,
    moveUp, moveDown, moveLeft, moveRight, toggle, expand, collapse,
    expandAll, collapseAll, setCursorIndex,
  };
};

export { useTreeNav };
export type { UseTreeNavReturn };
