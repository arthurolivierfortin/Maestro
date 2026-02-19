/**
 * Model Catalog
 *
 * Complete catalog of all known AI models with their specifications.
 * This includes models that may not be configured yet.
 *
 * Status is determined at runtime based on user configuration.
 */

import type { ModelCatalogEntry, ModelSpecs } from '../types/modelStatus.types';

/**
 * Base model definition (without runtime status)
 */
interface BaseModelDefinition {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  description?: string;
  specs: ModelSpecs;
  configurationSteps?: string[];
  isLocalModel?: boolean;
  defaultEndpoint?: string;
}

/**
 * OpenAI Models
 */
const OPENAI_MODELS: BaseModelDefinition[] = [
  {
    id: 'gpt-4o',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable OpenAI model with vision and tool use',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 2.5,
      outputPricePerMillion: 10,
      capabilities: ['code', 'vision', 'function-calling', 'streaming'],
      qualityTier: 'excellent',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from platform.openai.com', 'Add API key in settings'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and affordable OpenAI model',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.6,
      capabilities: ['code', 'vision', 'function-calling', 'streaming'],
      qualityTier: 'good',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from platform.openai.com', 'Add API key in settings'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'High-performance GPT-4 variant',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 10,
      outputPricePerMillion: 30,
      capabilities: ['code', 'vision', 'function-calling', 'streaming'],
      qualityTier: 'excellent',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from platform.openai.com', 'Add API key in settings'],
  },
  {
    id: 'o1',
    name: 'o1',
    displayName: 'o1',
    provider: 'openai',
    description: 'Advanced reasoning model with extended thinking',
    specs: {
      contextWindow: 200000,
      inputPricePerMillion: 15,
      outputPricePerMillion: 60,
      capabilities: ['code', 'reasoning', 'analysis'],
      qualityTier: 'excellent',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: false,
    },
    configurationSteps: ['Get API key from platform.openai.com', 'Add API key in settings', 'Note: Requires Tier 5 access'],
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    displayName: 'o1 Mini',
    provider: 'openai',
    description: 'Faster reasoning model for STEM tasks',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 3,
      outputPricePerMillion: 12,
      capabilities: ['code', 'reasoning'],
      qualityTier: 'excellent',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: false,
    },
    configurationSteps: ['Get API key from platform.openai.com', 'Add API key in settings'],
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Legacy fast model, good for simple tasks',
    specs: {
      contextWindow: 16385,
      inputPricePerMillion: 0.5,
      outputPricePerMillion: 1.5,
      capabilities: ['code', 'function-calling', 'streaming'],
      qualityTier: 'basic',
      supportsVision: false,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from platform.openai.com', 'Add API key in settings'],
  },
];

/**
 * Anthropic Models
 */
