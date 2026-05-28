import { useState } from 'react';
import { Header } from './components/Header';
import { ConsolePage } from './pages/ConsolePage';
import { SpacesPage } from './pages/SpacesPage';
import { StatusBar } from './components/StatusBar';

export type PageId = 'console' | 'spaces';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('console');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {currentPage === 'console' && <ConsolePage />}
        {currentPage === 'spaces' && <SpacesPage />}
      </main>
      <StatusBar />
    </div>
  );
}
