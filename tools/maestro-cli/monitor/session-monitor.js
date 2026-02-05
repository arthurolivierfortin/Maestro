#!/usr/bin/env node
/**
 * Maestro Session Monitor
 *
 * Monitors a single session with adaptive layout:
 * - EXECUTION mode: Workflow Tree + Filesystem + Widgets
 * - IDLE mode: Variables + Filesystem + Command Log
 */

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

// Components
const { HeaderComponent } = require('./components/header');
const { WorkflowTreeComponent } = require('./components/workflow-tree');
const { FilesystemComponent } = require('./components/filesystem');
const { VariablesComponent } = require('./components/variables');
const { CommandLogComponent } = require('./components/command-log');
const { WidgetsPanelComponent } = require('./components/widgets-panel');
const { StatusBarComponent } = require('./components/status-bar');
const { colors } = require('./components/colors');

class SessionMonitor {
    constructor(sessionId, apiClient, options = {}) {
        this.sessionId = sessionId;
        this.client = apiClient;
        this.refreshInterval = options.refreshInterval || 2000;
        this.layout = options.layout || 'auto'; // 'auto', 'execution', 'idle'
        this.onExit = options.onExit || null; // Callback to return to global view

        // State
        this.session = null;
        this.lastError = null;
        this.intervalId = null;
        this.lastRefresh = null;
        this.refreshLatency = 0;
        this.connectionStatus = 'connecting';
        this.mode = 'idle'; // 'execution' or 'idle'

        // Panel visibility
        this.panels = {
            tree: true,
            files: true,
            widgets: true,
            vars: true,
            logs: true
        };

        // Debug
        this.debugMode = options.debug || process.env.MAESTRO_MONITOR_DEBUG === 'true';
        this.logFile = path.join(process.env.TEMP || '/tmp', `maestro-monitor-${sessionId.substring(0, 8)}.log`);

        if (this.debugMode) {
            fs.writeFileSync(this.logFile, `=== Maestro Session Monitor ===\nSession: ${sessionId}\nStarted: ${new Date().toISOString()}\n\n`);
        }

        this.initScreen();
        this.initBoxes();
        this.initComponents();
        this.setupKeys();
    }

