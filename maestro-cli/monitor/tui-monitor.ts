// @ts-nocheck
/**
 * Maestro TUI Monitor - Entry Point
 *
 * Routes to the appropriate monitor:
 * - Default: Ink-based monitor (React for terminal)
 * - --legacy: blessed-based monitor (deprecated)
 *
 * Both support:
 * - No sessionId or --list: GlobalMonitor (session list)
 * - With sessionId: SessionMonitor (single session view)
 */

interface MonitorOptions {
  refreshInterval?: number;
  layout?: string;
  view?: string | null;
  debug?: boolean;
  returnToList?: boolean;
  legacy?: boolean;
  mock?: boolean;
}

// ── Legacy blessed monitor (--legacy flag) ─────────────────────

function startLegacyMonitor(sessionId: string | null, apiClient: any, options: MonitorOptions) {
    const { GlobalMonitor } = require('./global-monitor');
    const { SessionMonitor } = require('./session-monitor');

    if (sessionId) {
        const monitor = new SessionMonitor(sessionId, apiClient, {
            refreshInterval: options.refreshInterval || 2000,
            layout: options.layout || 'auto',
            view: options.view || null,
            debug: options.debug || false,
            onExit: options.returnToList ? () => {
                startLegacyGlobal(apiClient, options);
            } : null
        });
        return monitor.start();
    } else {
        return startLegacyGlobal(apiClient, options);
    }
}

function startLegacyGlobal(apiClient: any, options: MonitorOptions) {
    const { GlobalMonitor } = require('./global-monitor');
    const { SessionMonitor } = require('./session-monitor');

    const monitor = new GlobalMonitor(apiClient, {
        refreshInterval: options.refreshInterval || 3000,
        onSessionSelect: (selectedSessionId: string) => {
            const sessionMonitor = new SessionMonitor(selectedSessionId, apiClient, {
                refreshInterval: options.refreshInterval || 2000,
                layout: options.layout || 'auto',
                debug: options.debug || false,
                onExit: () => startLegacyGlobal(apiClient, options)
            });
            sessionMonitor.start();
        }
    });
    return monitor.start();
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Creates and starts the appropriate monitor
 */
async function startMonitor(sessionId: string | null, apiClient: any, options: MonitorOptions = {}) {
    if (options.legacy) {
        return startLegacyMonitor(sessionId, apiClient, options);
    }

    // Mock mode: use mock API client for visual testing
    if (options.mock) {
        try {
            const { MockApiClient } = await import('./ink/mock-api-client.ts');
            const { startInkMonitor } = await import('./ink/App.ts');
            const mockClient = new MockApiClient();
            await startInkMonitor(sessionId || null, mockClient, options);
            return;
        } catch (err: any) {
            console.error(`Mock monitor failed: ${err.message}`);
            process.exit(1);
        }
    }

    // Default: Ink monitor (ESM, loaded via dynamic import)
    try {
        const { startInkMonitor } = await import('./ink/App.ts');
        await startInkMonitor(sessionId, apiClient, options);
    } catch (err: any) {
        console.error(`Ink monitor failed to load: ${err.message}`);
        console.error('Falling back to legacy blessed monitor. Install ink+react or use --legacy flag.');
        return startLegacyMonitor(sessionId, apiClient, options);
    }
}

// Export for use by CLI
module.exports = {
    startMonitor,
};

// Backward compatibility
(module.exports as any).TuiMonitor = { start: startMonitor };
