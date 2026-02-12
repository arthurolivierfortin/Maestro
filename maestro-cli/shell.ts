/**
 * Maestro Interactive Shell
 *
 * A REPL-style interactive CLI for Maestro.
 * Launch with: maestro (no arguments)
 */

import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import * as c from '../shared/utils/cli-colors.js';

type ExecCommandFn = (args: string[]) => Promise<void>;

// Commands that accept a session ID as context
const SESSION_SUBCOMMANDS = [
    'info', 'start', 'pause', 'resume', 'stop', 'exec', 'events', 'delete',
    'vars', 'variables', 'entry-points', 'endpoints', 'invoke', 'widgets',
    'bind-repo', 'take-control', 'diff', 'test', 'commit', 'cancel', 'import'
];

// All known top-level commands for tab completion
const TOP_COMMANDS = [
    'help', 'exit', 'clear', 'use', 'unuse', 'context', 'monitor',
    'health', 'blocks', 'workflows', 'sessions', 'session', 'templates',
    'projects', 'workspace', 'foundry', 'training', 'fitness', 'metrics',
    'agents', 'tools', 'test', 'llm', 'system', 'orchestrator',
    'experiment', 'research', 'approval', 'execute', 'run', 'search', 'info'
];

const SESSION_SUB = [
    'list', 'info', 'create', 'start', 'pause', 'resume', 'stop', 'delete',
    'delete-all', 'import', 'vars', 'entry-points', 'invoke', 'widgets',
    'exec', 'events', 'bind-repo', 'take-control', 'last'
];

class MaestroShell {
    execCommand: ExecCommandFn;
    rl: readline.Interface | null;
    sessionContext: string | null;
    historyFile: string;
    multiLineBuffer: string;
    inMultiLine: boolean;

    constructor(execCommand: ExecCommandFn) {
        this.execCommand = execCommand;
        this.rl = null;
        this.sessionContext = null;
        this.historyFile = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.maestro_history');
        this.multiLineBuffer = '';
        this.inMultiLine = false;
    }

