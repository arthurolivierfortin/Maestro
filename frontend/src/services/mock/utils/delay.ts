/**
 * Delay Utility
 *
 * Simulates network latency for mock services.
 * Uses configuration from maestro.config.json when available.
 */

import { config } from '../../../config';

/**
 * Delay execution for a random duration within the specified range
 * Falls back to config values if not specified
 *
 * @param minMs Minimum delay in milliseconds (optional, uses config)
 * @param maxMs Maximum delay in milliseconds (optional, uses config)
 */
export function delay(minMs?: number, maxMs?: number): Promise<void> {
  const latencyConfig = config.mockLatency();
  const min = minMs ?? latencyConfig.min;
  const max = maxMs ?? latencyConfig.max;
  
  const duration = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * Fixed delay for predictable testing
 *
 * @param ms Delay in milliseconds
 */
export function fixedDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
