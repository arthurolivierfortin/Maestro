/**
 * Theme Store
 *
 * Manages style preset and light/dark/system theme switching.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StylePreset = 'minimal' | 'structured' | 'balanced';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preset: StylePreset;
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setPreset: (preset: StylePreset) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

/**
 * Get system theme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve theme based on mode
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preset: 'minimal',
      mode: 'light',
      resolvedTheme: 'light',

      setPreset: (preset: StylePreset) => {
        set({ preset });
        applyTheme(preset, get().resolvedTheme);
      },

      setMode: (mode: ThemeMode) => {
        const resolved = resolveTheme(mode);
        set({ mode, resolvedTheme: resolved });
        applyTheme(get().preset, resolved);
      },

      toggleMode: () => {
        const currentMode = get().mode;
        // Cycle through: light → dark → system → light
        let newMode: ThemeMode;
        if (currentMode === 'light') {
          newMode = 'dark';
        } else if (currentMode === 'dark') {
          newMode = 'system';
        } else {
          newMode = 'light';
        }
        const resolved = resolveTheme(newMode);
        set({ mode: newMode, resolvedTheme: resolved });
        applyTheme(get().preset, resolved);
      },
    }),
    {
      name: 'maestro.theme',
      onRehydrateStorage: () => (state) => {
        // Apply theme after hydration
        if (state) {
          const resolved = resolveTheme(state.mode);
          state.resolvedTheme = resolved;
          applyTheme(state.preset, resolved);
        }
      },
    }
  )
);

/**
 * Apply theme to document root
 */
function applyTheme(preset: StylePreset, theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-preset', preset);
  document.documentElement.setAttribute('data-theme', theme);
  
  // Add smooth transition class
  document.documentElement.classList.add('theme-transition');
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transition');
  }, 300);
}

/**
 * Initialize theme on app load
 */
export function initializeTheme() {
  const state = useThemeStore.getState();
  const resolved = resolveTheme(state.mode);
  useThemeStore.setState({ resolvedTheme: resolved });
  applyTheme(state.preset, resolved);

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const currentState = useThemeStore.getState();
      if (currentState.mode === 'system') {
        const newResolved = getSystemTheme();
        useThemeStore.setState({ resolvedTheme: newResolved });
        applyTheme(currentState.preset, newResolved);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Older browsers
      mediaQuery.addListener(handleChange);
    }
  }
}

/**
 * Hook for theme values
 */
export function useTheme() {
  const { mode, resolvedTheme, setMode, toggleMode } = useThemeStore();
  return { theme: mode, resolvedTheme, setTheme: setMode, toggleTheme: toggleMode };
}
