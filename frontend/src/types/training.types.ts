/**
 * Training type definitions (Phase 9)
 *
 * Types for training runs, configurations, and optimization.
 */

import type { TrainingOptimizationGoal, WorkflowExecutionMetrics } from './metrics.types';

/**
 * Training run status
 */
export type TrainingRunStatus =
  | 'Pending'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

/**
 * Input variation type for training
 */
export type InputVariationType = 'Fixed' | 'Dataset' | 'Generated';

/**
 * Training iteration result
 */
export interface TrainingIteration {
  iterationNumber: number;
  executionId: string;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  errorMessage?: string;
  metrics?: WorkflowExecutionMetrics;
}

/**
 * Input variation configuration
 */
export interface InputVariationConfig {
  type: InputVariationType;
  fixedInputs?: Record<string, unknown>;
  datasetPath?: string;
  generatorPrompt?: string;
}

/**
 * Heuristic evaluation configuration
 */
export interface HeuristicEvaluationConfig {
  checkOutputNotEmpty: boolean;
  checkJsonValid: boolean;
  checkSchemaCompliance?: string;
}

/**
 * LLM evaluation configuration
 */
export interface LLMEvaluationConfig {
  modelId: string;
  evaluationPrompt?: string;
  criteria?: string[];
  scoreMin: number;
  scoreMax: number;
}

/**
 * Quality evaluation configuration
 */
export interface QualityEvaluationConfig {
  enabled: boolean;
  method: string;
  heuristics?: HeuristicEvaluationConfig;
  llmEvaluation?: LLMEvaluationConfig;
}

/**
 * Training constraints
 */
export interface TrainingConstraints {
  maxTotalCost?: number;
  maxIterationDuration?: number;
  stopOnFailure: boolean;
  minQualityScore?: number;
}

/**
 * Training configuration
 */
export interface TrainingConfiguration {
  id: string;
  name: string;
  description?: string;
  workflowId: string;
  workflowName?: string;
  iterations: number;
  parallelIterations: number;
  delayBetweenIterationsMs: number;
  inputVariation: InputVariationConfig;
  qualityEvaluation: QualityEvaluationConfig;
  optimizationGoal: TrainingOptimizationGoal;
  constraints?: TrainingConstraints;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Training run
 */
export interface TrainingRun {
  id: string;
  name: string;
  workflowId: string;
  configurationId: string;
  status: TrainingRunStatus;
  totalIterations: number;
  completedIterations: number;
  failedIterations: number;
  parallelIterations: number;
  iterations: TrainingIteration[];
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
  initiatedBy?: string;
  errorMessage?: string;
  tags: string[];
  // Computed metrics
  averageQualityScore?: number;
  consistencyScore?: number;
  totalCostUsd?: number;
  averageDurationMs?: number;
}

/**
 * Training run summary for lists
 */
export interface TrainingRunSummary {
  id: string;
  name: string;
  workflowId: string;
  workflowName?: string;
  status: TrainingRunStatus;
  totalIterations: number;
  completedIterations: number;
  failedIterations: number;
  startedAt?: string;
  completedAt?: string;
  averageQualityScore?: number;
  totalCostUsd?: number;
}

/**
 * Create training configuration request
 */
export interface CreateTrainingConfigRequest {
  name: string;
  description?: string;
  workflowId: string;
  iterations: number;
  parallelIterations?: number;
  delayBetweenIterationsMs?: number;
  inputVariation?: InputVariationConfig;
  qualityEvaluation?: QualityEvaluationConfig;
  optimizationGoal?: TrainingOptimizationGoal;
  constraints?: TrainingConstraints;
  tags?: string[];
}

/**
 * Start training run request
 */
export interface StartTrainingRunRequest {
  configurationId: string;
  name?: string;
  inputs?: Record<string, unknown>;
}

/**
 * Training dashboard statistics
 */
export interface TrainingDashboardStats {
  totalConfigurations: number;
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalIterations: number;
  averageSuccessRate: number;
  totalCostUsd: number;
  recentRuns: TrainingRunSummary[];
}
