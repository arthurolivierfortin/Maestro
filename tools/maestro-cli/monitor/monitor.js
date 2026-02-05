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
        // Clear screen and move to top
        process.stdout.write('\x1B[2J\x1B[0;0H');

        if (this.lastError) {
            this.renderError();
            return;
        }

        if (!this.session) {
            console.log('\n  Loading session data...\n');
            return;
        }

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

    /**
     * Renders the header section.
     */
    renderHeader() {
        const session = this.session;
        const statusIcon = this.getStatusIcon(session.status);
        const duration = this.formatDuration(session.startedAt, session.completedAt);

        console.log('');
        console.log(`  ${'='.repeat(64)}`);
        console.log(`  MONITOR: ${session.name || session.id}`);
        console.log(`  ${'='.repeat(64)}`);
        console.log('');
        console.log(`  Status: ${statusIcon} ${session.status.toUpperCase()}    Duration: ${duration}`);
        console.log(`  Type: ${session.type || 'project'}    Authority: ${session.authority || 'human'}`);
        console.log(`  Commands: ${session.commandCount || 0}`);
    }

    /**
     * Renders the variables section (generic for any session).
     */
    renderVariables() {
        const vars = this.session.variables || {};
        const keys = Object.keys(vars);

        console.log('');
        console.log('  VARIABLES');
        console.log(`  ${'-'.repeat(64)}`);

        if (keys.length === 0) {
            console.log('  (no variables set)');
        } else {
            for (const key of keys) {
                const value = vars[key];
                const displayValue = this.formatValue(value);
                console.log(`  ${key}: ${displayValue}`);
            }
        }
    }

    /**
     * Renders session-specific widgets (pluggable system).
     */
    renderWidgets() {
        const widgetConfigs = this.session.monitorWidgets || [];

        console.log('');
        console.log('  CUSTOM WIDGETS');
        console.log(`  ${'-'.repeat(64)}`);

        if (widgetConfigs.length === 0) {
            console.log('  (no widgets registered for this session)');
            return;
        }

        for (const config of widgetConfigs) {
            try {
                const widget = this.createWidget(config);
                if (widget) {
                    widget.render(this.session);
                }
            } catch (error) {
                console.log(`  Widget error (${config.id}): ${error.message}`);
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
        console.log('');
        console.log('  RECENT EVENTS');
        console.log(`  ${'-'.repeat(64)}`);

        // Note: Events would come from the session if available
        // For now, show a placeholder or use the API to get events
        if (this.session.recentEvents && this.session.recentEvents.length > 0) {
            const events = this.session.recentEvents.slice(-this.maxEvents);
            for (const evt of events) {
                const time = new Date(evt.timestamp).toLocaleTimeString();
                const icon = this.getEventIcon(evt.type);
                console.log(`  ${icon} [${time}] ${evt.message || evt.type}`);
            }
        } else {
            console.log('  (no recent events)');
        }
    }

    /**
     * Renders the controls footer.
     */
    renderControls() {
        console.log('');
        console.log(`  ${'-'.repeat(64)}`);
        console.log('  Controls: [r] refresh  [v] toggle vars  [w] toggle widgets  [e] toggle events  [q] quit');
        console.log('');
    }

    /**
     * Renders an error message.
     */
    renderError() {
        console.log('');
        console.log(`  ${'='.repeat(64)}`);
        console.log('  MONITOR ERROR');
        console.log(`  ${'='.repeat(64)}`);
        console.log('');
        console.log(`  Error: ${this.lastError}`);
        console.log('');
        console.log('  Press [r] to retry, [q] to quit');
        console.log('');
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
