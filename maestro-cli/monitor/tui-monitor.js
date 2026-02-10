#!/usr/bin/env node
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

// ── Legacy blessed monitor (--legacy flag) ─────────────────────

function startLegacyMonitor(sessionId, apiClient, options) {
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

function startLegacyGlobal(apiClient, options) {
    const { GlobalMonitor } = require('./global-monitor');
    const { SessionMonitor } = require('./session-monitor');

    const monitor = new GlobalMonitor(apiClient, {
        refreshInterval: options.refreshInterval || 3000,
        onSessionSelect: (selectedSessionId) => {
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
 * @param {string|null} sessionId - Session ID or null for global view
 * @param {object} apiClient - Maestro API client
 * @param {object} options - Monitor options
 */
async function startMonitor(sessionId, apiClient, options = {}) {
    if (options.legacy) {
        // Use deprecated blessed monitor
        return startLegacyMonitor(sessionId, apiClient, options);
    }

    // Default: Ink monitor (ESM, loaded via dynamic import)
    try {
        const { startInkMonitor } = await import('./ink/App.js');
        await startInkMonitor(sessionId, apiClient, options);
    } catch (err) {
        // If Ink fails to load (e.g. missing deps), fall back to blessed with warning
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
module.exports.TuiMonitor = { start: startMonitor };
