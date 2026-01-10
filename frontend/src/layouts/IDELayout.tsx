/**
 * IDE Layout
 *
 * IDE-style layout with left sidebar, main workspace, and minimal top bar.
 * Inspired by VS Code, Claude Code, and n8n workflows.
 */

import { Outlet } from 'react-router-dom';
import { BlockExplorer } from '../components/BlockExplorer';
import { Breadcrumb } from '../components/Breadcrumb';
import { TopBar } from '../components/layout/TopBar';
import './IDELayout.scss';

export function IDELayout() {
  return (
    <div className="ide-layout">
      <TopBar />
      <div className="ide-layout__body">
        <BlockExplorer />
        <div className="ide-layout__main-area">
          <Breadcrumb />
          <main className="ide-layout__workspace">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default IDELayout;
