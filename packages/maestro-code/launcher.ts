// @ts-nocheck
/**
 * Launcher for Maestro Interactive Mode.
 * Uses dynamic import to avoid yoga-layout top-level await issue with CJS.
 * Same pattern as monitor/tui-monitor.ts.
 */

interface InteractiveOptions {
  apiClient?: any;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  noSplash?: boolean;
}

async function startInteractiveMode(options: InteractiveOptions = {}) {
  const { startInteractive } = await import('./App.ts');
  await startInteractive(options);
}

module.exports = { startInteractiveMode };
