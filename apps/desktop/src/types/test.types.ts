/**
 * Block Testing Types
 * Types for the block testing and evaluation system
 */

export type BlockTestRunStatus =
  | 'Pending'
  | 'Running'
  | 'AwaitingEvaluation'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type EvaluatorType =
  | 'manual'
  | 'claude-code'
  | 'llm-provider'
  | 'custom-agent';

export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface QualityCriterionScore {
  name: string;
  score: number;
  comment?: string;
}

export interface QualityScore {
  score: number;
  method: 'None' | 'Heuristic' | 'LLM' | 'Human' | 'Automated' | 'Custom';
  criteria: QualityCriterionScore[];
  explanation?: string;
  confidence: number;
  evaluatorModelId?: string;
  evaluatedAt?: string;
}

export interface BlockTestIteration {
  id: string;
  iterationNumber: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown | null>;
  outputContent?: string;
  logs: string[];
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  startedAt: string;
  completedAt?: string;
  evaluation?: QualityScore;
  evaluatedAt?: string;
}

export interface BlockTestRunMetrics {
  overallScore: number;
  minScore: number;
  maxScore: number;
  scoreVariance: number;
  criterionAverages: Record<string, number>;
  evaluatedCount: number;
  totalCount: number;
}

export interface BlockTestRun {
  id: string;
  name: string;
  blockId: string;
  blockType: string;
  variantId: string;
  variantDescription?: string;
  status: BlockTestRunStatus;
  totalIterations: number;
  completedIterations: number;
  evaluatedIterations: number;
  evaluatorType: EvaluatorType;
  evaluatorModelId?: string;
  criteria: EvaluationCriterion[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  iterations: BlockTestIteration[];
  metrics?: BlockTestRunMetrics;
  improvementSuggestions: string[];
  tags: string[];
}

export interface BlockTestRunComparison {
  runs: BlockTestRun[];
  bestRunId?: string;
  bestScore: number;
  scoresByVariant: Record<string, number>;
}

// Request/Response types
export interface CreateTestRunRequest {
  blockId: string;
  name?: string;
  iterations?: number;
  variantId?: string;
  variantDescription?: string;
  evaluatorType?: EvaluatorType;
  evaluatorModelId?: string;
  inputOverrides?: Record<string, unknown>;
  tags?: string[];
}

export interface SubmitEvaluationRequest {
  iterationId: string;
  overallScore: number;
  explanation?: string;
  criteriaScores?: QualityCriterionScore[];
  evaluatorType?: EvaluatorType;
  evaluatorModelId?: string;
  confidence?: number;
}

export interface TestRunFilter {
  blockId?: string;
  blockType?: string;
  status?: BlockTestRunStatus;
}

// Chart/Trend data types
export interface TestTrendPoint {
  date: string;
  score: number;
  runId: string;
  variantId: string;
}

export interface TestTrendData {
  blockId: string;
  points: TestTrendPoint[];
  averageScore: number;
  trend: 'improving' | 'stable' | 'declining';
}
