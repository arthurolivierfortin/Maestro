/**
 * Launcher for Maestro Interactive Mode.
 * Must be ESM (export, not module.exports) so that the await import('./App.ts')
 * chain stays in ESM context — required for yoga-layout's top-level await.
 */

import type { InteractiveOptions } from './types.ts';

export async function startInteractiveMode(options: InteractiveOptions = {}) {
  const { startInteractive } = await import('./App.ts');
  await startInteractive(options);
}
