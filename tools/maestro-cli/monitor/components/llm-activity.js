/**
 * LLM Activity Component (chat view)
 *
 * Shows LLM interactions in a chat-like format:
 *   --- generate-improvements (19:38:42) -----
 *   > Generate a JSON block definition for a
 *     'gen-commit' tool that analyzes git diffs...
 *   < { "name": "gen-commit", "type": "tool",
 *      "description": "Analyzes git diffs and...
 *     777 chars . 28.5s
 *
 * Data source: context.llmActivity (_llmActivity variable)
 * Each entry: { time, nodeId, promptPreview, responsePreview, responseLength, duration }
 */

const { colors, tag, icons } = require('./colors');

class LLMActivityComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const activities = context.llmActivity || [];

        let content = `${tag.label('LLM ACTIVITY')}\n`;

        if (!Array.isArray(activities) || activities.length === 0) {
            content += tag.dim('  (no LLM calls yet)\n');
            content += tag.dim('  Waiting for inference nodes...');
            this.box.setContent(content);
            return;
        }

        for (const entry of activities) {
            content += this.renderEntry(entry);
        }

        this.box.setContent(content);

        // Auto-scroll to bottom (latest entries)
        this.box.setScrollPerc(100);
    }

    renderEntry(entry) {
        const nodeId = entry.nodeId || 'unknown';
        const time = entry.time || '--:--:--';
        const duration = entry.duration != null ? `${entry.duration}s` : '?s';
        const respLen = entry.responseLength || 0;
        const lenStr = respLen > 1024 ? `${(respLen / 1024).toFixed(1)}K` : `${respLen}`;

        let out = '';

        // Separator with nodeId + timestamp
        const label = `${nodeId} (${time})`;
        const padLen = Math.max(0, 36 - label.length - 4);
        const pad = '\u2500'.repeat(padLen);
        out += `{gray-fg}\u2500\u2500\u2500 ${label} ${pad}{/gray-fg}\n`;

        // Prompt preview (truncated to 3 lines)
        const promptLines = this.wrapText(entry.promptPreview || '(no prompt)', 38);
        const promptDisplay = promptLines.slice(0, 3);
        out += `{yellow-fg}${icons.arrow}{/yellow-fg} ${promptDisplay[0] || ''}\n`;
        for (let i = 1; i < promptDisplay.length; i++) {
            out += `  ${promptDisplay[i]}\n`;
        }
        if (promptLines.length > 3) {
            out += `  ${tag.dim('...')}\n`;
        }

        // Response preview (truncated to 3 lines)
        const respLines = this.wrapText(entry.responsePreview || '(no response)', 38);
        const respDisplay = respLines.slice(0, 3);
        out += `{green-fg}\u2190{/green-fg} ${respDisplay[0] || ''}\n`;
        for (let i = 1; i < respDisplay.length; i++) {
            out += `  ${respDisplay[i]}\n`;
        }
        if (respLines.length > 3) {
            out += `  ${tag.dim('...')}\n`;
        }

        // Metadata line
        out += `  ${tag.dim(`${lenStr} chars ${icons.dot} ${duration}`)}\n\n`;

        return out;
    }

    wrapText(text, width) {
        if (!text) return [''];
        // Replace newlines with spaces for wrapping
        const clean = String(text).replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
        const lines = [];
        let remaining = clean;
        while (remaining.length > 0) {
            if (remaining.length <= width) {
                lines.push(remaining);
                break;
            }
            // Find a good break point
            let breakAt = remaining.lastIndexOf(' ', width);
            if (breakAt <= 0) breakAt = width;
            lines.push(remaining.substring(0, breakAt));
            remaining = remaining.substring(breakAt).trimStart();
        }
        return lines;
    }
}

module.exports = { LLMActivityComponent };
