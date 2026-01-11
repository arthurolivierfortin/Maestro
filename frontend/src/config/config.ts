/**
 * Maestro Configuration Loader
 *
 * Loads configuration from maestro.config.json at project root.
 * Falls back to defaults if config file is not found.
 */

import type { MaestroConfig, FrontendConfig, MockLatencyConfig } from './config.types';
import { DEFAULT_CONFIG } from './config.types';

// Config is loaded at build time via Vite's import
// The actual config file is at the project root
let loadedConfig: MaestroConfig | null = null;

/**
 * Load configuration from maestro.config.json
 * Uses Vite's static import for the config file
 */
async function loadConfig(): Promise<MaestroConfig> {
  if (loadedConfig) {
    return loadedConfig;
  }

  try {
    // Try to load from project root (Vite will resolve this at build time)
    // In development, we use a dynamic import
    const configModule = await import('../../../maestro.config.json');
    loadedConfig = { ...DEFAULT_CONFIG, ...configModule.default } as MaestroConfig;
    
    if (import.meta.env.DEV) {
      console.log('[Config] Loaded maestro.config.json:', loadedConfig);
    }
    
    return loadedConfig;
  } catch (error) {
    console.warn('[Config] Failed to load maestro.config.json, using defaults:', error);
    loadedConfig = DEFAULT_CONFIG;
    return loadedConfig;
  }
}

/**
 * Get configuration synchronously (must be called after init)
 */
function getConfig(): MaestroConfig {
  if (!loadedConfig) {
    console.warn('[Config] Config not loaded yet, using defaults');
    return DEFAULT_CONFIG;
  }
  return loadedConfig;
}

/**
 * Get frontend configuration
 */
function getFrontendConfig(): FrontendConfig {
  return getConfig().frontend;
}

/**
 * Check if mock backend should be used
 */
function shouldUseMockBackend(): boolean {
  const config = getConfig();
  
  // In test environment, always use mock
  if (config.environment === 'test') {
    return true;
  }
  
  // In production, never use mock (override any config)
  if (config.environment === 'production') {
    return false;
  }
  
  // Otherwise, use config value
  return config.frontend.useMockBackend;
}

/**
 * Get API base URL
 */
function getApiBaseUrl(): string {
  return getFrontendConfig().apiBaseUrl;
}

/**
 * Get mock latency configuration
 */
function getMockLatency(): MockLatencyConfig {
  return getFrontendConfig().mockLatency ?? DEFAULT_CONFIG.frontend.mockLatency!;
}

/**
 * Check if development tools are enabled
 */
function isDevToolsEnabled(): boolean {
  const config = getConfig();
  return config.environment === 'development' && (config.frontend.enableDevTools ?? true);
}

// Initialize config on module load
const configPromise = loadConfig();

/**
 * Exported configuration API
 */
export const config = {
  /** Initialize and load configuration (call once at app start) */
  init: loadConfig,
  
  /** Wait for config to be ready */
  ready: configPromise,
  
  /** Get full configuration */
  get: getConfig,
  
  /** Get frontend configuration section */
  frontend: getFrontendConfig,
  
  /** Check if mock backend should be used */
  useMockBackend: shouldUseMockBackend,
  
  /** Get API base URL */
  apiBaseUrl: getApiBaseUrl,
  
  /** Get mock latency settings */
  mockLatency: getMockLatency,
  
  /** Check if dev tools are enabled */
  devToolsEnabled: isDevToolsEnabled,
};

// Re-export types
export type { MaestroConfig, FrontendConfig, MockLatencyConfig } from './config.types';
export { DEFAULT_CONFIG } from './config.types';
