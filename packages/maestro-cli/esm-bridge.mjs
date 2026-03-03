// ESM bridge — loaded via dynamic import() from CJS cli.ts.
// .mjs forces Node.js native ESM loader (not tsx CJS interop),
// which supports yoga-layout's top-level await.
export async function startInteractiveMode(options) {
  const mod = await import('@maestro/code/launcher.ts');
  return mod.startInteractiveMode(options);
}

export async function launchInkTable(options) {
  const mod = await import('@maestro/code/ink-table-launcher.ts');
  return mod.launchInkTable(options);
}

export async function startMonitor(sessionId, apiClient, options) {
  const mod = await import('@maestro/monitor/tui-monitor.ts');
  return mod.startMonitor(sessionId, apiClient, options);
}

export async function runHeadless(options) {
  const mod = await import('@maestro/code/headless.ts');
  return mod.runHeadless(options);
}
