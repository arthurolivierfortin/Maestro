/**
 * Maestro Code — Services barrel export.
 */

export { SessionManager, ts } from './SessionManager.ts';
export type { LogLine, InteractiveOptions, Widget } from './SessionManager.ts';
export {
  getBlocksForContract,
  computeActiveFeatures,
} from './contract-resolver.ts';
export type {
  ContractDefinition,
  ContractFeature,
  BlockForContract,
} from './contract-resolver.ts';
