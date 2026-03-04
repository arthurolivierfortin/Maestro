/**
 * Test Harness — manages a sidecar backend for integration tests.
 *
 * Provides:
 * - getTestClient() — MaestroClient connected to the test backend
 * - importTemplate(client, sessionId, templateName) — loads a session template via API
 *
 * The sidecar is started once by vitest globalSetup (tests/setup.ts)
 * and the backend URL is passed via process.env.TEST_BACKEND_URL.
 */

import { MaestroClient } from '@maestro/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname_esm = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

/**
 * Get a MaestroClient connected to the test backend.
 * Reads the backend URL from process.env.TEST_BACKEND_URL.
 */
export function getTestClient(): MaestroClient {
  const url = process.env.TEST_BACKEND_URL;
  if (!url) {
    throw new Error(
      'TEST_BACKEND_URL not set. Make sure vitest globalSetup (tests/setup.ts) is running.'
    );
  }
  return new MaestroClient({ baseUrl: url, retryAttempts: 1, timeout: 30000 });
}

/**
 * Resolve the path to the Maestro monorepo root.
 */
function getMaestroRoot(): string {
  // Walk up from this file to find the monorepo root
  let dir = path.resolve(__dirname_esm, '..', '..', '..');
  // Verify: monorepo root should have packages/ and content/
  if (!fs.existsSync(path.join(dir, 'packages')) || !fs.existsSync(path.join(dir, 'content'))) {
    // Fallback: check MAESTRO_ROOT env
    if (process.env.MAESTRO_ROOT && fs.existsSync(process.env.MAESTRO_ROOT)) {
      dir = process.env.MAESTRO_ROOT;
    } else {
      throw new Error(`Cannot find Maestro root. Checked: ${dir}`);
    }
  }
  return dir;
}

/**
 * Import a session template into a session.
 * Reads the template JSON from content/system/templates/sessions/,
 * sets variables and entry points via the SDK.
 *
 * This replicates what the CLI's importSessionTemplate() does.
 */
export async function importTemplate(
  client: MaestroClient,
  sessionId: string,
  templateName: string
): Promise<{ variables: number; entryPoints: number }> {
  const root = getMaestroRoot();
  const templatePath = path.join(
    root, 'content', 'system', 'templates', 'sessions',
    `${templateName}.session.json`
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  // Import variables
  let varCount = 0;
  if (template.variables) {
    for (const [key, value] of Object.entries(template.variables)) {
      if (value === null || value === undefined) continue;
      await client.variables.set(sessionId, key, value);
      varCount++;
    }
  }

  // Import entry points via raw HTTP (no dedicated SDK method)
  let epCount = 0;
  if (template.entryPoints) {
    for (const [name, workflowId] of Object.entries(template.entryPoints)) {
      await client.http.put(
        `/api/sessions/${sessionId}/entry-points/${encodeURIComponent(name)}`,
        { workflowId }
      );
      epCount++;
    }
  }

  return { variables: varCount, entryPoints: epCount };
}

/**
 * Create a session and import a template in one call.
 * Returns the session object and a cleanup function.
 */
export async function createTestSession(
  client: MaestroClient,
  templateName: string,
  name?: string
): Promise<{ sessionId: string; cleanup: () => Promise<void> }> {
  const session = await client.sessions.create({
    name: name || `integration-test-${Date.now()}`,
    repositoryPath: process.cwd(),
  });

  await importTemplate(client, session.id, templateName);

  return {
    sessionId: session.id,
    cleanup: async () => {
      try { await client.sessions.delete(session.id); } catch {}
    },
  };
}
