/**
 * Workspace Types
 *
 * Type definitions for workspace management, isolation,
 * permissions, and cross-workspace operations.
 */

/**
 * Workspace type enum
 */
export type WorkspaceType = 'Research' | 'Training' | 'Staging' | 'Production' | 'Custom';

/**
 * Workspace status enum
 */
export type WorkspaceStatus = 'Active' | 'Paused' | 'Archived';

/**
 * Network configuration for workspace isolation
 */
export interface NetworkConfig {
  networkName: string;
  subnet?: string;
  gateway?: string;
  internal: boolean;
  labels: Record<string, string>;
}

/**
 * Resource limits for workspace isolation
 */
export interface WorkspaceResourceLimits {
  cpuPercentage: number;
  memoryMb: number;
  storageGb: number;
  maxContainers: number;
}

/**
 * Cross-workspace permissions
 */
export interface WorkspacePermissions {
  canReadFrom: string[];
  canWriteTo: string[];
  canPromoteTo: string[];
  allowReadFrom: string[];
  allowWriteFrom: string[];
}

/**
 * Workspace isolation configuration
 */
export interface WorkspaceIsolation {
  enabled: boolean;
  network?: NetworkConfig;
  resources?: WorkspaceResourceLimits;
  permissions: WorkspacePermissions;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  defaultModelId?: string;
  maxConcurrentSessions: number;
  maxConcurrentTrainingRuns: number;
  autoPromotionEnabled: boolean;
  minFitnessForPromotion: number;
  tags: string[];
}

/**
 * Workspace entity
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  sessionIds: string[];
  projectIds: string[];
  catalogRef?: string;
  settings: WorkspaceSettings;
  isolation: WorkspaceIsolation;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Workspace node in topology graph
 */
export interface WorkspaceNode {
  workspaceId: string;
  name: string;
  type: string;
  sessionCount: number;
  projectCount: number;
  isIsolated: boolean;
}

/**
 * Workspace edge in topology graph
 */
export interface WorkspaceEdge {
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  edgeType: 'promotion' | 'read' | 'write';
}

/**
 * Workspace topology graph
 */
export interface WorkspaceTopology {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
}

/**
 * Result of agent promotion
 */
export interface PromotionResult {
  success: boolean;
  promotedBlockId?: string;
  targetVersion?: string;
  errorMessage?: string;
  auditLogId?: string;
}

/**
 * Request to create a workspace
 */
export interface CreateWorkspaceRequest {
  name: string;
  type?: WorkspaceType;
  description?: string;
  isolated?: boolean;
  isolationConfig?: Partial<WorkspaceIsolation>;
  settings?: Partial<WorkspaceSettings>;
}

/**
 * Request to update a workspace
 */
export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
  isolation?: Partial<Omit<WorkspaceIsolation, 'permissions'>> & {
    permissions?: Partial<WorkspacePermissions>;
  };
}

/**
 * Request to promote an agent
 */
export interface PromoteAgentRequest {
  targetWorkspaceId: string;
  agentBlockId: string;
  version?: string;
}
