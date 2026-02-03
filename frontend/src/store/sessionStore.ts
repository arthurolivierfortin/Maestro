/**
 * Session Store (Zustand)
 * Generic state management for session operations
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Session,
  SessionSummary,
  SessionStatus,
  SessionListFilters,
  CreateSessionRequest
} from '../types/session.types';
import { sessionService } from '../services/sessionService';

interface SessionState {
  // Data
  sessions: SessionSummary[];
  selectedSession: Session | null;

  // Filters
  statusFilter: SessionStatus | 'All';
  workspaceFilter: string | null;
  searchQuery: string;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSessions: (filters?: SessionListFilters) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (request: CreateSessionRequest) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  startSession: (id: string) => Promise<void>;
  pauseSession: (id: string) => Promise<void>;
  resumeSession: (id: string) => Promise<void>;
  stopSession: (id: string) => Promise<void>;
  retrySession: (id: string) => Promise<void>;
  setStatusFilter: (filter: SessionStatus | 'All') => void;
  setWorkspaceFilter: (workspaceId: string | null) => void;
  setSearchQuery: (query: string) => void;
  selectSession: (id: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // Computed (call as functions)
  filteredSessions: () => SessionSummary[];
  countByStatus: () => Record<SessionStatus | 'All', number>;
}

const initialState = {
  sessions: [],
  selectedSession: null,
  statusFilter: 'All' as SessionStatus | 'All',
  workspaceFilter: null,
  searchQuery: '',
  isLoading: false,
  error: null,
};

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSessions: async (filters?: SessionListFilters) => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await sessionService.getSessions(filters);
          set({ sessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sessions',
            isLoading: false
          });
        }
      },

      loadSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.getSession(id);
          set({ selectedSession: session, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load session',
            isLoading: false
          });
        }
      },

      createSession: async (request: CreateSessionRequest) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.createSession(request);
          // Reload sessions to get the new one in the list
          await get().loadSessions();
          set({ isLoading: false });
          return session;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session',
            isLoading: false
          });
          throw error;
        }
      },

      deleteSession: async (id: string) => {
        try {
          await sessionService.deleteSession(id);
          set(state => ({
            sessions: state.sessions.filter(s => s.id !== id),
            selectedSession: state.selectedSession?.id === id ? null : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete session' });
        }
      },

      startSession: async (id: string) => {
        try {
          const updated = await sessionService.startSession(id);
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, status: updated.status } : s
            ),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to start session' });
        }
      },

      pauseSession: async (id: string) => {
        try {
          const updated = await sessionService.pauseSession(id);
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, status: updated.status } : s
            ),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to pause session' });
        }
      },

      resumeSession: async (id: string) => {
        try {
          const updated = await sessionService.resumeSession(id);
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, status: updated.status } : s
            ),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to resume session' });
        }
      },

      stopSession: async (id: string) => {
        try {
          const updated = await sessionService.stopSession(id);
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, status: updated.status } : s
            ),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to stop session' });
        }
      },

      retrySession: async (id: string) => {
        try {
          const updated = await sessionService.retrySession(id);
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, status: updated.status } : s
            ),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to retry session' });
        }
      },

      setStatusFilter: (filter) => set({ statusFilter: filter }),
      setWorkspaceFilter: (workspaceId) => set({ workspaceFilter: workspaceId }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      selectSession: (id) => {
        if (id === null) {
          set({ selectedSession: null });
        } else {
          get().loadSession(id);
        }
      },

      clearError: () => set({ error: null }),
      reset: () => set(initialState),

      filteredSessions: () => {
        const { sessions, statusFilter, workspaceFilter, searchQuery } = get();
        return sessions.filter(s => {
          const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
          const matchesWorkspace = !workspaceFilter || s.workspaceId === workspaceFilter;
          const matchesSearch = !searchQuery ||
            s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.workspaceName.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesStatus && matchesWorkspace && matchesSearch;
        });
      },

      countByStatus: () => {
        const { sessions } = get();
        const counts: Record<SessionStatus | 'All', number> = {
          All: sessions.length,
          Pending: 0,
          Running: 0,
          Paused: 0,
          Completed: 0,
          Failed: 0,
          Cancelled: 0
        };
        sessions.forEach(s => counts[s.status]++);
        return counts;
      }
    }),
    { name: 'SessionStore' }
  )
);
