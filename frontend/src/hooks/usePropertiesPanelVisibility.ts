/**
 * usePropertiesPanelVisibility Hook
 *
 * Determines whether the Properties panel should be visible based on current route
 * and navigation state. Properties panel is hidden when editing atomic blocks.
 */

import { useLocation } from 'react-router-dom';
import { useNavigationStore } from '../store/navigationStore';

export function usePropertiesPanelVisibility() {
  const location = useLocation();
  const isEditingAtomicBlock = useNavigationStore((state) => state.isEditingAtomicBlock);

  // Hide properties panel when editing an atomic block
  // (atomic blocks have their own full editor page)
  if (isEditingAtomicBlock) {
    return { isVisible: false };
  }

  // Canvas pages - properties panel visible
  if (location.pathname.startsWith('/canvas')) {
    return { isVisible: true };
  }

  // All other pages - hide properties panel
  return { isVisible: false };
}
