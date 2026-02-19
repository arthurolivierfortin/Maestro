import { palette } from './palette.js';

/** Semantic color mappings */
export const semantic = {
  text: {
    primary: palette.white,
    secondary: palette.gray300,
    muted: palette.gray500,
    accent: palette.primary,
    inverse: palette.black,
  },
  status: {
    running: palette.success,
    stopped: palette.error,
    pending: palette.warning,
    loading: palette.info,
    idle: palette.muted,
  },
  panel: {
    border: palette.gray700,
    borderFocused: palette.primary,
    background: palette.black,
    title: palette.primaryBright,
    titleFocused: palette.primary,
  },
  ui: {
    tabActive: palette.primary,
    tabInactive: palette.gray500,
    keybinding: palette.accent,
    separator: palette.gray700,
    badge: palette.accentBright,
  },
  log: {
    info: palette.white,
    warning: palette.warning,
    error: palette.error,
    debug: palette.gray500,
  },
} as const;
