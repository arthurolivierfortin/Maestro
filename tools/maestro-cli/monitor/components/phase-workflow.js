/**
 * Phase-Workflow Component (merged)
 *
 * Replaces separate phase-list + workflow-tree with a single unified view:
 * - Done phases: 1 collapsed line with summary (iterations, fitness)
 * - Running phase: header + full workflow tree expanded
 * - Pending phases: 1 simple line
 *
 * Data sources:
 *   context.phases (_phases variable)
 *   context.executionTree (_executionTree variable)
 */

const { colors, tag, icons } = require('./colors');

class PhaseWorkflowComponent {
    constructor(box) {
        this.box = box;
        this.runningNodeLine = -1;
        this.currentLine = 0;
    }

    render(session, context = {}) {
        const phases = context.phases || session.variables?._phases || [];
        const executionTree = context.executionTree || null;

        this.runningNodeLine = -1;
        this.currentLine = 0;

        let content = `${tag.label('PHASES + WORKFLOW')}\n`;
        this.currentLine++;

        if (!Array.isArray(phases) || phases.length === 0) {
            content += tag.dim('  (no phases defined)');
            this.box.setContent(content);
            return;
        }

        for (const phase of phases) {
            const status = (phase.status || 'pending').toLowerCase();

            if (status === 'done' || status === 'completed') {
                content += this.renderDonePhase(phase);
            } else if (status === 'running' || status === 'active') {
                content += this.renderRunningPhase(phase, executionTree);
            } else {
                content += this.renderPendingPhase(phase);
            }
        }

        this.box.setContent(content);

        // Auto-scroll: put the running node near the top third of viewport
        if (this.runningNodeLine >= 0) {
            const h = this.box.height || 10;
            const target = Math.max(0, this.runningNodeLine - Math.floor(h / 3));
            this.box.scrollTo(target);
        }
    }

    renderDonePhase(phase) {
        const name = phase.name || phase.id || 'Phase';
        const result = phase.result || {};
        const iter = result.iterations || '?';
        const fitness = typeof result.fitness === 'number' ? Math.round(result.fitness * 100) + '%' : '?';

        // Build summary parts
        const parts = [`${iter} iter`, `fitness ${fitness}`];
        if (result.tokenCount) parts.push(`~${result.tokenCount} tok`);
        if (result.qualityScore) parts.push(`quality ${Math.round(result.qualityScore * 100)}%`);

        const line = `  {green-fg}${icons.done}{/green-fg} ${name} {gray-fg}[done]{/gray-fg} {gray-fg}(${parts.join(', ')}){/gray-fg}\n`;
        this.currentLine++;
        return line;
    }

    renderRunningPhase(phase, executionTree) {
        const name = phase.name || phase.id || 'Phase';
        let content = `  {cyan-fg}${icons.running}{/cyan-fg} {bold}${name}{/bold} {gray-fg}[{/gray-fg}{cyan-fg}running{/cyan-fg}{gray-fg}]{/gray-fg}\n`;
        this.currentLine++;
        this.runningNodeLine = this.currentLine;

        // Render the execution tree under this phase
        if (executionTree) {
            const nodes = Array.isArray(executionTree) ? executionTree : (executionTree.nodes || []);
            content += this.renderNodes(nodes, '    ');
        }

        return content;
    }

    renderPendingPhase(phase) {
        const name = phase.name || phase.id || 'Phase';
        const line = `  {gray-fg}${icons.pending}{/gray-fg} ${tag.dim(name)} {gray-fg}[...]{/gray-fg}\n`;
        this.currentLine++;
        return line;
    }

    // === Workflow tree rendering (reused from workflow-tree.js logic) ===

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

        // Show output hint for running node
        if (isActive && node.output) {
            const brief = this.truncate(String(node.output).replace(/[\n\r]+/g, ' '), 50);
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

module.exports = { PhaseWorkflowComponent };
