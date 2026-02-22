import { MaestroClient } from '@maestro/client';
import { findFreePort } from './port-finder.js';
import { spawnManaged, type ManagedProcess } from './process-manager.js';
import { waitForHealth } from './health-checker.js';
import { detectMaestroRoot, getServicePaths } from './config.js';
import type { SidecarOptions, SidecarStatus, ServiceInfo } from './types.js';

/**
 * Maestro Sidecar — manages backend + LLM-Provider as child processes.
 *
 * Usage:
 *   const sidecar = new MaestroSidecar({ maestroRoot: 'C:/Meastro' });
 *   await sidecar.start();
 *   const client = sidecar.getClient();
 *   // ... use the client ...
 *   await sidecar.stop();
 */
export class MaestroSidecar {
  private readonly opts: Required<SidecarOptions>;
  private readonly maestroRoot: string;
  private backend: ManagedProcess | null = null;
  private llmProvider: ManagedProcess | null = null;
  private _client: MaestroClient | null = null;

  constructor(options: SidecarOptions = {}) {
    this.maestroRoot = detectMaestroRoot(options.maestroRoot);
    this.opts = {
      maestroRoot: this.maestroRoot,
      backendPort: options.backendPort ?? 0,
      llmProviderPort: options.llmProviderPort ?? 0,
      skipLlm: options.skipLlm ?? false,
      inheritStdio: options.inheritStdio ?? false,
      healthTimeout: options.healthTimeout ?? 30000,
      onLog: options.onLog ?? (() => {}),
    };
  }

  /**
   * Start the sidecar services.
   */
  async start(): Promise<void> {
    const paths = getServicePaths(this.maestroRoot);

    // Assign ports
    const backendPort = this.opts.backendPort || (await findFreePort());
    const llmPort = this.opts.skipLlm ? 0 : (this.opts.llmProviderPort || (await findFreePort()));

    // Start LLM-Provider first (backend depends on it)
    if (!this.opts.skipLlm) {
      this.llmProvider = spawnManaged({
        name: 'llm-provider',
        command: 'dotnet',
        args: ['run', '--project', paths.llmProviderProject, '--urls', `http://localhost:${llmPort}`],
        cwd: paths.llmProviderDir,
        port: llmPort,
        onLog: (line) => this.opts.onLog('llm-provider', line),
        inheritStdio: this.opts.inheritStdio,
      });

      const llmHealthy = await waitForHealth(
        `http://localhost:${llmPort}/api/v1/health/`,
        this.opts.healthTimeout,
      );
      if (!llmHealthy) {
        await this.stop();
        throw new Error(`LLM-Provider failed to start on port ${llmPort} within ${this.opts.healthTimeout}ms`);
      }
    }

    // Start Backend
    const backendEnv: Record<string, string> = {};
    if (!this.opts.skipLlm) {
      backendEnv.LLM_PROVIDER_URL = `http://localhost:${llmPort}`;
    }

    this.backend = spawnManaged({
      name: 'backend',
      command: 'dotnet',
      args: ['run', '--project', paths.backendProject, '--urls', `http://localhost:${backendPort}`],
      cwd: paths.backendDir,
      port: backendPort,
      env: backendEnv,
      onLog: (line) => this.opts.onLog('backend', line),
      inheritStdio: this.opts.inheritStdio,
    });

    const backendHealthy = await waitForHealth(
      `http://localhost:${backendPort}/api/discovery/health`,
      this.opts.healthTimeout,
    );
    if (!backendHealthy) {
      await this.stop();
      throw new Error(`Backend failed to start on port ${backendPort} within ${this.opts.healthTimeout}ms`);
    }

    // Create client
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
