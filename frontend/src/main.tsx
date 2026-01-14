import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initializeTheme } from './store/themeStore';
import './styles/globals.css';
import './styles/presets.css';
import { initRealBlockRealtime } from './services/real/realBlockService';

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
