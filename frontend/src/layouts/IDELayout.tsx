/**
 * IDE Layout
 *
 * IDE-style layout with left sidebar, main workspace, and minimal top bar.
 * Inspired by VS Code, Claude Code, and n8n workflows.
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import './IDELayout.scss';

export function IDELayout() {
  return (
    <div className="ide-layout">
      <TopBar />
      <div className="ide-layout__body">
        <Sidebar />
        <main className="ide-layout__workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default IDELayout;
