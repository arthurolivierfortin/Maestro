/**
 * Header Component
 * Displays session info at the top of the monitor
 */

const { colors, tag, icons } = require('./colors');

class HeaderComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        if (!session) {
            this.box.setContent(tag.muted('  Loading...'));
            return;
        }

        const status = (session.status || 'unknown').toLowerCase();
        const statusIcon = this.getStatusIcon(status);
        const statusColor = this.getStatusColor(status);

        const name = session.name || 'Unnamed Session';
        const shortId = session.id ? session.id.substring(0, 8) : '--------';
        const duration = this.formatDuration(session.startedAt, session.completedAt);

        // Workflow info if running
        let workflowInfo = '';
        if (context.activeWorkflow) {
            workflowInfo = `\n  workflow: ${tag.running(context.activeWorkflow)}`;
        } else if (session.workflowId) {
            workflowInfo = `\n  project: ${tag.muted(session.projectId?.substring(0, 8) || 'N/A')}`;
        }

        // Iteration/fitness line
        const vars = session.variables || {};
        let iterFitnessLine = '';
        const currentIteration = vars.currentIteration || 0;
        const maxIterations = vars.maxIterations || 50;
        const currentFitness = Number(vars.currentFitness || 0);
        const targetFitness = Number(vars.targetFitness || 0.85);

        if (currentIteration > 0 || currentFitness > 0) {
            const fitnessPercent = currentFitness * 100;
            // Color based on progress toward target
            const progressToTarget = targetFitness > 0 ? (currentFitness / targetFitness) * 100 : 0;
            let fitnessColor = 'red';
            if (progressToTarget >= 80) fitnessColor = 'green';
            else if (progressToTarget >= 50) fitnessColor = 'yellow';

            // Find active phase name
            let phaseName = '';
            const phases = vars._phases;
            if (Array.isArray(phases)) {
                const running = phases.find(p => p.status === 'running');
                if (running) phaseName = running.id || running.name || '';
            }

            // Fitness bar (relative to target)
            const barWidth = 7;
            const filled = Math.min(barWidth, Math.round((progressToTarget / 100) * barWidth));
            const empty = barWidth - filled;
            const fitnessBar = '\u2593'.repeat(filled) + '\u2591'.repeat(empty);

            // Score sparkline (normalized min/max)
            let sparkline = '';
            const scoreHistory = vars.scoreHistory;
            if (Array.isArray(scoreHistory) && scoreHistory.length > 0) {
                const sparkChars = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
                const recent = scoreHistory.slice(-8).map(s => Number(s) || 0);
                const min = Math.min(...recent);
                const max = Math.max(...recent);
                const range = max - min || 1;
                sparkline = recent.map(s => {
                    const idx = Math.min(Math.floor(((s - min) / range) * 7), 7);
                    return sparkChars[idx] || sparkChars[0];
                }).join('');
                sparkline = ` ${tag.dim(sparkline)}`;
            }

            const targetStr = targetFitness !== 1 ? `${tag.dim('/' + (targetFitness * 100).toFixed(0) + '%')}` : '';
            const parts = [
                `{${fitnessColor}-fg}${fitnessBar}{/${fitnessColor}-fg} ${fitnessPercent.toFixed(0)}%${targetStr}`,
                `iter ${tag.bold(String(currentIteration))}/${maxIterations}${sparkline}`
            ];
            if (phaseName) {
                parts.push(`Phase: ${tag.running(phaseName)}`);
            }
            iterFitnessLine = `  ${parts.join('  |  ')}`;
        }

        const lines = [
            '',
            `  {${statusColor}-fg}${statusIcon}{/} ${tag.bold(name)}  ${tag.dim(shortId)}  ${tag.muted(status)}  ${tag.dim('duration:')} ${tag.secondary(duration)}`,
            workflowInfo ? workflowInfo : `  project: ${tag.muted(session.projectId?.substring(0, 8) || 'N/A')}`
        ];
        if (iterFitnessLine) {
            lines.push(iterFitnessLine);
        }
        const content = lines.join('\n');

        this.box.setContent(content);
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
}

module.exports = { HeaderComponent };
