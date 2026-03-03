// @ts-nocheck
/**
 * Launcher for Maestro Interactive Mode.
 * Must be ESM (export, not module.exports) so that the await import('./App.ts')
 * chain stays in ESM context — required for yoga-layout's top-level await.
 */

interface InteractiveOptions {
  apiClient?: any;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  noSplash?: boolean;
  isFirstRun?: boolean;
  demo?: boolean;
  noBell?: boolean;
}

export async function startInteractiveMode(options: InteractiveOptions = {}) {
  const { startInteractive } = await import('./App.ts');
  await startInteractive(options);
}
