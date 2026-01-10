/**
 * Lazy Page Wrapper
 *
 * Wraps lazy-loaded components with Suspense fallback.
 */

import { Suspense } from 'react';
import LoadingSpinner from '@components/common/LoadingSpinner';

export function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner fullScreen />}>{children}</Suspense>;
}
