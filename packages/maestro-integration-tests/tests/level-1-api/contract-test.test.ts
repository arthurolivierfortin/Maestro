/**
 * Level 1 — Contract Tests
 *
 * Validates the contract API endpoints: list, get, test, and provider model pricing.
 */

import { describe, it, expect } from 'vitest';
import { getTestClient } from '../../src/test-harness.js';

describe('Contract API (Level 1)', () => {
  it('GET /api/contracts returns a non-empty list', async () => {
    const client = getTestClient();
    const contracts = await client.contracts.list();

    expect(Array.isArray(contracts)).toBe(true);
    expect(contracts.length).toBeGreaterThan(0);
  });

  it('GET /api/contracts/:id returns contract with features', async () => {
    const client = getTestClient();
    const contract = await client.contracts.get('maestro-assistant');

    expect(contract).toBeDefined();
    expect(contract.id).toBe('maestro-assistant');
    expect(contract.features).toBeDefined();
    expect(typeof contract.features).toBe('object');
  });

  it('POST /api/contracts/:id/test returns result with costs', async () => {
    const client = getTestClient();
    const result = await client.contracts.test(
      'maestro-assistant',
      'system:maestro-assistant'
    );

    expect(result).toBeDefined();
    expect(result.fitness).toBeGreaterThan(0);
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.totalTests).toBeGreaterThan(0);
    expect(Array.isArray(result.features)).toBe(true);
    expect(result.features.length).toBeGreaterThan(0);
  }, 120_000);

  it('Provider models include pricing info', async () => {
    const baseUrl = process.env.TEST_BACKEND_URL;
    if (!baseUrl) {
      throw new Error('TEST_BACKEND_URL not set');
    }

    const response = await fetch(`${baseUrl}/api/provider/models`);
    expect(response.ok).toBe(true);

    const data = await response.json();

    // The response should have a models array
    const models: any[] = data.models ?? data.Models ?? data;
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);

    // At least one model should have pricing info
    const withPricing = models.filter(
      (m: any) =>
        m.inputTokenPricePerMillion != null ||
        m.InputTokenPricePerMillion != null
    );
    expect(withPricing.length).toBeGreaterThan(0);
  });
});
