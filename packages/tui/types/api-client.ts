/**
 * IApiClient — TypeScript interface for the Maestro API client.
 *
 * Both MockApiClient and MaestroApiClient implement this contract.
 */

import type { Session } from './session.ts';
import type { Block } from './block.ts';
import type { Workspace } from './workspace.ts';
import type { Project } from './project.ts';
import type { LLMHealth, LLMModel, LLMStatus, ModelPerformance } from './llm.ts';

export interface HealthResponse {
  status: string;
  uptime?: string;
  version?: string;
}

export interface IApiClient {
  // Sessions
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session>;

  // Health
  getHealth(): Promise<HealthResponse>;

  // LLM
  getLLMHealth(): Promise<LLMHealth>;
  listLLMModels(): Promise<LLMModel[]>;
  getLLMStatus(): Promise<LLMStatus>;

  // Blocks
  listBlocks(filter?: { type?: string; designation?: string; category?: string }): Promise<Block[]>;
  getBlock(id: string): Promise<Block | null>;
  getBlockMetrics(id: string): Promise<unknown>;
  getTopBlocks(options?: { designation?: string; type?: string; limit?: number }): Promise<Block[]>;
  designateBlock(id: string, designation: string): Promise<unknown>;
  recordBlockRun(id: string, data: unknown): Promise<unknown>;

  // Model performance
  getModelPerformance(modelId: string): Promise<ModelPerformance>;

  // Projects
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project>;

  // Workspaces
  getWorkspace(id: string): Promise<Workspace>;

  // Costs
  getCostsSummary(): Promise<any>;
  getCostsLimits(): Promise<any>;
  setCostsLimits(limits: any): Promise<any>;

  // Generic
  get(path: string): Promise<unknown>;

  // URL
  getApiUrl(): string;
}
