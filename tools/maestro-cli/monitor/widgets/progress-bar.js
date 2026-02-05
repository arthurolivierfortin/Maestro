/**
 * Progress Bar Widget
 *
 * Displays a progress bar showing progress toward a goal.
 * Session-specific configuration defines what variables to use.
 *
 * Configuration:
 * {
 *   "id": "phase-progress",
 *   "type": "progress-bar",
 *   "config": {
 *     "label": "Phase",
 *     "current": "$.variables.currentPhase",
 *     "max": "$.variables.totalPhases"
 *   }
 * }
 */

class ProgressBarWidget {
    constructor(config) {
        this.id = config.id;
        this.label = config.config?.label || 'Progress';
        this.currentPath = config.config?.current || '0';
        this.maxPath = config.config?.max || '100';
        this.width = config.config?.width || 20;
        this.showPercent = config.config?.showPercent !== false;
    }

    /**
     * Renders the widget.
     */
    render(session) {
        const current = this.resolvePath(session, this.currentPath);
        const max = this.resolvePath(session, this.maxPath);

        const numCurrent = Number(current) || 0;
        const numMax = Number(max) || 1;

        const percent = Math.min(100, Math.max(0, (numCurrent / numMax) * 100));
        const filled = Math.round((percent / 100) * this.width);
        const empty = this.width - filled;

        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
        const percentStr = this.showPercent ? ` ${Math.round(percent)}%` : '';

        console.log(`  ${this.label}: [${bar}] ${numCurrent}/${numMax}${percentStr}`);
    }

    /**
     * Resolves a path expression to a value.
     * Supports:
     * - "$.variables.key" - access session variables
     * - "literal" - literal value
     * - number - literal number
     */
    resolvePath(session, path) {
        if (typeof path === 'number') return path;
        if (typeof path !== 'string') return path;

        if (path.startsWith('$.variables.')) {
            const key = path.replace('$.variables.', '');
            return session.variables?.[key];
        }

        if (path.startsWith('$.')) {
            // Generic path resolution
            const parts = path.substring(2).split('.');
            let current = session;
            for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
            }
            return current;
        }

        // Try to parse as number, otherwise return as string
        const num = Number(path);
        return isNaN(num) ? path : num;
    }
}

module.exports = { ProgressBarWidget };
