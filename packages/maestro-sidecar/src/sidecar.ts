import { MaestroClient } from '@maestro/client';
import * as os from 'os';
import * as path from 'path';
import { findFreePort } from './port-finder.js';
import { spawnManaged, type ManagedProcess } from './process-manager.js';
import { waitForHealth } from './health-checker.js';
import { detectMaestroRoot, getServicePaths, getBundledPaths, hasBundledBinaries } from './config.js';
import type { SidecarOptions, SidecarStatus, ServiceInfo } from './types.js';

/**
 * Maestro Sidecar — manages backend + LLM-Provider as child processes.
 *
 * Supports two modes:
 * - Source mode: uses `dotnet run --project` (dev, requires .NET SDK + source code)
 * - Bundled mode: spawns pre-compiled binaries from binaryDir (npm install, no SDK needed)
 *
 * Usage:
 *   const sidecar = new MaestroSidecar({ binaryDir: '/path/to/dist' });
 *   await sidecar.start();
 *   const client = sidecar.getClient();
 *   await sidecar.stop();
 */
export class MaestroSidecar {
  private readonly opts: SidecarOptions;
  private readonly _bundled: boolean;
  private backend: ManagedProcess | null = null;
  private llmProvider: ManagedProcess | null = null;
  private _client: MaestroClient | null = null;
  private _backendPort: number | null = null;
  private _llmProviderPort: number | null = null;

  constructor(options: SidecarOptions = {}) {
    this._bundled = !!(options.binaryDir && hasBundledBinaries(options.binaryDir));
    this.opts = {
      backendPort: options.backendPort ?? 0,
      llmProviderPort: options.llmProviderPort ?? 0,
      skipLlm: options.skipLlm ?? false,
      inheritStdio: options.inheritStdio ?? false,
      healthTimeout: options.healthTimeout ?? 30000,
      onLog: options.onLog ?? (() => {}),
      binaryDir: options.binaryDir,
      contentDir: options.contentDir,
      ...(!this._bundled ? { maestroRoot: detectMaestroRoot(options.maestroRoot) } : {}),
    };
  }

  /** Port the backend is listening on (after start). */
  get backendPort(): number | null { return this._backendPort; }
  /** Port the LLM-Provider is listening on (after start). */
  get llmProviderPort(): number | null { return this._llmProviderPort; }
  /** Full URL of the running backend. */
  get backendUrl(): string | null { return this._backendPort ? `http://localhost:${this._backendPort}` : null; }

