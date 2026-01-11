/**
 * Breadcrumb Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb } from './Breadcrumb';
import { useNavigationStore } from '../../store/navigationStore';
import { useBlockStore } from '../../store/blockStore';
import type { Block } from '../../types/block.types';

// Mock the hooks
vi.mock('../../hooks/useNavigation', () => ({
  useNavigation: () => {
    const navigation = useNavigationStore();
    const getBlock = useBlockStore((state) => state.getBlock);
    const getRootBlock = useBlockStore((state) => state.getRootBlock);

    const getBreadcrumbs = () => {
      const root = getRootBlock();
      const items: Array<{ id: string; block: Block | undefined }> = [];

      if (root) {
        items.push({ id: root.id, block: root });
      }

      navigation.currentPath.forEach((id) => {
        if (id !== root?.id) {
          items.push({ id, block: getBlock(id) });
        }
      });

      return items;
    };

    return {
      ...navigation,
      getBreadcrumbs,
    };
  },
}));

describe('Breadcrumb', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentPath: [],
      selectedBlockId: null,
    });
    useBlockStore.getState().clear();
  });

  const createTestBlock = (id: string, name: string): Block => ({
    id,
    name,
    blockType: 'workflow',
    isAtomic: false,
    parentId: null,
    config: { type: 'workflow' },
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
    children: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user',
      tags: [],
      status: 'active' as const,
    },
  });

  it('should render home segment when at root', () => {
    render(<Breadcrumb />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('should render root block name', () => {
    const rootBlock = createTestBlock('root-1', 'My Workflow');
    useBlockStore.getState().addBlock(null, rootBlock);

    render(<Breadcrumb />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('My Workflow')).toBeInTheDocument();
  });

  it('should navigate to root when home is clicked', async () => {
    const user = userEvent.setup();
    const rootBlock = createTestBlock('root-1', 'Workflow');

    useBlockStore.getState().addBlock(null, rootBlock);

    render(<Breadcrumb />);

    const homeButton = screen.getByLabelText('Navigate to root');
    await user.click(homeButton);

    expect(useNavigationStore.getState().currentPath).toEqual([]);
  });

  it('should mark home as active when at root', () => {
    render(<Breadcrumb />);

    const homeButton = screen.getByLabelText('Navigate to root');
    expect(homeButton).toHaveClass('breadcrumb__segment--active');
  });

  it('should mark root block as active when not navigated into children', () => {
    const rootBlock = createTestBlock('root-1', 'My Workflow');
    useBlockStore.getState().addBlock(null, rootBlock);

    render(<Breadcrumb />);

    const workflowButton = screen.getByLabelText('Navigate to My Workflow');
    expect(workflowButton).toHaveClass('breadcrumb__segment--active');
  });
});