    /**
     * Load history from file.
     */
    loadHistory(): string[] {
        try {
            if (fs.existsSync(this.historyFile)) {
                const content = fs.readFileSync(this.historyFile, 'utf8');
                return content.split('\n').filter(Boolean).slice(-100);
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    /**
     * Save a line to history file.
     */
    saveHistory(line: string): void {
        try {
            fs.appendFileSync(this.historyFile, line + '\n');
        } catch (e) { /* ignore */ }
    }

    /**
     * Tab completion handler.
     */
    completer(line: string): [string[], string] {
        const parts = line.trim().split(/\s+/);
        const current = parts[parts.length - 1] || '';

        if (parts.length <= 1) {
            // Complete top-level commands
            const hits = TOP_COMMANDS.filter(cmd => cmd.startsWith(current));
            return [hits.length ? hits : TOP_COMMANDS, current];
        }

        if (parts[0] === 'session' && parts.length === 2) {
            const hits = SESSION_SUB.filter(cmd => cmd.startsWith(current));
            return [hits.length ? hits : SESSION_SUB, current];
        }

        return [[], current];
    }

    /**
     * Prints the welcome banner.
     */
    printBanner(): void {
        const b = c.cyan;
        const l = (s: string) => c.boldColor('cyan', s);

        console.log('\n');
        console.log(b('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'));
        console.log(b('  \u2551') + '                                                               ' + b('\u2551'));
        console.log(b('  \u2551') + '   ' + l('\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557') + b('\u2551'));
        console.log(b('  \u2551') + '   ' + l('\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557') + b('\u2551'));
        console.log(b('  \u2551') + '   ' + l('\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551   \u2588\u2588\u2551') + b('\u2551'));
        console.log(b('  \u2551') + '   ' + l('\u2588\u2588\u2551\u255a\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551') + b('\u2551'));
        console.log(b('  \u2551') + '   ' + l('\u2588\u2588\u2551 \u255a\u2550\u255d \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d') + b('\u2551'));
        console.log(b('  \u2551') + '   ' + l('\u255a\u2550\u255d     \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d') + b('\u2551'));
        console.log(b('  \u2551') + '                                                               ' + b('\u2551'));
        console.log(b('  \u2551') + c.dim('              Orchestration Framework for AI Agents            ') + b('\u2551'));
        console.log(b('  \u2551') + '                                                               ' + b('\u2551'));
        console.log(b('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d'));
        console.log('\n');
        console.log('  Type ' + c.cyan('"help"') + ' for commands, ' + c.cyan('"exit"') + ' to quit.');
        console.log('  Tab completion available. History persisted across sessions.\n');
    }

    /**
     * Returns the command prompt string.
     */
    getPrompt(): string {
        if (this.inMultiLine) {
            return c.gray('  ... ');
        }
        if (this.sessionContext) {
            return c.cyan('maestro') + c.gray(' [') + c.yellow(this.sessionContext.substring(0, 8)) + c.gray(']') + c.cyan('> ');
        }
        return c.cyan('maestro> ');
    }

    /**
     * Parses a command line into arguments, respecting quotes.
     * Supports @file syntax for JSON input from file.
     */
    parseArgs(line: string): string[] {
        const args: string[] = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (inQuote) {
                if (char === quoteChar) {
                    inQuote = false;
                } else {
                    current += char;
                }
            } else {
                if (char === '"' || char === "'") {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === ' ' || char === '\t') {
                    if (current) {
                        args.push(current);
                        current = '';
                    }
                } else {
                    current += char;
                }
            }
        }

        if (current) {
            args.push(current);
        }

        // P3-28: Support @file syntax for reading JSON from file
        return args.map(arg => {
            if (arg.startsWith('@') && arg.length > 1) {
                const filePath = arg.substring(1);
                try {
                    return fs.readFileSync(filePath, 'utf8').trim();
                } catch (e) {
                    return arg; // Return original if file not found
                }
            }
            return arg;
        });
    }

    /**
     * Handles shell-specific commands.
     * Returns true if the command was handled, false otherwise.
     */
    handleShellCommand(line: string): boolean {
        const trimmed = line.trim().toLowerCase();

        if (trimmed === 'exit' || trimmed === 'quit' || trimmed === 'q') {
            console.log('\n' + c.dim('Goodbye!') + '\n');
            process.exit(0);
        }

        if (trimmed === 'clear' || trimmed === 'cls') {
            console.clear();
            return true;
        }

        if (trimmed === 'help' || trimmed === '?') {
            this.printHelp();
            return true;
        }

        // P3-29: Monitor from shell
        if (trimmed === 'monitor' || trimmed.startsWith('monitor ')) {
            // Pass through to main command handler (handled by executeWithArgv)
            return false;
        }

        if (trimmed.startsWith('use ')) {
            const sessionId = trimmed.substring(4).trim();
            if (sessionId) {
                this.sessionContext = sessionId;
                console.log(`\n  Session context: ${c.yellow(sessionId)}`);
                console.log(`  ${c.dim('All session commands will target this session.')}\n`);
            }
            return true;
        }

        if (trimmed === 'use' || trimmed === 'context') {
            if (this.sessionContext) {
                console.log(`\n  Current context: ${c.yellow(this.sessionContext)}\n`);
            } else {
                console.log(`\n  ${c.gray('No session context. Use "use <session-id>" to set one.')}\n`);
            }
            return true;
        }

        if (trimmed === 'unuse' || trimmed === 'clear-context') {
            this.sessionContext = null;
            console.log(`\n  ${c.dim('Session context cleared.')}\n`);
            return true;
        }

        return false;
    }

    /**
     * Prints help information.
     */
    printHelp(): void {
        console.log(`
${c.boldColor('cyan', 'Shell Commands')}
  ${c.green('help')}             Show this help
  ${c.green('exit')}             Exit the shell
  ${c.green('clear')}            Clear screen
  ${c.green('use <id>')}         Set session context (accepts ID prefix)
  ${c.green('unuse')}            Clear session context
  ${c.green('monitor')}          Launch monitor for current session

${c.boldColor('cyan', 'Quick Commands')}
  ${c.green('health')}           Check backend status
  ${c.green('sessions')}         List sessions
  ${c.green('session last')}     Show most recent session
  ${c.green('templates')}        List available templates
  ${c.green('blocks')}           List blocks

${c.boldColor('cyan', 'Session Commands')} ${c.gray('(use "session --help" for full list)')}
  ${c.green('session create --project <id> --template <name> --start')}
  ${c.green('session info <id>')}
  ${c.green('session invoke <id> start')}
  ${c.green('session vars <id> list')}

${c.boldColor('cyan', 'Tips')}
  ${c.dim('- Run any maestro command without the "maestro" prefix')}
  ${c.dim('- Use ID prefixes: "session info f2e8" instead of full UUID')}
  ${c.dim('- @file syntax: "session vars set <id> key @data.json"')}
  ${c.dim('- Tab completes commands, Up/Down navigates history')}
`);
    }

    /**
     * Executes a maestro command with session context injection.
     */
    async executeCommand(line: string): Promise<void> {
        const trimmed = line.trim();
        if (!trimmed) return;

        // P3-28: Multi-line JSON input detection
        // If line ends with open brace/bracket without closing, accumulate
        if (this.inMultiLine) {
            this.multiLineBuffer += '\n' + trimmed;
            // Simple check: count braces/brackets
            const opens = (this.multiLineBuffer.match(/[{[]/g) || []).length;
            const closes = (this.multiLineBuffer.match(/[}\]]/g) || []).length;
            if (closes >= opens) {
                this.inMultiLine = false;
                const fullLine = this.multiLineBuffer;
                this.multiLineBuffer = '';
                return this.executeCommand(fullLine);
            }
            return;
        }

        // Check if line has unbalanced JSON
        if (trimmed.includes('{') || trimmed.includes('[')) {
            const opens = (trimmed.match(/[{[]/g) || []).length;
            const closes = (trimmed.match(/[}\]]/g) || []).length;
            if (opens > closes) {
                this.inMultiLine = true;
                this.multiLineBuffer = trimmed;
                return;
            }
        }

        if (this.handleShellCommand(trimmed)) {
            return;
        }

        const args = this.parseArgs(trimmed);
        if (args.length === 0) return;

        try {
            // P1-15: Inject session context for ALL session subcommands, not just exec
            if (this.sessionContext) {
                if (args[0] === 'session' && args.length >= 2 && SESSION_SUBCOMMANDS.includes(args[1])) {
                    // session <subcmd> → session <subcmd> <contextId>
                    // Only inject if no ID is already provided (args[2] would be the ID)
                    if (args.length === 2 || (args.length > 2 && args[2].startsWith('--'))) {
                        args.splice(2, 0, this.sessionContext);
                    }
                } else if (SESSION_SUBCOMMANDS.includes(args[0])) {
                    // Bare subcommand like "vars list" → "session vars <contextId> list"
                    args.unshift('session');
                    args.splice(2, 0, this.sessionContext);
                } else if (args[0] === 'monitor' && args.length === 1) {
                    // P3-29: "monitor" uses current session context
                    args.push(this.sessionContext);
                } else if (args[0] === 'exec') {
                    args.unshift('session');
                    args.splice(2, 0, this.sessionContext);
                }
            }

            await this.execCommand(args);
        } catch (error: unknown) {
            console.error(c.fail((error as Error).message));
        }
    }

    /**
     * Starts the interactive shell.
     */
    async start(): Promise<void> {
        this.printBanner();

        // P2-19: Load persisted history
        const history = this.loadHistory();

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 200,
            terminal: true,
            // P2-18: Tab completion
            completer: (line: string) => this.completer(line)
        });

        // Pre-populate history (readline doesn't support this natively,
        // but we can write to the internal history array)
        if ((this.rl as any).history && history.length > 0) {
            (this.rl as any).history.push(...history.reverse());
        }

        this.rl.prompt();

        this.rl.on('line', async (line: string) => {
            try {
                const trimmed = line.trim();
                if (trimmed) {
                    this.saveHistory(trimmed);
                }
                await this.executeCommand(line);
            } catch (error: unknown) {
                console.error(c.fail((error as Error).message));
            }
            this.rl!.setPrompt(this.getPrompt());
            this.rl!.prompt();
        });

        this.rl.on('close', () => {
            console.log('\n' + c.dim('Goodbye!') + '\n');
            process.exit(0);
        });

        this.rl.on('SIGINT', () => {
            if (this.inMultiLine) {
                this.inMultiLine = false;
                this.multiLineBuffer = '';
                console.log('\n  ' + c.yellow('Multi-line input cancelled.'));
            } else {
                console.log('\n  ' + c.yellow('Use "exit" to leave the shell.'));
            }
            this.rl!.setPrompt(this.getPrompt());
            this.rl!.prompt();
        });
    }
}

module.exports = { MaestroShell };
export { MaestroShell };
