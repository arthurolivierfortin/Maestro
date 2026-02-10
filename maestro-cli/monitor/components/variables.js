/**
 * Variables Component
 * Displays session variables with grouping
 */

const { colors, tag, icons } = require('./colors');

class VariablesComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const vars = session.variables || {};

        // Filter out internal variables (starting with _)
        const userVars = {};
        for (const [key, value] of Object.entries(vars)) {
            if (!key.startsWith('_')) {
                userVars[key] = value;
            }
        }

        let content = `${tag.label('VARIABLES')}\n\n`;

        const keys = Object.keys(userVars);

        if (keys.length === 0) {
            content += tag.dim('  (no variables set)\n\n');
            content += tag.dim('  set with: maestro session vars <id> set <key> <value>');
            this.box.setContent(content);
            return;
        }

        // Group variables by category
        const groups = this.groupVariables(userVars);

        for (const [groupName, groupVars] of Object.entries(groups)) {
            if (Object.keys(groupVars).length === 0) continue;

            content += `  ${tag.muted(groupName)}\n`;
            content += `  ${tag.dim('─'.repeat(groupName.length))}\n`;

            for (const [key, value] of Object.entries(groupVars)) {
                const formattedValue = this.formatValue(value);
                content += `  ${tag.secondary(key.padEnd(20))} ${formattedValue}\n`;
            }
            content += '\n';
        }

        this.box.setContent(content);
    }

    groupVariables(vars) {
        const groups = {
            'Config': {},
            'State': {},
            'Other': {}
        };

        const configKeys = ['qualityThreshold', 'maxIterations', 'maxOptimizationRounds', 'targetFitness', 'threshold', 'target', 'max', 'min'];
        const stateKeys = ['currentPhase', 'currentIteration', 'currentFitness', 'phase', 'iteration', 'fitness', 'status', 'score', 'scoreHistory', 'result'];

        for (const [key, value] of Object.entries(vars)) {
            const lowerKey = key.toLowerCase();

            if (configKeys.some(k => lowerKey.includes(k.toLowerCase()))) {
                groups['Config'][key] = value;
            } else if (stateKeys.some(k => lowerKey.includes(k.toLowerCase()))) {
                groups['State'][key] = value;
            } else {
                groups['Other'][key] = value;
            }
        }

        return groups;
    }

    formatValue(value) {
        if (value === null || value === undefined) {
            return tag.muted('null');
        }

        if (typeof value === 'boolean') {
            return value
                ? `{green-fg}true{/green-fg}`
                : `{red-fg}false{/red-fg}`;
        }

        if (typeof value === 'number') {
            // Format percentages nicely
            if (value >= 0 && value <= 1) {
                const percent = Math.round(value * 100);
                const color = percent >= 80 ? 'green' :
                             percent >= 50 ? 'yellow' :
                             'red';
                return `{${color}-fg}${value}{/${color}-fg} ${tag.muted(`(${percent}%)`)}`;
            }
            return `{cyan-fg}${value}{/cyan-fg}`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return tag.dim('[]');
            }
            if (value.length <= 5) {
                const items = value.map(v =>
                    typeof v === 'number' ? v.toFixed(2) : String(v)
                ).join(', ');
                return tag.muted(`[${items}]`);
            }
            return tag.muted(`[${value.length} items]`);
        }

        if (typeof value === 'object') {
            const str = JSON.stringify(value);
            if (str.length > 30) {
                return tag.muted(str.substring(0, 27) + '...');
            }
            return tag.muted(str);
        }

        // String
        const str = String(value);
        if (str.length > 30) {
            return `${tag.primary(str.substring(0, 27))}${tag.dim('...')}`;
        }
        return tag.primary(str);
    }
}

module.exports = { VariablesComponent };
