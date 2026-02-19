/**
 * BlockCanvas Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockCanvas } from './BlockCanvas';
import { useBlockStore } from '../../store/blockStore';
import { useNavigationStore } from '../../store/navigationStore';

// Mock ReactFlow
vi.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  BackgroundVariant: { Dots: 'dots' },
}));

describe('BlockCanvas', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      navStack: [],
      selectedBlockId: null,
      propertiesPanelMode: 'view',
    });
    useBlockStore.getState().clear();
  });

  it('should render the canvas', () => {
    render(<BlockCanvas parentId={null} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('should render controls and minimap', () => {
    render(<BlockCanvas parentId={null} />);
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });

  it('should handle read-only mode', () => {
    render(<BlockCanvas parentId={null} readOnly={true} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('should call onBlockSelect when provided', () => {
    const mockOnBlockSelect = vi.fn();
    render(<BlockCanvas parentId={null} onBlockSelect={mockOnBlockSelect} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('should call onDrillDown when provided', () => {
    const mockOnDrillDown = vi.fn();
    render(<BlockCanvas parentId={null} onDrillDown={mockOnDrillDown} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });
});
