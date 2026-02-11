/**
 * Project-related types — the API contract for project data.
 */

export interface MaestroInfo {
  blocks: number;
  artifacts: number;
  metrics: number;
  logs: number;
}

export interface Project {
  id: string;
  name: string;
  rootPath?: string;
  containerStatus?: string;
  maestroInfo?: MaestroInfo;
  sessionIds?: string[];
}
