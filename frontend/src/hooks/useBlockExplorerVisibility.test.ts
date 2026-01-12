/**
 * useBlockExplorerVisibility Hook Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useBlockExplorerVisibility } from './useBlockExplorerVisibility';
import { useBlockStore } from '../store';
import type { Block } from '../types/block.types';
import type { ReactNode } from 'react';

// Helper to render hook with router context
function renderHookWithRouter(path: string) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/canvas/:blockId', element: children }),
        createElement(Route, { path: '/canvas', element: children }),
        createElement(Route, { path: '/foundry/:blockId/edit', element: children }),
        createElement(Route, { path: '/foundry', element: children }),
        createElement(Route, { path: '*', element: children })
      )
    );

  return renderHook(() => useBlockExplorerVisibility(), { wrapper });
}

describe('useBlockExplorerVisibility', () => {
  beforeEach(() => {
    // Clear the block store before each test
    useBlockStore.setState({ blocks: new Map(), rootId: null });
  });

  it('should return visible=true for canvas pages', () => {
    const { result } = renderHookWithRouter('/canvas');
    expect(result.current.isVisible).toBe(true);
  });

  it('should return visible=true for canvas with blockId', () => {
    const { result } = renderHookWithRouter('/canvas/block-123');
    expect(result.current.isVisible).toBe(true);
    expect(result.current.contextBlockId).toBe('block-123');
  });

  it('should return visible=false for home page', () => {
    const { result } = renderHookWithRouter('/');
    expect(result.current.isVisible).toBe(false);
  });

  it('should return visible=false for foundry page', () => {
    const { result } = renderHookWithRouter('/foundry');
    expect(result.current.isVisible).toBe(false);
  });

  it('should return visible=false for models page', () => {
    const { result } = renderHookWithRouter('/models');
    expect(result.current.isVisible).toBe(false);
  });

  it('should return visible=true for composite block edit pages', () => {
    // Create a composite block in the store
    const compositeBlock: Block = {
      id: 'composite-123',
      name: 'Composite Block',
      blockType: 'workflow',
      isAtomic: false, // composite
      config: { type: 'workflow' },
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user',
        tags: [],
        status: 'active',
      },
    };

    const blocksMap = new Map<string, Block>();
    blocksMap.set('composite-123', compositeBlock);
    useBlockStore.setState({ blocks: blocksMap });

    const { result } = renderHookWithRouter('/foundry/composite-123/edit');
    expect(result.current.isVisible).toBe(true);
    expect(result.current.contextBlockId).toBe('composite-123');
  });

  it('should return visible=false for atomic block edit pages', () => {
    // Create an atomic block in the store
    const atomicBlock: Block = {
      id: 'atomic-123',
      name: 'Atomic Block',
      blockType: 'prompt',
      isAtomic: true, // atomic
      config: { type: 'prompt', template: 'test' },
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user',
        tags: [],
        status: 'active',
      },
    };

    const blocksMap = new Map<string, Block>();
    blocksMap.set('atomic-123', atomicBlock);
    useBlockStore.setState({ blocks: blocksMap });

    const { result } = renderHookWithRouter('/foundry/atomic-123/edit');
    expect(result.current.isVisible).toBe(false);
  });

  it('should return visible=false for non-existent block edit pages', () => {
    const { result } = renderHookWithRouter('/foundry/non-existent/edit');
    expect(result.current.isVisible).toBe(false);
  });
});
