/**
 * Offline Mode Hook
 *
 * Detects when backend is unavailable and provides operation queueing
 * for automatic retry when connection is restored.
 */

import { useState, useCallback, useEffect } from 'react';
import { useBackendConnection } from './useBackendConnection';

/**
 * Pending operation to be retried when back online
 */
export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  description: string;
  execute: () => Promise<void>;
  createdAt: Date;
}

/**
 * Hook return type
 */
export interface UseOfflineModeResult {
  isOffline: boolean;
  pendingOperations: PendingOperation[];
  queueOperation: (operation: Omit<PendingOperation, 'id' | 'createdAt'>) => void;
  removeOperation: (id: string) => void;
  flushQueue: () => Promise<void>;
  clearQueue: () => void;
}

/**
 * Use offline mode detection and operation queueing
 *
 * @returns Offline state and queue management functions
 */
export function useOfflineMode(): UseOfflineModeResult {
  const { isConnected, error } = useBackendConnection();
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const [isFlushingRef, setIsFlushingRef] = useState(false);

  const isOffline = !isConnected && error !== null;

  /**
   * Queue an operation to be executed when back online
   */
  const queueOperation = useCallback(
    (operation: Omit<PendingOperation, 'id' | 'createdAt'>) => {
      const newOperation: PendingOperation = {
        ...operation,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
      };

      setPendingOperations((ops) => [...ops, newOperation]);
    },
    []
  );

  /**
   * Remove an operation from the queue
   */
  const removeOperation = useCallback((id: string) => {
    setPendingOperations((ops) => ops.filter((op) => op.id !== id));
  }, []);

  /**
   * Execute all pending operations
   */
  const flushQueue = useCallback(async () => {
    if (pendingOperations.length === 0 || isFlushingRef) {
      return;
    }

    setIsFlushingRef(true);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const op of pendingOperations) {
      try {
        await op.execute();
        results.push({ id: op.id, success: true });
      } catch (error) {
        console.error(`Failed to execute queued operation: ${op.id}`, error);
        results.push({
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Remove successful operations
    setPendingOperations((ops) =>
      ops.filter((op) => !results.find((r) => r.id === op.id && r.success))
    );

    setIsFlushingRef(false);
  }, [pendingOperations, isFlushingRef]);

  /**
   * Clear all pending operations
   */
  const clearQueue = useCallback(() => {
    setPendingOperations([]);
  }, []);

  // Auto-flush when coming back online
  useEffect(() => {
    if (isConnected && pendingOperations.length > 0 && !isFlushingRef) {
      flushQueue();
    }
  }, [isConnected, pendingOperations.length, isFlushingRef, flushQueue]);

  return {
    isOffline,
    pendingOperations,
    queueOperation,
    removeOperation,
    flushQueue,
    clearQueue,
  };
}
