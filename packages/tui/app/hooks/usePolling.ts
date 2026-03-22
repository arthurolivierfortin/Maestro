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

interface PollingState<T> {
  data: T | null;
  error: string | null;
  connectionStatus: ConnectionStatus;
  latency: number;
  lastRefresh: Date | null;
}

/**
 * Polls a fetch function at a given interval.
 *
 * @param fetchFn - Async function that returns data
 * @param interval - Polling interval in ms (default 3000)
 */
export function usePolling<T>(fetchFn: () => Promise<T>, interval: number = 3000): UsePollingReturn<T> {
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    error: null,
    connectionStatus: 'connecting',
    latency: 0,
    lastRefresh: null,
  });
  const mountedRef = useRef<boolean>(true);
  const fetchFnRef = useRef<() => Promise<T>>(fetchFn);
  fetchFnRef.current = fetchFn;

  const refresh = useCallback(async () => {
    const start = Date.now();
    try {
      const result = await fetchFnRef.current();
      if (!mountedRef.current) return;
      // Single setState instead of 5 separate calls — one re-render per poll
      setState({
        data: result,
        latency: Date.now() - start,
        lastRefresh: new Date(),
        connectionStatus: 'connected',
        error: null,
      });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setState((prev: PollingState<T>) => ({
        ...prev,
        latency: Date.now() - start,
        connectionStatus: 'error' as ConnectionStatus,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // interval <= 0 means "don't poll" (widget not focused)
    if (interval <= 0) {
      return () => { mountedRef.current = false; };
    }
    refresh();
    const timer = setInterval(refresh, interval);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [interval, refresh]);

  return { ...state, refresh };
}

// Legacy alias for backward compatibility
export const useApiData = usePolling;
