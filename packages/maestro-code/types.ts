/**
 * Centralized types for maestro-code.
 *
 * IMaestroCodeApiClient extends IApiClient with methods needed by SessionManager
 * (createSession, startSession, _fetch) that are not part of the universal
 * IApiClient contract in @maestro/tui.
 *
 * InteractiveOptions is the single source of truth for startInteractiveMode
 * and SessionManager constructor options.
 */

import type { IApiClient } from '@maestro/tui/types';

// ── API Client ───────────────────────────────────────────────

export interface CreateSessionOptions {
  repositoryPath: string;
  authority: string;
  name: string;
}

export interface IMaestroCodeApiClient extends IApiClient {
  createSession(opts: CreateSessionOptions): Promise<{ id: string }>;
  startSession(id: string): Promise<unknown>;
  _fetch(method: string, path: string, options?: { body?: unknown }): Promise<unknown>;
}

// ── Interactive Options ──────────────────────────────────────

export interface InteractiveOptions {
  apiClient?: IMaestroCodeApiClient | null;
  sidecar?: { stop(): Promise<void> } | null;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  importSessionTemplate?: (sessionId: string, templateName: string, options?: { quiet?: boolean }) => Promise<void>;
  noSplash?: boolean;
  isFirstRun?: boolean;
  hasProviders?: boolean;
  ensureBackendFn?: () => Promise<{ apiClient: IMaestroCodeApiClient; sidecar: { stop(): Promise<void> } | null }>;
  saveProviders?: (providers: Record<string, unknown>) => void;
  readProviders?: () => Record<string, unknown> | null;
  demo?: boolean;
  noBell?: boolean;
}
