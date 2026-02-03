/**
 * Session Store (Zustand) - Phase 11
 *
 * Global state management for unified sessions.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Session,
  SessionSummary,
  CreateSessionRequest,
  CreateSessionFromTemplateRequest,
  SessionStatus,
  EnvironmentMode,
} from '../types/session.types';
import { sessionService } from '../services/sessionService';

interface SessionState {
  // State
  sessions: SessionSummary[];
  currentSession: Session | null;
  activeSessions: SessionSummary[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSessions: (params?: {
    status?: SessionStatus;
    mode?: EnvironmentMode;
    categoryId?: string;
    templateId?: string;
    limit?: number;
  }) => Promise<void>;
  loadActiveSessions: () => Promise<void>;
  loadSessionsByCategory: (
    categoryId: string,
    params?: { status?: SessionStatus; limit?: number }
  ) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (request: CreateSessionRequest) => Promise<Session>;
  createSessionFromTemplate: (
    templateId: string,
    request: CreateSessionFromTemplateRequest
  ) => Promise<Session>;
  startSession: (id: string) => Promise<void>;
  stopSession: (id: string) => Promise<void>;
  pauseSession: (id: string) => Promise<void>;
  resumeSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  sessions: [],
  currentSession: null,
  activeSessions: [],
  isLoading: false,
  error: null,
};

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSessions: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await sessionService.getAll(params);
          set({ sessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sessions',
            isLoading: false,
          });
        }
      },

      loadActiveSessions: async () => {
        set({ isLoading: true, error: null });
        try {
          const activeSessions = await sessionService.getActive();
          set({ activeSessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load active sessions',
            isLoading: false,
          });
        }
      },

      loadSessionsByCategory: async (categoryId, params) => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await sessionService.getByCategory(categoryId, params);
          set({ sessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sessions',
            isLoading: false,
          });
        }
      },

      loadSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.getById(id);
          set({ currentSession: session, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load session',
            isLoading: false,
          });
        }
      },

      createSession: async (request: CreateSessionRequest) => {
        set({ isLoading: true, error: null });
        try {
          const created = await sessionService.create(request);
          const summary: SessionSummary = {
            id: created.id,
            name: created.name,
            status: created.status,
            mode: created.config.mode,
            categoryId: created.config.categoryId,
            sandboxImageId: created.config.sandboxImageId,
            templateId: created.config.templateId,
            createdAt: created.createdAt,
            startedAt: created.startedAt,
            completedAt: created.completedAt,
            durationMs: created.durationMs,
          };
          const sessions = [summary, ...get().sessions];
          set({ sessions, currentSession: created, isLoading: false });
          return created;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session',
            isLoading: false,
          });
          throw error;
        }
      },

      createSessionFromTemplate: async (
        templateId: string,
        request: CreateSessionFromTemplateRequest
      ) => {
        set({ isLoading: true, error: null });
        try {
          const created = await sessionService.createFromTemplate(templateId, request);
          const summary: SessionSummary = {
            id: created.id,
            name: created.name,
            status: created.status,
            mode: created.config.mode,
            categoryId: created.config.categoryId,
            sandboxImageId: created.config.sandboxImageId,
            templateId: created.config.templateId,
            createdAt: created.createdAt,
            startedAt: created.startedAt,
            completedAt: created.completedAt,
            durationMs: created.durationMs,
          };
          const sessions = [summary, ...get().sessions];
          set({ sessions, currentSession: created, isLoading: false });
          return created;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session from template',
            isLoading: false,
          });
          throw error;
        }
      },

      startSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.start(id);
          const sessions = get().sessions.map((s) =>
            s.id === id ? { ...s, status: session.status, startedAt: session.startedAt } : s
          );
          set({
            sessions,
            currentSession: get().currentSession?.id === id ? session : get().currentSession,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to start session',
            isLoading: false,
          });
        }
      },

      stopSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.stop(id);
          const sessions = get().sessions.map((s) =>
            s.id === id ? { ...s, status: session.status, completedAt: session.completedAt } : s
          );
          set({
            sessions,
            currentSession: get().currentSession?.id === id ? session : get().currentSession,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to stop session',
            isLoading: false,
          });
        }
      },

      pauseSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.pause(id);
          const sessions = get().sessions.map((s) =>
            s.id === id ? { ...s, status: session.status } : s
          );
          set({
            sessions,
            currentSession: get().currentSession?.id === id ? session : get().currentSession,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to pause session',
            isLoading: false,
          });
        }
      },

      resumeSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.resume(id);
          const sessions = get().sessions.map((s) =>
            s.id === id ? { ...s, status: session.status } : s
          );
          set({
            sessions,
            currentSession: get().currentSession?.id === id ? session : get().currentSession,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to resume session',
            isLoading: false,
          });
        }
      },

      deleteSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await sessionService.delete(id);
          const sessions = get().sessions.filter((s) => s.id !== id);
          set({
            sessions,
            currentSession: get().currentSession?.id === id ? null : get().currentSession,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete session',
            isLoading: false,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'SessionStore' }
  )
);
