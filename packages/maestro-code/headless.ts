// @ts-nocheck
/**
 * Maestro Headless Mode — Non-interactive session runner (Phase 33-B)
 *
 * Runs maestro code without Ink/TTY. Reads tasks from stdin or argv,
 * outputs structured progress to stdout. Useful for CI, scripting,
 * and testing from non-TTY environments like Claude Code.
 *
 * Output format (line-oriented, parseable):
 *   [HH:MM:SS] [LEVEL] message
 *   [HH:MM:SS] [NODE]  ▶ name (running)
 *   [HH:MM:SS] [NODE]  ✓ name (completed)
 *   [HH:MM:SS] [DONE]  Task completed
 *   [HH:MM:SS] [SUMRY] Duration: 2m 34s
 */

interface HeadlessOptions {
  apiClient: any;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  task?: string;
  importSessionTemplate: (sessionId: string, templateName: string, options?: { quiet?: boolean }) => Promise<void>;
}

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

function log(level: string, msg: string) {
  console.log(`[${ts()}] [${level.padEnd(5)}] ${msg}`);
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

async function runHeadless(options: HeadlessOptions): Promise<void> {
  const path = require('path');
  const client = options.apiClient;
  const repoPath = options.repoPath || process.cwd();
  const template = options.template || 'project-autonomous';
  const entryPoint = options.entryPoint || 'dev';

  // Get task from argv or read from stdin
  let task = options.task;
  if (!task) {
    // Read a single line from stdin
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin });
    log('INFO', 'Enter task (one line):');
    task = await new Promise<string>((resolve) => {
      rl.once('line', (line: string) => {
        rl.close();
        resolve(line.trim());
      });
      // If stdin is piped and empty, timeout after 5s
      setTimeout(() => {
        rl.close();
        resolve('');
      }, 5000);
    });
  }

  if (!task) {
    log('ERROR', 'No task provided. Use: maestro code --headless --task "description"');
    process.exit(1);
  }

  log('INFO', `Task: ${task}`);
  log('INFO', `Repo: ${repoPath}`);
  log('INFO', `Template: ${template}`);
  log('INFO', `Entry: ${entryPoint}`);
  console.log('');

  const startTime = Date.now();

  try {
    // 1. Create session
    log('INFO', 'Creating session...');
    const session = await client.createSession({
      repositoryPath: repoPath,
      authority: 'human',
      name: `${path.basename(repoPath)} - ${task.slice(0, 60)}`,
    });
    log('INFO', `Session: ${session.id}`);

    // 2. Import template (quiet — no console.log pollution)
    log('INFO', `Importing template: ${template}`);
    await options.importSessionTemplate(session.id, template, { quiet: true });
    log('INFO', 'Template imported');

    // 3. Start session
    await client.startSession(session.id);
    log('INFO', 'Session started');

    // 4. Invoke entry point
    log('INFO', `Invoking: ${entryPoint}`);
    await client._fetch('POST', `/api/sessions/${session.id}/invoke/${entryPoint}`, {
      body: { inputs: { repoPath, task } }
    });

    // 5. Poll for completion
    log('INFO', 'Waiting for execution...');
    console.log('');

    let lastLogCount = 0;
    // Track per-node status to show only transitions (delta)
    const nodeStatuses = new Map<string, string>();
    let done = false;
    let spinnerCount = 0;

    while (!done) {
      await new Promise(r => setTimeout(r, 2000));
      spinnerCount++;

      try {
        const sess = await client.getSession(session.id);
        const vars = sess.variables || {};

        // New log entries
        const execLog: any[] = vars._executionLog || [];
        if (execLog.length > lastLogCount) {
          for (const entry of execLog.slice(lastLogCount)) {
            const level = (entry.level || 'info').toUpperCase();
            log(level, entry.msg || entry.message || JSON.stringify(entry));
          }
          lastLogCount = execLog.length;
        }

        // Execution tree changes — only show TRANSITIONS
        const tree: any[] = vars._executionTree || [];
        for (const node of tree) {
          const prevStatus = nodeStatuses.get(node.name);
          if (prevStatus !== node.status) {
            nodeStatuses.set(node.name, node.status);
            if (node.status === 'running') {
              log('NODE', `\u25B6 ${node.name}`);
            } else if (node.status === 'completed') {
              log('NODE', `\u2713 ${node.name}`);
            } else if (node.status === 'error') {
              log('NODE', `\u2717 ${node.name}: ${node.error || 'failed'}`);
            } else if (node.status === 'skipped') {
              log('NODE', `\u2014 ${node.name} (skipped)`);
            }
          }
        }

        // Spinner dots while waiting (every 5s = every ~2.5 polls)
        if (nodeStatuses.size === 0 && spinnerCount % 3 === 0) {
          log('INFO', 'Waiting for first response...');
        }

        // Check completion
        const status = sess.status || sess.containerStatus;
        const allDone = tree.length > 0 && tree.every(
          (n: any) => n.status === 'completed' || n.status === 'error' || n.status === 'skipped'
        );

        if (allDone || status === 'completed' || status === 'idle') {
          done = true;
          console.log('');

          const hasErrors = tree.some((n: any) => n.status === 'error');
          if (hasErrors) {
            log('DONE', 'Task completed with errors');
          } else if (tree.length > 0) {
            log('DONE', 'Task completed successfully');
          } else {
            log('DONE', 'Session idle (no execution tree)');
          }

          // Final summary
          const duration = Date.now() - startTime;
          const completedCount = tree.filter((n: any) => n.status === 'completed').length;
          const errorCount = tree.filter((n: any) => n.status === 'error').length;
          const skippedCount = tree.filter((n: any) => n.status === 'skipped').length;

          log('SUMRY', `Duration: ${formatDuration(duration)}`);
          log('SUMRY', `Nodes: ${completedCount} completed${errorCount ? `, ${errorCount} errors` : ''}${skippedCount ? `, ${skippedCount} skipped` : ''}`);
          log('SUMRY', `Session: ${session.id}`);
        }
      } catch (pollErr: any) {
        // Non-fatal poll error
        log('WARN', `Poll error: ${pollErr.message || pollErr}`);
      }
    }

  } catch (err: any) {
    log('ERROR', err.message || String(err));
    process.exit(1);
  }
}

export { runHeadless };
export type { HeadlessOptions };
