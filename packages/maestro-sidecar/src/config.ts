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
 * Resolve paths for backend and LLM-Provider projects (source mode — dotnet run).
 */
export function getServicePaths(root: string) {
  return {
    backendDir: path.join(root, 'apps', 'backend', 'src', 'Maestro.Api'),
    backendProject: path.join(root, 'apps', 'backend', 'src', 'Maestro.Api', 'Maestro.Api.csproj'),
    llmProviderDir: path.join(root, 'llm-provider', 'dotnet', 'src', 'LLMProvider.Web'),
    llmProviderProject: path.join(root, 'llm-provider', 'dotnet', 'src', 'LLMProvider.Web', 'LLMProvider.Web.csproj'),
  };
}

/**
 * Get the platform-specific runtime identifier directory name.
 */
export function getPlatformRid(): string {
  return process.platform === 'win32' ? 'win-x64' : 'linux-x64';
}

/**
 * Resolve paths for pre-compiled binaries (bundled mode).
 */
export function getBundledPaths(binaryDir: string) {
  const rid = getPlatformRid();
  const ext = process.platform === 'win32' ? '.exe' : '';
  return {
    backendBinary: path.join(binaryDir, rid, 'backend', `Maestro.Api${ext}`),
    backendDir: path.join(binaryDir, rid, 'backend'),
    llmProviderBinary: path.join(binaryDir, rid, 'llm-provider', `LLMProvider.Web${ext}`),
    llmProviderDir: path.join(binaryDir, rid, 'llm-provider'),
  };
}

/**
 * Detect whether bundled binaries exist.
 */
export function hasBundledBinaries(binaryDir: string): boolean {
  try {
    const paths = getBundledPaths(binaryDir);
    return fs.existsSync(paths.backendBinary);
  } catch {
    return false;
  }
}
