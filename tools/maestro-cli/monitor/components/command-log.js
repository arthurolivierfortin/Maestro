/**
 * Command Log Component
 * Displays history of commands executed on the session
 */

const { colors, tag, icons } = require('./colors');

class CommandLogComponent {
    constructor(box) {
        this.box = box;
        this.maxCommands = 20;
    }

    render(session, context = {}) {
        const commandLog = session.variables?._commandLog || [];

        let content = `${tag.label('COMMAND LOG')}\n\n`;

        if (commandLog.length === 0) {
            content += tag.dim('  (no commands executed yet)\n\n');
            content += tag.dim(`  execute: maestro session vars <id> set <key> <value>\n`);
            content += tag.dim(`  invoke:  maestro session invoke <id> <entry-point>`);
            this.box.setContent(content);
            return;
        }

        // Show commands in reverse chronological order (newest first)
        const commands = [...commandLog].reverse().slice(0, this.maxCommands);

        for (const cmd of commands) {
            content += this.renderCommand(cmd);
        }

        this.box.setContent(content);
    }

    renderCommand(cmd) {
        const time = cmd.timestamp ? this.formatTime(cmd.timestamp) : '';
        const status = cmd.status || 'completed';

        const statusIcon = status === 'completed' ? icons.done :
                          status === 'failed' ? icons.failed :
                          icons.running;

        const statusColor = status === 'completed' ? colors.status.success :
                           status === 'failed' ? colors.status.error :
                           colors.status.running;

        let output = `  {${statusColor}-fg}${statusIcon}{/} ${tag.dim(time)}  ${tag.primary(cmd.command || 'command')}\n`;

        if (cmd.result) {
            const resultStr = typeof cmd.result === 'string' ? cmd.result : JSON.stringify(cmd.result);
            const truncated = resultStr.length > 60 ? resultStr.substring(0, 57) + '...' : resultStr;
            output += `     ${tag.success(icons.arrow)} ${tag.muted(truncated)}\n`;
        }

        output += '\n';

        return output;
    }

    formatTime(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', {
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

module.exports = { CommandLogComponent };
