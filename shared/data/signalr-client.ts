/**
 * Phase 24: SignalR client for TUI/CLI real-time data.
 * Connects to the backend's session hub for live updates.
 * Falls back to polling if connection fails.
 */

export interface SignalRClientOptions {
  /** Backend base URL (e.g., http://localhost:5000) */
  baseUrl: string;
  /** Hub path (e.g., /hubs/sessions) */
  hubPath: string;
  /** Reconnect on failure */
  autoReconnect?: boolean;
  /** Max reconnect delay in ms */
  maxReconnectDelay?: number;
}

export interface SignalREventHandlers {
  onSessionStateChange?: (sessionId: string, newState: string) => void;
  onExecutionProgress?: (sessionId: string, treeUpdate: unknown) => void;
  onLLMActivity?: (sessionId: string, activity: unknown) => void;
  onEvent?: (sessionId: string, event: unknown) => void;
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onReconnecting?: (attempt: number) => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Lightweight SignalR client for Node.js/TUI environments.
 * Uses the @microsoft/signalr npm package if available,
 * or provides a polling-based fallback.
 */
export class MaestroSignalRClient {
  private state: ConnectionState = 'disconnected';
  private connection: unknown = null;
  private handlers: SignalREventHandlers = {};
  private reconnectAttempts = 0;
  private readonly options: Required<SignalRClientOptions>;

  constructor(options: SignalRClientOptions) {
    this.options = {
      autoReconnect: true,
      maxReconnectDelay: 30000,
      ...options,
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  setHandlers(handlers: SignalREventHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Connect to the SignalR hub.
   * Returns true if connected, false if falling back to polling.
   */
  async connect(): Promise<boolean> {
    this.state = 'connecting';

    try {
      // Try to load @microsoft/signalr
      const signalR = await import('@microsoft/signalr');
      const url = `${this.options.baseUrl}${this.options.hubPath}`;

      const builder = new signalR.HubConnectionBuilder()
        .withUrl(url)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            const delays = [0, 2000, 5000, 10000, 20000, 30000];
            return delays[Math.min(retryContext.previousRetryCount, delays.length - 1)];
          },
        });

      this.connection = builder.build();
      const conn = this.connection as any;

      // Register event handlers
      conn.on('OnStateChange', (data: any) => {
        this.handlers.onSessionStateChange?.(data.sessionId, data.newState);
      });

      conn.on('OnEvent', (data: any) => {
        this.handlers.onEvent?.(data.sessionId, data);
      });

      conn.on('ExecutionProgress', (data: any) => {
        this.handlers.onExecutionProgress?.(data.sessionId, data.treeUpdate);
      });

      conn.on('LLMActivity', (data: any) => {
        this.handlers.onLLMActivity?.(data.sessionId, data);
      });

      conn.onreconnecting(() => {
        this.state = 'reconnecting';
        this.reconnectAttempts++;
        this.handlers.onReconnecting?.(this.reconnectAttempts);
      });

      conn.onreconnected(() => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.handlers.onConnected?.();
      });

      conn.onclose(() => {
        this.state = 'disconnected';
        this.handlers.onDisconnected?.('connection closed');
      });

      await conn.start();
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.handlers.onConnected?.();
      return true;
    } catch {
      // SignalR not available — fall back to polling
      this.state = 'disconnected';
      this.handlers.onDisconnected?.('signalr unavailable, using polling');
      return false;
    }
  }

  /**
   * Join a session group to receive its events.
   */
  async joinSession(sessionId: string): Promise<void> {
    const conn = this.connection as any;
    if (conn && this.state === 'connected') {
      try {
        await conn.invoke('JoinSession', sessionId);
      } catch {
        // Silently fail — polling will handle it
      }
    }
  }

  /**
   * Leave a session group.
   */
  async leaveSession(sessionId: string): Promise<void> {
    const conn = this.connection as any;
    if (conn && this.state === 'connected') {
      try {
        await conn.invoke('LeaveSession', sessionId);
      } catch {
        // Silently fail
      }
    }
  }

  /**
   * Disconnect from the hub.
   */
  async disconnect(): Promise<void> {
    const conn = this.connection as any;
    if (conn) {
      try {
        await conn.stop();
      } catch {
        // Ignore
      }
    }
    this.state = 'disconnected';
    this.connection = null;
  }
}
