/**
 * SignalR hub names used by the Maestro backend.
 */
export const HUB_NAMES = {
  blocks: '/hubs/blocks',
  execution: '/hubs/execution',
  sessions: '/hubs/sessions',
  workspaces: '/hubs/workspaces',
  terminal: '/hubs/terminal',
  projects: '/hubs/projects',
} as const;

export type HubName = keyof typeof HUB_NAMES;

/**
 * Common event types broadcast by hubs.
 */
export interface BlockUpdatedEvent {
  blockId: string;
  [key: string]: unknown;
}

export interface ExecutionUpdatedEvent {
  executionId: string;
  nodeId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface SessionUpdatedEvent {
  sessionId: string;
  [key: string]: unknown;
}

export interface WorkspaceUpdatedEvent {
  workspaceId: string;
  [key: string]: unknown;
}
