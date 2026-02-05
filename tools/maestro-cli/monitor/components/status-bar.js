/**
 * Status Bar Component
 * Displays connection status, latency, and keyboard shortcuts
 */

const { colors, tag, icons } = require('./colors');

class StatusBarComponent {
    constructor(box) {
        this.box = box;
    }

    render(context = {}) {
        const {
            connectionStatus = 'connecting',
            latency = 0,
            lastRefresh = null,
            mode = 'idle',
            visiblePanels = {},
            hasBackOption = false
        } = context;

        // Connection indicator
        const connColor = connectionStatus === 'connected' ? colors.status.success :
                         connectionStatus === 'error' ? colors.status.error :
                         colors.status.warning;
        const connIcon = `{${connColor}-fg}${icons.connected}{/}`;

        // Latency
        const latencyStr = latency > 0 ? `${latency}ms` : '-';

        // Time
        const timeStr = lastRefresh ? this.formatTime(lastRefresh) : '-';

        // Shortcuts based on mode
        const shortcuts = this.getShortcuts(mode, visiblePanels, hasBackOption);

        const left = `${connIcon} ${tag.muted(connectionStatus)}  ${tag.dim(icons.dot)}  ${tag.muted(latencyStr)}  ${tag.dim(icons.dot)}  ${tag.muted(timeStr)}`;
        const right = shortcuts;

        this.box.setContent(` ${left}      ${right}`);
    }

    getShortcuts(mode, visiblePanels, hasBackOption = false) {
        const shortcuts = [];

        // Panel toggles
        shortcuts.push(this.shortcut('t', 'tree', visiblePanels.tree));
        shortcuts.push(this.shortcut('f', 'files', visiblePanels.files));
        shortcuts.push(this.shortcut('w', 'widgets', visiblePanels.widgets));
        shortcuts.push(this.shortcut('v', 'vars', visiblePanels.vars));
        shortcuts.push(this.shortcut('l', 'logs', visiblePanels.logs));

        // Actions
        shortcuts.push(`${tag.dim('[')}${tag.muted('r')}${tag.dim(']')}efresh`);
        if (hasBackOption) {
            shortcuts.push(`${tag.dim('[')}${tag.muted('Esc')}${tag.dim(']')}back`);
        }
        shortcuts.push(`${tag.dim('[')}${tag.muted('q')}${tag.dim(']')}uit`);

        return shortcuts.join('  ');
    }

    shortcut(key, label, active = true) {
        if (active) {
            return `${tag.dim('[')}${tag.highlight(key)}${tag.dim(']')}${tag.muted(label)}`;
        } else {
            return `${tag.dim('[' + key + ']' + label)}`;
        }
    }

    formatTime(date) {
        try {
            const d = date instanceof Date ? date : new Date(date);
            return d.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return '--:--:--';
        }
    }
}

module.exports = { StatusBarComponent };
