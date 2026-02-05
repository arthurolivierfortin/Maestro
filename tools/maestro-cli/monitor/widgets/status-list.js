/**
 * Status List Widget
 *
 * Displays a list of items with status indicators.
 * Useful for showing phase completion, test results, etc.
 *
 * Configuration:
 * {
 *   "id": "phase-status",
 *   "type": "status-list",
 *   "config": {
 *     "label": "Phases",
 *     "items": [
 *       { "name": "Creation", "status": "$.variables.phase1Status" },
 *       { "name": "Optimization", "status": "$.variables.phase2Status" },
 *       { "name": "Publication", "status": "$.variables.phase3Status" }
 *     ],
 *     "statusIcons": {
 *       "pending": "⚪",
 *       "running": "🔵",
 *       "complete": "✅",
 *       "failed": "❌"
 *     }
 *   }
 * }
 *
 * Alternative: Use a single path to an array
 * {
 *   "id": "test-results",
 *   "type": "status-list",
 *   "config": {
 *     "label": "Test Cases",
 *     "itemsPath": "$.variables.testResults",
 *     "nameKey": "name",
 *     "statusKey": "passed"
 *   }
 * }
 */

class StatusListWidget {
    constructor(config) {
        this.id = config.id;
        this.label = config.config?.label || 'Status';
        this.items = config.config?.items || [];
        this.itemsPath = config.config?.itemsPath;
        this.nameKey = config.config?.nameKey || 'name';
        this.statusKey = config.config?.statusKey || 'status';
        this.statusIcons = config.config?.statusIcons || {
            'pending': '\u26AA',
            'waiting': '\u26AA',
            'running': '\uD83D\uDD35',
            'in_progress': '\uD83D\uDD35',
            'complete': '\u2705',
            'completed': '\u2705',
            'success': '\u2705',
            'passed': '\u2705',
            'true': '\u2705',
            'failed': '\u274C',
            'error': '\u274C',
            'false': '\u274C',
            'skipped': '\u23ED\uFE0F'
        };
        this.maxItems = config.config?.maxItems || 10;
    }

    /**
     * Renders the widget to an array of lines.
     */
    renderToLines(session) {
        const lines = [];
        lines.push(`${this.label}:`);

        let itemList = this.items;

        // If using dynamic items path
        if (this.itemsPath) {
            const dynamicItems = this.resolvePath(session, this.itemsPath);
            if (Array.isArray(dynamicItems)) {
                itemList = dynamicItems.slice(0, this.maxItems).map(item => ({
                    name: item[this.nameKey] || 'Unknown',
                    status: item[this.statusKey]
                }));
            }
        }

        if (itemList.length === 0) {
            lines.push('  (no items)');
            return lines;
        }

        for (const item of itemList) {
            const name = typeof item.name === 'string' ? item.name : this.resolvePath(session, item.name);
            const status = this.resolvePath(session, item.status);
            const statusStr = String(status).toLowerCase();
            const icon = this.statusIcons[statusStr] || '\u26AA';
            lines.push(`  ${icon} ${name}`);
        }

        return lines;
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

        return path;
    }
}

module.exports = { StatusListWidget };
