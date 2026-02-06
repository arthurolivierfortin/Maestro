/**
 * Metrics Panel Component
 * Compact view of session metrics: fitness, quality, tokens, iteration, phase
 *
 * Data source: Session variables (currentFitness, _qualityScore, _tokenCount,
 *   currentIteration, scoreHistory, targetFitness, _phases, _plateauCount, _bestFitness)
 *
 * Displays generically based on which variables exist:
 * - Phase 1 (target-based): Fitness bar + iteration + trend
 * - Phase 2 (plateau-based): Fitness + quality + tokens + plateau counter
 */

const { colors, tag, icons } = require('./colors');

class MetricsPanelComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const vars = session.variables || {};

        const lines = [`${tag.label('SESSION METRICS')}`];

        // Fitness progress bar
        const fitness = Number(vars.currentFitness || vars.fitness || 0);
        const target = Number(vars.targetFitness || vars.target || 1);
        lines.push(this.renderFitnessLine(fitness, target));

        // Quality score (shown when different from fitness, i.e. optimization phases)
        const qualityScore = Number(vars._qualityScore || 0);
        if (qualityScore > 0 && Math.abs(qualityScore - fitness) > 0.01) {
            lines.push(`  ${tag.muted('Quality')}  ${tag.primary(Math.round(qualityScore * 100) + '%')}${tag.dim('/' + Math.round(target * 100) + '%')}`);
        }

        // Token count (shown when available)
        const tokenCount = vars._tokenCount || 0;
        if (tokenCount > 0) {
            lines.push(`  ${tag.muted('Tokens')}   ${tag.primary('~' + tokenCount)}`);
        }

        // Iteration + plateau info
        const iteration = vars.currentIteration || vars.iteration || 0;
        const maxIter = vars.maxIterations;
        const plateauCount = vars._plateauCount;
        if (plateauCount !== undefined && plateauCount !== null) {
            // Plateau mode: show plateau counter instead of simple iteration
            lines.push(`  ${tag.muted('Iter')}     ${tag.primary(String(iteration))}  ${tag.dim('plateau:')} ${tag.primary(String(plateauCount))}`);
        } else {
            lines.push(this.renderIterationLine(iteration, maxIter));
        }

        // Fitness trend sparkline
        const history = vars.scoreHistory;
        if (Array.isArray(history) && history.length > 1) {
            lines.push(this.renderTrendLine(history));
        }

        this.box.setContent(lines.join('\n'));
    }

    renderFitnessLine(current, target) {
        const barWidth = 10;
        // Bar and color relative to target
        const progressToTarget = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        const filled = Math.round((progressToTarget / 100) * barWidth);
        const empty = barWidth - filled;

        const barColor = progressToTarget >= 80 ? 'green' : progressToTarget >= 50 ? 'yellow' : 'red';
        const bar = '\u2593'.repeat(filled) + '\u2591'.repeat(empty);

        // Display absolute fitness + target
        let line = `  ${tag.muted('Fitness')}  {${barColor}-fg}${bar}{/} ${Math.round(current * 100)}%`;
        if (target !== 1) line += `${tag.dim('/' + Math.round(target * 100) + '%')}`;
        return line;
    }

    renderIterationLine(value, max) {
        const maxStr = max !== null && max !== undefined ? `/${max}` : '';
        return `  ${tag.muted('Iter')}     ${tag.primary(String(value))}${tag.dim(maxStr)}`;
    }

    renderTrendLine(values) {
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
        return `  ${tag.muted('Trend')}    ${tag.running(sparkline)} ${tag.primary(last.toFixed(2))}`;
    }
}

module.exports = { MetricsPanelComponent };
