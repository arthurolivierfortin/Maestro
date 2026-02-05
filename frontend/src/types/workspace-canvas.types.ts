/**
 * Workspace Canvas Types
 *
 * Type definitions for the workspace canvas visualization,
 * including node data, edge types, and console entries.
 */

import type { SessionStatus } from './session.types';
import type { WorkspaceType } from './workspace.types';

/**
 * Block preview for display in session nodes
 */
export interface BlockPreview {
  id: string;
  name: string;
  type: string;
  icon?: string; // Optional - icons are rendered via BlockIcon component based on type
}

/**
 * Progress information for sessions
 */
export interface SessionProgress {
  current: number;
  total: number;
  label?: string;
}

/**
 * Metrics for a session node
 */
export interface SessionMetrics {
  messagesProcessed: number;
  errorsCount: number;
  lastActivity: string;
}

/**
 * Data for a session node on the canvas
 */
export interface SessionNodeData {
  sessionId: string;
  name: string;
  type: 'ProjectSession' | 'FoundrySession' | 'Session';
  status: SessionStatus;
  blockCount: number;
  activeBlockCount: number;
  startedAt?: string;
  progress?: SessionProgress;
  metrics?: SessionMetrics;
  blockPreviews?: BlockPreview[];
}

/**
 * Relationship type between workspaces
 */
export type WorkspaceRelationshipType = 'promotion' | 'read' | 'write';

/**
 * Data for an external workspace node on the canvas
 */
export interface ExternalWorkspaceNodeData {
  workspaceId: string;
  name: string;
  type: WorkspaceType;
  relationshipType: WorkspaceRelationshipType;
  isOnline: boolean;
  sessionCount?: number;
}

/**
 * Edge types for the canvas
 */
export type CanvasEdgeType = 'dataFlow' | 'promotion' | 'read' | 'write' | 'message';

/**
 * Data for canvas edges
 */
export interface CanvasEdgeData {
  lastTransfer?: string;
  transferCount?: number;
  animated?: boolean;
}

/**
 * Source information for console log entries
 */
export interface LogSource {
  sessionId: string;
  sessionName: string;
  blockId?: string;
  blockName?: string;
}

/**
 * Log level for console entries
 */
export type ConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Console log entry
 */
export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: ConsoleLogLevel;
  source: LogSource;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * View mode for the workspace canvas
 */
export type ViewMode = 'live' | 'design' | 'topology' | 'timeline' | 'blueprint';

/**
 * Selection state for the canvas
 */
export interface CanvasSelection {
  type: 'session' | 'workspace' | 'block' | null;
  id: string | null;
}

/**
 * Workspace metrics for real-time display
 */
export interface WorkspaceMetrics {
  activeSessionCount: number;
  totalBlockExecutions: number;
  errorCount: number;
  averageLatencyMs: number;
  timestamp: string;
}

/**
 * Props for linked workspace display
 */
export interface LinkedWorkspaceInfo {
  id: string;
  name: string;
  type: WorkspaceType;
  relationshipType: WorkspaceRelationshipType;
  isOnline: boolean;
  sessionCount?: number;
}

/**
 * Entry point type for workspace
 */
export type EntryPointType = 'main' | 'dashboard' | 'experiments' | 'settings' | 'custom';

/**
 * Entry point definition
 */
export interface EntryPoint {
  blockId: string;
  name: string;
  description?: string;
  type: EntryPointType;
}

/**
 * Data for a blueprint block node on the canvas
 */
export interface BlueprintBlockNodeData {
  blockId: string;
  name: string;
  blockType: string;
  description?: string;
  isAtomic: boolean;
  childCount?: number;
  isEntryPoint?: boolean;
  entryPointName?: string;
  entryPointType?: EntryPointType;
}
