// @ts-nocheck
/**
 * Interactive onboarding wizard for `maestro init`.
 * Configures the LLM provider and saves to ~/.maestro/config.json.
 */
const readline = require('readline');
const path = require('path');
const { execSync } = require('child_process');
const { readConfig, writeConfig, getProviderEnvVars, getConfigPath } = require('./config.ts');

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
  console.log('  ║   Let\'s configure your LLM provider  ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
}

const PROVIDERS = [
  { key: '1', type: 'azure',           label: 'Azure OpenAI',                   desc: 'Azure-hosted OpenAI models (endpoint + API key + deployment)' },
  { key: '2', type: 'azure-inference',  label: 'Azure AI Inference / GitHub Models', desc: 'Azure AI or GitHub Models (endpoint + API key)' },
  { key: '3', type: 'claude-code',      label: 'Claude Code (CLI)',              desc: 'Uses the Claude CLI installed on your machine' },
  { key: '4', type: 'local',            label: 'Local (Python FastAPI)',         desc: 'Local GPU inference server' },
];

async function pickProvider(rl): Promise<string> {
  console.log('  Which LLM provider do you want to use?\n');
  for (const p of PROVIDERS) {
    console.log(`    [${p.key}] ${p.label}`);
    console.log(`        ${p.desc}`);
  }
  console.log('');

  while (true) {
    const choice = await ask(rl, '  Enter choice (1-4): ');
    const match = PROVIDERS.find(p => p.key === choice);
    if (match) return match.type;
    console.log('  Invalid choice. Please enter 1, 2, 3, or 4.');
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

  return {
    type: 'azure' as const,
    azure: { endpoint, apiKey, deployment },
  };
}

async function configureAzureInference(rl) {
  console.log('\n  -- Azure AI Inference Configuration --\n');

  const endpoint = await ask(rl, '  Endpoint URL (e.g. https://models.inference.ai.azure.com): ');
  if (!endpoint) { console.log('  Endpoint is required.'); return null; }

  const apiKey = await ask(rl, '  API Key (or GitHub PAT): ');
  if (!apiKey) { console.log('  API Key is required.'); return null; }

  const model = await ask(rl, '  Model name [gpt-4o]: ') || 'gpt-4o';

  return {
    type: 'azure-inference' as const,
    azureInference: { endpoint, apiKey, model },
  };
}

function findClaudeCli(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    // 'where' on Windows may return multiple lines
    return result.split('\n')[0].trim();
  } catch {
    return null;
  }
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
    cliPath = await ask(rl, '  Path to claude CLI executable: ');
  }

  if (!cliPath) { console.log('  CLI path is required.'); return null; }

  return {
    type: 'claude-code' as const,
    claudeCode: { cliPath },
  };
}

async function configureLocal(rl) {
  console.log('\n  -- Local Provider Configuration --\n');

  const url = await ask(rl, '  Server URL [http://localhost:8000]: ') || 'http://localhost:8000';

  return {
    type: 'local' as const,
    local: { url },
  };
}

async function verifyConnection(providerConfig): Promise<boolean> {
  console.log('\n  Verifying connection...');

  const config = { provider: providerConfig };
  const providerEnv = getProviderEnvVars(config);

  // Quick check: try to reach the LLM-Provider health endpoint via sidecar
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

    // Try a health check on the LLM-Provider
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
      return true; // Save config anyway
    }
  } catch (err) {
    console.log(`  Warning: Could not verify connection: ${err.message}`);
    console.log('  Configuration will be saved — you can re-run "maestro init" to reconfigure.');
    return true; // Save config anyway, let user fix later
  }
}

export async function runInitWizard(): Promise<void> {
  const rl = createInterface();

  try {
    printBanner();

    // Check if config already exists
    const existing = readConfig();
    if (existing.provider) {
      console.log(`  Existing configuration found (provider: ${existing.provider.type}).`);
      const overwrite = await ask(rl, '  Reconfigure? [y/N]: ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('  Keeping existing configuration.');
        rl.close();
        return;
      }
    }

    // Step 1: Pick provider
    const providerType = await pickProvider(rl);

    // Step 2: Provider-specific config
    let providerConfig;
    switch (providerType) {
      case 'azure':
        providerConfig = await configureAzure(rl);
        break;
      case 'azure-inference':
        providerConfig = await configureAzureInference(rl);
        break;
      case 'claude-code':
        providerConfig = await configureClaudeCode(rl);
        break;
      case 'local':
        providerConfig = await configureLocal(rl);
        break;
    }

    if (!providerConfig) {
      console.log('\n  Configuration cancelled.');
      rl.close();
      return;
    }

    // Step 3: Ask about verification
    const doVerify = await ask(rl, '\n  Test the connection now? [Y/n]: ');
    rl.close(); // Close readline before sidecar (it takes over stdio)

    if (doVerify.toLowerCase() !== 'n') {
      await verifyConnection(providerConfig);
    }

    // Step 4: Save config
    const config = readConfig();
    config.provider = providerConfig;
    writeConfig(config);

    console.log(`\n  Configuration saved to ${getConfigPath()}`);
    console.log('  Run "maestro code" to start using Maestro.\n');
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    rl.close();
    process.exit(1);
  }
}
