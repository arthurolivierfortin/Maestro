/**
 * Metrics type definitions (Phase 9)
 *
 * Types for workflow execution metrics, model usage tracking,
 * and quality evaluation.
 */

/**
 * Quality evaluation method
 */
export type QualityEvaluationMethod = 'None' | 'Heuristic' | 'LLM' | 'Combined';

/**
 * Optimization goal for training (Pascal case for backend compatibility)
 * Note: model.types.ts has a lowercase version for Phase 13
 */
export type TrainingOptimizationGoal = 'Quality' | 'Speed' | 'Cost' | 'Balanced';

/**
 * Per-block execution metrics
 */
export interface BlockMetrics {
  blockId: string;
  blockType: string;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  success: boolean;
  errorMessage?: string;
  retryCount: number;
  modelId?: string;
}

/**
 * Per-LLM call metrics
 */
export interface ModelUsageMetrics {
  callId: string;
  modelId: string;
  providerId: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  success: boolean;
  errorCode?: string;
  promptCacheHit: boolean;
  streamingEnabled: boolean;
}

/**
 * Quality criterion for evaluation
 */
export interface QualityCriterion {
  name: string;
  score: number;
  weight: number;
  passed?: boolean;
  description?: string;
}

/**
 * Quality score from evaluation
 */
export interface QualityScore {
  score: number;
  method: QualityEvaluationMethod;
  criteria: QualityCriterion[];
  explanation?: string;
  confidence: number;
  evaluatorModelId?: string;
}

/**
 * Aggregated workflow execution metrics
 */
export interface WorkflowExecutionMetrics {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  blockMetrics: BlockMetrics[];
  modelUsage: ModelUsageMetrics[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  successRate: number;
  averageBlockDuration: number;
  qualityScore?: QualityScore;
  status: string;
  errorMessage?: string;
  tags: string[];
  trainingRunId?: string;
  iterationNumber?: number;
}

/**
 * Cost breakdown by model
 */
export interface ModelCostBreakdown {
  modelId: string;
  providerId: string;
  callCount: number;
  totalTokens: number;
  totalCostUsd: number;
  averageLatencyMs: number;
}

/**
 * Aggregated metrics for analysis
 */
export interface AggregatedMetrics {
  workflowId?: string;
  period: string;
  executionCount: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  totalTokens: number;
  totalCostUsd: number;
  successRate: number;
  averageQualityScore?: number;
  modelBreakdown: ModelCostBreakdown[];
}

/**
 * Query parameters for metrics
 */
export interface MetricsQuery {
  workflowId?: string;
  startDate?: string;
  endDate?: string;
  minQualityScore?: number;
  includeFailures?: boolean;
  limit?: number;
  offset?: number;
  tags?: string[];
  trainingRunId?: string;
}

/**
 * Metrics dashboard summary
 */
export interface MetricsDashboardSummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalCostUsd: number;
  totalTokens: number;
  averageQualityScore: number;
  averageDurationMs: number;
  recentExecutions: WorkflowExecutionMetrics[];
  topWorkflows: WorkflowMetricsSummary[];
}

/**
 * Per-workflow metrics summary
 */
export interface WorkflowMetricsSummary {
  workflowId: string;
  workflowName: string;
  executionCount: number;
  successRate: number;
  averageCostUsd: number;
  averageDurationMs: number;
  averageQualityScore?: number;
  lastExecutedAt?: string;
}
