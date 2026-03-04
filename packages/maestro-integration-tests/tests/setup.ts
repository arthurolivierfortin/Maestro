/**
 * Vitest globalSetup — starts a sidecar backend once for the entire test suite.
 *
 * The backend URL is passed to tests via process.env.TEST_BACKEND_URL.
 * The sidecar is stopped in teardown().
 *
 * skipLlm: true — no LLM-Provider needed for Level 1-2.
 * For Level 3, mock-response.json in the agent block folder replaces LLM calls.
 */

import { MaestroSidecar } from '@maestro/sidecar';

let sidecar: MaestroSidecar | null = null;

export async function setup(): Promise<void> {
  console.log('\n[integration-tests] Starting test backend...');

  sidecar = new MaestroSidecar({
    skipLlm: true,
    healthTimeout: 60000,
    onLog: (service, line) => {
      // Only log errors and startup info to avoid flooding test output
      if (line.includes('error') || line.includes('Error') || line.includes('Now listening')) {
        console.log(`  [${service}] ${line}`);
      }
    },
  });

  await sidecar.start();
  const url = sidecar.backendUrl!;
  console.log(`[integration-tests] Backend ready at ${url}`);

  // Pass to test workers via env var
  process.env.TEST_BACKEND_URL = url;
}

export async function teardown(): Promise<void> {
  if (sidecar) {
    console.log('[integration-tests] Stopping test backend...');
    await sidecar.stop();
    sidecar = null;
    console.log('[integration-tests] Backend stopped.');
  }
}
