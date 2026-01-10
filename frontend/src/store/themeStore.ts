/**
 * Theme Store
 *
 * Manages style preset and light/dark theme switching.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StylePreset = 'minimal' | 'structured' | 'balanced';
export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  preset: StylePreset;
  mode: ThemeMode;
  setPreset: (preset: StylePreset) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preset: 'minimal',
      mode: 'light',

      setPreset: (preset: StylePreset) => {
        set({ preset });
        applyTheme(preset, get().mode);
      },

      setMode: (mode: ThemeMode) => {
        set({ mode });
        applyTheme(get().preset, mode);
      },

      toggleMode: () => {
        const newMode = get().mode === 'light' ? 'dark' : 'light';
        set({ mode: newMode });
        applyTheme(get().preset, newMode);
      },
    }),
    {
      name: 'theme-store',
      onRehydrateStorage: () => (state) => {
        // Apply theme after hydration
        if (state) {
          applyTheme(state.preset, state.mode);
        }
      },
    }
  )
);

/**
 * Apply theme to document root
 */
function applyTheme(preset: StylePreset, mode: ThemeMode) {
  document.documentElement.setAttribute('data-preset', preset);
  document.documentElement.setAttribute('data-theme', mode);
}

/**
 * Initialize theme on app load
 */
export function initializeTheme() {
  const state = useThemeStore.getState();
  applyTheme(state.preset, state.mode);
}
