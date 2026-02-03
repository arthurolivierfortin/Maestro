/**
 * Experiment Types for Training Strategies Phase 7
 */

export type ExperimentStatus =
  | 'Created'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface IterationSnapshot {
  iteration: number;
  fitness: number;
  cost: number;
  timestamp: string;
  success: boolean;
  metrics: Record<string, number>;
  error?: string;
}

export interface ExperimentResults {
  initialFitness: number;
  finalFitness: number;
  fitnessImprovement: number;
  fitnessImprovementPercent: number;
  totalIterations: number;
  successfulIterations: number;
  successRate: number;
  totalCost: number;
  totalDuration: string;
  costEfficiency: number;
  timeEfficiency: number;
  bestFitness: number;
  bestIteration: number;
  stopReason: string;
  snapshots: IterationSnapshot[];
}

export interface Experiment {
  id: string;
  name: string;
  workspaceId: string;
  targetAgentId: string;
  strategyBlockId: string;
  status: ExperimentStatus;
  config: Record<string, unknown>;
  sessionIds: string[];
  results?: ExperimentResults;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  currentIteration: number;
  currentFitness: number;
}

export interface CreateExperimentRequest {
  name: string;
  workspaceId: string;
  agentId: string;
  strategyId: string;
  config?: Record<string, unknown>;
}

export interface UpdateExperimentRequest {
  name?: string;
  config?: Record<string, unknown>;
}

export interface EstimatedResources {
  minIterations: number;
  typicalIterations: number;
  maxIterations: number;
  costPerIteration: string;
}

export interface StrategyInfo {
  id: string;
  name: string;
  method: string;
  category: string;
  description: string;
  suitableFor: string[];
  strengths: string[];
  weaknesses: string[];
  estimatedResources?: EstimatedResources;
  isSystem: boolean;
  isOverridable: boolean;
}

export interface ExperimentRanking {
  fitnessRank: number;
  costEfficiencyRank: number;
  timeEfficiencyRank: number;
  overallRank: number;
  score: number;
}

export interface ComparisonSummary {
  bestFitness: number;
  averageFitness: number;
  bestCostEfficiency: number;
  mostEffectiveStrategy: string;
  totalIterationsAcrossAll: number;
  totalCostAcrossAll: number;
}

export interface ExperimentComparison {
  experiments: Experiment[];
  bestExperimentId: string;
  recommendedStrategyId: string;
  rankings: Record<string, ExperimentRanking>;
  summary: ComparisonSummary;
}

export interface ExperimentProgress {
  experimentId: string;
  status: string;
  progress: number;
  currentIteration: number;
  maxIterations: number;
  currentFitness: number;
  startedAt?: string;
  elapsedTime?: string;
}

export interface StrategyRecommendation {
  strategyId: string;
  strategyName: string;
  confidenceScore: number;
  reasoning: string;
  pros: string[];
  cons: string[];
}

// Strategy categories for filtering
export type StrategyCategory =
  | 'supervised'
  | 'reinforcement'
  | 'preference'
  | 'verification'
  | 'population'
  | 'transfer'
  | 'progressive'
  | 'self-improvement'
  | 'hybrid'
  | 'ensemble';

// Training method types matching backend
export type TrainingMethodType =
  | 'SupervisedFineTuning'
  | 'ReinforcementLearning'
  | 'PreferenceLearning'
  | 'ExecutionBased'
  | 'Evolutionary'
  | 'Distillation'
  | 'CurriculumLearning'
  | 'SelfPlay'
  | 'NeuroSymbolic'
  | 'MixtureOfExperts';
