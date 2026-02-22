import { HUB_NAMES, type HubName } from './events.js';
import type { EventCallback } from '../types.js';

/**
 * SignalR real-time client for Maestro hubs.
 *
 * Requires `@microsoft/signalr` as a peer dependency.
 * If not installed, methods will throw with a clear message.
 */
export class SignalRClient {
  private readonly baseUrl: string;
  private connections = new Map<string, unknown>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Connect to a hub and subscribe to events.
   */
  async connect(hub: HubName): Promise<void> {
    if (this.connections.has(hub)) return;

    let signalR: typeof import('@microsoft/signalr');
    try {
      signalR = await import('@microsoft/signalr');
    } catch {
      throw new Error(
        '@microsoft/signalr is required for real-time features. Install it: npm install @microsoft/signalr',
      );
    }

    const url = `${this.baseUrl}${HUB_NAMES[hub]}`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect()
      .build();

    await connection.start();
    this.connections.set(hub, connection);
  }

  /**
   * Subscribe to an event on a hub.
   */
  on<T = unknown>(hub: HubName, event: string, callback: EventCallback<T>): void {
    const connection = this.connections.get(hub) as { on(event: string, cb: EventCallback<T>): void } | undefined;
    if (!connection) {
      throw new Error(`Not connected to hub '${hub}'. Call connect('${hub}') first.`);
    }
    connection.on(event, callback);
  }

  /**
   * Disconnect from a specific hub.
   */
  async disconnect(hub: HubName): Promise<void> {
    const connection = this.connections.get(hub) as { stop(): Promise<void> } | undefined;
    if (connection) {
      await connection.stop();
      this.connections.delete(hub);
    }
  }

  /**
   * Disconnect from all hubs.
   */
  async disconnectAll(): Promise<void> {
    const hubs = [...this.connections.keys()] as HubName[];
    await Promise.all(hubs.map((h) => this.disconnect(h)));
  }

  /**
   * Check if connected to a specific hub.
   */
  isConnected(hub: HubName): boolean {
    return this.connections.has(hub);
  }
}
