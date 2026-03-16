// @ts-nocheck
const fs = require('fs');
const path = require('path');
const os = require('os');

export interface ProviderConfigs {
  claudeCode?: { cliPath: string };
  anthropic?: { apiKey: string };
  azure?: { endpoint: string; apiKey: string; deployment: string };
  azureInference?: { endpoint: string; apiKey: string; model: string };
  local?: { url: string };
  githubModels?: { token: string };
}

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
  // Legacy single-provider field — migrated to `providers` on read
  provider?: {
    type: 'azure' | 'azure-inference' | 'claude-code' | 'local';
    azure?: { endpoint: string; apiKey: string; deployment: string };
    azureInference?: { endpoint: string; apiKey: string; model: string };
    claudeCode?: { cliPath: string };
    local?: { url: string };
  };
  // Multi-provider config (new)
  providers?: ProviderConfigs;
}

const CONFIG_DIR = path.join(os.homedir(), '.maestro');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Migrate legacy single `provider` field to multi-provider `providers` map.
 * Called on read — does NOT write back (caller decides when to persist).
 */
function migrateProviderConfig(config: MaestroConfig): MaestroConfig {
  if (config.providers) return config; // Already migrated
  if (!config.provider) return config; // Nothing to migrate

  const p = config.provider;
  const providers: ProviderConfigs = {};

  switch (p.type) {
    case 'claude-code':
      if (p.claudeCode) providers.claudeCode = p.claudeCode;
      break;
    case 'azure':
      if (p.azure) providers.azure = p.azure;
      break;
    case 'azure-inference':
      if (p.azureInference) providers.azureInference = p.azureInference;
      break;
    case 'local':
      if (p.local) providers.local = p.local;
      break;
  }

  config.providers = providers;
  return config;
}

export function readConfig(): MaestroConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(raw);
      return migrateProviderConfig(config);
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

/**
 * Returns true if at least one provider is configured in the `providers` map.
 */
export function hasConfiguredProviders(config?: MaestroConfig): boolean {
  const c = config || readConfig();
  const p = c.providers;
  if (!p) return false;
  return !!(p.claudeCode || p.anthropic || p.azure || p.azureInference || p.local || p.githubModels);
}

/**
 * Build env vars for ALL configured providers (not just one).
 * The backend reads each provider's env vars independently.
 */
export function getProviderEnvVars(config: MaestroConfig): Record<string, string> {
  const env: Record<string, string> = {};
  const providers = config.providers;

  // Support legacy single-provider field as fallback
  if (!providers && config.provider) {
    return getLegacyProviderEnvVars(config.provider);
  }

  if (!providers) return env;

  if (providers.claudeCode) {
    env.Providers__ClaudeCode__CliPath = providers.claudeCode.cliPath;
  }

  if (providers.anthropic) {
    env.Providers__Anthropic__ApiKey = providers.anthropic.apiKey;
  }

  if (providers.azure) {
    env.Providers__Azure__ApiKey = providers.azure.apiKey;
    env.Providers__Azure__Endpoint = providers.azure.endpoint;
    env.Providers__Azure__DefaultDeployment = providers.azure.deployment;
  }

  if (providers.azureInference) {
    env.Providers__AzureInference__ApiKey = providers.azureInference.apiKey;
    env.Providers__AzureInference__Endpoint = providers.azureInference.endpoint;
  }

  if (providers.local) {
    env.Providers__Local__BaseUrl = providers.local.url;
  }

  if (providers.githubModels) {
    env.Providers__GitHubModels__Token = providers.githubModels.token;
  }

  return env;
}

function getLegacyProviderEnvVars(p: MaestroConfig['provider']): Record<string, string> {
  const env: Record<string, string> = {};
  if (!p) return env;
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
