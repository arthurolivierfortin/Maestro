import { useState, useEffect, useRef } from 'react';
import type { Session } from '@maestro/tui/types';
import type { IApiClient } from '@maestro/tui/types';

type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface UseSessionDataReturn {
  session: Session | null;
  sessions: Session[];
  error: string | null;
  connectionStatus: ConnectionStatus;
  latency: number;
  lastRefresh: Date | null;
}

const useSessionData = (
  apiClient: IApiClient,
  sessionId: string | null | undefined,
  interval: number = 2000
): UseSessionDataReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latency, setLatency] = useState<number>(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    const refresh = async (): Promise<void> => {
      const start = Date.now();
      try {
        if (sessionId) {
          const data = await apiClient.getSession(sessionId);
          if (!mountedRef.current) return;
          setSession(data);
        } else {
          const data = await apiClient.listSessions();
          if (!mountedRef.current) return;
          setSessions(data || []);
        }
        setLatency(Date.now() - start);
        setLastRefresh(new Date());
        setConnectionStatus('connected');
        setError(null);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        setLatency(Date.now() - start);
        setConnectionStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    refresh();
    const timer = setInterval(refresh, interval);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [sessionId, interval]);

  return { session, sessions, error, connectionStatus, latency, lastRefresh };
};

export { useSessionData };
export type { UseSessionDataReturn };
