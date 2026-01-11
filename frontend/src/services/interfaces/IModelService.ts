/**
 * Model Service Interface
 *
 * Defines all operations for AI model management.
 * Both mock and real implementations MUST implement this interface.
 */

import type { Model, ModelProvider, ModelCapability, TaskType } from '../../types/model.types';

/**
 * DTO for creating a new model
 */
export interface CreateModelDto {
  id?: string;
  name: string;
  displayName: string;
  provider: ModelProvider;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  speedRating: number;
  qualityRatings: Partial<Record<TaskType, number>>;
  strengths?: string[];
  weaknesses?: string[];
  supportsStreaming?: boolean;
  supportsToolCalls?: boolean;
  supportsVision?: boolean;
  isLocal?: boolean;
  apiEndpoint?: string;
}

/**
 * DTO for updating an existing model
 */
export type UpdateModelDto = Partial<Omit<CreateModelDto, 'id'>>;

/**
 * Result of a model connection test
 */
export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
  testedAt: string;
}

/**
 * Model Service Interface
 *
 * All model service implementations (mock and real) MUST implement this interface.
 */
export interface IModelService {
  /** Get all configured models */
  getAll(): Promise<Model[]>;

  /** Get a specific model by ID, returns null if not found */
  getById(id: string): Promise<Model | null>;

  /** Create a new model configuration */
  create(dto: CreateModelDto): Promise<Model>;

  /** Update an existing model */
  update(id: string, updates: UpdateModelDto): Promise<Model>;

  /** Delete a model configuration */
  delete(id: string): Promise<void>;

  /** Test connectivity to a model's API */
  testConnection(id: string, apiEndpoint?: string): Promise<ConnectionTestResult>;
}
