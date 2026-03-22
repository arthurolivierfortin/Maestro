/**
 * Widget types for inline chat widgets.
 *
 * Phase 63-B: Widgets render inline in the ConversationLog.
 * Each widget type maps to a component that can be interactive or read-only.
 */

// ── Widget Types ─────────────────────────────────────────────

export type WidgetType =
  | 'status'           // System health + active sessions
  | 'sessions'         // Sessions list (Spaces tab)
  | 'workspaces'       // Workspaces list
  | 'repos'            // Repos list
  | 'catalog'          // Block catalog
  | 'foundry'          // My blocks
  | 'models'           // Model list + metrics
  | 'session-monitor'  // Full session monitor
  | 'block-detail'     // Block info
  | 'model-detail'     // Model info
  | 'workspace-detail' // Workspace info
  | 'repo-detail'      // Repo info
  | 'permissions';     // Permissions diff (placeholder, 63-D)

export interface ChatWidget {
  type: WidgetType;
  props: Record<string, any>;
  interactive: boolean;
}

// ── Conversation Entry (augmented) ───────────────────────────

export type ConversationEntry =
  | { type: 'user'; timestamp: string; content: string }
  | { type: 'agent'; timestamp: string; content: string }
  | { type: 'step'; timestamp: string; content: string }
  | { type: 'widget'; id: string; widget: ChatWidget; interactive: boolean };

// ── Height constraints per widget type ───────────────────────

export const WIDGET_HEIGHTS: Record<WidgetType, number | 'auto'> = {
  'status': 8,
  'sessions': 15,
  'workspaces': 15,
  'repos': 15,
  'catalog': 15,
  'foundry': 15,
  'models': 15,
  'session-monitor': -1, // computed: terminal.rows - 6
  'block-detail': 20,
  'model-detail': 20,
  'workspace-detail': 20,
  'repo-detail': 20,
  'permissions': 15,
};

// ── Widget collapsed summary ─────────────────────────────────

export const WIDGET_TITLES: Record<WidgetType, string> = {
  'status': 'System Status',
  'sessions': 'Sessions',
  'workspaces': 'Workspaces',
  'repos': 'Repos',
  'catalog': 'Catalog',
  'foundry': 'Foundry',
  'models': 'Models',
  'session-monitor': 'Session Monitor',
  'block-detail': 'Block Detail',
  'model-detail': 'Model Detail',
  'workspace-detail': 'Workspace Detail',
  'repo-detail': 'Repo Detail',
  'permissions': 'Permissions',
};
