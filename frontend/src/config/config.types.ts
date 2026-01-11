/**
 * Maestro Configuration Types
 *
 * TypeScript interfaces for the maestro.config.json file.
 */

/**
 * Environment mode
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * LLM Provider type
 */
export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'azure' | 'google';

/**
 * Persistence mode
 */
export type PersistenceMode = 'json' | 'database';

/**
 * Mock latency configuration
 */
export interface MockLatencyConfig {
  /** Minimum latency in milliseconds */
  min: number;
  /** Maximum latency in milliseconds */
  max: number;
}

/**
 * Frontend configuration section
 */
export interface FrontendConfig {
  /** When true, uses mock services instead of real backend API */
  useMockBackend: boolean;
  /** Backend API base URL (used when useMockBackend is false) */
  apiBaseUrl: string;
  /** Simulated network latency for mock services */
  mockLatency?: MockLatencyConfig;
  /** Enable development tools and logging */
  enableDevTools?: boolean;
}

/**
 * Backend configuration section
 */
export interface BackendConfig {
  /** Default LLM provider */
  llmProvider?: LLMProvider;
  /** Enable Swagger UI for API documentation */
  enableSwagger?: boolean;
  /** Data persistence mode */
  persistenceMode?: PersistenceMode;
}

/**
 * Models configuration section
 */
export interface ModelsConfig {
  /** Load preset models on first launch */
  loadPresetsOnStart?: boolean;
  /** Default model ID for new agents */
  defaultModelId?: string;
}

/**
 * Root Maestro configuration
 */
export interface MaestroConfig {
  /** JSON Schema reference */
  $schema?: string;
  /** Current environment mode */
  environment: Environment;
  /** Frontend-specific configuration */
  frontend: FrontendConfig;
  /** Backend-specific configuration */
  backend?: BackendConfig;
  /** Model registry configuration */
  models?: ModelsConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: MaestroConfig = {
  environment: 'development',
  frontend: {
    useMockBackend: true,
    apiBaseUrl: 'https://localhost:5001',
    mockLatency: {
      min: 100,
      max: 300,
    },
    enableDevTools: true,
  },
  backend: {
    llmProvider: 'openai',
    enableSwagger: true,
    persistenceMode: 'json',
  },
  models: {
    loadPresetsOnStart: true,
    defaultModelId: 'gpt-4o',
  },
};
