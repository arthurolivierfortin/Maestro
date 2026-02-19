/**
 * Breadcrumb Component
 *
 * Displays navigation breadcrumb with clickable segments.
 * Uses the navigation stack to generate segments.
 */

import { useNavigate } from 'react-router-dom';
import { useNavigation } from '../../hooks';
import { BlockIcon } from '../icons';
import { useBlockStore } from '../../store/blockStore';
import type { BreadcrumbSegment } from '../../types/navigation.types';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import './Breadcrumb.scss';

/**
 * Helper to render block segment with name and icon
 * Uses a targeted selector to only re-render when this specific block changes
 */
function BlockSegmentContent({ segment }: { segment: BreadcrumbSegment }) {
  // Only subscribe to the specific block we need, not the entire blocks Map
  const getBlock = useBlockStore((s) => s.getBlock);
  const block = segment.blockId ? getBlock(segment.blockId) : undefined;
  const label = block ? block.name : segment.label;
  const type = block ? block.blockType : (segment.blockType as any) || 'workflow';

  return (
    <>
      <BlockIcon type={type} size={16} className="breadcrumb__icon" />
      <span className="breadcrumb__label">{label}</span>
    </>
  );
}

export function Breadcrumb() {
  const { getBreadcrumbSegments, popToIndex } = useNavigation();
  const segments = getBreadcrumbSegments();
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);
  const handleForward = () => navigate(1);

  const handleSegmentClick = (segment: BreadcrumbSegment, segmentIndex: number) => {
    // Home is index -1 (before the stack), stack entries start at index 0
    if (segment.type === 'home') {
      navigate('/');
      return;
    }

    // For stack entries, pop to that index
    // segmentIndex 0 = Home, so stack index = segmentIndex - 1
    const stackIndex = segmentIndex - 1;
    if (stackIndex >= 0) {
      popToIndex(stackIndex);
    }
  };

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb navigation">
      <div className="breadcrumb__nav-controls">
        <button className="breadcrumb__nav-btn" onClick={handleBack} aria-label="Go back" title="Go back">
          <ChevronLeft size={16} />
        </button>
        <button className="breadcrumb__nav-btn" onClick={handleForward} aria-label="Go forward" title="Go forward">
          <ChevronRight size={16} />
        </button>
      </div>

      <ol className="breadcrumb__list">
        {segments.map((segment, index) => {
          const isLast = segment.isCurrent;
          return (
            <li key={`${segment.path}-${index}`} className="breadcrumb__item">
              {index > 0 && <span className="breadcrumb__separator">/</span>}
              <button
                className={`breadcrumb__segment ${isLast ? 'breadcrumb__segment--active' : ''}`}
                onClick={() => handleSegmentClick(segment, index)}
                disabled={!segment.isClickable}
                aria-current={isLast ? 'page' : undefined}
              >
                {segment.type === 'home' ? <Home size={16} className="breadcrumb__icon" /> : null}
                {segment.type === 'block' ? <BlockSegmentContent segment={segment} /> : <span className="breadcrumb__label">{segment.label}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
