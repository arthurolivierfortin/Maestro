/**
 * useWorkspaceRealtime Hook
 *
 * Manages real-time SignalR connection for workspace visualization.
 * Provides session state updates, events, metrics, and console logs.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  signalRManager,
  WorkspaceJoinedMessage,
  WorkspaceSessionStateMessage,
  WorkspaceSessionEventMessage,
  WorkspaceAgentEventMessage,
  WorkspaceMetricsMessage,
  WorkspacePromotionMessage,
  WorkspaceConsoleLogMessage,
} from '../services/signalr/SignalRManager';
import type { ConsoleLogEntry, WorkspaceMetrics } from '../types/workspace-canvas.types';

export interface UseWorkspaceRealtimeOptions {
  /** Enable real-time updates */
  enabled?: boolean;
  /** Maximum console logs to keep in memory */
  maxConsoleLogs?: number;
}

export interface UseWorkspaceRealtimeResult {
  /** Whether connected to the workspace hub */
  isConnected: boolean;
  /** Whether currently connecting */
  isConnecting: boolean;
  /** Connection error if any */
  error: string | null;
  /** Current workspace metrics */
  metrics: WorkspaceMetrics | null;
  /** Console log entries */
  consoleLogs: ConsoleLogEntry[];
  /** Clear console logs */
  clearConsoleLogs: () => void;
  /** Session state updates (sessionId -> latest state) */
  sessionStates: Map<string, WorkspaceSessionStateMessage>;
  /** Recent promotion events */
  recentPromotions: WorkspacePromotionMessage[];
}

export function useWorkspaceRealtime(
  workspaceId: string | null,
  options: UseWorkspaceRealtimeOptions = {}
): UseWorkspaceRealtimeResult {
  const { enabled = true, maxConsoleLogs = 500 } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [sessionStates, setSessionStates] = useState<Map<string, WorkspaceSessionStateMessage>>(
    new Map()
  );
  const [recentPromotions, setRecentPromotions] = useState<WorkspacePromotionMessage[]>([]);

  // Keep track of unsubscribe function
  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);

  // Handler callbacks (stable references)
  const handleWorkspaceJoined = useCallback((data: WorkspaceJoinedMessage) => {
    console.log('[Workspace Realtime] Joined workspace:', data.workspaceName);
    setIsConnected(true);
    setIsConnecting(false);
    setError(null);
    setMetrics({
      activeSessionCount: data.activeSessionCount,
      totalBlockExecutions: 0,
      errorCount: 0,
      averageLatencyMs: 0,
      timestamp: data.timestamp,
    });
  }, []);

  const handleSessionStateChange = useCallback((data: WorkspaceSessionStateMessage) => {
    setSessionStates((prev) => {
      const next = new Map(prev);
      next.set(data.sessionId, data);
      return next;
    });
  }, []);

  const handleSessionEvent = useCallback((data: WorkspaceSessionEventMessage) => {
    // Add to console logs
    const logEntry: ConsoleLogEntry = {
      id: `${data.sessionId}-${data.timestamp}-${Math.random()}`,
      timestamp: data.timestamp,
      level: data.level,
      source: {
        sessionId: data.sessionId,
        sessionName: data.source,
      },
      message: data.message,
      data: data.data,
    };

    setConsoleLogs((prev) => {
      const next = [logEntry, ...prev];
      return next.slice(0, maxConsoleLogs);
    });
  }, [maxConsoleLogs]);

  const handleAgentEvent = useCallback((data: WorkspaceAgentEventMessage) => {
    // Add agent events to console logs
    const logEntry: ConsoleLogEntry = {
      id: `agent-${data.agentId}-${data.timestamp}-${Math.random()}`,
      timestamp: data.timestamp,
      level: 'info',
      source: {
        sessionId: data.sessionId,
        sessionName: data.agentName,
      },
      message: `[Agent] ${data.message}`,
      data: data.data,
    };

    setConsoleLogs((prev) => {
      const next = [logEntry, ...prev];
      return next.slice(0, maxConsoleLogs);
    });
  }, [maxConsoleLogs]);

  const handleMetricsUpdate = useCallback((data: WorkspaceMetricsMessage) => {
    setMetrics({
      activeSessionCount: data.activeSessionCount,
      totalBlockExecutions: data.totalBlockExecutions,
      errorCount: data.errorCount,
      averageLatencyMs: data.averageLatencyMs,
      timestamp: data.timestamp,
    });
  }, []);

  const handlePromotionEvent = useCallback((data: WorkspacePromotionMessage) => {
    setRecentPromotions((prev) => {
      const next = [data, ...prev];
      return next.slice(0, 10); // Keep last 10 promotions
    });

    // Also add to console logs
    const logEntry: ConsoleLogEntry = {
      id: `promotion-${data.timestamp}-${Math.random()}`,
      timestamp: data.timestamp,
      level: 'info',
      source: {
        sessionId: data.sourceWorkspaceId,
        sessionName: 'Promotion',
      },
      message: data.message,
    };

    setConsoleLogs((prev) => {
      const next = [logEntry, ...prev];
      return next.slice(0, maxConsoleLogs);
    });
  }, [maxConsoleLogs]);

  const handleConsoleLog = useCallback((data: WorkspaceConsoleLogMessage) => {
    const logEntry: ConsoleLogEntry = {
      id: data.id,
      timestamp: data.timestamp,
      level: data.level,
      source: {
        sessionId: data.sessionId,
        sessionName: data.sessionName,
        blockId: data.blockId,
        blockName: data.blockName,
      },
      message: data.message,
      data: data.data,
    };

    setConsoleLogs((prev) => {
      const next = [logEntry, ...prev];
      return next.slice(0, maxConsoleLogs);
    });
  }, [maxConsoleLogs]);

  // Clear console logs
  const clearConsoleLogs = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  // Connect/disconnect effect
  useEffect(() => {
    if (!workspaceId || !enabled) {
      return;
    }

    let isMounted = true;

    const connect = async () => {
      setIsConnecting(true);
      setError(null);

      try {
        const unsubscribe = await signalRManager.subscribeToWorkspaceEvents(workspaceId, {
          onWorkspaceJoined: handleWorkspaceJoined,
          onSessionStateChange: handleSessionStateChange,
          onSessionEvent: handleSessionEvent,
          onAgentEvent: handleAgentEvent,
          onMetricsUpdate: handleMetricsUpdate,
          onPromotionEvent: handlePromotionEvent,
          onConsoleLog: handleConsoleLog,
        });

        if (isMounted && unsubscribe) {
          unsubscribeRef.current = unsubscribe;
          // Note: isConnected will be set by handleWorkspaceJoined
        } else if (isMounted) {
          setError('Failed to connect to workspace hub');
          setIsConnecting(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown connection error');
          setIsConnecting(false);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsConnected(false);
      setSessionStates(new Map());
    };
  }, [
    workspaceId,
    enabled,
    handleWorkspaceJoined,
    handleSessionStateChange,
    handleSessionEvent,
    handleAgentEvent,
    handleMetricsUpdate,
    handlePromotionEvent,
    handleConsoleLog,
  ]);

  return {
    isConnected,
    isConnecting,
    error,
    metrics,
    consoleLogs,
    clearConsoleLogs,
    sessionStates,
    recentPromotions,
  };
}
