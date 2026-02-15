// @ts-nocheck
/**
 * Maestro TUI Monitor - Entry Point
 *
 * Ink-based monitor (React for terminal).
 *
 * Modes:
 * - No sessionId or --list: GlobalMonitor (session list)
 * - With sessionId: SessionMonitor (single session view)
 * - --mock: Visual testing with mock data
 */

interface MonitorOptions {
  refreshInterval?: number;
  layout?: string;
  view?: string | null;
  debug?: boolean;
  returnToList?: boolean;
  mock?: boolean;
  detailType?: 'session' | 'workspace';
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Creates and starts the Ink monitor.
 * Errors are shown to the user — no silent fallback.
 */
async function startMonitor(sessionId: string | null, apiClient: any, options: MonitorOptions = {}) {
    // Mock mode: use mock API client for visual testing
    if (options.mock) {
        const { MockApiClient } = await import('./ink/mock-api-client.ts');
        const { startInkMonitor } = await import('./ink/App.ts');
        const mockClient = new MockApiClient();
        await startInkMonitor(sessionId || null, mockClient, options);
        return;
    }

    // Default: Ink monitor
    const { startInkMonitor } = await import('./ink/App.ts');
    await startInkMonitor(sessionId, apiClient, options);
}

// Export for use by CLI
module.exports = {
    startMonitor,
};

// Backward compatibility
(module.exports as any).TuiMonitor = { start: startMonitor };
