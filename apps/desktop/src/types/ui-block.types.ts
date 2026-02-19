/**
 * UI Block Types
 * Defines the structure for custom UI blocks that can be rendered in workspaces
 * Following the Maestro Philosophy: "Tout est un Block"
 */

export type UIDisplayMode = 'panel' | 'fullpage' | 'modal' | 'sidebar';
export type UIFramework = 'vanilla' | 'react' | 'vue' | 'iframe';

export interface UIBlockDataBinding {
  source: string;
  transform?: string;
  refreshInterval?: number;
}

export interface UIBlockStyles {
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
}

export interface UIBlockConfig {
  entrypoint: string;
  displayMode: UIDisplayMode;
  framework: UIFramework;
  sandbox: boolean;
  permissions: string[];
  dataBindings: Record<string, string | UIBlockDataBinding>;
  styles?: UIBlockStyles;
}

export interface UIBlock {
  id: string;
  name: string;
  blockType: 'ui';
  version: string;
  description: string;
  config: UIBlockConfig;
  metadata?: Record<string, unknown>;
}

export interface UIBlockRenderContext {
  workspaceId: string;
  sessionId?: string;
  data: Record<string, unknown>;
  api: UIBlockAPI;
}

export interface UIBlockAPI {
  getSessions: () => Promise<unknown[]>;
  getBlocks: () => Promise<unknown[]>;
  getMetrics: () => Promise<unknown>;
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  execute: (blockId: string, input: unknown) => Promise<unknown>;
}

export interface UIBlockMessage {
  type: string;
  payload: unknown;
}
