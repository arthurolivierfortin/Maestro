/**
 * Breadcrumb Component
 *
 * Displays navigation breadcrumb with clickable segments.
 * Home button navigates to root route when at block root.
 */

import { useNavigate } from 'react-router-dom';
import { useNavigation } from '../../hooks';
import { BlockIcon } from '../icons';
import { Home } from 'lucide-react';
import './Breadcrumb.scss';

export function Breadcrumb() {
  const { getBreadcrumbs, navigateTo, navigateToRoot, isAtRoot } = useNavigation();
  const navigate = useNavigate();
  const breadcrumbs = getBreadcrumbs();

  const handleHomeClick = () => {
    if (isAtRoot()) {
      // Already at block root, navigate to home page
      navigate('/');
    } else {
      // Navigate to block root
      navigateToRoot();
    }
  };

  const handleSegmentClick = (index: number) => {
    if (index === 0) {
      handleHomeClick();
    } else {
      const path = breadcrumbs.slice(1, index + 1).map((b) => b.id);
      navigateTo(path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSegmentClick(index);
    }
  };

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb navigation">
      <ol className="breadcrumb__list">
        {/* Root/Home segment */}
        <li className="breadcrumb__item">
          <button
            className={`breadcrumb__segment ${isAtRoot() ? 'breadcrumb__segment--active' : ''}`}
            onClick={handleHomeClick}
            onKeyDown={(e) => handleKeyDown(e, 0)}
            aria-label={isAtRoot() ? 'Navigate to home page' : 'Navigate to block root'}
            aria-current={isAtRoot() ? 'page' : undefined}
          >
            <Home size={16} className="breadcrumb__icon" />
            <span className="breadcrumb__label">Home</span>
          </button>
        </li>

        {/* Block segments */}
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const block = item.block;

          if (!block) return null;

          return (
            <li key={item.id} className="breadcrumb__item">
              <span className="breadcrumb__separator">/</span>
              <button
                className={`breadcrumb__segment ${isLast ? 'breadcrumb__segment--active' : ''}`}
                onClick={() => handleSegmentClick(index + 1)}
                onKeyDown={(e) => handleKeyDown(e, index + 1)}
                aria-label={`Navigate to ${block.name}`}
                aria-current={isLast ? 'page' : undefined}
              >
                <BlockIcon type={block.blockType} size={16} className="breadcrumb__icon" />
                <span className="breadcrumb__label">{block.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
