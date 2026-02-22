import * as path from 'path';
import * as fs from 'fs';

/**
 * Detect the Maestro root directory.
 *
 * Priority:
 * 1. Explicit path from options
 * 2. MAESTRO_ROOT environment variable
 * 3. Walk up from __dirname looking for apps/backend/
 */
export function detectMaestroRoot(explicit?: string): string {
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`Explicit Maestro root does not exist: ${explicit}`);
    }
    return explicit;
  }

  const envRoot = process.env.MAESTRO_ROOT;
  if (envRoot && fs.existsSync(envRoot)) {
    return envRoot;
  }

  // Walk up from this file's location
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'apps', 'backend');
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Cannot detect Maestro root. Set MAESTRO_ROOT env or pass maestroRoot option.',
  );
}

/**
 * Resolve paths for backend and LLM-Provider projects.
 */
export function getServicePaths(root: string) {
  return {
    backendDir: path.join(root, 'apps', 'backend', 'src', 'Maestro.Api'),
    backendProject: path.join(root, 'apps', 'backend', 'src', 'Maestro.Api', 'Maestro.Api.csproj'),
    llmProviderDir: path.join(root, 'llm-provider', 'dotnet', 'src', 'LLMProvider.Web'),
    llmProviderProject: path.join(root, 'llm-provider', 'dotnet', 'src', 'LLMProvider.Web', 'LLMProvider.Web.csproj'),
  };
}
