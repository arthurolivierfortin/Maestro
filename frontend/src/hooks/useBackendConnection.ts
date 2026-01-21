/**
 * Backend Connection Hook
 *
 * Manages connection state to the backend API and provides
 * automatic health checks and reconnection logic.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRealDiscoveryService } from '../services/real/realDiscoveryService';
import { getErrorMessage } from '../services/api/errorHandling';

/**
 * Connection state
 */
export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastChecked: Date | null;
  backendVersion: string | null;
  blockCount: number;
  services: Record<string, string>;
}

/**
 * Hook return type
 */
export interface UseBackendConnectionResult extends ConnectionState {
  retry: () => Promise<void>;
  checkNow: () => Promise<void>;
}

/**
 * Use backend connection state with automatic health checks
 *
 * @param checkInterval - Interval between health checks in milliseconds (default: 30000)
 * @param enabled - Whether to enable automatic health checks (default: true)
 * @returns Connection state and retry function
 */
export function useBackendConnection(
  checkInterval = 30000,
  enabled = true
): UseBackendConnectionResult {
  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: true,
    error: null,
    lastChecked: null,
    backendVersion: null,
    blockCount: 0,
    services: {},
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * Check backend connection health
   */
  const checkConnection = useCallback(async () => {
    if (!mountedRef.current) return;

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const discoveryService = getRealDiscoveryService();
      const health = await discoveryService.getHealth();

      if (!mountedRef.current) return;

      setState({
        isConnected: health.isHealthy,
        isConnecting: false,
        error: health.isHealthy ? null : 'Backend is unhealthy',
        lastChecked: new Date(),
        backendVersion: health.version,
        blockCount: health.blockCount,
        services: health.services,
      });
    } catch (error: unknown) {
      if (!mountedRef.current) return;

      const errorMessage = getErrorMessage(error);

      setState({
        isConnected: false,
        isConnecting: false,
        error: errorMessage,
        lastChecked: new Date(),
        backendVersion: null,
        blockCount: 0,
        services: {},
      });
    }
  }, []);

  /**
   * Check connection immediately
   */
  const checkNow = useCallback(async () => {
    await checkConnection();
  }, [checkConnection]);

  /**
   * Retry connection (alias for checkConnection)
   */
  const retry = useCallback(async () => {
    await checkConnection();
  }, [checkConnection]);

  // Initial check and periodic health checks
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      return;
    }

    // Initial check
    checkConnection();

    // Set up periodic health checks
    if (checkInterval > 0) {
      intervalRef.current = setInterval(checkConnection, checkInterval);
    }

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkConnection, checkInterval, enabled]);

  return { ...state, retry, checkNow };
}

/**
 * Simple hook to just check if backend is connected (lighter weight)
 */
export function useIsBackendConnected(): boolean {
  const { isConnected } = useBackendConnection(60000); // Check every minute
  return isConnected;
}
