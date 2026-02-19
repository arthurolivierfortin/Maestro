/**
 * Workspace-related types — the API contract for workspace data.
 */

export interface WorkspaceSettings {
  maxConcurrentSessions: number;
  autoPromotionEnabled: boolean;
  minFitnessForPromotion: number;
}

export interface Workspace {
  id: string;
  name: string;
  type?: string;
  status?: string;
  description?: string;
  repositoryPath?: string;
  sessionIds?: string[];
  settings?: WorkspaceSettings;
}