  /**
   * Start the sidecar services.
   */
  async start(): Promise<void> {
    const log = this.opts.onLog ?? (() => {});

    // Assign ports
    const backendPort = this.opts.backendPort || (await findFreePort());
    const llmPort = this.opts.skipLlm ? 0 : (this.opts.llmProviderPort || (await findFreePort()));

    // Start LLM-Provider first (backend depends on it)
    if (!this.opts.skipLlm) {
      if (this._bundled) {
        const bp = getBundledPaths(this.opts.binaryDir!);
        this.llmProvider = spawnManaged({
          name: 'llm-provider',
          command: bp.llmProviderBinary,
          args: ['--urls', `http://localhost:${llmPort}`],
          cwd: bp.llmProviderDir,
          port: llmPort,
          onLog: (line) => log('llm-provider', line),
          inheritStdio: this.opts.inheritStdio,
        });
      } else {
        const paths = getServicePaths(this.opts.maestroRoot!);
        this.llmProvider = spawnManaged({
          name: 'llm-provider',
          command: 'dotnet',
          args: ['run', '--project', paths.llmProviderProject, '--urls', `http://localhost:${llmPort}`],
          cwd: paths.llmProviderDir,
          port: llmPort,
          onLog: (line) => log('llm-provider', line),
          inheritStdio: this.opts.inheritStdio,
        });
      }

      const llmHealthy = await waitForHealth(
        `http://localhost:${llmPort}/api/v1/health/`,
        this.opts.healthTimeout ?? 30000,
      );
      if (!llmHealthy) {
        await this.stop();
        throw new Error(`LLM-Provider failed to start on port ${llmPort} within ${this.opts.healthTimeout ?? 30000}ms`);
      }
      this._llmProviderPort = llmPort;
    }

    // Start Backend
    const backendEnv: Record<string, string> = {};
    if (!this.opts.skipLlm) {
      backendEnv.LLM_PROVIDER_URL = `http://localhost:${llmPort}`;
    }
    // In bundled mode, tell the backend where to find blocks and set production environment
    if (this._bundled && this.opts.contentDir) {
      backendEnv.MAESTRO_GLOBAL_BLOCKS_PATH = path.join(this.opts.contentDir, 'blocks');
      backendEnv.MAESTRO_USER_BLOCKS_PATH = path.join(os.homedir(), '.maestro', 'blocks');
      backendEnv.ASPNETCORE_ENVIRONMENT = 'Production';
    }

    if (this._bundled) {
      const bp = getBundledPaths(this.opts.binaryDir!);
      this.backend = spawnManaged({
        name: 'backend',
        command: bp.backendBinary,
        args: ['--urls', `http://localhost:${backendPort}`],
        cwd: bp.backendDir,
        port: backendPort,
        env: backendEnv,
        onLog: (line) => log('backend', line),
        inheritStdio: this.opts.inheritStdio,
      });
    } else {
      const paths = getServicePaths(this.opts.maestroRoot!);
      this.backend = spawnManaged({
        name: 'backend',
        command: 'dotnet',
        args: ['run', '--project', paths.backendProject, '--urls', `http://localhost:${backendPort}`],
        cwd: paths.backendDir,
        port: backendPort,
        env: backendEnv,
        onLog: (line) => log('backend', line),
        inheritStdio: this.opts.inheritStdio,
      });
    }

    const backendHealthy = await waitForHealth(
      `http://localhost:${backendPort}/api/discovery/health`,
      this.opts.healthTimeout ?? 30000,
    );
    if (!backendHealthy) {
      await this.stop();
      throw new Error(`Backend failed to start on port ${backendPort} within ${this.opts.healthTimeout ?? 30000}ms`);
    }

    this._backendPort = backendPort;
    this._client = new MaestroClient({ baseUrl: `http://localhost:${backendPort}` });
  }

  /**
   * Stop all sidecar services.
   */
  async stop(): Promise<void> {
    const kills: Promise<void>[] = [];
    if (this.backend) kills.push(this.backend.kill());
    if (this.llmProvider) kills.push(this.llmProvider.kill());
    await Promise.all(kills);
    this.backend = null;
    this.llmProvider = null;
    this._client = null;
  }

  /**
   * Get the SDK client connected to the sidecar backend.
   */
  getClient(): MaestroClient {
    if (!this._client) {
      throw new Error('Sidecar is not running. Call start() first.');
    }
    return this._client;
  }

  /**
   * Get current status of all services.
   */
  async status(): Promise<SidecarStatus> {
    const backendInfo = this.backend
      ? await this.buildServiceInfo('backend', this.backend)
      : null;
    const llmInfo = this.llmProvider
      ? await this.buildServiceInfo('llm-provider', this.llmProvider)
      : null;

    return {
      running: !!this.backend,
      backend: backendInfo,
      llmProvider: llmInfo,
    };
  }

  private async buildServiceInfo(name: string, managed: ManagedProcess): Promise<ServiceInfo> {
    const url = `http://localhost:${managed.port}`;
    let healthy = false;
    try {
      const res = await fetch(
        name === 'backend'
          ? `${url}/api/discovery/health`
          : `${url}/api/v1/health/`,
      );
      healthy = res.ok;
    } catch {
      healthy = false;
    }

    return {
      name,
      port: managed.port,
      pid: managed.process.pid,
      url,
      healthy,
    };
  }
}
