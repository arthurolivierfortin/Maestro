// @ts-nocheck
/**
 * Provider detection helpers for `maestro code`.
 *
 * Provides Claude CLI detection, auth status checking, and the shared
 * PROVIDERS list used by both init-wizard and the TUI ProviderSetupScreen.
 */
const { execSync, spawnSync, spawn } = require('child_process');

// ── Claude CLI helpers ────────────────────────────────────────

/**
 * Find the `claude` binary on PATH. Returns the full path or null.
 * Shared between provider-detect and init-wizard.
 */
export function findClaudeCli(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    // `where` on Windows may return multiple lines
    return result.split('\n')[0].trim();
  } catch {
    return null;
  }
}

/**
 * Check Claude CLI authentication status.
 * Returns { loggedIn, email } or { loggedIn: false } on failure.
 */
export async function getClaudeAuthStatus(cliPath: string): Promise<{ loggedIn: boolean; email?: string }> {
  try {
    const result = spawnSync(cliPath, ['auth', 'status'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10_000,
      env: { ...process.env, CLAUDECODE: undefined },
    });

    if (result.status === 0 && result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout.trim());
        // Claude CLI auth status JSON: { "authenticated": true, "account": "..." }
        if (parsed.authenticated || parsed.loggedIn) {
          return { loggedIn: true, email: parsed.account || parsed.email };
        }
      } catch {
        // If it printed something but wasn't JSON, check for known text patterns
        if (result.stdout.includes('Logged in') || result.stdout.includes('authenticated')) {
          return { loggedIn: true };
        }
      }
    }

    // Also check stderr — some versions print status there
    if (result.stderr && (result.stderr.includes('Logged in') || result.stderr.includes('authenticated'))) {
      return { loggedIn: true };
    }

    return { loggedIn: false };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Run `claude login` interactively (opens browser).
 * Returns true if subsequent auth check shows loggedIn.
 */
export async function runClaudeLogin(cliPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('');
    console.log('  Opening browser for Claude login...');
    console.log('  Complete the login in your browser, then return here.');
    console.log('');

    const child = spawn(cliPath, ['login'], {
      stdio: 'inherit', // Interactive — user sees the browser prompt
      env: { ...process.env, CLAUDECODE: undefined },
    });

    child.on('close', async (code) => {
      if (code === 0) {
        // Verify login actually worked
        const status = await getClaudeAuthStatus(cliPath);
        resolve(status.loggedIn);
      } else {
        resolve(false);
      }
    });

    child.on('error', () => resolve(false));
  });
}

// ── Provider list (shared with TUI ProviderSetupScreen) ──────

export const PROVIDERS = [
  { key: '1', id: 'claudeCode',      label: 'Claude Code (CLI)',              desc: 'Uses the Claude CLI on your machine (requires claude login)' },
  { key: '2', id: 'azure',           label: 'Azure OpenAI',                   desc: 'Azure-hosted OpenAI models (endpoint + API key + deployment)' },
  { key: '3', id: 'azureInference',  label: 'Azure AI Inference / GitHub Models', desc: 'Azure AI or GitHub Models (endpoint + API key)' },
  { key: '4', id: 'local',           label: 'Local (Python FastAPI)',         desc: 'Local GPU inference server (localhost:8000)' },
];

// Note: Interactive provider setup is handled by the TUI (ProviderSetupScreen).
// The ensureProviders() readline flow was removed — the TUI handles first-run setup.
