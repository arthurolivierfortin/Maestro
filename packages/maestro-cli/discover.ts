// @ts-nocheck
// Auto-discover Maestro backend by trying candidate ports

const CANDIDATE_PORTS = [5000, 5001, 5050, 8080];
const TIMEOUT_MS = 2000;

/**
 * Try to discover a running Maestro backend on common ports.
 * Returns the base URL of the first healthy backend found, or null.
 */
async function discoverBackend(candidatePorts = CANDIDATE_PORTS): Promise<string | null> {
  for (const port of candidatePorts) {
    const url = `http://localhost:${port}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${url}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'healthy') {
          return url;
        }
      }
    } catch {
      // Port not available or timeout — try next
    }
  }
  return null;
}

/**
 * Get the backend URL, trying in order:
 * 1. MAESTRO_API_URL environment variable
 * 2. Config file
 * 3. Auto-discover on candidate ports
 * 4. Default localhost:5000
 */
async function getBackendUrlWithDiscovery(): Promise<string> {
  // 1. Env var
  if (process.env.MAESTRO_API_URL) {
    return process.env.MAESTRO_API_URL;
  }

  // 2. Config file
  try {
    const { getBackendUrl } = require('./config.ts');
    const configUrl = getBackendUrl();
    if (configUrl && configUrl !== 'http://localhost:5000') {
      return configUrl;
    }
  } catch {
    // Config not available
  }

  // 3. Auto-discover
  const discovered = await discoverBackend();
  if (discovered) {
    return discovered;
  }

  // 4. Default
  return 'http://localhost:5000';
}

module.exports = { discoverBackend, getBackendUrlWithDiscovery, CANDIDATE_PORTS };
