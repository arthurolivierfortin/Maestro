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
const { PhaseListComponent } = require('./components/phase-list');
const { BlockDetailComponent } = require('./components/block-detail');
const { MetricsPanelComponent } = require('./components/metrics-panel');
const { ExecutionLogComponent } = require('./components/execution-log');
const { ArtifactsComponent } = require('./components/artifacts');
const { PhaseWorkflowComponent } = require('./components/phase-workflow');
const { LLMActivityComponent } = require('./components/llm-activity');
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

        // Logging (always enabled for diagnostics)
        this.debugMode = options.debug || process.env.MAESTRO_MONITOR_DEBUG === 'true';
        this.logFile = path.join(process.env.TEMP || '/tmp', `maestro-monitor-${sessionId.substring(0, 8)}.log`);

        // Always write log file for troubleshooting
        try {
            fs.writeFileSync(this.logFile, `=== Maestro Session Monitor ===\nSession: ${sessionId}\nStarted: ${new Date().toISOString()}\nDebug: ${this.debugMode}\n\n`);
        } catch (e) { /* ignore log write failures */ }

        this.initScreen();
        this.initBoxes();
        this.initComponents();
        this.setupKeys();
    }

    log(msg) {
        try {
            fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { /* ignore */ }
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

        // Header (fixed — 7 lines for status + metrics line)
        this.headerBox = blessed.box({
            parent: this.mainBox,
            top: 0,
            left: 0,
            width: '100%',
            height: 7,
            tags: true,
            border: { type: 'line' },
            style: {
                bg: colors.bg,
                fg: colors.fg,
                border: { fg: 'white' }
            }
        });

        // Header Metrics (right side of header row, descriptor mode only)
        this.headerMetricsBox = blessed.box({
            parent: this.mainBox,
            top: 0,
            left: '60%',
            width: '40%',
            height: 7,
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

        // Main content area - will be dynamically configured
        this.contentArea = blessed.box({
            parent: this.mainBox,
            top: 7,
            left: 0,
            width: '100%',
            height: '100%-10',
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

        // Phase List (descriptor mode) — top-left 25% x 50%
        this.phasesBox = blessed.box({
            parent: this.contentArea,
            top: 0, left: 0, width: '25%', height: '50%',
            tags: true, scrollable: true, alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
            hidden: true
        });

        // Block Detail / Block Output Browser (descriptor mode) — mid-right 65% x 25%
        this.blockDetailBox = blessed.box({
            parent: this.contentArea,
            top: '50%', left: '35%', width: '65%', height: '25%',
            tags: true, scrollable: true, alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
            hidden: true
        });

        // Metrics Panel (descriptor mode) — mid-left 35% x 25%
        this.metricsBox = blessed.box({
            parent: this.contentArea,
            top: '50%', left: 0, width: '35%', height: '25%',
            tags: true, scrollable: true,
            border: { type: 'line' },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
            hidden: true
        });

        // Execution Log (descriptor mode) — bottom 100% x 25%
        this.execLogBox = blessed.box({
            parent: this.contentArea,
            top: '75%', left: 0, width: '100%', height: '25%',
            tags: true, scrollable: true, alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
            hidden: true
        });

        // Artifacts (descriptor mode) — hidden by default in new layout
        this.artifactsBox = blessed.box({
            parent: this.contentArea,
            top: '75%', left: '75%', width: '25%', height: '25%',
            tags: true, scrollable: true,
            border: { type: 'line' },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
            hidden: true
        });

        // Phase-Workflow merged (descriptor v2 mode) — left 55% x 75%
        this.phaseWorkflowBox = blessed.box({
            parent: this.contentArea,
            top: 0, left: 0, width: '55%', height: '75%',
            tags: true, scrollable: true, alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
            hidden: true
        });

        // LLM Activity (descriptor v2 mode) — right 45% x 75%
        this.llmActivityBox = blessed.box({
            parent: this.contentArea,
            top: 0, left: '55%', width: '45%', height: '75%',
            tags: true, scrollable: true, alwaysScroll: true,
            border: { type: 'line' },
            scrollbar: { style: { bg: 'white' } },
            style: { bg: colors.bg, fg: colors.fg, border: { fg: 'white' } },
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

        // Descriptor mode components
        this.phaseList = new PhaseListComponent(this.phasesBox);
        this.blockDetail = new BlockDetailComponent(this.blockDetailBox);
        this.metricsPanel = new MetricsPanelComponent(this.metricsBox);
        this.executionLog = new ExecutionLogComponent(this.execLogBox);
        this.artifactsList = new ArtifactsComponent(this.artifactsBox);

        // Descriptor v2 components (merged)
        this.phaseWorkflow = new PhaseWorkflowComponent(this.phaseWorkflowBox);
        this.llmActivity = new LLMActivityComponent(this.llmActivityBox);
        this.headerMetrics = new MetricsPanelComponent(this.headerMetricsBox);
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
        // Panel toggles only apply to execution/idle mode, not descriptor mode
        if (this.mode === 'descriptor') return;
        this.panels[panel] = !this.panels[panel];
        this.applyLayout();
        this.renderAll();
        this.screen.render();
    }

    showHelp() {
        const backText = this.onExit ? '    Esc     Back to session list\n' : '';
        const helpText = `
  Maestro Session Monitor (read-only)

  The monitor auto-scrolls to follow execution.
  Use the CLI in another terminal for commands.

  Keys:
    r       Refresh now
${backText}    q       Quit
    ?       This help

  Auto-scroll behavior:
    Workflow Tree  centers on running node
    Execution Log  tail -f (latest at bottom)
    Block Output   follows active block

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

        // Show immediate feedback before first API call
        this.headerBox.setContent(`\n  {cyan-fg}●{/cyan-fg} Connecting to session ${this.sessionId.substring(0, 8)}...`);
        this.statusBox.setContent(` {yellow-fg}●{/yellow-fg} {gray-fg}connecting{/gray-fg}      {gray-fg}[q]uit{/gray-fg}`);
        this.screen.render();

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
            this.log(`Mode: ${this.mode}, vars: ${Object.keys(this.session.variables || {}).length}`);

            // Apply layout based on mode
            this.applyLayout();

            // Render all components
            this.renderAll();

            this.log(`Rendered: status=${this.session.status}, mode=${this.mode}`);
        } catch (err) {
            this.refreshLatency = Date.now() - startTime;
            this.lastError = err.message;
            this.connectionStatus = 'error';
            this.renderError();
            this.log(`Error: ${err.message}\n${err.stack}`);
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

        // Priority 1: descriptor mode if _monitorDescriptor exists
        if (vars._monitorDescriptor) {
            this.mode = 'descriptor';
            return;
        }

        // Priority 2: execution mode if active workflow (generic detection)
        const hasActiveWorkflow = vars._activeWorkflow || session.activeWorkflow ||
            (session.status === 'running' && (
                vars._executionTree ||
                vars.currentIteration > 0 ||
                vars.iteration > 0
            ));

        this.mode = hasActiveWorkflow ? 'execution' : 'idle';
    }

    applyLayout() {
        // Hide ALL panels first
        this.treeBox.hide();
        this.filesBox.hide();
        this.widgetsBox.hide();
        this.varsBox.hide();
        this.logsBox.hide();
        this.phasesBox.hide();
        this.blockDetailBox.hide();
        this.metricsBox.hide();
        this.execLogBox.hide();
        this.artifactsBox.hide();
        this.phaseWorkflowBox.hide();
        this.llmActivityBox.hide();
        this.headerMetricsBox.hide();

        // Reset header to full width (descriptor mode narrows it)
        this.headerBox.width = '100%';

        if (this.mode === 'descriptor') {
            this.applyDescriptorLayout();
        } else if (this.mode === 'execution') {
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

    applyDescriptorLayout() {
        // HEADER: Shrink to 60% width, show metrics beside it
        this.headerBox.width = '60%';
        this.headerMetricsBox.show();

        // LEFT: Phase-Workflow merged (55% x 75%)
        this.phaseWorkflowBox.show();
        this.phaseWorkflowBox.top = 0;
        this.phaseWorkflowBox.left = 0;
        this.phaseWorkflowBox.width = '55%';
        this.phaseWorkflowBox.height = '75%';

        // RIGHT: LLM Activity (45% x 75%)
        this.llmActivityBox.show();
        this.llmActivityBox.top = 0;
        this.llmActivityBox.left = '55%';
        this.llmActivityBox.width = '45%';
        this.llmActivityBox.height = '75%';

        // BOTTOM: Execution Log (100% x 25%)
        this.execLogBox.show();
        this.execLogBox.top = '75%';
        this.execLogBox.left = 0;
        this.execLogBox.width = '100%';
        this.execLogBox.height = '25%';
    }

    renderAll() {
        if (!this.session) return;

        const vars = this.session.variables || {};
        const context = {
            mode: this.mode,
            activeWorkflow: vars._activeWorkflow || this.session.activeWorkflow || this.detectActiveWorkflow(),
            executionTree: vars._executionTree || null,
            workingDirectory: this.session.workingDirectory,
            // Descriptor-specific context
            phases: vars._phases || null,
            activeBlock: vars._activeBlock || null,
            blockOutputs: vars._blockOutputs || null,
            executionLog: vars._executionLog || null,
            artifacts: vars._artifacts || null,
            monitorDescriptor: vars._monitorDescriptor || null,
            llmActivity: vars._llmActivity || []
        };

        // Safe render helper — catches per-component errors
        const safeRender = (name, fn) => {
            try {
                fn();
            } catch (err) {
                this.log(`[ERROR] Component ${name}: ${err.message}\n${err.stack}`);
            }
        };

        // Header (always)
        safeRender('header', () => this.header.render(this.session, context));

        if (this.mode === 'descriptor') {
            // Descriptor mode: 3-zone layout (phase-workflow + llm-activity + exec-log)
            // + header-level metrics panel
            safeRender('phaseWorkflow', () => this.phaseWorkflow.render(this.session, context));
            safeRender('llmActivity', () => this.llmActivity.render(this.session, context));
            safeRender('executionLog', () => this.executionLog.render(this.session, context));
            safeRender('headerMetrics', () => this.headerMetrics.render(this.session, context));
        } else {
            // Existing execution/idle mode
            if (this.panels.tree && !this.treeBox.hidden) {
                safeRender('tree', () => this.tree.render(this.session, context));
            }
            if (this.panels.files && !this.filesBox.hidden) {
                safeRender('filesystem', () => this.filesystem.render(this.session, context));
            }
            if (this.panels.widgets && !this.widgetsBox.hidden) {
                safeRender('widgetsPanel', () => this.widgetsPanel.render(this.session, context));
            }
            if (this.panels.vars && !this.varsBox.hidden) {
                safeRender('variables', () => this.variables.render(this.session, context));
            }
            if (this.panels.logs && !this.logsBox.hidden) {
                safeRender('commandLog', () => this.commandLog.render(this.session, context));
            }
        }

        // Status bar (always)
        safeRender('statusBar', () => this.statusBar.render({
            connectionStatus: this.connectionStatus,
            latency: this.refreshLatency,
            lastRefresh: this.lastRefresh,
            mode: this.mode,
            visiblePanels: this.panels,
            hasBackOption: !!this.onExit
        }));
    }

    detectActiveWorkflow() {
        // Generic: read from session variables only — no hardcoded workflow names
        const vars = this.session?.variables || {};
        return vars._activeWorkflow || null;
    }

    renderError() {
        this.headerBox.setContent(`\n  {red-fg}● Connection Error{/red-fg}\n  Session: ${this.sessionId.substring(0, 8)}\n  Error: ${this.lastError}`);
        // Also show error in content area for visibility
        this.statusBox.setContent(` {red-fg}●{/red-fg} {gray-fg}error{/gray-fg}  Press {white-fg}[r]{/white-fg} retry  {white-fg}[q]{/white-fg} quit${this.onExit ? '  {white-fg}[Esc]{/white-fg} back' : ''}  Log: ${this.logFile}`);
    }
}

module.exports = { SessionMonitor };
