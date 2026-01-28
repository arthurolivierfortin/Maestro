/**
 * Model type definitions
 *
 * Represents AI/LLM models as first-class resources with rich metadata
 * for intelligent model selection and workflow auto-optimization.
 *
 * @see README.md - Model Registry & Auto-Optimization section
 * @see ROADMAP.md - Phase 4e (Models Panel) and Phase 13 (Auto-Optimization)
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Supported model providers
 */
export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'azure-openai'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'local'
  | 'llm-provider'
  | 'custom';

/**
 * Model capabilities that can be queried for task matching
 */
export type ModelCapability =
  | 'code-generation'
  | 'code-review'
  | 'code-debugging'
  | 'reasoning'
  | 'planning'
  | 'summarization'
  | 'analysis'
  | 'creative-writing'
  | 'translation'
  | 'vision'
  | 'tool-use'
  | 'function-calling'
  | 'structured-output'
  | 'long-context'
  | 'fast-inference';

/**
 * Task types for quality rating mapping
 */
export type TaskType =
  | 'code-generation'
  | 'code-review'
  | 'test-generation'
  | 'debugging'
  | 'planning'
  | 'summarization'
  | 'analysis'
  | 'documentation'
  | 'refactoring';

// ============================================================================
// Core Model Interface
// ============================================================================

/**
 * Represents an AI model with rich metadata for selection and optimization.
 *
 * Models are first-class resources that can be:
 * - Assigned to Agent blocks
 * - Compared for cost/quality/speed trade-offs
 * - Benchmarked for specific task types
 * - Auto-selected based on optimization goals
 */
export interface Model {
  /** Unique identifier (e.g., 'gpt-4o', 'claude-3-opus', 'llama3-70b') */
  id: string;

  /** Provider adapter that handles this model */
  provider: ModelProvider;

  /** Human-readable display name */
  displayName: string;

  /** Optional description or notes about this model */
  description?: string;

  /** Array of capabilities this model supports */
  capabilities: ModelCapability[];

  /** Maximum context window size in tokens */
  contextWindow: number;

  /** Cost per input token in USD (0 for local models) */
  costPerInputToken: number;

  /** Cost per output token in USD (0 for local models) */
  costPerOutputToken: number;

  /** Relative speed rating (1-10, higher = faster) */
  speedRating: number;

  /** Quality ratings per task type (1-10, higher = better) */
  qualityRatings: Partial<Record<TaskType, number>>;

  /** What this model excels at */
  strengths: string[];

  /** Known limitations or weaknesses */
  weaknesses: string[];

  /** Maximum output tokens the model can generate */
  maxOutputTokens: number;

  /** Whether the model supports streaming responses */
  supportsStreaming: boolean;

  /** Whether the model supports tool/function calling */
  supportsToolCalls: boolean;

  /** Whether the model supports vision/image input */
  supportsVision: boolean;

  /** Whether this is a locally-running model (Ollama, LM Studio, etc.) */
  isLocal: boolean;

  /** Whether the model is currently available (API key valid, server running) */
  isAvailable: boolean;

  /** Custom API endpoint (for self-hosted or custom providers) */
  apiEndpoint?: string;

  /** Model version or variant */
  version?: string;

  /** Tags for organization and filtering */
  tags?: string[];

  /** When this model configuration was created */
  createdAt?: string;

  /** When this model configuration was last updated */
  updatedAt?: string;
}

// ============================================================================
// Model Configuration for Agent Blocks
// ============================================================================

/**
 * Model assignment configuration for an Agent block
 */
export interface AgentModelConfig {
  /** Primary model to use for this agent */
  modelId: string;

  /** Fallback model if primary is unavailable or fails */
  fallbackModelId?: string;

  /** Maximum tokens for this specific usage */
  maxTokens?: number;

  /** Temperature setting (0-2, lower = more deterministic) */
  temperature?: number;

  /** Top-p sampling parameter */
  topP?: number;

  /** Override the model's default system prompt behavior */
  systemPromptOverride?: string;
}

// ============================================================================
// Model Constraints for Selection
// ============================================================================

/**
 * Constraints for automatic model selection
 */
export interface ModelConstraints {
  /** Maximum cost per 1K tokens (input + output) */
  maxCostPer1kTokens?: number;

  /** Minimum required capabilities */
  requiredCapabilities?: ModelCapability[];

  /** Minimum context window size needed */
  minContextWindow?: number;

  /** Minimum speed rating required */
  minSpeedRating?: number;

  /** Minimum quality rating for a specific task */
  minQualityRating?: {
    taskType: TaskType;
    rating: number;
  };

  /** Prefer local models over cloud */
  preferLocal?: boolean;

  /** Specific providers to include/exclude */
  providers?: {
    include?: ModelProvider[];
    exclude?: ModelProvider[];
  };
}

// ============================================================================
// Model Comparison & Benchmarking
// ============================================================================

/**
 * Result of a model benchmark run
 */
export interface BenchmarkResult {
  /** Model that was benchmarked */
  modelId: string;

