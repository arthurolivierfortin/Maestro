/**
 * Top Bar Component
 *
 * Minimal top bar with app title, main navigation, and settings access.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SettingsModal } from '../settings/SettingsModal';
import './TopBar.scss';

export function TopBar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div className="top-bar">
        <div className="top-bar__left">
          <Link to="/" className="top-bar__brand">
            <h1 className="top-bar__title">B-One Maestro</h1>
          </Link>
          <span className="top-bar__subtitle">Autonomous Multi-Agent Orchestrator</span>
        </div>
        <nav className="top-bar__nav">
          <Link
            to="/"
            className={`top-bar__nav-link ${isActive('/') ? 'top-bar__nav-link--active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/workflows"
            className={`top-bar__nav-link ${isActive('/workflows') ? 'top-bar__nav-link--active' : ''}`}
          >
            Workflows
          </Link>
          <Link
            to="/demo"
            className={`top-bar__nav-link ${isActive('/demo') ? 'top-bar__nav-link--active' : ''}`}
          >
            Demo
          </Link>
          <Link
            to="/history"
            className={`top-bar__nav-link ${isActive('/history') ? 'top-bar__nav-link--active' : ''}`}
          >
            History
          </Link>
        </nav>
        <div className="top-bar__right">
          <button
            className="top-bar__settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path d="M16.5 10c0 .3 0 .6-.1.9l1.7 1.3c.2.1.2.4.1.6l-1.6 2.7c-.1.2-.3.3-.6.2l-2-.8c-.4.3-.9.6-1.4.8l-.3 2.1c0 .2-.3.4-.5.4h-3.2c-.3 0-.5-.2-.5-.4l-.3-2.1c-.5-.2-1-.5-1.4-.8l-2 .8c-.2.1-.5 0-.6-.2L2.2 12.8c-.1-.2-.1-.5.1-.6l1.7-1.3c-.1-.3-.1-.6-.1-.9s0-.6.1-.9L2.3 7.8c-.2-.1-.2-.4-.1-.6l1.6-2.7c.1-.2.3-.3.6-.2l2 .8c.4-.3.9-.6 1.4-.8l.3-2.1c0-.2.3-.4.5-.4h3.2c.3 0 .5.2.5.4l.3 2.1c.5.2 1 .5 1.4.8l2-.8c.2-.1.5 0 .6.2l1.6 2.7c.1.2.1.5-.1.6l-1.7 1.3c.1.3.1.6.1.9z" />
            </svg>
          </button>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
