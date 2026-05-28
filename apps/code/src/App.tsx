import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ConsolePage } from './pages/ConsolePage';
import { SpacesPage } from './pages/SpacesPage';
import { CatalogPage } from './pages/CatalogPage';
import { ModelsPage } from './pages/ModelsPage';
import { MonitorPage } from './pages/MonitorPage';
import { HelpOverlay } from './components/HelpOverlay';
import { StatusBar } from './components/StatusBar';

export type PageId = 'console' | 'spaces' | 'catalog' | 'models' | 'monitor';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('console');
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
      if (isTyping) return;

      if (e.key === '?') {
        e.preventDefault();
        toggleHelp();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleHelp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {currentPage === 'console' && (
          <ConsolePage showHelp={showHelp} onToggleHelp={toggleHelp} />
        )}
        {currentPage === 'spaces' && <SpacesPage />}
        {currentPage === 'catalog' && <CatalogPage />}
        {currentPage === 'models' && <ModelsPage />}
        {currentPage === 'monitor' && <MonitorPage />}
      </main>
      <StatusBar />
      {showHelp && currentPage !== 'console' && <HelpOverlay onClose={toggleHelp} />}
    </div>
  );
}
