#!/usr/bin/env node
/**
 * Maestro Monitor Shell
 *
 * A real-time monitoring interface for sessions.
 * Displays generic zones (variables, execution tree, events)
 * and pluggable session-specific widgets.
 */

const readline = require('readline');

// Import widget types
const { ProgressBarWidget } = require('./widgets/progress-bar');
const { ScoreChartWidget } = require('./widgets/score-chart');
const { CounterWidget } = require('./widgets/counter');
const { StatusListWidget } = require('./widgets/status-list');

// Widget type registry
const WIDGET_TYPES = {
    'progress-bar': ProgressBarWidget,
    'score-chart': ScoreChartWidget,
    'counter': CounterWidget,
    'status-list': StatusListWidget
};

class MonitorShell {
    constructor(sessionId, apiClient, options = {}) {
        this.sessionId = sessionId;
        this.client = apiClient;
        this.refreshInterval = options.refreshInterval || 2000;
        this.showWidgets = true;
        this.showVariables = true;
        this.showEvents = true;
        this.maxEvents = options.maxEvents || 10;
        this.intervalId = null;
        this.session = null;
        this.lastError = null;
    }

    /**
     * Starts the monitor.
     */
    async start() {
        // Hide cursor
        process.stdout.write('\x1B[?25l');

        // Initial fetch
        try {
            await this.refresh();
        } catch (error) {
            this.lastError = error.message;
        }

        // Start refresh loop
        this.intervalId = setInterval(async () => {
            try {
                await this.refresh();
            } catch (error) {
                this.lastError = error.message;
            }
        }, this.refreshInterval);

        // Setup keyboard handlers
        this.setupKeyboardHandlers();
    }

    /**
     * Stops the monitor.
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        // Show cursor
        process.stdout.write('\x1B[?25h');
        // Clear screen
        process.stdout.write('\x1B[2J\x1B[0;0H');
        console.log('\nMonitor stopped.\n');
    }

    /**
     * Sets up keyboard handlers for interactive controls.
     */
    setupKeyboardHandlers() {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.on('keypress', (str, key) => {
            if (key.ctrl && key.name === 'c') {
                this.stop();
                process.exit(0);
            }

            if (key.name === 'q') {
                this.stop();
                process.exit(0);
            }

            if (key.name === 'r') {
                this.refresh();
            }

            if (key.name === 'v') {
                this.showVariables = !this.showVariables;
                this.render();
            }

            if (key.name === 'w') {
                this.showWidgets = !this.showWidgets;
                this.render();
            }

            if (key.name === 'e') {
                this.showEvents = !this.showEvents;
                this.render();
            }
        });
    }

    /**
     * Fetches latest session data and renders.
     */
    async refresh() {
        try {
            this.session = await this.client.getSession(this.sessionId);
            this.lastError = null;
            this.render();
        } catch (error) {
            this.lastError = error.message;
            this.render();
        }
    }

    /**
     * Renders the monitor display.
     */
    render() {
        // Build entire output in a buffer first
        this.buffer = [];

        if (this.lastError) {
            this.renderError();
        } else if (!this.session) {
            this.buffer.push('');
            this.buffer.push('  Loading session data...');
            this.buffer.push('');
        } else {
            this.renderHeader();
            this.renderSeparator();

            if (this.showVariables) {
                this.renderVariables();
                this.renderSeparator();
            }

            if (this.showWidgets) {
                this.renderWidgets();
                this.renderSeparator();
            }

            if (this.showEvents) {
                this.renderEvents();
                this.renderSeparator();
            }

            this.renderControls();
        }

        // Clear screen, move to top, then output everything at once
        const output = this.buffer.join('\n');
        process.stdout.write('\x1B[2J\x1B[H' + output);
    }

    /**
     * Adds a line to the render buffer.
     */
    print(line = '') {
        this.buffer.push(line);
    }

    /**
     * Renders the header section.
     */
    renderHeader() {
        const session = this.session;
        const statusIcon = this.getStatusIcon(session.status);
        const duration = this.formatDuration(session.startedAt, session.completedAt);

        this.print('');
        this.print(`  ${'═'.repeat(70)}`);
        this.print(`  ║  MONITOR: ${(session.name || session.id).padEnd(54)} ║`);
        this.print(`  ${'═'.repeat(70)}`);
        this.print('');
        this.print(`  Status: ${statusIcon} ${session.status.toUpperCase()}    Duration: ${duration}`);
        this.print(`  Type: ${session.type || 'project'}    Authority: ${session.authority || 'human'}`);
        this.print(`  Commands: ${session.commandCount || 0}`);
    }

