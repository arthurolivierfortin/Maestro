/**
 * IDE Layout
 *
 * IDE-style layout with resizable panels using react-resizable-panels.
 * Inspired by VS Code, Claude Code, and n8n workflows.
 */

import { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { BlockExplorer } from '../components/BlockExplorer';
import { Breadcrumb } from '../components/Breadcrumb';
import { TopBar } from '../components/layout/TopBar';
import { PanelLayout, PanelItem, PanelDivider } from '../components/panels';
import { PropertiesPanel } from '../components/panels/PropertiesPanel';
import { BottomPanel } from '../components/panels/BottomPanel';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBlockExplorerVisibility } from '../hooks/useBlockExplorerVisibility';
import { usePropertiesPanelVisibility } from '../hooks/usePropertiesPanelVisibility';
import './IDELayout.scss';

export function IDELayout() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const bottomPanelRef = useRef<ImperativePanelHandle>(null);

  // Determine if BlockExplorer should be visible
  const { isVisible: showExplorer, contextBlockId } = useBlockExplorerVisibility();
  
  // Determine if Properties panel should be visible
  const { isVisible: showProperties } = usePropertiesPanelVisibility();

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
                    minSize={15}
                    maxSize={35}
                    collapsible={true}
                    panelRef={leftPanelRef}
                  >
                    <BlockExplorer contextBlockId={contextBlockId} />
                  </PanelItem>

                  <PanelDivider />
                </>
              )}

              {/* Center - Main workspace */}
              <PanelItem id="main" defaultSize={showExplorer ? 60 : 80} minSize={40}>
                <div className="ide-layout__main-area">
                  <Breadcrumb />
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
                    minSize={15}
                    maxSize={35}
                    collapsible={true}
                    collapsedSize={5}
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
    </div>
  );
}

export default IDELayout;
