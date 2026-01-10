/**
 * B-One Maestro Frontend Application
 *
 * Desktop application UI for autonomous multi-agent workflow orchestration.
 * Architecture: Clean separation between UI and business logic.
 * Business logic resides in backend - frontend is purely presentational.
 */

import { RouterProvider } from 'react-router-dom';
import { router } from './router';

function App() {
  return <RouterProvider router={router} />;
}

export default App;
