/**
 * Color scheme for TUI Monitor
 * Uses blessed-compatible color names
 */

// Blessed supports: black, red, green, yellow, blue, magenta, cyan, white
// And bright variants: bright-red, bright-green, etc.
// Also gray/grey

const colors = {
    // Base colors - dark background
    bg: 'black',
    fg: 'white',

    // Text hierarchy (for dark background)
    text: {
        primary: 'white',
        secondary: 'gray',
        muted: 'gray',
        dim: 'gray'
    },

    // Status colors
    status: {
        success: 'green',
        running: 'cyan',
        pending: 'gray',
        warning: 'yellow',
        error: 'red',
        paused: 'yellow'
    },

    // Filesystem access colors
    access: {
        readWrite: 'green',
        readOnly: 'yellow',
        none: 'red',
        ignored: 'gray',
        active: 'cyan'
    },

    // UI elements
    ui: {
        border: 'white',
        borderActive: 'white',
        label: 'gray',
        highlight: 'cyan'
    }
};

/**
 * Blessed tag helpers
 */
const tag = {
    // Colors (for dark background)
    primary: (text) => `{white-fg}${text}{/white-fg}`,
    secondary: (text) => `{gray-fg}${text}{/gray-fg}`,
    muted: (text) => `{gray-fg}${text}{/gray-fg}`,
    dim: (text) => `{gray-fg}${text}{/gray-fg}`,

    // Status
    success: (text) => `{green-fg}${text}{/green-fg}`,
    running: (text) => `{cyan-fg}${text}{/cyan-fg}`,
    pending: (text) => `{gray-fg}${text}{/gray-fg}`,
    warning: (text) => `{yellow-fg}${text}{/yellow-fg}`,
    error: (text) => `{red-fg}${text}{/red-fg}`,

    // Formatting
    bold: (text) => `{bold}${text}{/bold}`,

    // Combined
    label: (text) => `{cyan-fg}{bold}${text}{/bold}{/cyan-fg}`,
    highlight: (text) => `{cyan-fg}${text}{/cyan-fg}`
};

/**
 * Icons
 */
const icons = {
    // Status
    done: '\u2713',      // ✓
    running: '\u25CF',   // ●
    pending: '\u25CB',   // ○
    failed: '\u2717',    // ✗
    paused: '\u2016',    // ‖

    // Tree
    branch: '\u251C\u2500',    // ├─
    lastBranch: '\u2514\u2500', // └─
    vertical: '\u2502',        // │
    expanded: '\u25BC',        // ▼
    collapsed: '\u25B6',       // ▶

    // Misc
    arrow: '\u2192',     // →
    dot: '\u2022',       // •
    connected: '\u25CF', // ●

    // Filesystem
    folder: '',
    file: ''
};

module.exports = { colors, tag, icons };
