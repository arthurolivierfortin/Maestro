/**
 * SignalR Service
 * 
 * Real-time communication with backend for execution monitoring.
 */

import * as signalR from '@microsoft/signalr';
import { ExecutionEvent } from '@types';

const SIGNALR_HUB_URL =
  import.meta.env.VITE_SIGNALR_HUB_URL || 'https://localhost:5001/hubs/execution';

/**
 * SignalR connection singleton
 */
let connection: signalR.HubConnection | null = null;

/**
 * Event handler type
 */
type EventHandler = (event: ExecutionEvent) => void;

/**
 * SignalR service for real-time execution monitoring
 */
export const signalRService = {
  /**
   * Initialize and start connection
   */
  async connect(): Promise<signalR.HubConnection> {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
      return connection;
    }

    connection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_HUB_URL, {
        accessTokenFactory: () => localStorage.getItem('auth_token') || '',
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 10s, 30s
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        },
      })
      .configureLogging(import.meta.env.DEV ? signalR.LogLevel.Debug : signalR.LogLevel.Warning)
      .build();

    // Connection lifecycle handlers
    connection.onreconnecting((error) => {
      console.warn('[SignalR] Reconnecting...', error);
    });

    connection.onreconnected((connectionId) => {
      console.log('[SignalR] Reconnected', connectionId);
    });

    connection.onclose((error) => {
      console.error('[SignalR] Connection closed', error);
    });

    try {
      await connection.start();
      console.log('[SignalR] Connected');
      return connection;
    } catch (error) {
      console.error('[SignalR] Failed to connect', error);
      throw error;
    }
  },

  /**
   * Disconnect from SignalR hub
   */
  async disconnect(): Promise<void> {
    if (connection) {
      await connection.stop();
      connection = null;
      console.log('[SignalR] Disconnected');
    }
  },

  /**
   * Join execution monitoring group
   */
  async joinExecution(executionId: string): Promise<void> {
    if (!connection) {
      throw new Error('SignalR connection not established');
    }
    await connection.invoke('JoinExecution', executionId);
    console.log(`[SignalR] Joined execution ${executionId}`);
  },

  /**
   * Leave execution monitoring group
   */
  async leaveExecution(executionId: string): Promise<void> {
    if (!connection) {
      throw new Error('SignalR connection not established');
    }
    await connection.invoke('LeaveExecution', executionId);
    console.log(`[SignalR] Left execution ${executionId}`);
  },

  /**
   * Subscribe to execution events
   */
  onExecutionEvent(eventType: string, handler: EventHandler): void {
    if (!connection) {
      console.warn('[SignalR] Cannot subscribe - connection not established');
      return;
    }
    connection.on(eventType, handler);
  },

  /**
   * Unsubscribe from execution events
   */
  offExecutionEvent(eventType: string, handler: EventHandler): void {
    if (!connection) return;
    connection.off(eventType, handler);
  },

  /**
   * Subscribe to all execution events
   */
  subscribeToAllEvents(handlers: {
    onExecutionStarted?: (event: ExecutionEvent) => void;
    onExecutionCompleted?: (event: ExecutionEvent) => void;
    onExecutionFailed?: (event: ExecutionEvent) => void;
    onNodeStarted?: (event: ExecutionEvent) => void;
    onNodeCompleted?: (event: ExecutionEvent) => void;
    onNodeFailed?: (event: ExecutionEvent) => void;
    onTerminalOutput?: (event: ExecutionEvent) => void;
    onProgressUpdate?: (event: ExecutionEvent) => void;
  }): void {
    if (handlers.onExecutionStarted) {
      this.onExecutionEvent('ExecutionStarted', handlers.onExecutionStarted);
    }
    if (handlers.onExecutionCompleted) {
      this.onExecutionEvent('ExecutionCompleted', handlers.onExecutionCompleted);
    }
    if (handlers.onExecutionFailed) {
      this.onExecutionEvent('ExecutionFailed', handlers.onExecutionFailed);
    }
    if (handlers.onNodeStarted) {
      this.onExecutionEvent('NodeStarted', handlers.onNodeStarted);
    }
    if (handlers.onNodeCompleted) {
      this.onExecutionEvent('NodeCompleted', handlers.onNodeCompleted);
    }
    if (handlers.onNodeFailed) {
      this.onExecutionEvent('NodeFailed', handlers.onNodeFailed);
    }
    if (handlers.onTerminalOutput) {
      this.onExecutionEvent('TerminalOutput', handlers.onTerminalOutput);
    }
    if (handlers.onProgressUpdate) {
      this.onExecutionEvent('ProgressUpdate', handlers.onProgressUpdate);
    }
  },

  /**
   * Get connection state
   */
  getState(): signalR.HubConnectionState | null {
    return connection?.state ?? null;
  },

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return connection?.state === signalR.HubConnectionState.Connected;
  },
};

export default signalRService;