    /**
     * Renders the variables section (generic for any session).
     */
    renderVariables() {
        const vars = this.session.variables || {};
        const keys = Object.keys(vars);

        this.print('');
        this.print('  VARIABLES');
        this.print(`  ${'─'.repeat(70)}`);

        if (keys.length === 0) {
            this.print('  (no variables set)');
        } else {
            for (const key of keys) {
                const value = vars[key];
                const displayValue = this.formatValue(value);
                this.print(`    ${key}: ${displayValue}`);
            }
        }
    }

    /**
     * Renders session-specific widgets (pluggable system).
     */
    renderWidgets() {
        const widgetConfigs = this.session.monitorWidgets || [];

        this.print('');
        this.print('  CUSTOM WIDGETS');
        this.print(`  ${'─'.repeat(70)}`);

        if (widgetConfigs.length === 0) {
            this.print('  (no widgets registered for this session)');
            return;
        }

        for (const config of widgetConfigs) {
            try {
                const widget = this.createWidget(config);
                if (widget) {
                    const lines = widget.renderToLines(this.session);
                    for (const line of lines) {
                        this.print(`    ${line}`);
                    }
                }
            } catch (error) {
                this.print(`    Widget error (${config.id}): ${error.message}`);
            }
        }
    }

    /**
     * Creates a widget instance from configuration.
     */
    createWidget(config) {
        const WidgetClass = WIDGET_TYPES[config.type];
        if (!WidgetClass) {
            console.log(`  Unknown widget type: ${config.type}`);
            return null;
        }
        return new WidgetClass(config);
    }

    /**
     * Renders the events section.
     */
    renderEvents() {
        this.print('');
        this.print('  RECENT EVENTS');
        this.print(`  ${'─'.repeat(70)}`);

        // Note: Events would come from the session if available
        // For now, show a placeholder or use the API to get events
        if (this.session.recentEvents && this.session.recentEvents.length > 0) {
            const events = this.session.recentEvents.slice(-this.maxEvents);
            for (const evt of events) {
                const time = new Date(evt.timestamp).toLocaleTimeString();
                const icon = this.getEventIcon(evt.type);
                this.print(`    ${icon} [${time}] ${evt.message || evt.type}`);
            }
        } else {
            this.print('    (no recent events)');
        }
    }

    /**
     * Renders the controls footer.
     */
    renderControls() {
        this.print('');
        this.print(`  ${'─'.repeat(70)}`);
        this.print('  [r] refresh  [v] vars  [w] widgets  [e] events  [q] quit');
        this.print('');
    }

    /**
     * Renders an error message.
     */
    renderError() {
        this.print('');
        this.print(`  ${'═'.repeat(70)}`);
        this.print('  MONITOR ERROR');
        this.print(`  ${'═'.repeat(70)}`);
        this.print('');
        this.print(`  Error: ${this.lastError}`);
        this.print('');
        this.print('  Press [r] to retry, [q] to quit');
        this.print('');
    }

    /**
     * Renders a separator line.
     */
    renderSeparator() {
        // Just visual spacing
    }

    /**
     * Gets a status icon.
     */
    getStatusIcon(status) {
        const icons = {
            'created': '⚪',
            'running': '🟢',
            'paused': '🟡',
            'completed': '✅',
            'failed': '❌',
            'stopped': '🔴',
            'cancelled': '⚫'
        };
        return icons[status?.toLowerCase()] || '⚪';
    }

    /**
     * Gets an event icon.
     */
    getEventIcon(type) {
        const icons = {
            'error': '❌',
            'warning': '⚠️',
            'info': '📝',
            'command': '💻',
            'state_change': '🔄',
            'file_change': '📄'
        };
        return icons[type?.toLowerCase()] || '📝';
    }

    /**
     * Formats a value for display.
     */
    formatValue(value) {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    /**
     * Formats duration between two timestamps.
     */
    formatDuration(startedAt, completedAt) {
        if (!startedAt) return '-';

        const start = new Date(startedAt);
        const end = completedAt ? new Date(completedAt) : new Date();
        const diffMs = end - start;

        if (diffMs < 1000) return `${diffMs}ms`;
        if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
        if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
        return `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`;
    }
}

module.exports = { MonitorShell, WIDGET_TYPES };
