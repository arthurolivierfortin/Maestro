// @ts-nocheck
/**
 * Phase 23: Breadcrumb navigation component.
 * Shows the current navigation path (Home > Spaces > Workspace > Session).
 * Framework-agnostic rendering via createElement.
 */

import { createElement as h } from 'react';
import type { BreadcrumbItem } from '../../types/page.js';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  onNavigate?: (item: BreadcrumbItem) => void;
}

/**
 * Ink-compatible Breadcrumb component.
 * Renders: Home > Spaces > My Workspace > Session abc123
 */
export function Breadcrumb({ items, separator = ' > ', onNavigate }: BreadcrumbProps) {
  const Text = require('ink').Text;

  if (!items || items.length === 0) return null;

  const elements: unknown[] = [];

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;

    // Item label
    if (isLast) {
      // Current item — bold
      elements.push(
        h(Text, { key: `item-${index}`, bold: true, color: 'white' }, item.label)
      );
    } else {
      // Navigable item — dimmed
      elements.push(
        h(Text, { key: `item-${index}`, color: 'gray' }, item.label)
      );
    }

    // Separator (except after last item)
    if (!isLast) {
      elements.push(
        h(Text, { key: `sep-${index}`, color: '#555' }, separator)
      );
    }
  });

  const Box = require('ink').Box;
  return h(Box, { flexDirection: 'row' }, ...elements);
}

/**
 * Build breadcrumb items from navigation state.
 */
export function buildBreadcrumbs(
  currentPage: string,
  detailView?: { type: string; id: string; name?: string },
  pageName?: string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  // Always start with home
  if (currentPage !== 'home') {
    items.push({ label: 'Home', page: 'home' });
  }

  // Current page
  items.push({
    label: pageName || currentPage.charAt(0).toUpperCase() + currentPage.slice(1),
    page: currentPage,
  });

  // Detail view
  if (detailView) {
    const label = detailView.name
      || `${detailView.type} ${detailView.id.substring(0, 8)}...`;
    items.push({
      label,
      detailType: detailView.type,
      detailId: detailView.id,
    });
  }

  return items;
}
