/**
 * Session List Component
 * Displays list of all active sessions for selection
 */

const { colors, tag, icons } = require('./colors');

class SessionListComponent {
    constructor(box) {
        this.box = box;
        this.sessions = [];
        this.selectedIndex = 0;
    }

    render(sessions = [], selectedIndex = 0) {
        this.sessions = sessions;
        this.selectedIndex = selectedIndex;

        let content = `${tag.label('MAESTRO SESSIONS')}\n\n`;

        if (sessions.length === 0) {
            content += tag.muted('  (no active sessions)\n\n');
            content += tag.muted('  Create one with:\n');
            content += tag.primary('  maestro session create --project <id> --name "My Session"\n');
            this.box.setContent(content);
            return;
        }

        content += `  ${sessions.length} session(s) available\n\n`;

        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            const isSelected = i === selectedIndex;
            content += this.renderSessionCard(session, i, isSelected);
        }

        this.box.setContent(content);
    }

    renderSessionCard(session, index, isSelected) {
        const status = (session.status || 'unknown').toLowerCase();
        const statusIcon = this.getStatusIcon(status);
        const statusColor = this.getStatusColor(status);

        const name = session.name || 'Unnamed Session';
        const shortId = session.id ? session.id.substring(0, 8) : '--------';
        const duration = this.formatDuration(session.startedAt, session.completedAt);

        // Selection indicator
        const selector = isSelected ? `{cyan-fg}${icons.arrow}{/cyan-fg}` : ' ';
        const numKey = `[${index + 1}]`;

        let card = '';

        // Card border top
        if (isSelected) {
            card += `  ${tag.highlight('┌' + '─'.repeat(68) + '┐')}\n`;
        } else {
            card += `  ${tag.muted('┌' + '─'.repeat(68) + '┐')}\n`;
        }

        // Main line: status icon, name, id, status text
        const statusTag = `{${statusColor}-fg}${status}{/${statusColor}-fg}`;
        card += `  ${isSelected ? tag.highlight('│') : tag.muted('│')} ${selector} ${numKey} {${statusColor}-fg}${statusIcon}{/${statusColor}-fg} ${tag.primary(name.padEnd(35))} ${tag.muted(shortId)}  ${statusTag.padEnd(20)} ${isSelected ? tag.highlight('│') : tag.muted('│')}\n`;

        // Details line
        let details = '';
        if (session.activeWorkflow) {
            details = `workflow: ${session.activeWorkflow}`;
        } else if (session.projectId) {
            details = `project: ${session.projectId.substring(0, 8)}`;
        }

        const vars = session.variables || {};
        const iteration = vars.currentIteration || vars.iteration;
        const maxIter = vars.maxIterations;
        const iterInfo = iteration !== undefined && maxIter ? `iter: ${iteration}/${maxIter}` : '';

        card += `  ${isSelected ? tag.highlight('│') : tag.muted('│')}     ${tag.muted(details.padEnd(45))} ${tag.muted(iterInfo.padEnd(15))} ${tag.muted('│')}\n`;

        // Fitness/Duration line
        const fitness = vars.currentFitness || vars.fitness;
        let fitnessBar = '';
        if (fitness !== undefined) {
            const percent = Math.round(fitness * 100);
            const filled = Math.round(percent / 5);
            const empty = 20 - filled;
            const barColor = percent >= 80 ? 'green' : percent >= 50 ? 'yellow' : 'red';
            fitnessBar = `fitness: {${barColor}-fg}${'█'.repeat(filled)}${'░'.repeat(empty)}{/${barColor}-fg} ${percent}%`;
        }

        card += `  ${isSelected ? tag.highlight('│') : tag.muted('│')}     ${fitnessBar ? tag.muted(fitnessBar.padEnd(45)) : ' '.repeat(45)} ${tag.muted('duration: ' + duration.padEnd(10))} ${isSelected ? tag.highlight('│') : tag.muted('│')}\n`;

        // Card border bottom
        if (isSelected) {
            card += `  ${tag.highlight('└' + '─'.repeat(68) + '┘')}\n`;
        } else {
            card += `  ${tag.muted('└' + '─'.repeat(68) + '┘')}\n`;
        }

        card += '\n';

        return card;
    }

    getStatusIcon(status) {
        const iconMap = {
            'running': icons.running,
            'created': icons.pending,
            'paused': icons.paused,
            'stopped': icons.failed,
            'completed': icons.done,
            'failed': icons.failed
        };
        return iconMap[status] || icons.pending;
    }

    getStatusColor(status) {
        const colorMap = {
            'running': 'cyan',
            'created': 'gray',
            'paused': 'yellow',
            'stopped': 'red',
            'completed': 'green',
            'failed': 'red'
        };
        return colorMap[status] || 'gray';
    }

    formatDuration(startedAt, completedAt) {
        if (!startedAt) return '-';

        try {
            const start = new Date(startedAt);
            const end = completedAt ? new Date(completedAt) : new Date();

            if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

            const diffMs = Math.max(0, end.getTime() - start.getTime());

            if (diffMs < 1000) return `${diffMs}ms`;
            if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
            if (diffMs < 3600000) {
                const mins = Math.floor(diffMs / 60000);
                const secs = Math.floor((diffMs % 60000) / 1000);
                return `${mins}m ${secs}s`;
            }
            const hours = Math.floor(diffMs / 3600000);
            const mins = Math.floor((diffMs % 3600000) / 60000);
            return `${hours}h ${mins}m`;
        } catch {
            return '-';
        }
    }

    getSelectedSession() {
        if (this.sessions.length === 0) return null;
        return this.sessions[this.selectedIndex];
    }

    moveUp() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            return true;
        }
        return false;
    }

    moveDown() {
        if (this.selectedIndex < this.sessions.length - 1) {
            this.selectedIndex++;
            return true;
        }
        return false;
    }

    selectByNumber(num) {
        const index = num - 1;
        if (index >= 0 && index < this.sessions.length) {
            this.selectedIndex = index;
            return true;
        }
        return false;
    }
}

module.exports = { SessionListComponent };
