/**
 * useApiData — Generic polling hook for API data fetching.
 *
 * Replaces the need to duplicate useSessionData for each page.
 * Takes any async function and polls it at a configurable interval.
 *
 * Usage:
 *   const { data, error, connectionStatus, latency, lastRefresh, refresh } =
 *     useApiData(() => apiClient.getHealth(), 5000);
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const useApiData = (fetchFn, interval = 3000) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [latency, setLatency] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);

  // Keep fetchFn ref up to date without re-triggering effect
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
    } catch (err) {
      if (!mountedRef.current) return;
      setLatency(Date.now() - start);
      setConnectionStatus('error');
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    refresh();

    // Polling
    const timer = setInterval(refresh, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [interval, refresh]);

  return { data, error, connectionStatus, latency, lastRefresh, refresh };
};

export { useApiData };
