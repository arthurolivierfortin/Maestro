import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initializeTheme } from './store/themeStore';
import './styles/globals.css';
import './styles/presets.css';
import { initRealBlockRealtime } from './services/real/realBlockService';
import { blockService } from './services';
import { useBlockStore } from './store/blockStore';
import { useMockBackendEffective } from './config/config';

// Initialize theme before rendering
initializeTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Start realtime block updates (best-effort)
void initRealBlockRealtime(import.meta.env.VITE_API_URL || 'http://localhost:5000');

// If using the real backend, hydrate the block store from the backend
async function hydrateBlocksFromBackend() {
  try {
    if (!useMockBackendEffective()) {
      // Fetch blocks from backend and set into the Zustand store
      const blocks = await blockService.getAll();
      const map = new Map<string, any>();
      blocks.forEach((b: any) => map.set(b.id, b));
      useBlockStore.getState().setBlocks(map, null);
      if (import.meta.env.DEV) console.log('[Startup] Hydrated blocks from backend:', blocks.length);
    } else {
      if (import.meta.env.DEV) console.log('[Startup] Mock backend enabled; skipping hydration');
    }
  } catch (e) {
    console.warn('[Startup] Failed to hydrate blocks from backend', e);
  }
}

void hydrateBlocksFromBackend();
