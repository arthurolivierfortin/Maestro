/**
 * PanelLayout Component
 *
 * Wrapper around react-resizable-panels with persistence and keyboard support.
 */

import { ReactNode } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';
import './PanelLayout.scss';

export interface PanelLayoutProps {
  /** Unique key for localStorage persistence */
  persistKey: string;
  /** Panel group direction */
  direction: 'horizontal' | 'vertical';
  /** Children (panels and dividers) */
  children: ReactNode;
  /** Class name */
  className?: string;
}

export interface PanelProps {
  /** Panel ID */
  id: string;
  /** Default size (percentage) */
  defaultSize?: number;
  /** Minimum size (percentage) */
  minSize?: number;
  /** Maximum size (percentage) */
  maxSize?: number;
  /** Whether panel can be collapsed */
  collapsible?: boolean;
  /** Preferred width when collapsed (percentage) */
  collapsedSize?: number;
  /** Collapse direction */
  collapseDirection?: 'left' | 'right' | 'up' | 'down';
  /** Class name */
  className?: string;
  /** Children */
  children: ReactNode;
  /** Panel ref for imperative control */
  panelRef?: React.RefObject<ImperativePanelHandle>;
}

export interface PanelDividerProps {
  /** Divider class name */
  className?: string;
}

/**
 * PanelLayout - Resizable panel container
 */
export function PanelLayout({
  persistKey,
  direction,
  children,
  className = '',
}: PanelLayoutProps) {
  const handleLayoutChange = (layout: number[]) => {
    // Persist panel sizes to localStorage with debouncing
    setTimeout(() => {
      try {
        localStorage.setItem(`maestro.ui.panels.${persistKey}`, JSON.stringify(layout));
      } catch (error) {
        console.error('Failed to persist panel sizes:', error);
      }
    }, 100);
  };

  return (
    <PanelGroup
      direction={direction}
      className={`panel-layout ${className}`}
      id={persistKey}
      onLayout={handleLayoutChange}
    >
      {children}
    </PanelGroup>
  );
}

/**
 * PanelItem - Individual resizable panel
 */
export function PanelItem({
  id,
  defaultSize,
  minSize,
  maxSize,
  collapsible,
  collapsedSize,
  className = '',
  children,
  panelRef,
}: PanelProps) {
  return (
    <Panel
      id={id}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsible={collapsible}
      collapsedSize={collapsedSize}
      className={`panel-item ${className}`}
      ref={panelRef as any}
    >
      {children}
    </Panel>
  );
}

/**
 * PanelDivider - Resize handle between panels
 */
export function PanelDivider({ className = '' }: PanelDividerProps) {
  return <PanelResizeHandle className={`panel-divider ${className}`} />;
}
