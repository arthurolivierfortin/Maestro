// @ts-nocheck
/**
 * Interactive onboarding wizard for `maestro init`.
 * Configures LLM providers and saves to ~/.maestro/config.json.
 *
 * Uses shared helpers from provider-detect.ts for Claude CLI detection/auth.
 */
const readline = require('readline');
const path = require('path');
const { readConfig, writeConfig, getProviderEnvVars, getConfigPath, hasConfiguredProviders } = require('./config.ts');
const { findClaudeCli, getClaudeAuthStatus, runClaudeLogin } = require('./provider-detect.ts');

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

function printBanner() {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║       Welcome to Maestro!            ║');
  console.log('  ║   Let\'s configure your LLM providers ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
}

const PROVIDERS = [
  { key: '1', id: 'claudeCode',      label: 'Claude Code (CLI)',              desc: 'Uses the Claude CLI installed on your machine' },
  { key: '2', id: 'azure',           label: 'Azure OpenAI',                   desc: 'Azure-hosted OpenAI models (endpoint + API key + deployment)' },
  { key: '3', id: 'azureInference',  label: 'Azure AI Inference / GitHub Models', desc: 'Azure AI or GitHub Models (endpoint + API key)' },
  { key: '4', id: 'local',           label: 'Local (Python FastAPI)',         desc: 'Local GPU inference server' },
];

async function pickProviders(rl): Promise<string[]> {
  console.log('  Which LLM providers do you want to configure?');
  console.log('  (Enter numbers separated by commas for multiple, e.g. "1,2")\n');

  for (const p of PROVIDERS) {
    console.log(`    [${p.key}] ${p.label}`);
    console.log(`        ${p.desc}`);
  }
  console.log('');

  while (true) {
    const choice = await ask(rl, '  Enter choice (1-4): ');
    const keys = choice.split(',').map(s => s.trim()).filter(Boolean);
    const matched = keys.map(k => PROVIDERS.find(p => p.key === k)).filter(Boolean);

    if (matched.length > 0) {
      return matched.map(m => m.id);
    }
    console.log('  Invalid choice. Enter 1-4, separated by commas for multiple.');
  }
}

async function configureAzure(rl) {
  console.log('\n  -- Azure OpenAI Configuration --\n');

  const endpoint = await ask(rl, '  Azure endpoint URL (e.g. https://my-resource.openai.azure.com): ');
  if (!endpoint) { console.log('  Endpoint is required.'); return null; }

  const apiKey = await ask(rl, '  API Key: ');
  if (!apiKey) { console.log('  API Key is required.'); return null; }

  const deployment = await ask(rl, '  Default deployment name (e.g. gpt-4o): ');
  if (!deployment) { console.log('  Deployment name is required.'); return null; }

  return { endpoint, apiKey, deployment };
}

async function configureAzureInference(rl) {
  console.log('\n  -- Azure AI Inference Configuration --\n');

  const endpoint = await ask(rl, '  Endpoint URL (e.g. https://models.inference.ai.azure.com): ');
  if (!endpoint) { console.log('  Endpoint is required.'); return null; }

  const apiKey = await ask(rl, '  API Key (or GitHub PAT): ');
  if (!apiKey) { console.log('  API Key is required.'); return null; }

  const model = await ask(rl, '  Model name [gpt-4o]: ') || 'gpt-4o';

  return { endpoint, apiKey, model };
}

async function configureClaudeCode(rl) {
  console.log('\n  -- Claude Code Configuration --\n');

  const detected = findClaudeCli();
  let cliPath: string;

  if (detected) {
    console.log(`  Detected Claude CLI at: ${detected}`);
    const useDetected = await ask(rl, `  Use this path? [Y/n]: `);
    cliPath = (useDetected.toLowerCase() === 'n') ? await ask(rl, '  Path to claude CLI: ') : detected;
  } else {
    console.log('  Claude CLI not found in PATH.');
    console.log('  Install: https://docs.anthropic.com/en/docs/claude-code/overview');
    cliPath = await ask(rl, '  Path to claude CLI executable (or press Enter to skip): ');
  }

  if (!cliPath) { console.log('  Skipped.'); return null; }

  // Check auth
  console.log('  Checking authentication...');
  const authStatus = await getClaudeAuthStatus(cliPath);

  if (authStatus.loggedIn) {
    const emailStr = authStatus.email ? ` (${authStatus.email})` : '';
    console.log(`  Authenticated${emailStr}`);
  } else {
    console.log('  Not logged in.');
    const doLogin = await ask(rl, '  Run "claude login" now? [Y/n]: ');
    if (doLogin.toLowerCase() !== 'n') {
      rl.close();
      const success = await runClaudeLogin(cliPath);
      if (success) {
        console.log('  Login successful!');
      } else {
        console.log('  Login cancelled or failed. You can run "claude login" later.');
      }
      return { cliPath };
    }
  }

  return { cliPath };
}

async function configureLocal(rl) {
  console.log('\n  -- Local Provider Configuration --\n');

  const url = await ask(rl, '  Server URL [http://localhost:8000]: ') || 'http://localhost:8000';

  return { url };
}

async function verifyConnection(providers): Promise<boolean> {
  console.log('\n  Verifying connection...');

  const config = { providers };
  const providerEnv = getProviderEnvVars(config);

  try {
    const { MaestroSidecar, hasBundledBinaries } = require('@maestro/sidecar');
    const distDir = path.join(__dirname, 'dist');
    const contentDir = path.join(__dirname, 'content', 'system');
    const bundled = hasBundledBinaries(distDir);

    const sidecar = new MaestroSidecar({
      ...(bundled ? { binaryDir: distDir, contentDir } : {}),
      envOverrides: providerEnv,
      skipLlm: false,
      healthTimeout: 30000,
      onLog: () => {},
    });

    await sidecar.start();
    const port = sidecar.llmProviderPort;

    let healthy = false;
    if (port) {
      try {
        const resp = await fetch(`http://localhost:${port}/api/v1/health/`);
        healthy = resp.ok;
      } catch {}
    }

    await sidecar.stop();

    if (healthy) {
      console.log('  Connection verified successfully!');
      return true;
    } else {
      console.log('  Warning: Services started but LLM-Provider health check failed.');
      console.log('  Configuration will be saved — you can re-run "maestro init" to reconfigure.');
      return true;
    }
  } catch (err) {
    console.log(`  Warning: Could not verify connection: ${err.message}`);
    console.log('  Configuration will be saved — you can re-run "maestro init" to reconfigure.');
    return true;
  }
}

export async function runInitWizard(): Promise<void> {
  const rl = createInterface();

  try {
    printBanner();

    // Check if config already exists
    const existing = readConfig();
    if (hasConfiguredProviders(existing)) {
      const names = Object.keys(existing.providers || {}).join(', ');
      console.log(`  Existing configuration found (providers: ${names}).`);
      const overwrite = await ask(rl, '  Reconfigure? [y/N]: ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('  Keeping existing configuration.');
        rl.close();
        return;
      }
    }

    // Step 1: Pick providers (multi-select)
    const selectedIds = await pickProviders(rl);

    // Step 2: Configure each selected provider
    const providers: any = {};
    for (const id of selectedIds) {
      switch (id) {
        case 'claudeCode': {
          const cfg = await configureClaudeCode(rl);
          if (cfg) providers.claudeCode = cfg;
          break;
        }
        case 'azure': {
          const cfg = await configureAzure(rl);
          if (cfg) providers.azure = cfg;
          break;
        }
        case 'azureInference': {
          const cfg = await configureAzureInference(rl);
          if (cfg) providers.azureInference = cfg;
          break;
        }
        case 'local': {
          const cfg = await configureLocal(rl);
          if (cfg) providers.local = cfg;
          break;
        }
      }
    }

    if (Object.keys(providers).length === 0) {
      console.log('\n  Configuration cancelled.');
      rl.close();
      return;
    }

    // Step 3: Ask about verification
    const doVerify = await ask(rl, '\n  Test the connection now? [Y/n]: ');
    rl.close();

    if (doVerify.toLowerCase() !== 'n') {
      await verifyConnection(providers);
    }

    // Step 4: Save config with new providers map
    const config = readConfig();
    config.providers = providers;
    delete config.provider; // Remove legacy field
    writeConfig(config);

    console.log(`\n  Configuration saved to ${getConfigPath()}`);
    console.log('  Run "maestro code" to start using Maestro.\n');
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    rl.close();
    process.exit(1);
  }
}
