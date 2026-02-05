/**
 * Workflow Tree Component
 * Displays the execution tree of active workflows
 */

const { colors, tag, icons } = require('./colors');

class WorkflowTreeComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const workflow = context.activeWorkflow || session.activeWorkflow;
        const executionTree = context.executionTree || session.executionTree;

        let content = `${tag.label('WORKFLOW TREE')}\n\n`;

        if (!workflow && !executionTree) {
            content += tag.dim('  (no active workflow)\n\n');
            content += tag.dim(`  invoke with: maestro session invoke <id> <entry-point>`);
            this.box.setContent(content);
            return;
        }

        // If we have execution tree data
        if (executionTree && executionTree.nodes) {
            content += this.renderTree(executionTree);
        } else if (workflow) {
            // Simple workflow display
            content += this.renderSimpleWorkflow(workflow, session);
        }

        this.box.setContent(content);
    }

    renderTree(tree, indent = '') {
        let output = '';

        const nodes = Array.isArray(tree.nodes) ? tree.nodes : [tree];

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isLast = i === nodes.length - 1;
            const prefix = indent + (isLast ? icons.lastBranch : icons.branch) + ' ';
            const childIndent = indent + (isLast ? '    ' : icons.vertical + '   ');

            output += this.renderNode(node, prefix);

            if (node.children && node.children.length > 0) {
                output += this.renderTree({ nodes: node.children }, childIndent);
            }
        }

        return output;
    }

    renderNode(node, prefix = '') {
        const status = (node.status || 'pending').toLowerCase();
        const icon = this.getStatusIcon(status);
        const color = this.getStatusColor(status);
        const name = node.name || node.type || 'node';

        let line = `${prefix}{${color}-fg}${icon}{/${color}-fg} ${name}`;

        // Add status tag on the right
        const statusTag = this.getStatusTag(status);
        if (statusTag) {
            line += `  ${statusTag}`;
        }

        // Add output/result if available
        if (node.output) {
            line += `\n${prefix.replace(/[├└─]/g, ' ')}    ${tag.dim(icons.arrow)} ${tag.muted(this.truncate(node.output, 50))}`;
        }

        // Add progress if available
        if (node.progress !== undefined && status === 'running') {
            line += `\n${prefix.replace(/[├└─]/g, ' ')}    ${tag.dim('progress:')} ${tag.running(node.progress + '%')}`;
        }

        return line + '\n';
    }

    renderSimpleWorkflow(workflow, session) {
        // Generate a mock tree based on session variables
        const vars = session.variables || {};
        const iteration = vars.currentIteration || vars.iteration || 0;
        const fitness = vars.currentFitness || vars.fitness || 0;

        let output = '';

        // Workflow header
        output += `  ${tag.running(icons.expanded)} ${tag.bold(workflow)}  ${this.getStatusTag('running')}\n`;

        // Mock nodes based on common workflow patterns
        const mockNodes = [
            { name: 'evaluate-current', status: fitness > 0 ? 'done' : 'pending', output: fitness > 0 ? `fitness: ${fitness}` : null },
            { name: 'generate-improvement', status: fitness > 0 ? 'running' : 'pending' },
            { name: 'apply-changes', status: 'pending' },
            { name: 'check-fitness', status: 'pending' }
        ];

        for (let i = 0; i < mockNodes.length; i++) {
            const node = mockNodes[i];
            const isLast = i === mockNodes.length - 1;
            const prefix = isLast ? icons.lastBranch : icons.branch;

            output += this.renderNode(node, `    ${prefix} `);
        }

        return output;
    }

    getStatusIcon(status) {
        const iconMap = {
            'done': icons.done,
            'completed': icons.done,
            'success': icons.done,
            'running': icons.running,
            'active': icons.running,
            'pending': icons.pending,
            'waiting': icons.pending,
            'failed': icons.failed,
            'error': icons.failed,
            'paused': icons.paused
        };
        return iconMap[status] || icons.pending;
    }

    getStatusColor(status) {
        const colorMap = {
            'done': 'green',
            'completed': 'green',
            'success': 'green',
            'running': 'cyan',
            'active': 'cyan',
            'pending': 'gray',
            'waiting': 'gray',
            'failed': 'red',
            'error': 'red',
            'paused': 'yellow'
        };
        return colorMap[status] || 'gray';
    }

    getStatusTag(status) {
        const color = this.getStatusColor(status);
        const labels = {
            'done': 'done',
            'completed': 'done',
            'success': 'done',
            'running': 'running',
            'active': 'active',
            'pending': 'pending',
            'waiting': 'waiting',
            'failed': 'failed',
            'error': 'error',
            'paused': 'paused'
        };
        const label = labels[status] || status;
        return `{gray-fg}[{/gray-fg}{${color}-fg}${label}{/${color}-fg}{gray-fg}]{/gray-fg}`;
    }

    truncate(str, maxLen) {
        if (!str) return '';
        const s = String(str);
        return s.length > maxLen ? s.substring(0, maxLen - 3) + '...' : s;
    }
}

module.exports = { WorkflowTreeComponent };
