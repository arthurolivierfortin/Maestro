/**
 * Artifacts Component
 * Displays files produced by the session
 *
 * Data source: session.variables._artifacts (array)
 * Each artifact: { name, type, size?, status? }
 * Status: new, updated, deleted
 */

const { colors, tag, icons } = require('./colors');

class ArtifactsComponent {
    constructor(box) {
        this.box = box;
    }

    render(session, context = {}) {
        const artifacts = context.artifacts || session.variables?._artifacts || [];

        let content = `${tag.label('ARTIFACTS')}\n\n`;

        if (!Array.isArray(artifacts) || artifacts.length === 0) {
            content += tag.dim('  (no artifacts yet)');
            this.box.setContent(content);
            return;
        }

        for (const artifact of artifacts) {
            content += this.renderArtifact(artifact);
        }

        this.box.setContent(content);
    }

    renderArtifact(artifact) {
        const status = (artifact.status || 'new').toLowerCase();
        const icon = status === 'updated' ? icons.done :
                     status === 'new' ? '+' :
                     status === 'deleted' ? icons.failed : icons.dot;
        const color = status === 'updated' ? 'green' :
                      status === 'new' ? 'cyan' :
                      status === 'deleted' ? 'red' : 'gray';

        const typeTag = artifact.type ? `{gray-fg}[${artifact.type}]{/gray-fg}` : '';
        const sizeTag = artifact.size ? `${tag.dim(artifact.size)}` : '';

        return `  {${color}-fg}${icon}{/${color}-fg} ${artifact.name}  ${typeTag}  ${sizeTag}  {${color}-fg}${status}{/${color}-fg}\n`;
    }
}

module.exports = { ArtifactsComponent };
