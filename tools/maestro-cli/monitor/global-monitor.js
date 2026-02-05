#!/usr/bin/env node
/**
 * Maestro Global Monitor
 *
 * Displays list of all sessions for selection.
 * User can navigate and select a session to open in SessionMonitor.
 */

const blessed = require('blessed');
const { SessionListComponent } = require('./components/session-list');
const { StatusBarComponent } = require('./components/status-bar');
const { colors, tag } = require('./components/colors');

class GlobalMonitor {
    constructor(apiClient, options = {}) {
        this.client = apiClient;
        this.refreshInterval = options.refreshInterval || 3000;
        this.onSessionSelect = options.onSessionSelect || null;

        // State
        this.sessions = [];
        this.selectedIndex = 0;
        this.intervalId = null;
        this.lastRefresh = null;
        this.refreshLatency = 0;
        this.connectionStatus = 'connecting';
        this.lastError = null;

        this.initScreen();
        this.initBoxes();
        this.initComponents();
        this.setupKeys();
    }

    initScreen() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Maestro Monitor - Sessions',
            fullUnicode: true
        });
    }

    initBoxes() {
        // Main container
        this.mainBox = blessed.box({
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            style: { bg: colors.bg }
        });

        // Header
        this.headerBox = blessed.box({
            parent: this.mainBox,
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            tags: true,
            border: { type: 'line' },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            }
        });

        // Session list area
        this.listBox = blessed.box({
            parent: this.mainBox,
            top: 3,
            left: 0,
            width: '100%',
            height: '100%-6',
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            }
        });

        // Status bar
        this.statusBox = blessed.box({
            parent: this.mainBox,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 3,
            tags: true,
            border: { type: 'line' },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            }
        });

        this.screen.append(this.mainBox);
    }

    initComponents() {
        this.sessionList = new SessionListComponent(this.listBox);
        this.statusBar = new StatusBarComponent(this.statusBox);
    }

    setupKeys() {
        // Quit
        this.screen.key(['q', 'C-c'], () => {
            this.stop();
            process.exit(0);
        });

        // Navigation
        this.screen.key(['up', 'k'], () => {
            if (this.selectedIndex > 0) {
                this.selectedIndex--;
                this.renderList();
                this.screen.render();
            }
        });

        this.screen.key(['down', 'j'], () => {
            if (this.selectedIndex < this.sessions.length - 1) {
                this.selectedIndex++;
                this.renderList();
                this.screen.render();
            }
        });

        // Selection
        this.screen.key(['enter'], () => this.openSelectedSession());

        // Quick select 1-9
        for (let i = 1; i <= 9; i++) {
            this.screen.key([String(i)], () => {
                if (i <= this.sessions.length) {
                    this.selectedIndex = i - 1;
                    this.openSelectedSession();
                }
            });
        }

        // Refresh
        this.screen.key(['r'], () => this.refresh());

        // Help
        this.screen.key(['?', 'h'], () => this.showHelp());
    }

    async start() {
        await this.refresh();
        this.intervalId = setInterval(() => this.refresh(), this.refreshInterval);
        this.screen.render();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.screen.destroy();
    }

    async refresh() {
        const startTime = Date.now();

        try {
            const sessions = await this.client.listSessions();
            this.sessions = sessions || [];
            this.refreshLatency = Date.now() - startTime;
            this.lastRefresh = new Date();
            this.connectionStatus = 'connected';
            this.lastError = null;

            // Adjust selected index if needed
            if (this.selectedIndex >= this.sessions.length) {
                this.selectedIndex = Math.max(0, this.sessions.length - 1);
            }

            this.renderAll();
        } catch (err) {
            this.refreshLatency = Date.now() - startTime;
            this.lastError = err.message;
            this.connectionStatus = 'error';
            this.renderError();
        }

        this.screen.render();
    }

    renderAll() {
        this.renderHeader();
        this.renderList();
        this.renderStatusBar();
    }

    renderHeader() {
        const count = this.sessions.length;
        const runningCount = this.sessions.filter(s => s.status === 'running').length;

        let content = `  ${tag.label('MAESTRO SESSIONS')}`;
        content += `  ${tag.muted(`${count} session(s)`)}`;
        if (runningCount > 0) {
            content += `  ${tag.running(`${runningCount} running`)}`;
        }

        this.headerBox.setContent(content);
    }

    renderList() {
        this.sessionList.render(this.sessions, this.selectedIndex);
    }

    renderStatusBar() {
        const shortcuts = [
            `${tag.muted('[')}${tag.highlight('↑↓')}${tag.muted(']')}navigate`,
            `${tag.muted('[')}${tag.highlight('Enter')}${tag.muted(']')}open`,
            `${tag.muted('[')}${tag.highlight('1-9')}${tag.muted(']')}quick`,
            `${tag.muted('[')}${tag.highlight('r')}${tag.muted(']')}refresh`,
            `${tag.muted('[')}${tag.highlight('q')}${tag.muted(']')}quit`
        ].join('  ');

        const connColor = this.connectionStatus === 'connected' ? 'green' :
                         this.connectionStatus === 'error' ? 'red' : 'yellow';
        const connStatus = `{${connColor}-fg}●{/${connColor}-fg} ${this.connectionStatus}`;
        const latency = this.refreshLatency > 0 ? `${this.refreshLatency}ms` : '-';

        this.statusBox.setContent(` ${connStatus}  ${tag.muted(latency)}      ${shortcuts}`);
    }

    renderError() {
        this.headerBox.setContent(`  ${tag.error('● Connection Error')}  ${tag.muted(this.lastError)}`);
        this.listBox.setContent(`\n  ${tag.error('Failed to fetch sessions')}\n\n  ${tag.muted('Press [r] to retry')}`);
        this.renderStatusBar();
    }

    async openSelectedSession() {
        if (this.sessions.length === 0) return;

        const session = this.sessions[this.selectedIndex];
        if (!session) return;

        // Stop this monitor
        this.stop();

        // Call the callback to open session monitor
        if (this.onSessionSelect) {
            this.onSessionSelect(session.id);
        }
    }

    showHelp() {
        const helpText = `
  Maestro Monitor - Session List

  Navigation:
    ↑/k     Move up
    ↓/j     Move down
    Enter   Open selected session
    1-9     Quick select session

  Actions:
    r       Refresh list
    q       Quit

  Press any key to close...
`;
        const helpBox = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 45,
            height: 18,
            content: helpText,
            tags: true,
            border: { type: 'line' },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            }
        });

        this.screen.render();

        this.screen.onceKey(['escape', 'q', 'enter', 'space'], () => {
            helpBox.destroy();
            this.screen.render();
        });
    }
}

module.exports = { GlobalMonitor };
