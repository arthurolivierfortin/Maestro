/**
 * Chevron Icon Component
 *
 * Animated chevron for expand/collapse.
 */

import { ChevronRight } from 'lucide-react';
import './ChevronIcon.scss';

interface ChevronIconProps {
  isExpanded: boolean;
  size?: number;
  className?: string;
}

export function ChevronIcon({ isExpanded, size = 16, className = '' }: ChevronIconProps) {
  return (
    <ChevronRight
      size={size}
      className={`chevron-icon ${isExpanded ? 'chevron-icon--expanded' : ''} ${className}`}
    />
  );
}
