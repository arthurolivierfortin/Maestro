/**
 * Workflow Tree Component — hierarchical display with auto-focus
 *
 * Renders the execution tree with nested indentation:
 *   ├─ ✓ Load Agent  [done]
 *   ├─ ● Improvement Loop  [running] → Iteration 3/50
 *   │   ├─ ✓ Run Training  [done]
 *   │   ├─ ✓ Evaluate Results  [done]
 *   │   ├─ ● Generate Improvements  [running] →
 *   │   │     Calling LLM...
 *   │   ├─ ○ Apply Improvements  [...]
 *   │   └─ ○ Update Metrics  [...]
 *   └─ ○ Finalize  [...]
 *
 * Only the running node shows output detail.
 * Auto-scrolls so the running node is always visible.
 * Read-only display — no user navigation.
 */

const { colors, tag, icons } = require('./colors');

class WorkflowTreeComponent {
    constructor(box) {
        this.box = box;
        this.runningNodeLine = -1;
    }

    render(session, context = {}) {
        const workflow = context.activeWorkflow || session.activeWorkflow;
        const executionTree = context.executionTree || session.executionTree;

        this.runningNodeLine = -1;
        this.currentLine = 0;

        let content = `${tag.label('WORKFLOW TREE')}\n`;
        this.currentLine++;

        if (!workflow && !executionTree) {
            content += tag.dim('  (no active workflow)\n');
            content += tag.dim('  invoke: maestro session invoke <id> <entry-point>');
            this.box.setContent(content);
            return;
        }

        if (executionTree) {
            const nodes = Array.isArray(executionTree) ? executionTree : (executionTree.nodes || []);
            content += this.renderNodes(nodes, '  ');
        } else if (workflow) {
            content += `  ${tag.running(icons.running)} ${tag.bold(workflow)}  ${this.badge('running')}\n`;
            this.currentLine++;
        }

        this.box.setContent(content);

        // Auto-scroll: put the running node near the top third of viewport
        if (this.runningNodeLine >= 0) {
            const h = this.box.height || 10;
            const target = Math.max(0, this.runningNodeLine - Math.floor(h / 3));
            this.box.scrollTo(target);
        } else {
            this.box.setScrollPerc(100);
        }
    }

    renderNodes(nodes, indent) {
        let out = '';
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isLast = i === nodes.length - 1;
            const branch = isLast ? icons.lastBranch : icons.branch;
            const childIndent = indent + (isLast ? '    ' : icons.vertical + '   ');

            out += this.renderNode(node, indent + branch + ' ', childIndent);
        }
        return out;
    }

    renderNode(node, prefix, childIndent) {
        const status = (node.status || 'pending').toLowerCase();
        const icon = this.statusIcon(status);
        const col = this.statusColor(status);
        const name = node.name || node.id || 'node';
        const isActive = status === 'running' || status === 'active';

        if (isActive) {
            this.runningNodeLine = this.currentLine;
        }

        // Node line: prefix + icon + name + badge
        let line = `${prefix}{${col}-fg}${icon}{/${col}-fg} ${isActive ? `{bold}${name}{/bold}` : name}`;
        line += `  ${this.badge(status)}`;

        if (isActive) {
            line += ` {cyan-fg}${icons.arrow}{/cyan-fg}`;
        }

        this.currentLine++;

        // Show output ONLY for running/active node
        if (isActive && node.output) {
            const brief = this.truncate(String(node.output).replace(/[\n\r]+/g, ' '), 60);
            line += `\n${childIndent}  ${tag.dim(brief)}`;
            this.currentLine++;
        }

        line += '\n';

        // Render children recursively (for while/conditional nodes)
        const children = node.children;
        if (children && Array.isArray(children) && children.length > 0) {
            line += this.renderNodes(children, childIndent);
        }

        return line;
    }

    // Helpers

    truncate(str, max) {
        if (!str) return '';
        const s = String(str);
        return s.length > max ? s.substring(0, max - 3) + '...' : s;
    }

    statusIcon(status) {
        const map = {
            done: icons.done, completed: icons.done, success: icons.done,
            running: icons.running, active: icons.running,
            pending: icons.pending, waiting: icons.pending,
            failed: icons.failed, error: icons.failed,
            paused: icons.paused
        };
        return map[status] || icons.pending;
    }

    statusColor(status) {
        const map = {
            done: 'green', completed: 'green', success: 'green',
            running: 'cyan', active: 'cyan',
            pending: 'gray', waiting: 'gray',
            failed: 'red', error: 'red',
            paused: 'yellow'
        };
        return map[status] || 'gray';
    }

    badge(status) {
        const col = this.statusColor(status);
        const label = { done: 'done', completed: 'done', success: 'done',
            running: 'running', active: 'active',
            pending: '...', waiting: '...',
            failed: 'FAIL', error: 'ERR', paused: 'paused' }[status] || status;
        return `{gray-fg}[{/gray-fg}{${col}-fg}${label}{/${col}-fg}{gray-fg}]{/gray-fg}`;
    }
}

module.exports = { WorkflowTreeComponent };
