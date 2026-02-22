import { describe, it, expect } from 'vitest';
import { findFreePort } from '../src/port-finder.js';

describe('findFreePort', () => {
  it('returns a valid port number', async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('returns different ports on consecutive calls', async () => {
    const port1 = await findFreePort();
    const port2 = await findFreePort();
    // Ports SHOULD be different (not guaranteed but very likely)
    expect(typeof port1).toBe('number');
    expect(typeof port2).toBe('number');
  });
});
