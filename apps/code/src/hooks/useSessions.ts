import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSessions as fetchSessions,
  startSession as apiStartSession,
  stopSession as apiStopSession,
} from '../services/sessionService';
import type { SessionDto } from '../services/sessionService';

const POLL_INTERVAL = 5000;

export function useSessions() {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchSessions();
      setSessions(data);
      setError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load sessions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    intervalRef.current = setInterval(loadSessions, POLL_INTERVAL);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadSessions]);

  const startSession = useCallback(async (id: string) => {
    await apiStartSession(id);
    await loadSessions();
  }, [loadSessions]);

  const stopSession = useCallback(async (id: string) => {
    await apiStopSession(id);
    await loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    isLoading,
    error,
    startSession,
    stopSession,
  };
}
