/**
 * Model Status Types
 *
 * Defines the three-tier status system for models:
 * - ready: Configured and working
 * - available: Can be auto-setup (download or LLM-Provider)
 * - not_configured: Requires manual configuration
 */

/**
 * Model configuration status
 */
export type ModelStatus =
  | 'ready'           // Configured and working
  | 'available'       // Can be auto-setup (download or LLM-Provider)
  | 'not_configured'  // Requires manual configuration
  | 'downloading'     // Currently being downloaded
  | 'error';          // Configuration error

/**
 * Setup type for available models
 */
export type ModelSetupType = 'download' | 'llm_provider' | 'api_key';

/**
 * Quality tier for models
 */
export type ModelQualityTier = 'basic' | 'good' | 'excellent';

/**
 * Model specifications for comparison
 */
export interface ModelSpecs {
  contextWindow: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  capabilities: string[];
  qualityTier: ModelQualityTier;
  parameterCount?: string;
  supportsVision?: boolean;
  supportsToolUse?: boolean;
  supportsStreaming?: boolean;
}

/**
 * Configuration info for ready models
 */
export interface ModelConfiguration {
  apiEndpoint?: string;
  hasApiKey: boolean;
  lastTested?: string;
}

/**
 * Setup info for available models
 */
export interface ModelSetupInfo {
  setupType: ModelSetupType;
  downloadSize?: number;
  estimatedTime?: string;
  requirements?: string[];
}

/**
 * Extended model with status information
 */
export interface ModelCatalogEntry {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  description?: string;
  status: ModelStatus;
  specs: ModelSpecs;

  // Only for ready models
  configuration?: ModelConfiguration;

  // Only for available models
  setupInfo?: ModelSetupInfo;

  // Only for not_configured models
  configurationSteps?: string[];

  // Download progress (0-100) for downloading models
  downloadProgress?: number;

  // Error message for error status
  errorMessage?: string;
}

/**
 * Get status display info
 */
export function getStatusDisplayInfo(status: ModelStatus): {
  label: string;
  colorClass: string;
  icon: 'check' | 'download' | 'circle' | 'loader' | 'alert';
} {
  switch (status) {
    case 'ready':
      return { label: 'Ready', colorClass: 'success', icon: 'check' };
    case 'available':
      return { label: 'Available', colorClass: 'primary', icon: 'download' };
    case 'not_configured':
      return { label: 'Setup Required', colorClass: 'muted', icon: 'circle' };
    case 'downloading':
      return { label: 'Downloading', colorClass: 'primary', icon: 'loader' };
    case 'error':
      return { label: 'Error', colorClass: 'error', icon: 'alert' };
    default:
      return { label: 'Unknown', colorClass: 'muted', icon: 'circle' };
  }
}

/**
 * Check if a model can be used
 */
export function canUseModel(status: ModelStatus): boolean {
  return status === 'ready';
}

/**
 * Check if a model can be auto-setup
 */
export function canAutoSetup(status: ModelStatus): boolean {
  return status === 'available';
}

/**
 * Get primary action for a model status
 */
export function getPrimaryAction(status: ModelStatus): {
  label: string;
  action: 'test' | 'setup' | 'configure' | 'retry' | 'none';
} {
  switch (status) {
    case 'ready':
      return { label: 'Test', action: 'test' };
    case 'available':
      return { label: 'Setup', action: 'setup' };
    case 'not_configured':
      return { label: 'Configure', action: 'configure' };
    case 'error':
      return { label: 'Retry', action: 'retry' };
    default:
      return { label: '', action: 'none' };
  }
}
