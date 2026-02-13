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
