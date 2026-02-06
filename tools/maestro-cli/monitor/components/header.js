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
            let fitnessColor = 'red';
            if (fitnessPercent >= 80) fitnessColor = 'green';
            else if (fitnessPercent >= 50) fitnessColor = 'yellow';

            // Find active phase name
            let phaseName = '';
            const phases = vars._phases;
            if (Array.isArray(phases)) {
                const running = phases.find(p => p.status === 'running');
                if (running) phaseName = running.id || running.name || '';
            }

            const parts = [
                `iter: ${tag.bold(String(currentIteration))}/${maxIterations}`,
                `fitness: {${fitnessColor}-fg}${currentFitness.toFixed(2)}{/${fitnessColor}-fg}/${targetFitness.toFixed(2)}`
            ];
            if (phaseName) {
                parts.push(`phase: ${tag.running(phaseName)}`);
            }
            iterFitnessLine = `\n  ${parts.join('  |  ')}`;
        }

        const content = [
            '',
            `  {${statusColor}-fg}${statusIcon}{/} ${tag.bold(name)}  ${tag.dim(shortId)}  ${tag.muted(status)}`,
            workflowInfo ? workflowInfo : `  project: ${tag.muted(session.projectId?.substring(0, 8) || 'N/A')}`,
            `  ${tag.dim('duration:')} ${tag.secondary(duration)}${iterFitnessLine}`
        ].join('\n');

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
