/**
 * Counter Widget
 *
 * Displays a simple counter value with optional icon and label.
 *
 * Configuration:
 * {
 *   "id": "iteration-count",
 *   "type": "counter",
 *   "config": {
 *     "label": "Iterations",
 *     "value": "$.variables.iteration",
 *     "max": "$.variables.maxIterations",
 *     "icon": "🔄"
 *   }
 * }
 */

class CounterWidget {
    constructor(config) {
        this.id = config.id;
        this.label = config.config?.label || 'Count';
        this.valuePath = config.config?.value || '0';
        this.maxPath = config.config?.max;
        this.icon = config.config?.icon || '';
    }

    /**
     * Renders the widget.
     */
    render(session) {
        const value = this.resolvePath(session, this.valuePath);
        const max = this.maxPath ? this.resolvePath(session, this.maxPath) : null;

        const numValue = Number(value) || 0;
        const numMax = max !== null ? Number(max) : null;

        const iconStr = this.icon ? `${this.icon} ` : '';
        const maxStr = numMax !== null ? `/${numMax}` : '';

        console.log(`  ${iconStr}${this.label}: ${numValue}${maxStr}`);
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

module.exports = { CounterWidget };