  /** Task type that was tested */
  taskType: TaskType;

  /** Number of runs in this benchmark */
  runCount: number;

  /** Average response time in milliseconds */
  avgResponseTimeMs: number;

  /** Average input tokens per run */
  avgInputTokens: number;

  /** Average output tokens per run */
  avgOutputTokens: number;

  /** Average cost per run in USD */
  avgCostUsd: number;

  /** Quality score (0-100, based on validation or human rating) */
  qualityScore: number;

  /** When this benchmark was run */
  benchmarkedAt: string;
}

/**
 * Model comparison result
 */
export interface ModelComparison {
  /** Models being compared */
  modelIds: string[];

  /** Task type for comparison */
  taskType: TaskType;

  /** Benchmark results per model */
  results: Record<string, BenchmarkResult>;

  /** Recommended model based on optimization goal */
  recommendation: {
    modelId: string;
    reason: string;
    confidence: number; // 0-1
  };

  /** When this comparison was generated */
  comparedAt: string;
}

// ============================================================================
// Optimization Types (Phase 13)
// ============================================================================

/**
 * Optimization goal for automatic model selection
 */
export type OptimizationGoal = 'cost' | 'quality' | 'speed' | 'balanced';

/**
 * Optimization recommendation from the system
 */
export interface OptimizationRecommendation {
  /** Unique ID for this recommendation */
  id: string;

  /** The block/agent this applies to */
  targetBlockId: string;

  /** Current model being used */
  currentModelId: string;

  /** Recommended model to switch to */
  recommendedModelId: string;

  /** Type of optimization */
  optimizationGoal: OptimizationGoal;

  /** Expected improvement */
  expectedImpact: {
    costChangePercent: number; // negative = savings
    qualityChangePercent: number;
    speedChangePercent: number;
  };

  /** Human-readable explanation */
  reason: string;

  /** Confidence in this recommendation (0-1) */
  confidence: number;

  /** Status of this recommendation */
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled-back';

  /** When this was generated */
  createdAt: string;

  /** When this was applied (if applicable) */
  appliedAt?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid ModelProvider
 */
export function isModelProvider(value: unknown): value is ModelProvider {
  const validProviders: ModelProvider[] = [
    'openai',
    'anthropic',
    'ollama',
    'azure-openai',
    'google',
    'mistral',
    'groq',
    'local',
    'llm-provider',
    'custom',
  ];
  return typeof value === 'string' && validProviders.includes(value as ModelProvider);
}

/**
 * Type guard to check if a value is a valid ModelCapability
 */
export function isModelCapability(value: unknown): value is ModelCapability {
  const validCapabilities: ModelCapability[] = [
    'code-generation',
    'code-review',
    'code-debugging',
    'reasoning',
    'planning',
    'summarization',
    'analysis',
    'creative-writing',
    'translation',
    'vision',
    'tool-use',
    'function-calling',
    'structured-output',
    'long-context',
    'fast-inference',
  ];
  return typeof value === 'string' && validCapabilities.includes(value as ModelCapability);
}

/**
 * Type guard to check if an object is a valid Model
 */
export function isModel(value: unknown): value is Model {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    isModelProvider(obj.provider) &&
    typeof obj.displayName === 'string' &&
    Array.isArray(obj.capabilities) &&
    typeof obj.contextWindow === 'number' &&
    typeof obj.costPerInputToken === 'number' &&
    typeof obj.costPerOutputToken === 'number'
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial model for creation (some fields auto-generated)
 */
export type CreateModelInput = Omit<Model, 'createdAt' | 'updatedAt' | 'isAvailable'>;

/**
 * Partial model for updates
 */
export type UpdateModelInput = Partial<Omit<Model, 'id' | 'createdAt'>>;

/**
 * Model summary for list views (lighter weight)
 */
export interface ModelSummary {
  id: string;
  provider: ModelProvider;
  displayName: string;
  capabilities: ModelCapability[];
  costTier: 'free' | 'low' | 'medium' | 'high' | 'premium';
  speedRating: number;
  isLocal: boolean;
  isAvailable: boolean;
}

/**
 * Calculate cost tier from token pricing
 */
export function getCostTier(model: Model): ModelSummary['costTier'] {
  const avgCostPer1k = (model.costPerInputToken + model.costPerOutputToken) * 500;

  if (avgCostPer1k === 0) return 'free';
  if (avgCostPer1k < 0.001) return 'low';
  if (avgCostPer1k < 0.01) return 'medium';
  if (avgCostPer1k < 0.05) return 'high';
  return 'premium';
}

/**
 * Convert Model to ModelSummary
 */
export function toModelSummary(model: Model): ModelSummary {
  return {
    id: model.id,
    provider: model.provider,
    displayName: model.displayName,
    capabilities: model.capabilities,
    costTier: getCostTier(model),
    speedRating: model.speedRating,
    isLocal: model.isLocal,
    isAvailable: model.isAvailable,
  };
}
