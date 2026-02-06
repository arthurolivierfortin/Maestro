/**
 * Execution Log Component — tail -f style
 *
 * Always shows the most recent log entries at the bottom of the viewport.
 * Auto-scrolls to the latest entry on every render cycle.
 * The user sees new entries appear at the bottom, like `tail -f`.
 *
 * Data source: session.variables._executionLog (array)
 * Each entry: { time, level, msg }
 * Levels: info (white), success (green), warning (yellow), error (red)
 */

const { colors, tag, icons } = require('./colors');

class ExecutionLogComponent {
    constructor(box) {
        this.box = box;
        this.maxEntries = 50;
    }

    render(session, context = {}) {
        const log = context.executionLog || session.variables?._executionLog || [];

        let content = `${tag.label('EXECUTION LOG')}\n`;

        if (!Array.isArray(log) || log.length === 0) {
            content += tag.dim('  (no log entries yet)');
            this.box.setContent(content);
            return;
        }

        // Show most recent entries (tail)
        const entries = log.slice(-this.maxEntries);

        for (const entry of entries) {
            content += this.renderEntry(entry);
        }

        this.box.setContent(content);
        // Auto-scroll to bottom — tail -f behavior
        this.box.setScrollPerc(100);
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
