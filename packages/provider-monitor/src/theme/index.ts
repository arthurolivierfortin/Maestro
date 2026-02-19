export { palette } from './palette.js';
export { semantic } from './semantic.js';
export { icons } from './icons.js';
export { borders } from './borders.js';
export { layout } from './layout.js';
export { setTerminalBg, resetTerminalBg } from './terminal.js';

import chalk from 'chalk';
import { semantic } from './semantic.js';

/** Themed text helper - returns chalk-colored strings */
export const T = {
  primary: (text: string) => chalk.hex(semantic.text.primary)(text),
  secondary: (text: string) => chalk.hex(semantic.text.secondary)(text),
  muted: (text: string) => chalk.hex(semantic.text.muted)(text),
  accent: (text: string) => chalk.hex(semantic.text.accent)(text),
  success: (text: string) => chalk.hex(semantic.status.running)(text),
  warning: (text: string) => chalk.hex(semantic.status.pending)(text),
  error: (text: string) => chalk.hex(semantic.status.stopped)(text),
  info: (text: string) => chalk.hex(semantic.status.loading)(text),
} as const;
