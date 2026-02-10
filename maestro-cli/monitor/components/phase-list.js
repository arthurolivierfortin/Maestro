/**
 * Phase List Component
 * Displays session phases with status indicators
 *
 * Data source: session.variables._phases (array)
 * Each phase: { id, name, status, progress?, description? }
 * Statuses: pending, running, done, failed, skipped
 */

const { colors, tag, icons } = require('./colors');

class PhaseListComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const phases = context.phases || session.variables?._phases || [];

        let content = `${tag.label('PHASES')}\n\n`;

        if (!Array.isArray(phases) || phases.length === 0) {
            content += tag.dim('  (no phases defined)');
            this.box.setContent(content);
            return;
        }

        for (const phase of phases) {
            content += this.renderPhase(phase);
        }

        this.box.setContent(content);
    }

    renderPhase(phase) {
        const status = (phase.status || 'pending').toLowerCase();
        const icon = this.getIcon(status);
        const color = this.getColor(status);
        const name = phase.name || phase.id || 'Phase';

        let line = `  {${color}-fg}${icon}{/${color}-fg} ${name}`;

        // Status tag
        if (status !== 'pending') {
            line += `  {gray-fg}[{/gray-fg}{${color}-fg}${status}{/${color}-fg}{gray-fg}]{/gray-fg}`;
        }

        line += '\n';

        // Progress bar for running phase
        if (status === 'running' && phase.progress !== undefined) {
            const width = 20;
            const filled = Math.round((phase.progress / 100) * width);
            const empty = width - filled;
            const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
            line += `    {cyan-fg}${bar}{/cyan-fg} ${phase.progress}%\n`;
        }

        // Description for running phase
        if (status === 'running' && phase.description) {
            line += `    ${tag.dim(phase.description)}\n`;
        }

        return line;
    }

    getIcon(status) {
        const map = {
            'done': icons.done,
            'completed': icons.done,
            'running': icons.running,
            'active': icons.running,
            'pending': icons.pending,
            'waiting': icons.pending,
            'failed': icons.failed,
            'error': icons.failed,
            'skipped': '\u2212'  // −
        };
        return map[status] || icons.pending;
    }

    getColor(status) {
        const map = {
            'done': 'green',
            'completed': 'green',
            'running': 'cyan',
            'active': 'cyan',
            'pending': 'gray',
            'waiting': 'gray',
            'failed': 'red',
            'error': 'red',
            'skipped': 'gray'
        };
        return map[status] || 'gray';
    }
}

module.exports = { PhaseListComponent };
