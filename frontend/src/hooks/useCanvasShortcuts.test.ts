/**
 * useCanvasShortcuts Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasShortcuts } from '../useCanvasShortcuts';
import { useBlockStore } from '../../store/blockStore';
import { useNavigationStore } from '../../store/navigationStore';

// Mock the stores
vi.mock('../../store/blockStore');
vi.mock('../../store/navigationStore');

describe('useCanvasShortcuts', () => {
  const mockRemoveBlock = vi.fn();
  const mockDuplicateBlock = vi.fn();
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const mockCanUndo = vi.fn(() => true);
  const mockCanRedo = vi.fn(() => true);
  const mockSelectBlock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useBlockStore as any).mockReturnValue({
      removeBlock: mockRemoveBlock,
      duplicateBlock: mockDuplicateBlock,
      undo: mockUndo,
      redo: mockRedo,
      canUndo: mockCanUndo,
      canRedo: mockCanRedo,
    });

    (useNavigationStore as any).mockReturnValue({
      selectedBlockId: 'test-block',
      selectBlock: mockSelectBlock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle Delete key', () => {
    renderHook(() => useCanvasShortcuts({ enabled: true, parentId: null }));

    const event = new KeyboardEvent('keydown', { key: 'Delete' });
    document.dispatchEvent(event);

    expect(mockRemoveBlock).toHaveBeenCalledWith('test-block');
    expect(mockSelectBlock).toHaveBeenCalledWith(null);
  });

  it('should handle Ctrl+D for duplicate', () => {
    renderHook(() => useCanvasShortcuts({ enabled: true, parentId: null }));

    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true });
    document.dispatchEvent(event);

    expect(mockDuplicateBlock).toHaveBeenCalledWith('test-block');
  });

  it('should handle Ctrl+Z for undo', () => {
    renderHook(() => useCanvasShortcuts({ enabled: true, parentId: null }));

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    document.dispatchEvent(event);

    expect(mockUndo).toHaveBeenCalled();
  });

  it('should handle Escape to deselect', () => {
    renderHook(() => useCanvasShortcuts({ enabled: true, parentId: null }));

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(mockSelectBlock).toHaveBeenCalledWith(null);
  });

  it('should not handle shortcuts when disabled', () => {
    renderHook(() => useCanvasShortcuts({ enabled: false, parentId: null }));

    const event = new KeyboardEvent('keydown', { key: 'Delete' });
    document.dispatchEvent(event);

    expect(mockRemoveBlock).not.toHaveBeenCalled();
  });

  it('should not handle shortcuts when typing in input', () => {
    renderHook(() => useCanvasShortcuts({ enabled: true, parentId: null }));

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    input.dispatchEvent(event);

    expect(mockRemoveBlock).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
