/**
 * useSessionData — Polls the API for session data at a regular interval.
 *
 * Returns { session, sessions, error, connectionStatus, latency, lastRefresh }
 *
 * Usage:
 *   const data = useSessionData(apiClient, sessionId, 2000);
 *   const list = useSessionData(apiClient, null, 3000); // list mode
 */

import { useState, useEffect, useRef } from 'react';

const useSessionData = (apiClient, sessionId, interval = 2000) => {
  const [session, setSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [latency, setLatency] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const refresh = async () => {
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
      } catch (err) {
        if (!mountedRef.current) return;
        setLatency(Date.now() - start);
        setConnectionStatus('error');
        setError(err.message);
      }
    };

    // Initial fetch
    refresh();

    // Polling
    const timer = setInterval(refresh, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [sessionId, interval]);

  return { session, sessions, error, connectionStatus, latency, lastRefresh };
};

export { useSessionData };
