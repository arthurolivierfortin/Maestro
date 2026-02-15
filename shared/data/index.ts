/**
 * Phase 23: Data layer barrel exports.
 */

export { resolveDataSource, resolveBindingSync } from './data-source-resolver.js';
export type { ResolverContext } from './data-source-resolver.js';

export { MaestroSignalRClient } from './signalr-client.js';
export type { SignalRClientOptions, SignalREventHandlers, ConnectionState } from './signalr-client.js';
