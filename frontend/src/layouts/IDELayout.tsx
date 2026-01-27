/**
 * IDE Layout
 *
 * IDE-style layout with resizable panels using react-resizable-panels.
 * Inspired by VS Code, Claude Code, and n8n workflows.
 */

import { useRef, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { BlockExplorer } from '../components/BlockExplorer';
import { Breadcrumb } from '../components/Breadcrumb';
import { useRouteSync } from '../hooks/useRouteSync';
import { useBlocksInitialization } from '../hooks/useBlocksInitialization';
import { TopBar } from '../components/layout/TopBar';
import { PanelLayout, PanelItem, PanelDivider } from '../components/panels';
import { PropertiesPanel } from '../components/panels/PropertiesPanel';
import { BottomPanel } from '../components/panels/BottomPanel';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBlockExplorerVisibility } from '../hooks/useBlockExplorerVisibility';
import { usePropertiesPanelVisibility } from '../hooks/usePropertiesPanelVisibility';
import { CommandPalette, useCommandPalette } from '../components/common/CommandPalette';
import { KeyboardShortcutsPanel } from '../components/common/KeyboardShortcutsPanel';
import './IDELayout.scss';

export function IDELayout() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const bottomPanelRef = useRef<ImperativePanelHandle>(null);

  // Sync router <-> navigation store
  useRouteSync();

  // Initialize blocks from backend API
  const { isLoading: blocksLoading, error: blocksError } = useBlocksInitialization();

  // Log initialization status in dev mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (blocksLoading) {
        console.log('[IDELayout] Loading blocks from backend...');
      }
      if (blocksError) {
        console.error('[IDELayout] Failed to load blocks:', blocksError);
      }
    }
  }, [blocksLoading, blocksError]);

  // Command palette and shortcuts state (now in router context)
  const { isOpen, close, open } = useCommandPalette();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Determine if BlockExplorer should be visible
  const { isVisible: showExplorer, contextBlockId } = useBlockExplorerVisibility();

  // Determine if Properties panel should be visible
  const { isVisible: showProperties } = usePropertiesPanelVisibility();

  // Listen for ? key to show shortcuts and Cmd/Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? key to show shortcuts panel
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Cmd/Ctrl+K for command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    leftPanelRef,
    rightPanelRef,
    bottomPanelRef,
    onFocusSidebar: () => {
      // Focus first focusable element in sidebar
      const sidebar = document.querySelector('.block-explorer');
      const firstFocusable = sidebar?.querySelector('button, [tabindex="0"]') as HTMLElement;
      firstFocusable?.focus();
    },
    onFocusMain: () => {
      // Focus main workspace
      const workspace = document.querySelector('.ide-layout__workspace');
      (workspace as HTMLElement)?.focus();
    },
    onFocusProperties: () => {
      // Focus first focusable element in properties panel
      const properties = document.querySelector('.properties-panel');
      const firstFocusable = properties?.querySelector(
        'input, button, [tabindex="0"]'
      ) as HTMLElement;
      firstFocusable?.focus();
    },
  });

  const handleCloseBottomPanel = () => {
    if (bottomPanelRef.current) {
      bottomPanelRef.current.collapse();
    }
  };

  return (
    <div className="ide-layout">
      <TopBar />
      {/* Breadcrumb fixed below TopBar */}
      <Breadcrumb />
      <div className="ide-layout__body">
        {/* Main horizontal split: left sidebar + center/right + bottom */}
        <PanelLayout persistKey="main" direction="vertical">
          {/* Top section: left sidebar + center + right properties */}
          <PanelItem id="top" defaultSize={80} minSize={30}>
            <PanelLayout persistKey="horizontal" direction="horizontal">
              {/* Left Sidebar - BlockExplorer (conditional) */}
              {showExplorer && (
                <>
                  <PanelItem
                    id="sidebar"
                    defaultSize={20}
                    minSize={2}
                    maxSize={35}
                    collapsible={true}
                    collapsedSize={2}
                    panelRef={leftPanelRef}
                  >
                    <BlockExplorer contextBlockId={contextBlockId} panelRef={leftPanelRef} />
                  </PanelItem>

                  <PanelDivider />
                </>
              )}

              {/* Center - Main workspace */}
              <PanelItem
                id="main"
                defaultSize={
                  showExplorer && showProperties ? 60 : showExplorer || showProperties ? 80 : 100
                }
                minSize={40}
              >
                <div className="ide-layout__main-area">
                  <main className="ide-layout__workspace" tabIndex={0}>
                    <Outlet />
                  </main>
                </div>
              </PanelItem>

              {showProperties && (
                <>
                  <PanelDivider />

                  {/* Right - Properties Panel */}
                  <PanelItem
                    id="properties"
                    defaultSize={20}
                    minSize={2}
                    maxSize={35}
                    collapsible={true}
                    collapsedSize={2}
                    panelRef={rightPanelRef}
                  >
                    <PropertiesPanel panelRef={rightPanelRef} />
                  </PanelItem>
                </>
              )}
            </PanelLayout>
          </PanelItem>

          <PanelDivider />

          {/* Bottom Panel - Terminal, Output, Problems */}
          <PanelItem
            id="bottom"
            defaultSize={20}
            minSize={10}
            maxSize={50}
            collapsible={true}
            panelRef={bottomPanelRef}
          >
            <BottomPanel onClose={handleCloseBottomPanel} />
          </PanelItem>
        </PanelLayout>
      </div>

      {/* Global overlays - rendered inside Router context */}
      <CommandPalette isOpen={isOpen} onClose={close} />
      <KeyboardShortcutsPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

export default IDELayout;
