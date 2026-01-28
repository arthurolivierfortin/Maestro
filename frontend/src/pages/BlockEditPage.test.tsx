/**
 * AtomicBlockEditPage Component Tests (renamed from BlockEditPage)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AtomicBlockEditorPage } from './AtomicBlockEditorPage';
import { useBlockStore } from '../store';
import type { Block } from '../types/block.types';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to render component with router context
function renderWithRouter(path: string) {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/foundry/:blockId/edit', element: children })
      )
    );

  return render(createElement(AtomicBlockEditorPage), { wrapper });
}

describe('AtomicBlockEditorPage', () => {
  beforeEach(() => {
    // Clear the block store and navigate mock
    useBlockStore.setState({ blocks: new Map(), rootId: null });
    mockNavigate.mockClear();
  });

  it('should display error when block is not found', () => {
    renderWithRouter('/foundry/nonexistent/edit');

    expect(screen.getByText('Block Not Found')).toBeInTheDocument();
    expect(
      screen.getByText("The block you're looking for doesn't exist or has been deleted.")
    ).toBeInTheDocument();
  });

  it('should redirect to canvas for composite blocks', () => {
    // Create a composite block
    const compositeBlock: Block = {
      id: 'composite-123',
      name: 'Composite Block',
      blockType: 'workflow',
      isAtomic: false,
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

    renderWithRouter('/foundry/composite-123/edit');

    // Should call navigate to canvas
    expect(mockNavigate).toHaveBeenCalledWith('/canvas/composite-123');
  });

  it('should display block information for atomic blocks', () => {
    const atomicBlock: Block = {
      id: 'atomic-123',
      name: 'Test Prompt',
      blockType: 'prompt',
      isAtomic: true,
      config: { type: 'prompt', template: 'Test template' },
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
      metadata: {
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        createdBy: 'user',
        tags: ['test', 'prompt'],
        status: 'active',
        description: 'A test prompt block',
      },
      capabilities: ['text-generation'],
    };

    const blocksMap = new Map<string, Block>();
    blocksMap.set('atomic-123', atomicBlock);
    useBlockStore.setState({ blocks: blocksMap });

    renderWithRouter('/foundry/atomic-123/edit');

    // Check that block information is displayed
    expect(screen.getByRole('heading', { name: 'Test Prompt' })).toBeInTheDocument();
    expect(screen.getByText('A test prompt block')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('text-generation')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('should display Save Changes and Cancel buttons', () => {
    const atomicBlock: Block = {
      id: 'atomic-123',
      name: 'Test Block',
      blockType: 'tool',
      isAtomic: true,
      config: { type: 'tool', toolType: 'Bash' },
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

    renderWithRouter('/foundry/atomic-123/edit');

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('should navigate back to foundry when cancel is clicked', async () => {
    const user = userEvent.setup();

    const atomicBlock: Block = {
      id: 'atomic-123',
      name: 'Test Block',
      blockType: 'tool',
      isAtomic: true,
      config: { type: 'tool', toolType: 'Bash' },
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

    renderWithRouter('/foundry/atomic-123/edit');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith('/foundry');
  });

  it('should display editor placeholder message', () => {
    const atomicBlock: Block = {
      id: 'atomic-123',
      name: 'Test Block',
      blockType: 'agent',
      isAtomic: true,
      config: { type: 'agent', agentType: 'Planner' },
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

    renderWithRouter('/foundry/atomic-123/edit');

    expect(
      screen.getByText((_content, element) => {
        return (
          element?.textContent ===
          'Type-specific editor for agent blocks will be implemented in Phase 4g.2.'
        );
      })
    ).toBeInTheDocument();
  });
});
