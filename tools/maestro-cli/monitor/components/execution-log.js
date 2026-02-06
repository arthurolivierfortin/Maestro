/**
 * Execution Log Component
 * Displays a real-time scrollable log of workflow execution events
 *
 * Data source: session.variables._executionLog (array)
 * Each entry: { time, level, msg }
 * Levels: info (white), success (green), warning (yellow), error (red)
 */

const { colors, tag, icons } = require('./colors');

class ExecutionLogComponent {
    constructor(box) {
        this.box = box;
        this.maxEntries = 30;
    }

    render(session, context = {}) {
        const log = context.executionLog || session.variables?._executionLog || [];

        let content = `${tag.label('EXECUTION LOG')}\n\n`;

        if (!Array.isArray(log) || log.length === 0) {
            content += tag.dim('  (no log entries yet)');
            this.box.setContent(content);
            return;
        }

        // Show most recent entries
        const entries = log.slice(-this.maxEntries);

        for (const entry of entries) {
            content += this.renderEntry(entry);
        }

        this.box.setContent(content);
    }

    renderEntry(entry) {
        const time = entry.time || '';
        const level = (entry.level || 'info').toLowerCase();
        const msg = entry.msg || entry.message || '';

        const levelColor = this.getLevelColor(level);
        const levelTag = `{${levelColor}-fg}[${level}]{/${levelColor}-fg}`;

        return `  ${tag.dim(time)} ${levelTag}  ${msg}\n`;
    }

    getLevelColor(level) {
        const map = {
            'info': 'white',
            'success': 'green',
            'warning': 'yellow',
            'warn': 'yellow',
            'error': 'red',
            'debug': 'gray'
        };
        return map[level] || 'white';
    }
}

module.exports = { ExecutionLogComponent };
