/**
 * B-One Maestro Frontend Application
 *
 * Desktop application UI for autonomous multi-agent workflow orchestration.
 * Architecture: Clean separation between UI and business logic.
 * Business logic resides in backend - frontend is purely presentational.
 */

import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { CommandPalette, useCommandPalette } from './components/common/CommandPalette';

function App() {
  const { isOpen, close } = useCommandPalette();

  return (
    <>
      <RouterProvider router={router} />
      <CommandPalette isOpen={isOpen} onClose={close} />
    </>
  );
}

export default App;
