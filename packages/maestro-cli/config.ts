// @ts-nocheck
const fs = require('fs');
const path = require('path');
const os = require('os');

export interface MaestroConfig {
  backendUrl?: string;
  apiKey?: string;
  llmProvider?: {
    url?: string;
    defaultModel?: string;
  };
  azure?: {
    endpoint?: string;
    apiKey?: string;
    deployment?: string;
  };
  provider?: {
    type: 'azure' | 'azure-inference' | 'claude-code' | 'local';
    azure?: { endpoint: string; apiKey: string; deployment: string };
    azureInference?: { endpoint: string; apiKey: string; model: string };
    claudeCode?: { cliPath: string };
    local?: { url: string };
  };
}

const CONFIG_DIR = path.join(os.homedir(), '.maestro');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function readConfig(): MaestroConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // Corrupted config — return defaults
  }
  return {};
}

export function writeConfig(config: MaestroConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function updateConfig(partial: Partial<MaestroConfig>): void {
  const current = readConfig();
  const merged = { ...current, ...partial };
  writeConfig(merged);
}

export function getBackendUrl(): string {
  return process.env.MAESTRO_API_URL
    || readConfig().backendUrl
    || 'http://localhost:5000';
}

export function getApiKey(): string | undefined {
  return process.env.MAESTRO_API_KEY
    || readConfig().apiKey
    || undefined;
}

export function getProviderEnvVars(config: MaestroConfig): Record<string, string> {
  const env: Record<string, string> = {};
  if (!config.provider) return env;
  const p = config.provider;
  switch (p.type) {
    case 'azure':
      if (p.azure) {
        env.Providers__Azure__ApiKey = p.azure.apiKey;
        env.Providers__Azure__Endpoint = p.azure.endpoint;
        env.Providers__Azure__DefaultDeployment = p.azure.deployment;
      }
      break;
    case 'azure-inference':
      if (p.azureInference) {
        env.Providers__AzureInference__ApiKey = p.azureInference.apiKey;
        env.Providers__AzureInference__Endpoint = p.azureInference.endpoint;
      }
      break;
    case 'claude-code':
      if (p.claudeCode) {
        env.Providers__ClaudeCode__CliPath = p.claudeCode.cliPath;
      }
      break;
    case 'local':
      if (p.local) {
        env.Providers__Local__BaseUrl = p.local.url;
      }
      break;
  }
  return env;
}
