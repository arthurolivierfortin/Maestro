/**
 * B-One Maestro Frontend Application
 *
 * Desktop application UI for autonomous multi-agent workflow orchestration.
 * Architecture: Clean separation between UI and business logic.
 * Business logic resides in backend - frontend is purely presentational.
 */

import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  // App simply provides the router; route-level layout components
  // (like IDELayout) will render global UI such as CommandPalette.
  // Phase 22: ErrorBoundary catches React render errors globally.
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
