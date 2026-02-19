/**
 * Root Layout
 *
 * Main application layout with navigation and outlet for child routes.
 */

import { Outlet, Link, useLocation } from 'react-router-dom';
import './RootLayout.scss';

export function RootLayout() {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path);

  return (
    <div className="root-layout">
      <header className="root-layout__header">
        <div className="header-content">
          <div className="header-brand">
            <Link to="/" className="brand-link">
              <h1 className="brand-title">B-One Maestro</h1>
            </Link>
            <span className="brand-tagline">Autonomous Multi-Agent Orchestrator</span>
          </div>
          <nav className="header-nav">
            <Link
              to="/"
              className={`nav-link ${isActive('/') && location.pathname === '/' ? 'nav-link--active' : ''}`}
            >
              Home
            </Link>
            <Link
              to="/workflows"
              className={`nav-link ${isActive('/workflows') ? 'nav-link--active' : ''}`}
            >
              Workflows
            </Link>
            <Link
              to="/history"
              className={`nav-link ${isActive('/history') ? 'nav-link--active' : ''}`}
            >
              History
            </Link>
          </nav>
        </div>
      </header>

      <main className="root-layout__main">
        <Outlet />
      </main>

      <footer className="root-layout__footer">
        <p>B-One Maestro &copy; 2024 | Clean Architecture | Model-Agnostic | Desktop-First</p>
      </footer>
    </div>
  );
}

export default RootLayout;
