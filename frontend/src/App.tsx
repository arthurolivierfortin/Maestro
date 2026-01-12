/**
 * B-One Maestro Frontend Application
 *
 * Desktop application UI for autonomous multi-agent workflow orchestration.
 * Architecture: Clean separation between UI and business logic.
 * Business logic resides in backend - frontend is purely presentational.
 */

import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { CommandPalette, useCommandPalette } from './components/common/CommandPalette';
import { KeyboardShortcutsPanel } from './components/common/KeyboardShortcutsPanel';

function App() {
  const { isOpen, close } = useCommandPalette();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Listen for ? key to show shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger if typing in input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <CommandPalette isOpen={isOpen} onClose={close} />
      <KeyboardShortcutsPanel
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}

export default App;
