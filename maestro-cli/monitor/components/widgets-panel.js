/**
 * Widgets Panel Component
 * Renders custom session widgets defined in templates
 */

const { colors, tag, icons } = require('./colors');

class WidgetsPanelComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const widgets = session.monitorWidgets || [];

        let content = `${tag.label('WIDGETS')}\n\n`;

        if (widgets.length === 0) {
            // Show default widgets based on session variables
            content += this.renderDefaultWidgets(session);
        } else {
            for (const widget of widgets) {
                try {
                    content += this.renderWidget(widget, session);
                } catch (err) {
                    content += tag.error(`  ${widget.id}: ${err.message}\n`);
                }
            }
        }

        this.box.setContent(content);
    }

    renderDefaultWidgets(session) {
        const vars = session.variables || {};
        let content = '';

        // Fitness/Score widget
        const fitness = vars.currentFitness || vars.fitness;
        const target = vars.targetFitness || vars.target || vars.qualityThreshold;

        if (fitness !== undefined) {
            content += this.renderProgressBar('Fitness Score', fitness, target || 1, true);
            content += '\n';
        }

        // Iteration widget
        const iteration = vars.currentIteration || vars.iteration;
        const maxIterations = vars.maxIterations;

        if (iteration !== undefined) {
            content += this.renderCounter('Iteration', iteration, maxIterations);
            content += '\n';
        }

        // Score history widget
        const scoreHistory = vars.scoreHistory;
        if (Array.isArray(scoreHistory) && scoreHistory.length > 0) {
            content += this.renderSparkline('Score History', scoreHistory, target);
            content += '\n';
        }

        // Phase widget
        const phase = vars.currentPhase || vars.phase;
        if (phase !== undefined) {
            content += `  ${tag.muted('Phase')}\n`;
            content += `  ${tag.primary(String(phase))}\n\n`;
        }

        if (content === '') {
            content = tag.dim('  (no widget data available)');
        }

        return content;
    }

    renderWidget(widget, session) {
        const config = widget.config || {};

        switch (widget.type) {
            case 'progress-bar':
                return this.renderProgressBarWidget(widget, session);
            case 'counter':
                return this.renderCounterWidget(widget, session);
            case 'score-chart':
                return this.renderScoreChartWidget(widget, session);
            case 'status-list':
                return this.renderStatusListWidget(widget, session);
            case 'fitness-summary':
                return this.renderFitnessSummaryWidget(widget, session);
            case 'knowledge-status':
                return this.renderKnowledgeStatusWidget(widget, session);
            default:
                return tag.dim(`  Unknown widget: ${widget.type}\n`);
        }
    }

    renderProgressBarWidget(widget, session) {
        const config = widget.config || {};
        const label = config.label || 'Progress';
        const current = this.resolvePath(session, config.current) || 0;
        const max = this.resolvePath(session, config.max) || 1;

        return this.renderProgressBar(label, current, max, config.showPercentage !== false);
    }

    renderCounterWidget(widget, session) {
        const config = widget.config || {};
        const label = config.label || 'Count';
        const value = this.resolvePath(session, config.value) || 0;
        const max = config.max ? this.resolvePath(session, config.max) : null;

        return this.renderCounter(label, value, max);
    }

    renderScoreChartWidget(widget, session) {
        const config = widget.config || {};
        const label = config.label || 'Score';
        const data = this.resolvePath(session, config.data) || [];
        const threshold = config.threshold ? this.resolvePath(session, config.threshold) : null;

        return this.renderSparkline(label, data, threshold);
    }

    renderStatusListWidget(widget, session) {
        const config = widget.config || {};
        const label = config.label || 'Status';
        const items = this.resolvePath(session, config.items) || [];

        let content = `  ${tag.muted(label)}\n`;

        if (!Array.isArray(items) || items.length === 0) {
            content += tag.dim('  (empty)\n');
        } else {
            for (const item of items.slice(0, 5)) {
                const icon = item.status === 'done' ? icons.done :
                            item.status === 'running' ? icons.running :
                            icons.pending;
                const color = item.status === 'done' ? colors.status.success :
                             item.status === 'running' ? colors.status.running :
                             colors.status.pending;
                content += `  {${color}-fg}${icon}{/} ${item.name || item}\n`;
            }
        }

        return content + '\n';
    }

    renderFitnessSummaryWidget(widget, session) {
        const config = widget.config || {};
        const label = config.label || 'Fitness';
        const data = this.resolvePath(session, config.data) || {};

        let content = `  ${tag.muted(label)}\n`;

        const levels = ['block', 'task', 'value'];
        const levelLabels = { block: 'Block', task: 'Task ', value: 'Value' };

        for (const level of levels) {
            const entry = data[level];
            const lbl = levelLabels[level];

            if (entry && entry.score !== null && entry.score !== undefined) {
                const score = Number(entry.score) || 0;
                const bar = this.renderMiniBar(score);
                content += `  ${tag.dim(lbl + ':')} ${tag.primary(score.toFixed(2))} ${bar}\n`;

                // Show sub-dimensions for task fitness
                if (level === 'task' && typeof entry === 'object') {
                    const dims = [
                        ['Completion', entry.completion],
                        ['Quality', entry.quality],
                        ['Cost-Eff', entry.costEfficiency],
                        ['Reliability', entry.reliability],
                        ['Resilience', entry.resilience]
                    ];
                    for (const [dimName, dimValue] of dims) {
                        if (dimValue !== null && dimValue !== undefined) {
                            const pct = Math.round(Number(dimValue) * 100);
                            content += `    ${tag.dim(dimName + ':')}${' '.repeat(Math.max(1, 13 - dimName.length))}${tag.muted(pct + '%')}\n`;
                        }
                    }
                }
            } else {
                content += `  ${tag.dim(lbl + ':')} ${tag.dim('--')}\n`;
            }
        }

        return content + '\n';
    }

    renderMiniBar(score) {
        const width = 16;
        const percent = Math.min(100, Math.max(0, score * 100));
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;

        const barColor = percent >= 80 ? colors.status.success :
                        percent >= 50 ? colors.status.warning :
                        colors.status.error;

        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
        return `{${barColor}-fg}${bar}{/}`;
    }

    renderKnowledgeStatusWidget(widget, session) {
        const config = widget.config || {};
        const label = config.label || 'Knowledge Base';
        const data = this.resolvePath(session, config.data) || {};

        let content = `  ${tag.muted(label)}\n`;

        // Total articles
        const total = data.totalArticles;
        if (total !== null && total !== undefined) {
            content += `  ${tag.dim('Articles:')} ${tag.primary(String(total))}\n`;
        } else {
            content += `  ${tag.dim('Articles:')} ${tag.dim('--')}\n`;
        }

        // Confidence breakdown
        const conf = data.byConfidence || {};
        const high = conf.high || 0;
        const med = conf.medium || 0;
        const low = conf.low || 0;
        if (high || med || low) {
            content += `  ${tag.success('High: ' + high)} ${tag.dim('|')} ${tag.warning('Med: ' + med)} ${tag.dim('|')} ${tag.error('Low: ' + low)}\n`;
        }

        // Under review count
        const byStatus = data.byStatus || {};
        const review = byStatus['under-review'] || byStatus['underReview'] || 0;
        if (review > 0) {
            content += `  ${tag.dim('Review:')} ${tag.warning(String(review))}\n`;
        }

        // Last generated (relative time)
        if (data.lastGenerated) {
            const relTime = this.formatRelativeTime(data.lastGenerated);
            content += `  ${tag.dim('Last gen:')} ${tag.muted(relTime)}\n`;
        }

        return content + '\n';
    }

    formatRelativeTime(isoString) {
        try {
            const then = new Date(isoString);
            const now = new Date();
            const diffMs = now - then;

            if (diffMs < 0) return 'just now';

            const diffSec = Math.floor(diffMs / 1000);
            if (diffSec < 60) return `${diffSec}s ago`;

            const diffMin = Math.floor(diffSec / 60);
            if (diffMin < 60) return `${diffMin} min ago`;

            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ago`;

            const diffDays = Math.floor(diffHr / 24);
            return `${diffDays}d ago`;
        } catch {
            return String(isoString);
        }
    }

    renderProgressBar(label, current, max, showPercent = true) {
        const width = 16;
        const percent = Math.min(100, Math.max(0, (current / max) * 100));
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;

        const barColor = percent >= 80 ? colors.status.success :
                        percent >= 50 ? colors.status.warning :
                        colors.status.error;

        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
        const percentStr = showPercent ? ` ${Math.round(percent)}%` : '';

        let content = `  ${tag.muted(label)}\n`;
        content += `  {${barColor}-fg}${bar}{/}${percentStr}\n`;

        if (max !== 1) {
            content += `  ${tag.dim('target:')} ${tag.muted(String(max))}\n`;
        }

        return content;
    }

    renderCounter(label, value, max) {
        const maxStr = max !== null && max !== undefined ? ` / ${max}` : '';

        let content = `  ${tag.muted(label)}\n`;
        content += `  ${tag.primary(String(value))}${tag.dim(maxStr)}\n`;

        return content;
    }

    renderSparkline(label, values, threshold) {
        const chars = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
        const nums = values.map(v => Number(v) || 0).slice(-12);

        if (nums.length === 0) {
            return `  ${tag.muted(label)}\n  ${tag.dim('(no data)')}\n`;
        }

        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const range = max - min || 1;

        const sparkline = nums.map(n => {
            const idx = Math.floor(((n - min) / range) * (chars.length - 1));
            return chars[Math.max(0, Math.min(chars.length - 1, idx))];
        }).join('');

        const lastValue = nums[nums.length - 1];

        let content = `  ${tag.muted(label)}\n`;
        content += `  ${tag.running(sparkline)} ${tag.primary(lastValue.toFixed(2))}\n`;

        if (threshold !== null && threshold !== undefined) {
            content += `  ${tag.dim('target:')} ${tag.muted(String(threshold))}\n`;
        }

        return content;
    }

    resolvePath(session, path) {
        if (typeof path === 'number') return path;
        if (typeof path !== 'string') return path;

        if (path.startsWith('$.variables.')) {
            const key = path.replace('$.variables.', '');
            return session.variables?.[key];
        }

        if (path.startsWith('$.')) {
            const parts = path.substring(2).split('.');
            let current = session;
            for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
            }
            return current;
        }

        const num = Number(path);
        return isNaN(num) ? path : num;
    }
}

module.exports = { WidgetsPanelComponent };
