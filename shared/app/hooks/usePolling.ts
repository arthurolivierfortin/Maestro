/**
 * usePolling — Generic polling hook for API data.
 *
 * Pure React hook (no Ink or DOM dependency). Works in both TUI and Frontend.
 * Replaces the duplicated useApiData hook.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

export interface UsePollingReturn<T> {
  data: T | null;
  error: string | null;
  connectionStatus: ConnectionStatus;
  latency: number;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Polls a fetch function at a given interval.
 *
 * @param fetchFn - Async function that returns data
 * @param interval - Polling interval in ms (default 3000)
 */
export function usePolling<T>(fetchFn: () => Promise<T>, interval: number = 3000): UsePollingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latency, setLatency] = useState<number>(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const mountedRef = useRef<boolean>(true);
  const fetchFnRef = useRef<() => Promise<T>>(fetchFn);
  fetchFnRef.current = fetchFn;

  const refresh = useCallback(async () => {
    const start = Date.now();
    try {
      const result = await fetchFnRef.current();
      if (!mountedRef.current) return;
      setData(result);
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
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const timer = setInterval(refresh, interval);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [interval, refresh]);

  return { data, error, connectionStatus, latency, lastRefresh, refresh };
}

// Legacy alias for backward compatibility
export const useApiData = usePolling;