    log(msg) {
        if (this.debugMode) {
            fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] ${msg}\n`);
        }
    }

    initScreen() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: `Maestro Monitor - ${this.sessionId.substring(0, 8)}`,
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

        // Header (fixed)
        this.headerBox = blessed.box({
            parent: this.mainBox,
            top: 0,
            left: 0,
            width: '100%',
            height: 5,
            tags: true,
            border: { type: 'line' },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            }
        });

        // Main content area - will be dynamically configured
        this.contentArea = blessed.box({
            parent: this.mainBox,
            top: 5,
            left: 0,
            width: '100%',
            height: '100%-8',
            style: { bg: colors.bg }
        });

        // Status bar (fixed at bottom)
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

        // Create all panel boxes (hidden initially)
        this.createPanelBoxes();
    }

    createPanelBoxes() {
        // Workflow Tree
        this.treeBox = blessed.box({
            parent: this.contentArea,
            top: 0,
            left: 0,
            width: '100%',
            height: '50%',
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            },
            hidden: true
        });

        // Filesystem
        this.filesBox = blessed.box({
            parent: this.contentArea,
            top: 0,
            left: 0,
            width: '50%',
            height: '50%',
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            },
            hidden: true
        });

        // Widgets
        this.widgetsBox = blessed.box({
            parent: this.contentArea,
            top: 0,
            left: '50%',
            width: '50%',
            height: '50%',
            tags: true,
            scrollable: true,
            border: { type: 'line' },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            },
            hidden: true
        });

        // Variables
        this.varsBox = blessed.box({
            parent: this.contentArea,
            top: 0,
            left: 0,
            width: '50%',
            height: '50%',
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            },
            hidden: true
        });

        // Command Log
        this.logsBox = blessed.box({
            parent: this.contentArea,
            top: '50%',
            left: 0,
            width: '100%',
            height: '50%',
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            },
            hidden: true
        });
    }

    initComponents() {
        this.header = new HeaderComponent(this.headerBox);
        this.tree = new WorkflowTreeComponent(this.treeBox);
        this.filesystem = new FilesystemComponent(this.filesBox);
        this.variables = new VariablesComponent(this.varsBox);
        this.commandLog = new CommandLogComponent(this.logsBox);
        this.widgetsPanel = new WidgetsPanelComponent(this.widgetsBox);
        this.statusBar = new StatusBarComponent(this.statusBox);
    }

    setupKeys() {
        // Quit
        this.screen.key(['q', 'C-c'], () => {
            this.stop();
            process.exit(0);
        });

        // Back to session list (if callback provided)
        this.screen.key(['escape', 'backspace'], () => {
            if (this.onExit) {
                this.stop();
                this.onExit();
            }
        });

        // Refresh
        this.screen.key(['r'], () => this.refresh());

        // Panel toggles
        this.screen.key(['t'], () => this.togglePanel('tree'));
        this.screen.key(['f'], () => this.togglePanel('files'));
        this.screen.key(['w'], () => this.togglePanel('widgets'));
        this.screen.key(['v'], () => this.togglePanel('vars'));
        this.screen.key(['l'], () => this.togglePanel('logs'));

        // Help
        this.screen.key(['?', 'h'], () => this.showHelp());
    }

    togglePanel(panel) {
        this.panels[panel] = !this.panels[panel];
        this.applyLayout();
        this.renderAll();
        this.screen.render();
    }

    showHelp() {
        const backText = this.onExit ? '    Esc     Back to session list\n' : '';
        const helpText = `
  Maestro Session Monitor

  Navigation:
    t       Toggle workflow tree
    f       Toggle filesystem
    w       Toggle widgets
    v       Toggle variables
    l       Toggle command log

  Actions:
    r       Refresh now
${backText}    q       Quit

  Press any key to close...
`;
        const helpBox = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 45,
            height: this.onExit ? 20 : 18,
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

    async start() {
        this.log('Starting session monitor...');

        await this.refresh();

        this.intervalId = setInterval(() => this.refresh(), this.refreshInterval);

        this.screen.render();
    }

    stop() {
        this.log('Stopping session monitor');
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.screen.destroy();
    }

    async refresh() {
        const startTime = Date.now();

        try {
            this.log('Fetching session...');
            this.session = await this.client.getSession(this.sessionId);
            this.refreshLatency = Date.now() - startTime;
            this.lastRefresh = new Date();
            this.connectionStatus = 'connected';
            this.lastError = null;

            // Detect mode
            this.detectMode();

            // Apply layout based on mode
            this.applyLayout();

            // Render all components
            this.renderAll();

            this.log(`Fetched: status=${this.session.status}, mode=${this.mode}`);
        } catch (err) {
            this.refreshLatency = Date.now() - startTime;
            this.lastError = err.message;
            this.connectionStatus = 'error';
            this.renderError();
            this.log(`Error: ${err.message}`);
        }

        this.screen.render();
    }

    detectMode() {
        if (this.layout !== 'auto') {
            this.mode = this.layout;
            return;
        }

        const session = this.session;
        const vars = session.variables || {};

        // Check for active workflow indicators
        const hasActiveWorkflow = session.activeWorkflow ||
            session.status === 'running' && (
                vars.currentIteration > 0 ||
                vars.iteration > 0 ||
                vars.currentPhase === 'execution' ||
                vars.phase === 'execution' ||
                vars.phase === 'optimization'
            );

        this.mode = hasActiveWorkflow ? 'execution' : 'idle';
    }

    applyLayout() {
        // Hide all panels first
        this.treeBox.hide();
        this.filesBox.hide();
        this.widgetsBox.hide();
        this.varsBox.hide();
        this.logsBox.hide();

        if (this.mode === 'execution') {
            this.applyExecutionLayout();
        } else {
            this.applyIdleLayout();
        }
    }

    applyExecutionLayout() {
        // EXECUTION: Tree (top full) + Files (bottom left) + Widgets (bottom right)

        if (this.panels.tree) {
            this.treeBox.show();
            this.treeBox.top = 0;
            this.treeBox.left = 0;
            this.treeBox.width = '100%';
            this.treeBox.height = '50%';
        }

        if (this.panels.files) {
            this.filesBox.show();
            this.filesBox.top = this.panels.tree ? '50%' : 0;
            this.filesBox.left = 0;
            this.filesBox.width = this.panels.widgets ? '50%' : '100%';
            this.filesBox.height = this.panels.tree ? '50%' : '100%';
        }

        if (this.panels.widgets) {
            this.widgetsBox.show();
            this.widgetsBox.top = this.panels.tree ? '50%' : 0;
            this.widgetsBox.left = this.panels.files ? '50%' : 0;
            this.widgetsBox.width = this.panels.files ? '50%' : '100%';
            this.widgetsBox.height = this.panels.tree ? '50%' : '100%';
        }
    }

    applyIdleLayout() {
        // IDLE: Vars (top left) + Files (top right) + Logs (bottom full)

        if (this.panels.vars) {
            this.varsBox.show();
            this.varsBox.top = 0;
            this.varsBox.left = 0;
            this.varsBox.width = this.panels.files ? '50%' : '100%';
            this.varsBox.height = this.panels.logs ? '60%' : '100%';
        }

        if (this.panels.files) {
            this.filesBox.show();
            this.filesBox.top = 0;
            this.filesBox.left = this.panels.vars ? '50%' : 0;
            this.filesBox.width = this.panels.vars ? '50%' : '100%';
            this.filesBox.height = this.panels.logs ? '60%' : '100%';
        }

        if (this.panels.logs) {
            this.logsBox.show();
            this.logsBox.top = (this.panels.vars || this.panels.files) ? '60%' : 0;
            this.logsBox.left = 0;
            this.logsBox.width = '100%';
            this.logsBox.height = (this.panels.vars || this.panels.files) ? '40%' : '100%';
        }
    }

    renderAll() {
        if (!this.session) return;

        const context = {
            mode: this.mode,
            activeWorkflow: this.session.activeWorkflow || this.detectActiveWorkflow(),
            workingDirectory: this.session.workingDirectory
        };

        // Header
        this.header.render(this.session, context);

        // Panels based on visibility
        if (this.panels.tree && !this.treeBox.hidden) {
            this.tree.render(this.session, context);
        }

        if (this.panels.files && !this.filesBox.hidden) {
            this.filesystem.render(this.session, context);
        }

        if (this.panels.widgets && !this.widgetsBox.hidden) {
            this.widgetsPanel.render(this.session, context);
        }

        if (this.panels.vars && !this.varsBox.hidden) {
            this.variables.render(this.session, context);
        }

        if (this.panels.logs && !this.logsBox.hidden) {
            this.commandLog.render(this.session, context);
        }

        // Status bar
        this.statusBar.render({
            connectionStatus: this.connectionStatus,
            latency: this.refreshLatency,
            lastRefresh: this.lastRefresh,
            mode: this.mode,
            visiblePanels: this.panels,
            hasBackOption: !!this.onExit
        });
    }

    detectActiveWorkflow() {
        const vars = this.session?.variables || {};

        // Try to detect workflow name from variables
        if (vars.currentPhase || vars.phase) {
            const phase = vars.currentPhase || vars.phase;
            if (phase === 'exploration' || phase === 'optimization' || phase === 'validation') {
                return 'agent-improvement-loop';
            }
        }

        if (vars.iteration > 0 || vars.currentIteration > 0) {
            return 'agent-improvement-loop';
        }

        return null;
    }

    renderError() {
        this.headerBox.setContent(`
  {red-fg}● Connection Error{/red-fg}

  Session: ${this.sessionId.substring(0, 8)}
  Error: ${this.lastError}

  Press [r] to retry, [q] to quit${this.onExit ? ', [Esc] back to list' : ''}
`);
    }
}

module.exports = { SessionMonitor };
