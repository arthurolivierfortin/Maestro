/**
 * Score Chart Widget
 *
 * Displays a score value with optional trend indicator.
 * Can show history as a simple sparkline.
 *
 * Configuration:
 * {
 *   "id": "quality-score",
 *   "type": "score-chart",
 *   "config": {
 *     "label": "Quality Score",
 *     "value": "$.variables.currentScore",
 *     "threshold": "$.variables.qualityThreshold",
 *     "history": "$.variables.scoreHistory",
 *     "format": "percent"
 *   }
 * }
 */

class ScoreChartWidget {
    constructor(config) {
        this.id = config.id;
        this.label = config.config?.label || 'Score';
        this.valuePath = config.config?.value || '0';
        this.thresholdPath = config.config?.threshold;
        this.historyPath = config.config?.history;
        this.format = config.config?.format || 'number'; // 'number', 'percent', 'decimal'
        this.sparklineWidth = config.config?.sparklineWidth || 10;
    }

    /**
     * Renders the widget to an array of lines.
     */
    renderToLines(session) {
        const value = this.resolvePath(session, this.valuePath);
        const threshold = this.thresholdPath ? this.resolvePath(session, this.thresholdPath) : null;
        const history = this.historyPath ? this.resolvePath(session, this.historyPath) : null;

        const numValue = Number(value) || 0;
        const numThreshold = threshold !== null ? Number(threshold) : null;

        // Format the value
        const displayValue = this.formatValue(numValue);

        // Status indicator
        let statusIcon = '⚪';
        if (numThreshold !== null) {
            statusIcon = numValue >= numThreshold ? '🟢' : '🟡';
        }

        // Threshold display
        const thresholdStr = numThreshold !== null ? ` (target: ${this.formatValue(numThreshold)})` : '';

        // Sparkline for history
        let sparkline = '';
        if (Array.isArray(history) && history.length > 0) {
            sparkline = ' ' + this.renderSparkline(history);
        }

        return [`${statusIcon} ${this.label}: ${displayValue}${thresholdStr}${sparkline}`];
    }

    /**
     * Renders the widget (legacy).
     */
    render(session) {
        const lines = this.renderToLines(session);
        for (const line of lines) {
            console.log(`  ${line}`);
        }
    }

    /**
     * Formats a value based on the format setting.
     */
    formatValue(value) {
        switch (this.format) {
            case 'percent':
                return `${Math.round(value * 100)}%`;
            case 'decimal':
                return value.toFixed(2);
            default:
                return String(value);
        }
    }

    /**
     * Renders a sparkline from an array of values.
     */
    renderSparkline(values) {
        const chars = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
        const nums = values.map(v => Number(v) || 0).slice(-this.sparklineWidth);

        if (nums.length === 0) return '';

        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const range = max - min || 1;

        return nums.map(n => {
            const idx = Math.floor(((n - min) / range) * (chars.length - 1));
            return chars[Math.max(0, Math.min(chars.length - 1, idx))];
        }).join('');
    }

    /**
     * Resolves a path expression to a value.
     */
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

module.exports = { ScoreChartWidget };
