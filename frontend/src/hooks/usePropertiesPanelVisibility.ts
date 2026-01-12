/**
 * usePropertiesPanelVisibility Hook
 *
 * Determines whether the Properties panel should be visible based on current route.
 * Properties panel should only be visible in canvas contexts (workflows, blocks, nodes).
 */

import { useLocation } from 'react-router-dom';

export function usePropertiesPanelVisibility() {
  const location = useLocation();

  // Canvas pages - properties panel visible
  if (location.pathname.startsWith('/canvas')) {
    return { isVisible: true };
  }

  // Block edit pages for composite blocks - properties panel visible
  if (location.pathname.includes('/foundry/') && location.pathname.endsWith('/edit')) {
    return { isVisible: true };
  }

  // All other pages - hide properties panel
  return { isVisible: false };
}
