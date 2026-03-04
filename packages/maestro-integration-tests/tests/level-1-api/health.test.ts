/**
 * Level 1 — Health Check Tests
 *
 * Verifies the backend is running and healthy via the SDK.
 * Case 1.14 from the Phase 47 plan.
 */

import { describe, it, expect } from 'vitest';
import { getTestClient } from '../../src/test-harness.js';

describe('Health Check (Level 1)', () => {
  it('1.14 — backend health check returns healthy', async () => {
    const client = getTestClient();
    const health = await client.health.check();

    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
  });

  it('1.14b — isReady returns true', async () => {
    const client = getTestClient();
    const ready = await client.health.isReady();

    expect(ready).toBe(true);
  });
});
