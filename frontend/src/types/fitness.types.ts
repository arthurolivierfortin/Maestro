/**
 * Fitness type definitions (Phase 11)
 *
 * Types for model fitness calculations, profiles, and rankings.
 * Based on the fitness formula:
 *
 *                P × S × W
 * ModelFitness = ─────────────────────────
 *                (C_norm × C_compute × C_hw)^λ
 */

/**
 * Fitness score breakdown components
 */
export interface FitnessBreakdown {
  performance: number;
  specialization: number;
  composability: number;
  economicCost: number;
  computeCost: number;
  hardwareCost: number;
  totalFitness: number;
  numerator?: number;
  combinedCost?: number;
}

/**
 * Complete fitness score with all components
 */
export interface FitnessScore {
  /** Performance component (P) - Quality score normalized to 0-1 */
  performance: number;
  /** Specialization component (S) - P / TaskEntropy */
  specialization: number;
  /** Composability component (W) - SuccessRate × RetryPenalty */
  composability: number;
  /** Normalized economic cost (C_norm) */
  economicCost: number;
  /** Computational cost (C_compute) - log10(params) × (FLOPs/1e9) */
  computeCost: number;
  /** Hardware cost (C_hw) - α×VRAM + β×RAM + γ×GPU */
  hardwareCost: number;
  /** Lambda (λ) - Cost sensitivity exponent used in calculation */
  lambda: number;
  /** The model ID this fitness was calculated for */
  modelId: string;
  /** The task type this fitness was calculated for */
  taskType: string;
  /** The total fitness score calculated using the formula */
  totalFitness: number;
  /** When the fitness was calculated */
  calculatedAt: string;
}

/**
 * Model profile for fitness calculations
 */
export interface ModelProfile {
  /** Unique identifier for the model */
  modelId: string;
  /** Human-readable name */
  displayName: string;
  /** Provider of the model (openai, anthropic, ollama) */
  provider: string;
  /** Number of parameters in billions */
  parametersBillions: number;
  /** FLOPs per token */
  flopsPerToken: number;
  /** VRAM requirement in GB */
  vramGb: number;
  /** RAM requirement in GB */
  ramGb: number;
  /** GPU requirement (0-1 scale) */
  gpuRequirement: number;
  /** Cost per million input tokens in USD */
  costPerMillionInputTokens: number;
  /** Cost per million output tokens in USD */
  costPerMillionOutputTokens: number;
  /** Context window size in tokens */
  contextWindowSize: number;
  /** Whether this is a local model */
  isLocal: boolean;
  /** Average latency per token in milliseconds */
  avgLatencyMsPerToken: number;
  /** Task types this model excels at */
  specializations: string[];
  /** When the profile was last updated */
  updatedAt: string;
  /** Computed compute cost */
  computeCost?: number;
  /** Computed hardware cost */
  hardwareCost?: number;
  /** Average cost per million tokens */
  averageCostPerMillion?: number;
}

/**
 * Task entropy for measuring model specialization
 */
export interface TaskEntropy {
  /** The entity ID (model or agent) */
  entityId: string;
  /** The type of entity */
  entityType: 'model' | 'agent';
  /** Distribution of task types executed */
  taskDistribution: Record<string, number>;
  /** Calculated Shannon entropy value */
  entropyValue: number;
  /** Total number of tasks executed */
  totalTasks: number;
  /** Number of unique task types */
  uniqueTaskTypes: number;
  /** Maximum possible entropy */
  maxEntropy: number;
  /** Normalized entropy (0-1) */
  normalizedEntropy: number;
  /** Specialization score (inverse of normalized entropy) */
  specializationScore: number;
  /** The dominant task type */
  dominantTaskType?: string;
  /** When the entropy was last calculated */
  calculatedAt: string;
}

/**
 * Fitness configuration parameters
 */
export interface FitnessConfig {
  /** Lambda (λ) - Cost sensitivity exponent */
  lambda: number;
  /** Weight for VRAM in hardware cost (α) */
  vramWeight: number;
  /** Weight for RAM in hardware cost (β) */
  ramWeight: number;
  /** Weight for GPU in hardware cost (γ) */
  gpuWeight: number;
  /** Baseline cost for normalization */
  baselineCostPerMillion: number;
  /** Penalty factor per retry attempt */
  retryPenaltyFactor: number;
  /** Minimum fitness threshold for selection */
  minimumFitnessThreshold: number;
  /** Maximum fitness score cap */
  maximumFitnessScore: number;
  /** Weight for performance component */
  performanceWeight: number;
  /** Weight for specialization component */
  specializationWeight: number;
  /** Weight for composability component */
  composabilityWeight: number;
  /** When the configuration was last updated */
  updatedAt: string;
}

/**
 * Model fitness ranking for leaderboard
 */
export interface ModelFitnessRanking {
  /** Rank position (1 = best) */
  rank: number;
  /** The model ID */
  modelId: string;
  /** Human-readable model name */
  displayName: string;
  /** The model provider */
  provider: string;
  /** Average fitness score */
  averageFitness: number;
  /** Number of executions */
  executionCount: number;
  /** Best fitness score achieved */
  bestFitness: number;
  /** Task type this ranking is for */
  taskType?: string;
  /** Average breakdown of fitness components */
  breakdown?: FitnessBreakdown;
  /** When the ranking was last updated */
  updatedAt: string;
}

/**
 * Aggregate fitness statistics
 */
export interface AggregateFitnessStats {
  averageFitness: number;
  minFitness: number;
  maxFitness: number;
  fitnessVariance: number;
  fitnessStdDev: number;
  sampleCount: number;
  averageBreakdown?: FitnessBreakdown;
}

/**
 * Request to calculate fitness
 */
export interface CalculateFitnessRequest {
  executionId?: string;
  modelId: string;
  taskType: string;
  metrics?: {
    executionId: string;
    workflowId: string;
    totalDurationMs: number;
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    blocksTotal: number;
    blocksSucceeded: number;
    blocksFailed: number;
    totalRetries: number;
    quality?: {
      score: number;
    };
  };
}

/**
 * Request to update model profile
 */
export interface UpdateModelProfileRequest {
  displayName?: string;
  parametersBillions?: number;
  flopsPerToken?: number;
  vramGb?: number;
  ramGb?: number;
  gpuRequirement?: number;
  costPerMillionInputTokens?: number;
  costPerMillionOutputTokens?: number;
  contextWindowSize?: number;
  isLocal?: boolean;
  avgLatencyMsPerToken?: number;
  specializations?: string[];
}

/**
 * Request to update fitness configuration
 */
export interface UpdateFitnessConfigRequest {
  lambda?: number;
  vramWeight?: number;
  ramWeight?: number;
  gpuWeight?: number;
  baselineCostPerMillion?: number;
  retryPenaltyFactor?: number;
  minimumFitnessThreshold?: number;
  maximumFitnessScore?: number;
  performanceWeight?: number;
  specializationWeight?: number;
  composabilityWeight?: number;
}
