/**
 * Filesystem Component
 * Displays the project filesystem with access permissions
 */

const { colors, tag, icons } = require('./colors');
const fs = require('fs');
const path = require('path');

class FilesystemComponent {
    constructor(box) {
        this.box = box;
        this.maxDepth = 3;
        this.maxItems = 15;
    }

    render(session, context = {}) {
        const workingDir = session.workingDirectory || context.workingDirectory;

        let content = `${tag.label('FILESYSTEM')}\n\n`;

        if (!workingDir || workingDir === '.' || workingDir === 'N/A') {
            content += tag.dim('  (no working directory bound)\n\n');
            content += tag.dim('  bind with project path');
            this.box.setContent(content);
            return;
        }

        content += `  ${tag.secondary(workingDir)}\n`;

        // Try to read the actual filesystem
        try {
            if (fs.existsSync(workingDir)) {
                content += this.renderDirectory(workingDir, context.accessRules || {}, '  ', 0);
            } else {
                content += tag.dim('  (directory not found)');
            }
        } catch (err) {
            content += tag.error(`  error: ${err.message}`);
        }

        this.box.setContent(content);
    }

    renderDirectory(dirPath, accessRules, indent, depth) {
        if (depth >= this.maxDepth) {
            return indent + tag.dim('...') + '\n';
        }

        let output = '';
        let items = [];

        try {
            items = fs.readdirSync(dirPath);
        } catch {
            return indent + tag.error('(access denied)') + '\n';
        }

        // Sort: directories first, then files
        items.sort((a, b) => {
            const aPath = path.join(dirPath, a);
            const bPath = path.join(dirPath, b);
            const aIsDir = this.isDirectory(aPath);
            const bIsDir = this.isDirectory(bPath);
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        // Limit items
        const displayItems = items.slice(0, this.maxItems);
        const hasMore = items.length > this.maxItems;

        for (let i = 0; i < displayItems.length; i++) {
            const item = displayItems[i];
            const itemPath = path.join(dirPath, item);
            const isLast = i === displayItems.length - 1 && !hasMore;
            const prefix = isLast ? icons.lastBranch : icons.branch;

            const isDir = this.isDirectory(itemPath);
            const access = this.getAccess(itemPath, accessRules);
            const accessTag = this.formatAccess(access);
            const accessColor = this.getAccessColor(access);

            if (this.shouldIgnore(item)) {
                output += `${indent}${prefix} {gray-fg}${item}/{/gray-fg}  {gray-fg}[--]{/gray-fg}\n`;
                continue;
            }

            if (isDir) {
                output += `${indent}${prefix} {${accessColor}-fg}${item}/{/${accessColor}-fg}  ${accessTag}\n`;

                // Recursively render subdirectory
                const childIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
                output += this.renderDirectory(itemPath, accessRules, childIndent, depth + 1);
            } else {
                output += `${indent}${prefix} {${accessColor}-fg}${item}{/${accessColor}-fg}  ${accessTag}\n`;
            }
        }

        if (hasMore) {
            output += `${indent}${icons.lastBranch} ${tag.dim(`... ${items.length - this.maxItems} more`)}\n`;
        }

        return output;
    }

    isDirectory(itemPath) {
        try {
            return fs.statSync(itemPath).isDirectory();
        } catch {
            return false;
        }
    }

    shouldIgnore(name) {
        const ignoreList = ['node_modules', '.git', '__pycache__', '.vs', 'bin', 'obj', 'dist', 'build'];
        return ignoreList.includes(name);
    }

    getAccess(itemPath, accessRules) {
        // Default access rules based on common patterns
        const name = path.basename(itemPath);
        const ext = path.extname(itemPath);

        if (this.shouldIgnore(name)) return 'none';

        // Source files - read/write
        if (['.ts', '.js', '.tsx', '.jsx', '.cs', '.py', '.go', '.rs'].includes(ext)) {
            return 'rw';
        }

        // Test files - read only
        if (name.includes('.test.') || name.includes('.spec.') || name.includes('_test.')) {
            return 'r';
        }

        // Config files - read only
        if (['.json', '.yaml', '.yml', '.toml', '.xml', '.config'].includes(ext)) {
            return 'r';
        }

        // Directories in src - read/write
        if (itemPath.includes('src') || itemPath.includes('lib')) {
            return 'rw';
        }

        // Tests directory - read only
        if (itemPath.includes('test') || itemPath.includes('spec')) {
            return 'r';
        }

        return 'r'; // Default read-only
    }

    getAccessColor(access) {
        const colorMap = {
            'rw': 'green',
            'r': 'yellow',
            'none': 'red',
            'active': 'cyan'
        };
        return colorMap[access] || 'yellow';
    }

    formatAccess(access) {
        const color = this.getAccessColor(access);
        const labels = {
            'rw': '[rw]',
            'r': '[r-]',
            'none': '[--]'
        };
        const label = labels[access] || '[r-]';
        return `{${color}-fg}${label}{/${color}-fg}`;
    }
}

module.exports = { FilesystemComponent };