const ANTHROPIC_MODELS: BaseModelDefinition[] = [
  {
    id: 'claude-3-5-sonnet',
    name: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Best Anthropic model for coding and analysis',
    specs: {
      contextWindow: 200000,
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
      capabilities: ['code', 'vision', 'analysis', 'streaming'],
      qualityTier: 'excellent',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.anthropic.com', 'Add API key in settings'],
  },
  {
    id: 'claude-3-5-haiku',
    name: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fast and affordable Claude model',
    specs: {
      contextWindow: 200000,
      inputPricePerMillion: 0.8,
      outputPricePerMillion: 4,
      capabilities: ['code', 'vision', 'streaming'],
      qualityTier: 'good',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.anthropic.com', 'Add API key in settings'],
  },
  {
    id: 'claude-3-opus',
    name: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Most powerful Claude 3 model',
    specs: {
      contextWindow: 200000,
      inputPricePerMillion: 15,
      outputPricePerMillion: 75,
      capabilities: ['code', 'vision', 'analysis', 'reasoning', 'streaming'],
      qualityTier: 'excellent',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.anthropic.com', 'Add API key in settings'],
  },
  {
    id: 'claude-3-sonnet',
    name: 'claude-3-sonnet-20240229',
    displayName: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: 'Balanced Claude 3 model',
    specs: {
      contextWindow: 200000,
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
      capabilities: ['code', 'vision', 'streaming'],
      qualityTier: 'good',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.anthropic.com', 'Add API key in settings'],
  },
  {
    id: 'claude-3-haiku',
    name: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fast and cheap Claude 3 model',
    specs: {
      contextWindow: 200000,
      inputPricePerMillion: 0.25,
      outputPricePerMillion: 1.25,
      capabilities: ['code', 'vision', 'streaming'],
      qualityTier: 'basic',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.anthropic.com', 'Add API key in settings'],
  },
];

/**
 * Google Models
 */
const GOOGLE_MODELS: BaseModelDefinition[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Fast Google model with multimodal capabilities',
    specs: {
      contextWindow: 1000000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'vision', 'streaming'],
      qualityTier: 'good',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from aistudio.google.com', 'Add API key in settings'],
  },
  {
    id: 'gemini-1.5-pro',
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'google',
    description: 'Advanced Google model with massive context',
    specs: {
      contextWindow: 2000000,
      inputPricePerMillion: 1.25,
      outputPricePerMillion: 5,
      capabilities: ['code', 'vision', 'analysis', 'streaming'],
      qualityTier: 'excellent',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from aistudio.google.com', 'Add API key in settings'],
  },
  {
    id: 'gemini-1.5-flash',
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'google',
    description: 'Fast and affordable Gemini model',
    specs: {
      contextWindow: 1000000,
      inputPricePerMillion: 0.075,
      outputPricePerMillion: 0.3,
      capabilities: ['code', 'vision', 'streaming'],
      qualityTier: 'good',
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from aistudio.google.com', 'Add API key in settings'],
  },
];

/**
 * Mistral Models
 */
const MISTRAL_MODELS: BaseModelDefinition[] = [
  {
    id: 'mistral-large',
    name: 'mistral-large-latest',
    displayName: 'Mistral Large',
    provider: 'mistral',
    description: 'Most capable Mistral model',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 2,
      outputPricePerMillion: 6,
      capabilities: ['code', 'function-calling', 'streaming'],
      qualityTier: 'excellent',
      supportsVision: false,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.mistral.ai', 'Add API key in settings'],
  },
  {
    id: 'mistral-medium',
    name: 'mistral-medium-latest',
    displayName: 'Mistral Medium',
    provider: 'mistral',
    description: 'Balanced Mistral model',
    specs: {
      contextWindow: 32000,
      inputPricePerMillion: 2.7,
      outputPricePerMillion: 8.1,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.mistral.ai', 'Add API key in settings'],
  },
  {
    id: 'mistral-small',
    name: 'mistral-small-latest',
    displayName: 'Mistral Small',
    provider: 'mistral',
    description: 'Fast and cost-effective Mistral model',
    specs: {
      contextWindow: 32000,
      inputPricePerMillion: 0.2,
      outputPricePerMillion: 0.6,
      capabilities: ['code', 'function-calling', 'streaming'],
      qualityTier: 'good',
      supportsVision: false,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.mistral.ai', 'Add API key in settings'],
  },
  {
    id: 'codestral',
    name: 'codestral-latest',
    displayName: 'Codestral',
    provider: 'mistral',
    description: 'Specialized code generation model',
    specs: {
      contextWindow: 32000,
      inputPricePerMillion: 0.2,
      outputPricePerMillion: 0.6,
      capabilities: ['code', 'streaming'],
      qualityTier: 'excellent',
      parameterCount: '22B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.mistral.ai', 'Add API key in settings'],
  },
];

/**
 * Groq Models (Fast Inference)
 */
const GROQ_MODELS: BaseModelDefinition[] = [
  {
    id: 'llama-3.1-70b-groq',
    name: 'llama-3.1-70b-versatile',
    displayName: 'Llama 3.1 70B (Groq)',
    provider: 'groq',
    description: 'Fast inference with Groq LPU',
    specs: {
      contextWindow: 131072,
      inputPricePerMillion: 0.59,
      outputPricePerMillion: 0.79,
      capabilities: ['code', 'function-calling', 'streaming'],
      qualityTier: 'good',
      parameterCount: '70B',
      supportsVision: false,
      supportsToolUse: true,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.groq.com', 'Add API key in settings'],
  },
  {
    id: 'llama-3.1-8b-groq',
    name: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B (Groq)',
    provider: 'groq',
    description: 'Ultra-fast small model',
    specs: {
      contextWindow: 131072,
      inputPricePerMillion: 0.05,
      outputPricePerMillion: 0.08,
      capabilities: ['code', 'streaming'],
      qualityTier: 'basic',
      parameterCount: '8B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.groq.com', 'Add API key in settings'],
  },
  {
    id: 'mixtral-8x7b-groq',
    name: 'mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B (Groq)',
    provider: 'groq',
    description: 'MoE model with fast inference',
    specs: {
      contextWindow: 32768,
      inputPricePerMillion: 0.24,
      outputPricePerMillion: 0.24,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '8x7B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
    configurationSteps: ['Get API key from console.groq.com', 'Add API key in settings'],
  },
];

/**
 * Local Models (Ollama / LLM-Provider)
 */
const LOCAL_MODELS: BaseModelDefinition[] = [
  {
    id: 'llama-3.2-3b',
    name: 'llama3.2:3b',
    displayName: 'Llama 3.2 3B',
    provider: 'local',
    description: 'Small, fast local model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'basic',
      parameterCount: '3B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'llama-3.2-1b',
    name: 'llama3.2:1b',
    displayName: 'Llama 3.2 1B',
    provider: 'local',
    description: 'Ultra-small local model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['streaming'],
      qualityTier: 'basic',
      parameterCount: '1B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'llama-3.1-8b',
    name: 'llama3.1:8b',
    displayName: 'Llama 3.1 8B',
    provider: 'local',
    description: 'Balanced local model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '8B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'codellama-7b',
    name: 'codellama:7b',
    displayName: 'CodeLlama 7B',
    provider: 'local',
    description: 'Code-specialized local model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 100000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '7B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'codellama-13b',
    name: 'codellama:13b',
    displayName: 'CodeLlama 13B',
    provider: 'local',
    description: 'Larger code-specialized model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 100000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '13B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'mistral-7b',
    name: 'mistral:7b',
    displayName: 'Mistral 7B',
    provider: 'local',
    description: 'Efficient local model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 32000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '7B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'mixtral-8x7b',
    name: 'mixtral:8x7b',
    displayName: 'Mixtral 8x7B',
    provider: 'local',
    description: 'MoE local model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 32000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '8x7B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'deepseek-coder-6.7b',
    name: 'deepseek-coder:6.7b',
    displayName: 'DeepSeek Coder 6.7B',
    provider: 'local',
    description: 'Code-focused local model from DeepSeek',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 16000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '6.7B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'phi-3-mini',
    name: 'phi3:mini',
    displayName: 'Phi-3 Mini',
    provider: 'local',
    description: 'Microsoft small language model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 4096,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'good',
      parameterCount: '3.8B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'qwen2.5-coder:7b',
    displayName: 'Qwen 2.5 Coder 7B',
    provider: 'local',
    description: 'Alibaba code-focused model',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:11434',
    specs: {
      contextWindow: 128000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'excellent',
      parameterCount: '7B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
];

/**
 * LLM-Provider Models (can be auto-setup)
 */
const LLM_PROVIDER_MODELS: BaseModelDefinition[] = [
  {
    id: 'deepseek-coder-llm-provider',
    name: 'deepseek-ai/deepseek-coder-1.3b-instruct',
    displayName: 'DeepSeek Coder 1.3B (LLM-Provider)',
    provider: 'llm-provider',
    description: 'Auto-configurable via LLM-Provider',
    isLocalModel: true,
    defaultEndpoint: 'http://localhost:8000',
    specs: {
      contextWindow: 16000,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      capabilities: ['code', 'streaming'],
      qualityTier: 'basic',
      parameterCount: '1.3B',
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
    },
  },
];

/**
 * All base model definitions
 */
export const ALL_MODEL_DEFINITIONS: BaseModelDefinition[] = [
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  ...MISTRAL_MODELS,
  ...GROQ_MODELS,
  ...LOCAL_MODELS,
  ...LLM_PROVIDER_MODELS,
];

/**
 * Get all providers
 */
export function getAllProviders(): string[] {
  const providers = new Set(ALL_MODEL_DEFINITIONS.map(m => m.provider));
  return Array.from(providers);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: string): BaseModelDefinition[] {
  return ALL_MODEL_DEFINITIONS.filter(m => m.provider === provider);
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    mistral: 'Mistral AI',
    groq: 'Groq',
    local: 'Local (Ollama)',
    'llm-provider': 'LLM-Provider',
    custom: 'Custom',
  };
  return names[provider] || provider;
}

/**
 * Convert base definition to catalog entry with status
 */
export function toCatalogEntry(
  definition: BaseModelDefinition,
  configuredModels: Set<string>,
  availableLocalModels: Set<string>
): ModelCatalogEntry {
  const isConfigured = configuredModels.has(definition.id) || configuredModels.has(definition.name);
  const isLocalDownloaded = definition.isLocalModel && availableLocalModels.has(definition.name);

  let status: ModelCatalogEntry['status'] = 'not_configured';

  if (isConfigured || isLocalDownloaded) {
    status = 'ready';
  } else if (definition.isLocalModel || definition.provider === 'llm-provider') {
    // Local models can be auto-setup
    status = 'available';
  }

  return {
    id: definition.id,
    name: definition.name,
    displayName: definition.displayName,
    provider: definition.provider,
    description: definition.description,
    status,
    specs: definition.specs,
    configurationSteps: definition.configurationSteps,
    setupInfo: status === 'available' ? {
      setupType: definition.isLocalModel ? 'download' : 'llm_provider',
      requirements: definition.isLocalModel ? ['Ollama installed', '8GB RAM minimum'] : undefined,
    } : undefined,
    configuration: status === 'ready' ? {
      hasApiKey: !definition.isLocalModel,
      apiEndpoint: definition.defaultEndpoint,
    } : undefined,
  };
}

/**
 * Get full catalog with status
 */
export function getModelCatalog(
  configuredModelIds: Set<string>,
  availableLocalModels: Set<string> = new Set()
): ModelCatalogEntry[] {
  return ALL_MODEL_DEFINITIONS.map(def =>
    toCatalogEntry(def, configuredModelIds, availableLocalModels)
  );
}

/**
 * Group catalog by provider
 */
export function groupCatalogByProvider(
  catalog: ModelCatalogEntry[]
): Map<string, ModelCatalogEntry[]> {
  const grouped = new Map<string, ModelCatalogEntry[]>();

  catalog.forEach(entry => {
    const existing = grouped.get(entry.provider) || [];
    existing.push(entry);
    grouped.set(entry.provider, existing);
  });

  return grouped;
}

/**
 * Filter catalog by status
 */
export function filterCatalogByStatus(
  catalog: ModelCatalogEntry[],
  statuses: ModelCatalogEntry['status'][]
): ModelCatalogEntry[] {
  return catalog.filter(entry => statuses.includes(entry.status));
}

/**
 * Search catalog
 */
export function searchCatalog(
  catalog: ModelCatalogEntry[],
  query: string
): ModelCatalogEntry[] {
  const lowerQuery = query.toLowerCase();
  return catalog.filter(entry =>
    entry.displayName.toLowerCase().includes(lowerQuery) ||
    entry.provider.toLowerCase().includes(lowerQuery) ||
    entry.description?.toLowerCase().includes(lowerQuery) ||
    entry.specs.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
  );
}
