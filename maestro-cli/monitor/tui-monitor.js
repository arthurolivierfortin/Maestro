#!/usr/bin/env node
/**
 * Maestro TUI Monitor - Entry Point
 *
 * Routes to the appropriate monitor based on arguments:
 * - No sessionId or --list: GlobalMonitor (session list)
 * - With sessionId: SessionMonitor (single session view)
 */

const { GlobalMonitor } = require('./global-monitor');
const { SessionMonitor } = require('./session-monitor');

/**
 * Creates and starts the appropriate monitor
 * @param {string|null} sessionId - Session ID or null for global view
 * @param {object} apiClient - Maestro API client
 * @param {object} options - Monitor options
 */
async function startMonitor(sessionId, apiClient, options = {}) {
    if (sessionId) {
        // Session-specific monitor
        const monitor = new SessionMonitor(sessionId, apiClient, {
            refreshInterval: options.refreshInterval || 2000,
            layout: options.layout || 'auto',
            view: options.view || null,
            debug: options.debug || false,
            onExit: options.returnToList ? () => {
                // Return to global monitor when Escape is pressed
                startGlobalWithCallback(apiClient, options);
            } : null
        });
        await monitor.start();
    } else {
        // Global monitor (session list)
        await startGlobalWithCallback(apiClient, options);
    }
}

/**
 * Starts the global monitor with session selection callback
 */
async function startGlobalWithCallback(apiClient, options) {
    const monitor = new GlobalMonitor(apiClient, {
        refreshInterval: options.refreshInterval || 3000,
        onSessionSelect: (selectedSessionId) => {
            // When a session is selected, open SessionMonitor
            const sessionMonitor = new SessionMonitor(selectedSessionId, apiClient, {
                refreshInterval: options.refreshInterval || 2000,
                layout: options.layout || 'auto',
                debug: options.debug || false,
                onExit: () => {
                    // Return to global monitor when Escape is pressed
                    startGlobalWithCallback(apiClient, options);
                }
            });
            sessionMonitor.start();
        }
    });
    await monitor.start();
}

// Export for use by CLI
module.exports = {
    startMonitor,
    GlobalMonitor,
    SessionMonitor
};

// Also export the old TuiMonitor name for backward compatibility
module.exports.TuiMonitor = SessionMonitor;
