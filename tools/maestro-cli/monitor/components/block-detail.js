/**
 * Block Detail Component
 * Shows detailed information about the currently active block
 *
 * Data source: session.variables._activeBlock (object)
 * Fields: { id, name, type, status, startedAt?, output?, logs?, metadata? }
 */

const { colors, tag, icons } = require('./colors');

class BlockDetailComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const block = context.activeBlock || session.variables?._activeBlock;

        let content = `${tag.label('ACTIVE BLOCK')}\n\n`;

        if (!block) {
            content += tag.dim('  (no active block)');
            this.box.setContent(content);
            return;
        }

        // Block header
        const status = (block.status || 'running').toLowerCase();
        const statusIcon = this.getIcon(status);
        const statusColor = this.getColor(status);
        const blockType = block.type ? `  {gray-fg}[${block.type}]{/gray-fg}` : '';

        content += `  {${statusColor}-fg}${statusIcon}{/${statusColor}-fg} ${tag.bold(block.name || block.id)}${blockType}\n`;

        // Metadata line
        const metaParts = [];
        if (block.startedAt) {
            const time = this.formatTime(block.startedAt);
            metaParts.push(`Started: ${time}`);
        }
        if (block.metadata?.tokensUsed) {
            metaParts.push(`Tokens: ${block.metadata.tokensUsed}`);
        }
        if (block.metadata?.model) {
            metaParts.push(`Model: ${block.metadata.model}`);
        }
        if (metaParts.length > 0) {
            content += `  ${tag.dim(metaParts.join('  |  '))}\n`;
        }

        content += '\n';

        // Output section
        if (block.output) {
            content += `  ${tag.muted('Output:')}\n`;
            const lines = String(block.output).split('\n').slice(0, 6);
            for (const line of lines) {
                const truncated = line.length > 50 ? line.substring(0, 47) + '...' : line;
                content += `  ${tag.dim('\u2502')} ${truncated}\n`;
            }
            content += '\n';
        }

        // Logs section
        const logs = block.logs || [];
        if (logs.length > 0) {
            content += `  ${tag.muted('Log:')}\n`;
            const recentLogs = logs.slice(-8);
            for (const log of recentLogs) {
                const time = log.time || '';
                const msg = log.msg || log.message || '';
                content += `  ${tag.dim(time)}  ${msg}\n`;
            }
        }

        this.box.setContent(content);
    }

    getIcon(status) {
        const map = {
            'done': icons.done, 'completed': icons.done,
            'running': icons.running, 'active': icons.running,
            'pending': icons.pending, 'failed': icons.failed
        };
        return map[status] || icons.pending;
    }

    getColor(status) {
        const map = {
            'done': 'green', 'completed': 'green',
            'running': 'cyan', 'active': 'cyan',
            'pending': 'gray', 'failed': 'red'
        };
        return map[status] || 'gray';
    }

    formatTime(isoString) {
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch { return '--:--:--'; }
    }
}

module.exports = { BlockDetailComponent };
