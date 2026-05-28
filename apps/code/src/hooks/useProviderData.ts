import { useState, useEffect, useCallback, useRef } from 'react';
import { getHealth, getModels, getActiveProvider, getStats } from '../services/providerService';
import type { ProviderHealth, CompatibleModelsResponse, ActiveProviderInfo, ProviderStats } from '../services/providerService';

const POLL_INTERVAL = 10_000;

export function useProviderData() {
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [models, setModels] = useState<CompatibleModelsResponse | null>(null);
  const [activeProvider, setActiveProvider] = useState<ActiveProviderInfo | null>(null);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [h, m, a, s] = await Promise.all([
        getHealth(),
        getModels(),
        getActiveProvider(),
        getStats(),
      ]);
      if (!mountedRef.current) return;
      setHealth(h);
      setModels(m);
      setActiveProvider(a);
      setStats(s);
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to fetch provider data');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const id = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAll]);

  return { health, models, activeProvider, stats, isLoading, error };
}
