/**
 * File Browser Component
 *
 * Directory navigation for selecting project folders.
 * Phase 8 implementation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DirectoryEntry,
  DirectoryListing,
  CommonDirectory,
  fileSystemService,
} from '../../services/fileSystemService';
import './FileBrowser.scss';

interface FileBrowserProps {
  onSelect: (path: string) => void;
  initialPath?: string;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ onSelect, initialPath }) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [commonDirs, setCommonDirs] = useState<CommonDirectory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState(initialPath || '');

  // Load common directories on mount
  useEffect(() => {
    fileSystemService.getCommonDirectories().then(setCommonDirs).catch(console.error);
  }, []);

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fileSystemService.browse(path || undefined);
      setListing(result);
      setCurrentPath(result.currentPath);
      setPathInput(result.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDirectory(initialPath || '');
  }, [initialPath, loadDirectory]);

  const handleNavigate = (path: string) => {
    loadDirectory(path);
  };

  const handleGoUp = () => {
    if (listing?.parentPath) {
      loadDirectory(listing.parentPath);
    }
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      loadDirectory(pathInput.trim());
    }
  };

  const handleSelectCurrent = () => {
    if (currentPath) {
      onSelect(currentPath);
    }
  };

  const getDirectoryIcon = (dir: DirectoryEntry): string => {
    if (dir.isMaestroProject) return '🎭';
    if (dir.isGitRepository) return '📦';
    if (dir.isHidden) return '📁';
    return '📂';
  };

  return (
    <div className="file-browser">
      {/* Quick access */}
      <div className="file-browser__quick-access">
        <h4>Quick Access</h4>
        <div className="file-browser__quick-list">
          {commonDirs.map((dir) => (
            <button
              key={dir.path}
              className="file-browser__quick-item"
              onClick={() => handleNavigate(dir.path)}
              title={dir.path}
            >
              <span className="file-browser__quick-icon">
                {dir.icon === 'home'
                  ? '🏠'
                  : dir.icon === 'desktop'
                  ? '🖥️'
                  : dir.icon === 'code'
                  ? '💻'
                  : '📁'}
              </span>
              <span className="file-browser__quick-name">{dir.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Path input */}
      <form className="file-browser__path-form" onSubmit={handlePathSubmit}>
        <input
          type="text"
          className="file-browser__path-input"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          placeholder="Enter path..."
        />
        <button type="submit" className="file-browser__go-btn">
          Go
        </button>
      </form>

      {/* Breadcrumb / Navigation */}
      <div className="file-browser__nav">
        <button
          className="file-browser__nav-btn"
          onClick={handleGoUp}
          disabled={!listing?.parentPath}
          title="Go up"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"
            />
          </svg>
        </button>
        <span className="file-browser__current-path" title={currentPath}>
          {currentPath || 'Select a folder'}
        </span>
      </div>

      {/* Directory listing */}
      <div className="file-browser__listing">
        {isLoading && (
          <div className="file-browser__loading">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        )}

        {error && <div className="file-browser__error">{error}</div>}

        {!isLoading && !error && listing && (
          <>
            {/* Project indicator */}
            {listing.isMaestroProject && (
              <div className="file-browser__project-indicator file-browser__project-indicator--maestro">
                <span>🎭</span> This is a Maestro project
              </div>
            )}
            {listing.isGitRepository && !listing.isMaestroProject && (
              <div className="file-browser__project-indicator file-browser__project-indicator--git">
                <span>📦</span> Git repository
              </div>
            )}

            {/* Directories */}
            <div className="file-browser__items">
              {listing.directories
                .filter((d) => !d.isHidden)
                .map((dir) => (
                  <button
                    key={dir.path}
                    className={`file-browser__item ${
                      dir.isMaestroProject ? 'file-browser__item--maestro' : ''
                    } ${dir.isGitRepository ? 'file-browser__item--git' : ''}`}
                    onClick={() => handleNavigate(dir.path)}
                    onDoubleClick={() => handleNavigate(dir.path)}
                  >
                    <span className="file-browser__item-icon">{getDirectoryIcon(dir)}</span>
                    <span className="file-browser__item-name">{dir.name}</span>
                    {dir.isMaestroProject && (
                      <span className="file-browser__item-badge">Project</span>
                    )}
                    {dir.isGitRepository && !dir.isMaestroProject && (
                      <span className="file-browser__item-badge file-browser__item-badge--git">
                        Git
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {listing.directories.length === 0 && (
              <div className="file-browser__empty">No subdirectories</div>
            )}
          </>
        )}
      </div>

      {/* Select button */}
      <div className="file-browser__actions">
        <button
          className="file-browser__select-btn"
          onClick={handleSelectCurrent}
          disabled={!currentPath}
        >
          Select This Folder
        </button>
      </div>
    </div>
  );
};

export default FileBrowser;
