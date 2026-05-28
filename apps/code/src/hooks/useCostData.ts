import { useState, useEffect, useCallback, useRef } from 'react';
import { getCostSummary, getCostLimits } from '../services/costsService';
import type { CostSummary, CostLimits } from '../services/costsService';

const POLL_INTERVAL = 30_000;

export function useCostData() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [limits, setLimits] = useState<CostLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        getCostSummary(),
        getCostLimits(),
      ]);
      if (!mountedRef.current) return;
      setSummary(s);
      setLimits(l);
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to fetch cost data');
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

  return { summary, limits, isLoading, error };
}
