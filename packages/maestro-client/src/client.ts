import { HttpTransport, type HttpTransportOptions } from './http.js';
import type { MaestroClientOptions } from './types.js';
import { healthDomain } from './domains/health.js';
import { blockDomain } from './domains/blocks.js';
import { sessionDomain } from './domains/sessions.js';
import { variableDomain } from './domains/variables.js';
import { workspaceDomain } from './domains/workspaces.js';
import { projectDomain } from './domains/projects.js';
import { templateDomain } from './domains/templates.js';
import { llmDomain } from './domains/llm.js';
import { metricsDomain } from './domains/metrics.js';
import { foundryDomain } from './domains/foundry.js';
import { workflowDomain } from './domains/workflows.js';
import { trainingDomain } from './domains/training.js';
import { testingDomain } from './domains/testing.js';
import { runDomain } from './domains/runs.js';
import { authDomain } from './domains/auth.js';
import { filesystemDomain } from './domains/filesystem.js';
import { fitnessDomain } from './domains/fitness.js';
import { contractDomain } from './domains/contracts.js';
import { costDomain } from './domains/costs.js';
import { playgroundDomain } from './domains/playground.js';
import { SignalRClient } from './realtime/signalr-client.js';
import { ClientBlockRegistry } from './client-blocks.js';

/**
 * Maestro SDK client — typed access to the full Maestro API.
 *
 * Usage:
 *   const client = new MaestroClient({ baseUrl: 'http://localhost:5000' });
 *   const blocks = await client.blocks.list();
 *   const session = await client.sessions.create({ repositoryPath: '/my/repo' });
 */
export class MaestroClient {
  readonly http: HttpTransport;
  readonly health: ReturnType<typeof healthDomain>;
  readonly blocks: ReturnType<typeof blockDomain>;
  readonly sessions: ReturnType<typeof sessionDomain>;
  readonly variables: ReturnType<typeof variableDomain>;
  readonly workspaces: ReturnType<typeof workspaceDomain>;
  readonly projects: ReturnType<typeof projectDomain>;
  readonly templates: ReturnType<typeof templateDomain>;
  readonly llm: ReturnType<typeof llmDomain>;
  readonly metrics: ReturnType<typeof metricsDomain>;
  readonly foundry: ReturnType<typeof foundryDomain>;
  readonly workflows: ReturnType<typeof workflowDomain>;
  readonly training: ReturnType<typeof trainingDomain>;
  readonly testing: ReturnType<typeof testingDomain>;
  readonly runs: ReturnType<typeof runDomain>;
  readonly auth: ReturnType<typeof authDomain>;
  readonly filesystem: ReturnType<typeof filesystemDomain>;
  readonly fitness: ReturnType<typeof fitnessDomain>;
  readonly contracts: ReturnType<typeof contractDomain>;
  readonly costs: ReturnType<typeof costDomain>;
  readonly playground: ReturnType<typeof playgroundDomain>;
  readonly realtime: SignalRClient;
  readonly clientBlocks: ClientBlockRegistry;

  constructor(options: MaestroClientOptions = {}) {
    const transportOpts: HttpTransportOptions = {
      baseUrl: options.baseUrl ?? 'http://localhost:5000',
      timeout: options.timeout ?? 30000,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      debug: options.debug ?? false,
      apiKey: options.apiKey ?? null,
      headers: options.headers ?? {},
    };

    this.http = new HttpTransport(transportOpts);
    this.health = healthDomain(this.http);
    this.blocks = blockDomain(this.http);
    this.sessions = sessionDomain(this.http);
    this.variables = variableDomain(this.http);
    this.workspaces = workspaceDomain(this.http);
    this.projects = projectDomain(this.http);
    this.templates = templateDomain(this.http);
    this.llm = llmDomain(this.http);
    this.metrics = metricsDomain(this.http);
    this.foundry = foundryDomain(this.http);
    this.workflows = workflowDomain(this.http);
    this.training = trainingDomain(this.http);
    this.testing = testingDomain(this.http);
    this.runs = runDomain(this.http);
    this.auth = authDomain(this.http);
    this.filesystem = filesystemDomain(this.http);
    this.fitness = fitnessDomain(this.http);
    this.contracts = contractDomain(this.http);
    this.costs = costDomain(this.http);
    this.playground = playgroundDomain(this.http);
    this.realtime = new SignalRClient(transportOpts.baseUrl);
    this.clientBlocks = new ClientBlockRegistry();
  }

  /** Convenience: base URL this client is connected to. */
  get baseUrl(): string {
    return this.http.getBaseUrl();
  }
}
