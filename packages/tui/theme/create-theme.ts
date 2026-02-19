import { palette as defaultPalette } from './colors.ts';
import { icons as defaultIcons, layout as defaultLayout } from './tokens.ts';

export interface ThemeOverrides {
  palette?: Partial<typeof defaultPalette>;
  icons?: Partial<typeof defaultIcons>;
}

export function createTheme(overrides: ThemeOverrides = {}) {
  return {
    palette: { ...defaultPalette, ...overrides.palette },
    icons: { ...defaultIcons, ...overrides.icons },
    layout: defaultLayout,
  };
}

export type MaestroTheme = ReturnType<typeof createTheme>;
