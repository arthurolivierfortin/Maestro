/**
 * Metrics Panel Component
 * Aggregated view of fitness, iteration, and score history
 *
 * Data source: Multiple session variables (currentFitness, currentIteration, scoreHistory, targetFitness)
 * Reuses rendering patterns from widgets-panel.js
 */

const { colors, tag, icons } = require('./colors');

class MetricsPanelComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const vars = session.variables || {};

        let content = `${tag.label('METRICS')}\n`;

        // Fitness progress bar
        const fitness = vars.currentFitness || vars.fitness || 0;
        const target = vars.targetFitness || vars.target || 1;
        content += this.renderProgressBar('Fitness', fitness, target);

        // Iteration counter
        const iteration = vars.currentIteration || vars.iteration || 0;
        const maxIter = vars.maxIterations;
        content += this.renderCounter('Iteration', iteration, maxIter);

        // Score sparkline
        const history = vars.scoreHistory;
        if (Array.isArray(history) && history.length > 0) {
            content += this.renderSparkline('Scores', history, target);
        }

        this.box.setContent(content);
        this.box.setScrollPerc(100);
    }

    renderProgressBar(label, current, max) {
        const width = 16;
        const percent = Math.min(100, Math.max(0, (current / max) * 100));
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;

        const barColor = percent >= 80 ? 'green' : percent >= 50 ? 'yellow' : 'red';
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

        let out = `  ${tag.muted(label)}\n`;
        out += `  {${barColor}-fg}${bar}{/} ${Math.round(percent)}%`;
        if (max !== 1) out += `  ${tag.dim('T: ' + (max * 100) + '%')}`;
        out += '\n';
        return out;
    }

    renderCounter(label, value, max) {
        const maxStr = max !== null && max !== undefined ? ` / ${max}` : '';
        let out = `  ${tag.muted(label)}\n`;
        out += `  ${tag.primary(String(value))}${tag.dim(maxStr)}\n`;
        return out;
    }

    renderSparkline(label, values, threshold) {
        const chars = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
        const nums = values.map(v => Number(v) || 0).slice(-12);
        if (nums.length === 0) return '';

        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const range = max - min || 1;

        const sparkline = nums.map(n => {
            const idx = Math.floor(((n - min) / range) * (chars.length - 1));
            return chars[Math.max(0, Math.min(chars.length - 1, idx))];
        }).join('');

        const last = nums[nums.length - 1];
        let out = `  ${tag.muted(label)}\n`;
        out += `  ${tag.running(sparkline)} ${tag.primary(last.toFixed(2))}\n`;
        return out;
    }
}

module.exports = { MetricsPanelComponent };
