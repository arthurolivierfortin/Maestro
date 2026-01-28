/**
 * File Browser Component
 *
 * Directory navigation for selecting project folders.
 * Phase 8 implementation.
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import {
  DirectoryEntry,
  DirectoryListing,
  CommonDirectory,
  fileSystemService,
} from '../../services/fileSystemService';
import {
  Home,
  Monitor,
  Code2,
  Download,
  Image,
  Music,
  Video,
  FileText,
  Cloud,
  Folder,
  FolderGit,
  FolderKanban,
  ChevronUp,
} from 'lucide-react';
import './FileBrowser.scss';

interface FileBrowserProps {
  onSelect: (path: string) => void;
  initialPath?: string;
}

const getQuickAccessIcon = (icon?: string): ReactNode => {
  switch (icon) {
    case 'home':
      return <Home size={16} />;
    case 'desktop':
      return <Monitor size={16} />;
    case 'code':
      return <Code2 size={16} />;
    case 'download':
      return <Download size={16} />;
    case 'image':
      return <Image size={16} />;
    case 'music':
      return <Music size={16} />;
    case 'video':
      return <Video size={16} />;
    case 'file-text':
      return <FileText size={16} />;
    case 'cloud':
      return <Cloud size={16} />;
    default:
      return <Folder size={16} />;
  }
};

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

  const getDirectoryIcon = (dir: DirectoryEntry): ReactNode => {
    if (dir.isMaestroProject) return <FolderKanban size={16} />;
    if (dir.isGitRepository) return <FolderGit size={16} />;
    return <Folder size={16} />;
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
                {getQuickAccessIcon(dir.icon)}
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
          <ChevronUp size={16} />
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
                <span>[M]</span> This is a Maestro project
              </div>
            )}
            {listing.isGitRepository && !listing.isMaestroProject && (
              <div className="file-browser__project-indicator file-browser__project-indicator--git">
                <span>[G]</span> Git repository
              </div>
            )}

            {/* Directories */}
            <div className="file-browser__items">
              {listing.directories.map((dir) => (
                <button
                  key={dir.path}
                  className={`file-browser__item ${
                    dir.isMaestroProject ? 'file-browser__item--maestro' : ''
                  } ${dir.isGitRepository ? 'file-browser__item--git' : ''} ${
                    dir.isHidden ? 'file-browser__item--hidden' : ''
                  }`}
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
                  {dir.isHidden && (
                    <span className="file-browser__item-badge file-browser__item-badge--hidden">
                      Hidden
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
