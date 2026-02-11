/**
 * Block-related types — the API contract for block data.
 */

export type BlockType =
  | 'workflow'
  | 'agent'
  | 'task'
  | 'tool'
  | 'prompt'
  | 'instruction'
  | 'decision'
  | 'validator'
  | 'trigger'
  | 'inference'
  | 'script';

export interface FitnessDimensions {
  performance: number;
  specialization: number;
  composability: number;
}

export interface TaskFitnessDimensions {
  completion: number;
  quality: number;
  costEfficiency: number;
  reliability: number;
}

export interface TaskFitness {
  score: number;
  dimensions: TaskFitnessDimensions;
}

export interface Block {
  id: string;
  name: string;
  type: BlockType;
  version?: string;
  description?: string;
  author?: string;
  fitness?: number | null;
  isAtomic: boolean;
  children?: string[];
  fitnessDimensions?: FitnessDimensions | null;
  taskFitness?: TaskFitness | null;
  sessionIds?: string[];
}
