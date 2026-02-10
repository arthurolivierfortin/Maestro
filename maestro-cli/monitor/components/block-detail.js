/**
 * Block Output Browser Component
 * Shows block outputs from _blockOutputs (historical) + _activeBlock (real-time)
 *
 * When a block is running: shows live detail from _activeBlock
 * When idle: shows per-block outputs from _blockOutputs with typed sections
 */

const { colors, tag, icons } = require('./colors');

class BlockDetailComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const activeBlock = context.activeBlock || session.variables?._activeBlock;
        const blockOutputs = context.blockOutputs || session.variables?._blockOutputs;

        let content = `${tag.label('BLOCK OUTPUT BROWSER')}\n`;

        // If a block is currently running, show its live detail
        if (activeBlock && activeBlock.status === 'running') {
            content += this.renderActiveBlock(activeBlock);
            this.box.setContent(content);
            this.box.setScrollPerc(100);
            return;
        }

        // Otherwise show historical block outputs
        if (blockOutputs && typeof blockOutputs === 'object') {
            const entries = Object.entries(blockOutputs);
            if (entries.length === 0) {
                content += tag.dim('  (no block outputs yet)');
            } else {
                for (const [nodeId, data] of entries) {
                    content += this.renderBlockEntry(nodeId, data);
                }
            }
        } else {
            // Fall back to active block if available (even if done)
            if (activeBlock) {
                content += this.renderActiveBlock(activeBlock);
            } else {
                content += tag.dim('  (no block outputs yet)');
            }
        }

        this.box.setContent(content);
        // Auto-scroll to bottom to show latest block outputs
        this.box.setScrollPerc(100);
    }

    renderActiveBlock(block) {
        let content = '';
        const status = (block.status || 'running').toLowerCase();
        const statusIcon = this.getIcon(status);
        const statusColor = this.getColor(status);
        const blockType = block.type ? `  {gray-fg}[${block.type}]{/gray-fg}` : '';

        content += `  {${statusColor}-fg}${statusIcon}{/${statusColor}-fg} ${tag.bold(block.name || block.id)}${blockType}\n`;

        // Metadata
        const metaParts = [];
        if (block.startedAt) {
            metaParts.push(`Started: ${this.formatTime(block.startedAt)}`);
        }
        if (block.metadata?.tokensUsed) {
            metaParts.push(`Tokens: ${block.metadata.tokensUsed}`);
        }
        if (metaParts.length > 0) {
            content += `  ${tag.dim(metaParts.join('  |  '))}\n`;
        }
        content += '\n';

        // Output section with increased limits
        if (block.output) {
            content += `  ${tag.muted('Output:')}\n`;
            const lines = String(block.output).split('\n').slice(0, 15);
            for (const line of lines) {
                const truncated = line.length > 100 ? line.substring(0, 97) + '...' : line;
                content += `  ${tag.dim('\u2502')} ${truncated}\n`;
            }
        }

        return content;
    }

    renderBlockEntry(nodeId, data) {
        let content = '';
        const type = data?.type || 'unknown';
        const typeColor = this.getTypeColor(type);
        const displayName = this.nodeIdToDisplayName(nodeId);
        const timestamp = data?.timestamp || '';

        content += `  {${typeColor}-fg}${icons.arrow}{/${typeColor}-fg} ${tag.bold(displayName)}  {gray-fg}[${type}]{/gray-fg}`;
        if (timestamp) {
            content += `  ${tag.dim(timestamp)}`;
        }
        content += '\n';

        switch (type) {
            case 'inference':
                content += this.renderInferenceOutput(data);
                break;
            case 'validator':
                content += this.renderValidatorOutput(data);
                break;
            case 'shell':
            case 'script':
                content += this.renderShellOutput(data);
                break;
            case 'write':
                content += this.renderWriteOutput(data);
                break;
            default:
                content += this.renderGenericOutput(data);
                break;
        }

        content += '\n';
        return content;
    }

    renderInferenceOutput(data) {
        let content = '';
        const output = data.output || data.response || '';
        if (output) {
            const lines = String(output).split('\n').slice(0, 10);
            for (const line of lines) {
                const truncated = line.length > 100 ? line.substring(0, 97) + '...' : line;
                content += `  ${tag.dim('\u2502')} ${truncated}\n`;
            }
            const totalLines = String(output).split('\n').length;
            if (totalLines > 10) {
                content += `  ${tag.dim('\u2502')} ${tag.dim(`... ${totalLines - 10} more lines`)}\n`;
            }
        }
        return content;
    }

    renderValidatorOutput(data) {
        let content = '';
        const criteriaScores = data.criteriaScores || {};
        const totalScore = data.totalScore ?? 0;
        const passed = data.passed;

        // Per-criteria scores
        for (const [criterion, score] of Object.entries(criteriaScores)) {
            const numScore = Number(score);
            const icon = numScore >= 0.5 ? `{green-fg}${icons.done}{/green-fg}` : `{red-fg}${icons.failed}{/red-fg}`;
            const bar = this.miniBar(numScore);
            content += `  ${tag.dim('\u2502')} ${icon} ${criterion}: ${bar} ${numScore.toFixed(2)}\n`;
        }

        // Total
        const totalColor = passed ? 'green' : 'red';
        const passLabel = passed ? 'PASSED' : 'FAILED';
        content += `  ${tag.dim('\u2502')} {${totalColor}-fg}Total: ${totalScore.toFixed(2)} [${passLabel}]{/${totalColor}-fg}\n`;

        return content;
    }

    renderShellOutput(data) {
        let content = '';
        const output = data.output || data.commands || '';
        if (output) {
            const lines = String(output).split('\n').slice(0, 8);
            for (const line of lines) {
                const truncated = line.length > 100 ? line.substring(0, 97) + '...' : line;
                content += `  ${tag.dim('\u2502')} ${truncated}\n`;
            }
        }
        return content;
    }

    renderWriteOutput(data) {
        let content = '';
        const output = data.output || '';
        if (output) {
            const lines = String(output).split('\n').slice(0, 3);
            for (const line of lines) {
                content += `  ${tag.dim('\u2502')} ${line}\n`;
            }
        }
        return content;
    }

    renderGenericOutput(data) {
        let content = '';
        const output = data.output || '';
        if (output) {
            const lines = String(output).split('\n').slice(0, 8);
            for (const line of lines) {
                const truncated = line.length > 100 ? line.substring(0, 97) + '...' : line;
                content += `  ${tag.dim('\u2502')} ${truncated}\n`;
            }
        }
        return content;
    }

    miniBar(value, width = 8) {
        const filled = Math.round(value * width);
        const empty = width - filled;
        return '{green-fg}' + '\u2588'.repeat(filled) + '{/green-fg}' +
               '{gray-fg}' + '\u2591'.repeat(empty) + '{/gray-fg}';
    }

    nodeIdToDisplayName(nodeId) {
        return nodeId.split('-').map(w =>
            w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w
        ).join(' ');
    }

    getTypeColor(type) {
        const map = {
            'inference': 'cyan',
            'validator': 'yellow',
            'shell': 'magenta',
            'script': 'magenta',
            'write': 'green',
            'task': 'white'
        };
        return map[type] || 'gray';
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
