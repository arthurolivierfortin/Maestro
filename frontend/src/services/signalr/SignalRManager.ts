/**
 * SignalR Connection Manager
 *
 * Manages SignalR connections to backend hubs for real-time updates.
 */

import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
  HubConnectionState,
} from '@microsoft/signalr';

/**
 * SignalR Manager for managing multiple hub connections
 */
class SignalRManager {
  private connections: Map<string, HubConnection> = new Map();
  private apiBaseUrl: string;
  private isEnabled: boolean;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    this.isEnabled = import.meta.env.VITE_USE_MOCK_BACKEND !== 'true';
  }

  /**
   * Get or create connection to blocks hub
   */
  async connectToBlockHub(): Promise<HubConnection | null> {
    if (!this.isEnabled) {
      console.log('[SignalR] Disabled in mock mode');
      return null;
    }

    if (this.connections.has('blocks')) {
      const connection = this.connections.get('blocks')!;
      if (connection.state === HubConnectionState.Connected) {
        return connection;
      }
    }

    try {
      const connection = new HubConnectionBuilder()
        .withUrl(`${this.apiBaseUrl}/hubs/blocks`)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => {
            // Retry after 5, 10, 20, 30 seconds, then 30s continuously
            return Math.min(5000 * Math.pow(2, this.getRetryCount('blocks')), 30000);
          },
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Connection lifecycle event handlers
      connection.onreconnecting((error) => {
        console.log('[SignalR Block Hub] Reconnecting...', error);
      });

      connection.onreconnected((connectionId) => {
        console.log(`[SignalR Block Hub] Reconnected: ${connectionId}`);
        this.resetRetryCount('blocks');
      });

      connection.onclose((error) => {
        console.log('[SignalR Block Hub] Connection closed', error);
        this.connections.delete('blocks');
      });

      await connection.start();
      console.log('[SignalR Block Hub] Connected');

      this.connections.set('blocks', connection);
      return connection;
    } catch (error) {
      console.error('[SignalR Block Hub] Failed to connect:', error);
      return null;
    }
  }

  /**
   * Get or create connection to execution hub
   */
  async connectToExecutionHub(): Promise<HubConnection | null> {
    if (!this.isEnabled) {
      console.log('[SignalR] Disabled in mock mode');
      return null;
    }

    if (this.connections.has('execution')) {
      const connection = this.connections.get('execution')!;
      if (connection.state === HubConnectionState.Connected) {
        return connection;
      }
    }

    try {
      const connection = new HubConnectionBuilder()
        .withUrl(`${this.apiBaseUrl}/hubs/execution`)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => {
            return Math.min(5000 * Math.pow(2, this.getRetryCount('execution')), 30000);
          },
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Connection lifecycle event handlers
      connection.onreconnecting((error) => {
        console.log('[SignalR Execution Hub] Reconnecting...', error);
      });

      connection.onreconnected((connectionId) => {
        console.log(`[SignalR Execution Hub] Reconnected: ${connectionId}`);
        this.resetRetryCount('execution');
      });

      connection.onclose((error) => {
        console.log('[SignalR Execution Hub] Connection closed', error);
        this.connections.delete('execution');
      });

      await connection.start();
      console.log('[SignalR Execution Hub] Connected');

      this.connections.set('execution', connection);
      return connection;
    } catch (error) {
      console.error('[SignalR Execution Hub] Failed to connect:', error);
      return null;
    }
  }

  /**
   * Get existing connection by name
   */
  getConnection(name: string): HubConnection | null {
    return this.connections.get(name) || null;
  }

  /**
   * Check if connection is active
   */
  isConnected(name: string): boolean {
    const connection = this.connections.get(name);
    return connection?.state === HubConnectionState.Connected;
  }

  /**
   * Disconnect specific hub
   */
  async disconnect(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (connection) {
      await connection.stop();
      this.connections.delete(name);
    }
  }

  /**
   * Disconnect all hubs
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [name, connection] of this.connections.entries()) {
      promises.push(connection.stop().then(() => {
        console.log(`[SignalR] Disconnected ${name} hub`);
      }));
    }

    await Promise.all(promises);
    this.connections.clear();
  }

  /**
   * Subscribe to block events
   */
  async subscribeToBlockEvents(callbacks: {
    onBlockAdded?: (block: any) => void;
    onBlockUpdated?: (block: any) => void;
    onBlockDeleted?: (id: string) => void;
  }): Promise<(() => void) | null> {
    const connection = await this.connectToBlockHub();
    if (!connection) return null;

    if (callbacks.onBlockAdded) {
      connection.on('BlockAdded', callbacks.onBlockAdded);
    }

    if (callbacks.onBlockUpdated) {
      connection.on('BlockUpdated', callbacks.onBlockUpdated);
    }

    if (callbacks.onBlockDeleted) {
      connection.on('BlockDeleted', callbacks.onBlockDeleted);
    }

    // Return unsubscribe function
    return () => {
      if (callbacks.onBlockAdded) connection.off('BlockAdded', callbacks.onBlockAdded);
      if (callbacks.onBlockUpdated) connection.off('BlockUpdated', callbacks.onBlockUpdated);
      if (callbacks.onBlockDeleted) connection.off('BlockDeleted', callbacks.onBlockDeleted);
    };
  }

  /**
   * Subscribe to execution events
   */
  async subscribeToExecutionEvents(
    executionId: string,
    callbacks: {
      onNodeStarted?: (data: any) => void;
      onNodeCompleted?: (data: any) => void;
      onNodeFailed?: (data: any) => void;
      onExecutionCompleted?: (data: any) => void;
      onExecutionFailed?: (data: any) => void;
      onProgressUpdate?: (data: any) => void;
    }
  ): Promise<(() => void) | null> {
    const connection = await this.connectToExecutionHub();
    if (!connection) return null;

    // Join the execution room
    try {
      await connection.invoke('JoinExecution', executionId);
    } catch (error) {
      console.error('[SignalR] Failed to join execution:', error);
      return null;
    }

    // Register event handlers
    if (callbacks.onNodeStarted) connection.on('NodeStarted', callbacks.onNodeStarted);
    if (callbacks.onNodeCompleted) connection.on('NodeCompleted', callbacks.onNodeCompleted);
    if (callbacks.onNodeFailed) connection.on('NodeFailed', callbacks.onNodeFailed);
    if (callbacks.onExecutionCompleted) connection.on('ExecutionCompleted', callbacks.onExecutionCompleted);
    if (callbacks.onExecutionFailed) connection.on('ExecutionFailed', callbacks.onExecutionFailed);
    if (callbacks.onProgressUpdate) connection.on('ProgressUpdate', callbacks.onProgressUpdate);

    // Return unsubscribe function
    return async () => {
      if (callbacks.onNodeStarted) connection.off('NodeStarted', callbacks.onNodeStarted);
      if (callbacks.onNodeCompleted) connection.off('NodeCompleted', callbacks.onNodeCompleted);
      if (callbacks.onNodeFailed) connection.off('NodeFailed', callbacks.onNodeFailed);
      if (callbacks.onExecutionCompleted) connection.off('ExecutionCompleted', callbacks.onExecutionCompleted);
      if (callbacks.onExecutionFailed) connection.off('ExecutionFailed', callbacks.onExecutionFailed);
      if (callbacks.onProgressUpdate) connection.off('ProgressUpdate', callbacks.onProgressUpdate);

      try {
        await connection.invoke('LeaveExecution', executionId);
      } catch (error) {
        console.error('[SignalR] Failed to leave execution:', error);
      }
    };
  }

  // Private helpers for retry count tracking
  private retryCounts: Map<string, number> = new Map();

  private getRetryCount(name: string): number {
    return this.retryCounts.get(name) || 0;
  }

  private resetRetryCount(name: string): void {
    this.retryCounts.delete(name);
  }
}

/**
 * Singleton instance
 */
export const signalRManager = new SignalRManager();
