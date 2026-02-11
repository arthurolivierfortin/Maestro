/**
 * Maestro Interactive Shell
 *
 * A REPL-style interactive CLI for Maestro.
 * Launch with: maestro (no arguments)
 */

import * as readline from 'readline';
import * as path from 'path';

type ExecCommandFn = (args: string[]) => Promise<void>;

class MaestroShell {
    execCommand: ExecCommandFn;
    rl: readline.Interface | null;
    sessionContext: string | null;
    historyFile: string;

    constructor(execCommand: ExecCommandFn) {
        this.execCommand = execCommand;
        this.rl = null;
        this.sessionContext = null;
        this.historyFile = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.maestro_history');
    }

    /**
     * Prints the welcome banner.
     */
    printBanner(): void {
        console.log('\n');
        console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
        console.log('  \u2551                                                               \u2551');
        console.log('  \u2551   \u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2551');
        console.log('  \u2551   \u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557');
        console.log('  \u2551   \u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551   \u2588\u2588\u2551');
        console.log('  \u2551   \u2588\u2588\u2551\u255a\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551');
        console.log('  \u2551   \u2588\u2588\u2551 \u255a\u2550\u255d \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d');
        console.log('  \u2551   \u255a\u2550\u255d     \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d\u2551');
        console.log('  \u2551                                                               \u2551');
        console.log('  \u2551              Orchestration Framework for AI Agents            \u2551');
        console.log('  \u2551                                                               \u2551');
        console.log('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
        console.log('\n');
        console.log('  Type "help" for available commands, "exit" to quit.\n');
    }

    /**
     * Returns the command prompt string.
     */
    getPrompt(): string {
        if (this.sessionContext) {
            return `maestro [${this.sessionContext.substring(0, 8)}]> `;
        }
        return 'maestro> ';
    }

    /**
     * Parses a command line into arguments, respecting quotes.
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

        return args;
    }

    /**
     * Handles shell-specific commands.
     * Returns true if the command was handled, false otherwise.
     */
    handleShellCommand(line: string): boolean {
        const trimmed = line.trim().toLowerCase();

        if (trimmed === 'exit' || trimmed === 'quit' || trimmed === 'q') {
            console.log('\nGoodbye!\n');
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

        if (trimmed.startsWith('use ')) {
            const sessionId = trimmed.substring(4).trim();
            if (sessionId) {
                this.sessionContext = sessionId;
                console.log(`\n  Session context set to: ${sessionId}`);
                console.log('  Commands will now target this session.\n');
            }
            return true;
        }

        if (trimmed === 'use' || trimmed === 'context') {
            if (this.sessionContext) {
                console.log(`\n  Current session context: ${this.sessionContext}\n`);
            } else {
                console.log('\n  No session context set. Use "use <session-id>" to set one.\n');
            }
            return true;
        }

        if (trimmed === 'unuse' || trimmed === 'clear-context') {
            this.sessionContext = null;
            console.log('\n  Session context cleared.\n');
            return true;
        }

        return false;
    }

    /**
     * Prints help information.
     */
    printHelp(): void {
        console.log(`
  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
  \u2551                    MAESTRO SHELL COMMANDS                     \u2551
  \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
  \u2551                                                               \u2551
  \u2551  Shell Commands:                                              \u2551
  \u2551    help, ?          Show this help message                    \u2551
  \u2551    exit, quit, q    Exit the shell                           \u2551
  \u2551    clear, cls       Clear the screen                         \u2551
  \u2551    use <id>         Set session context                      \u2551
  \u2551    unuse            Clear session context                    \u2551
  \u2551    context          Show current session context             \u2551
  \u2551                                                               \u2551
  \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
  \u2551                                                               \u2551
  \u2551  Common Commands:                                             \u2551
  \u2551    health           Check backend connectivity               \u2551
  \u2551    blocks           List all blocks                          \u2551
  \u2551    workflows        List all workflows                       \u2551
  \u2551    sessions         List all sessions                        \u2551
  \u2551    workspaces       List all workspaces                      \u2551
  \u2551    foundry          List foundry sessions                    \u2551
  \u2551                                                               \u2551
  \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
  \u2551                                                               \u2551
  \u2551  Session Management:                                          \u2551
  \u2551    session create --project <id>    Create new session       \u2551
  \u2551    session info <id>                Get session details      \u2551
  \u2551    session start <id>               Start a session          \u2551
  \u2551    session stop <id>                Stop a session           \u2551
  \u2551    session vars <id> list           List session variables   \u2551
  \u2551    session vars <id> set <k> <v>    Set session variable     \u2551
  \u2551    session vars <id> get <k>        Get session variable     \u2551
  \u2551                                                               \u2551
  \u2551  Monitor:                                                     \u2551
  \u2551    monitor <id>                     Monitor a session        \u2551
  \u2551                                                               \u2551
  \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
  \u2551                                                               \u2551
  \u2551  Tip: Run any maestro command without the "maestro" prefix   \u2551
  \u2551  For full command reference: maestro --help                   \u2551
  \u2551                                                               \u2551
  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d
`);
    }

    /**
     * Executes a maestro command.
     */
    async executeCommand(line: string): Promise<void> {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (this.handleShellCommand(trimmed)) {
            return;
        }

        const args = this.parseArgs(trimmed);
        if (args.length === 0) return;

        try {
            if (this.sessionContext && args[0] === 'exec') {
                args.unshift('session');
                args.splice(2, 0, this.sessionContext);
            }

            await this.execCommand(args);
        } catch (error: unknown) {
            console.error(`Error: ${(error as Error).message}`);
        }
    }

    /**
     * Starts the interactive shell.
     */
    async start(): Promise<void> {
        this.printBanner();

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 100,
            terminal: true
        });

        this.rl.prompt();

        this.rl.on('line', async (line: string) => {
            try {
                await this.executeCommand(line);
            } catch (error: unknown) {
                console.error(`Error: ${(error as Error).message}`);
            }
            this.rl!.setPrompt(this.getPrompt());
            this.rl!.prompt();
        });

        this.rl.on('close', () => {
            console.log('\nGoodbye!\n');
            process.exit(0);
        });

        this.rl.on('SIGINT', () => {
            console.log('\n  Use "exit" or "quit" to leave the shell.\n');
            this.rl!.prompt();
        });
    }
}

module.exports = { MaestroShell };
export { MaestroShell };
