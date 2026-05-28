import { useState, useEffect, useCallback } from 'react';

interface BackendStatus {
  connected: boolean;
  checking: boolean;
}

export function useBackendStatus(intervalMs = 10000): BackendStatus {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/discovery/health');
      setConnected(res.ok);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, intervalMs);
    return () => clearInterval(id);
  }, [checkStatus, intervalMs]);

  return { connected, checking };
}
