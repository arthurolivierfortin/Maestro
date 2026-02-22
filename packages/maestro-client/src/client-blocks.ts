import type { ClientBlockHandler } from './types.js';

/**
 * Registry for client-side block handlers.
 *
 * When a block has `executorType: "client-side"`, the backend returns
 * `_clientSideExecution: true` instead of executing it. The embedding
 * application registers handlers here and calls `execute()` to run the
 * block locally.
 *
 * Usage:
 *   const registry = new ClientBlockRegistry();
 *   registry.register('speech-to-text', mySTTHandler);
 *   const result = await registry.execute('speech-to-text', { language: 'en-US' });
 */
export class ClientBlockRegistry {
  private handlers = new Map<string, ClientBlockHandler>();

  /**
   * Register a handler for a client-side block.
   */
  register(blockId: string, handler: ClientBlockHandler): void {
    this.handlers.set(blockId, handler);
  }

  /**
   * Unregister a handler.
   */
  unregister(blockId: string): void {
    this.handlers.delete(blockId);
  }

  /**
   * Check if a handler is registered.
   */
  has(blockId: string): boolean {
    return this.handlers.has(blockId);
  }

  /**
   * Execute a client-side block. Throws if no handler is registered.
   */
  async execute(blockId: string, inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(blockId);
    if (!handler) {
      throw new Error(`No client-side handler registered for block '${blockId}'`);
    }
    return handler.execute(inputs);
  }

  /**
   * List all registered block IDs.
   */
  registeredBlocks(): string[] {
    return [...this.handlers.keys()];
  }
}
