#!/usr/bin/env node
/**
 * Maestro Interactive Shell
 *
 * A REPL-style interactive CLI for Maestro.
 * Launch with: maestro (no arguments)
 */

const readline = require('readline');
const path = require('path');

class MaestroShell {
    constructor(execCommand) {
        this.execCommand = execCommand;
        this.rl = null;
        this.sessionContext = null; // Currently active session ID
        this.historyFile = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.maestro_history');
    }

    /**
     * Prints the welcome banner.
     */
    printBanner() {
        console.log('\n');
        console.log('  ╔═══════════════════════════════════════════════════════════════╗');
        console.log('  ║                                                               ║');
        console.log('  ║   ███╗   ███╗ █████╗ ███████╗███████╗████████╗██████╗  ██████╗║');
        console.log('  ║   ████╗ ████║██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗');
        console.log('  ║   ██╔████╔██║███████║█████╗  ███████╗   ██║   ██████╔╝██║   ██║');
        console.log('  ║   ██║╚██╔╝██║██╔══██║██╔══╝  ╚════██║   ██║   ██╔══██╗██║   ██║');
        console.log('  ║   ██║ ╚═╝ ██║██║  ██║███████╗███████║   ██║   ██║  ██║╚██████╔╝');
        console.log('  ║   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝║');
        console.log('  ║                                                               ║');
        console.log('  ║              Orchestration Framework for AI Agents            ║');
        console.log('  ║                                                               ║');
        console.log('  ╚═══════════════════════════════════════════════════════════════╝');
        console.log('\n');
        console.log('  Type "help" for available commands, "exit" to quit.\n');
    }

    /**
     * Returns the command prompt string.
     */
    getPrompt() {
        if (this.sessionContext) {
            return `maestro [${this.sessionContext.substring(0, 8)}]> `;
        }
        return 'maestro> ';
    }

    /**
     * Parses a command line into arguments, respecting quotes.
     */
    parseArgs(line) {
        const args = [];
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
    handleShellCommand(line) {
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
            // Set session context
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
    printHelp() {
        console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                    MAESTRO SHELL COMMANDS                     ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  Shell Commands:                                              ║
  ║    help, ?          Show this help message                    ║
  ║    exit, quit, q    Exit the shell                           ║
  ║    clear, cls       Clear the screen                         ║
  ║    use <id>         Set session context                      ║
  ║    unuse            Clear session context                    ║
  ║    context          Show current session context             ║
  ║                                                               ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  Common Commands:                                             ║
  ║    health           Check backend connectivity               ║
  ║    blocks           List all blocks                          ║
  ║    workflows        List all workflows                       ║
  ║    sessions         List all sessions                        ║
  ║    workspaces       List all workspaces                      ║
  ║    foundry          List foundry sessions                    ║
  ║                                                               ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  Session Management:                                          ║
  ║    session create --project <id>    Create new session       ║
  ║    session info <id>                Get session details      ║
  ║    session start <id>               Start a session          ║
  ║    session stop <id>                Stop a session           ║
  ║    session vars <id> list           List session variables   ║
  ║    session vars <id> set <k> <v>    Set session variable     ║
  ║    session vars <id> get <k>        Get session variable     ║
  ║                                                               ║
  ║  Monitor:                                                     ║
  ║    monitor <id>                     Monitor a session        ║
  ║                                                               ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  Tip: Run any maestro command without the "maestro" prefix   ║
  ║  For full command reference: maestro --help                   ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
`);
    }

    /**
     * Executes a maestro command.
     */
    async executeCommand(line) {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Handle shell-specific commands
        if (this.handleShellCommand(trimmed)) {
            return;
        }

        // Parse the command line
        const args = this.parseArgs(trimmed);
        if (args.length === 0) return;

        try {
            // If we have a session context and the command is exec, inject the session ID
            if (this.sessionContext && args[0] === 'exec') {
                // Transform "exec <cmd>" to "session exec <session-id> <cmd>"
                args.unshift('session');
                args.splice(2, 0, this.sessionContext);
            }

            // Execute through the main CLI command handler
            await this.execCommand(args);
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }

    /**
     * Starts the interactive shell.
     */
    async start() {
        this.printBanner();

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 100,
            terminal: true
        });

        this.rl.prompt();

        this.rl.on('line', async (line) => {
            try {
                await this.executeCommand(line);
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
            // Update prompt (may have changed due to session context)
            this.rl.setPrompt(this.getPrompt());
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log('\nGoodbye!\n');
            process.exit(0);
        });

        // Handle SIGINT (Ctrl+C)
        this.rl.on('SIGINT', () => {
            console.log('\n  Use "exit" or "quit" to leave the shell.\n');
            this.rl.prompt();
        });
    }
}

module.exports = { MaestroShell };
