/**
 * DemoApiClient — Full IMaestroCodeApiClient implementation with demo data.
 *
 * Used by maestro-code in --demo mode. Monitor screens call standard
 * IApiClient methods (listBlocks, listSessions, etc.) and get back
 * realistic mock data. The screens don't know they're in demo mode.
 *
 * Also includes extra methods needed by SessionManager (createSession,
 * startSession, _fetch) for the agent page's task submission flow.
 */

import type { IMaestroCodeApiClient, CreateSessionOptions } from '../types.ts';

import {
  DEMO_BLOCKS,
  DEMO_REPOS,
  DEMO_WORKSPACES,
  DEMO_SESSIONS,
  DEMO_MODELS,
} from './demo-data.ts';

// ── Constants ────────────────────────────────────────────────

const DEMO_SESSION_ID = 'demo-0000-1111-2222-333344445555';

const DEMO_CONTRACTS: Record<string, any> = {
  'maestro-assistant': {
    id: 'maestro-assistant',
    name: 'Maestro Assistant',
    description: 'The primary conversational assistant in maestro-code.',
    requiredCapabilities: ['conversation'],
    features: {
      'conversation': { description: 'Basic conversational interaction', requires: ['conversation'] },
      'tool-use': { description: 'Execute tools (file ops, CLI, API calls)', requires: ['tool-calling'] },
      'json-config': { description: 'Generate structured JSON configs', requires: ['structured-output'] },
      'deep-context': { description: 'Handle large codebases and long histories', requires: ['long-context'] },
      'session-orchestration': { description: 'Create and manage workspaces and sessions', requires: ['orchestration', 'tool-calling'] },
    },
  },
};

function ts() {
  return new Date().toISOString();
}

// ── Evolving session data (staged mock execution) ────────────

function getTree(elapsed: number): any[] {
  return [
    { id: 'prepare', name: 'Prepare', status: elapsed > 500 ? 'completed' : 'running', type: 'task', children: [] },
    { id: 'plan', name: 'Plan', status: elapsed > 2000 ? 'completed' : elapsed > 500 ? 'running' : 'pending', type: 'workflow', children: [
      { id: 'analyze', name: 'Analyze Codebase', status: elapsed > 1200 ? 'completed' : elapsed > 600 ? 'running' : 'pending', type: 'agent', children: [] },
      { id: 'design', name: 'Design Solution', status: elapsed > 2000 ? 'completed' : elapsed > 1200 ? 'running' : 'pending', type: 'inference', children: [] },
    ] },
    { id: 'implement', name: 'Implement', status: elapsed > 4000 ? 'completed' : elapsed > 2000 ? 'running' : 'pending', type: 'workflow', children: [
      { id: 'code', name: 'Write Code', status: elapsed > 3000 ? 'completed' : elapsed > 2200 ? 'running' : 'pending', type: 'agent', children: [] },
      { id: 'test', name: 'Run Tests', status: elapsed > 4000 ? 'completed' : elapsed > 3000 ? 'running' : 'pending', type: 'tool', children: [] },
    ] },
    { id: 'review', name: 'Review', status: elapsed > 5000 ? 'completed' : elapsed > 4000 ? 'running' : 'pending', type: 'agent', children: [] },
    { id: 'commit', name: 'Commit', status: elapsed > 6000 ? 'completed' : elapsed > 5000 ? 'running' : 'pending', type: 'tool', children: [] },
  ];
}

function getLog(elapsed: number) {
  const entries: any[] = [];
  if (elapsed > 200) entries.push({ time: ts(), level: 'info', message: 'Session initialized', source: 'system' });
  if (elapsed > 600) entries.push({ time: ts(), level: 'info', message: 'Analyzing repository structure...', source: 'agent' });
  if (elapsed > 1200) entries.push({ time: ts(), level: 'info', message: 'Found 12 source files, 3 test files', source: 'agent' });
  if (elapsed > 1800) entries.push({ time: ts(), level: 'info', message: 'Design: 3 steps identified', source: 'agent' });
  if (elapsed > 2200) entries.push({ time: ts(), level: 'info', message: 'Writing implementation...', source: 'agent' });
  if (elapsed > 3000) entries.push({ time: ts(), level: 'info', message: 'Code generation complete', source: 'agent' });
  if (elapsed > 3200) entries.push({ time: ts(), level: 'info', message: 'Running test suite...', source: 'tool' });
  if (elapsed > 4000) entries.push({ time: ts(), level: 'info', message: 'All 8 tests passed', source: 'tool' });
  if (elapsed > 4500) entries.push({ time: ts(), level: 'info', message: 'Reviewing changes...', source: 'agent' });
  if (elapsed > 5200) entries.push({ time: ts(), level: 'info', message: 'Review: no issues found', source: 'agent' });
  if (elapsed > 5500) entries.push({ time: ts(), level: 'info', message: 'Creating commit...', source: 'tool' });
  if (elapsed > 6000) entries.push({ time: ts(), level: 'info', message: 'Committed: feat: add login page', source: 'tool' });
  return entries;
}

function getLLM(elapsed: number) {
  const entries: any[] = [];
  if (elapsed > 600) entries.push({ nodeId: 'analyze', time: ts(), duration: 580, responseLength: 320, promptPreview: 'Analyze this repository...', responsePreview: 'Repository contains a TypeScript project with...' });
  if (elapsed > 1800) entries.push({ nodeId: 'design', time: ts(), duration: 920, responseLength: 580, promptPreview: 'Design a solution for...', responsePreview: 'Step 1: Create auth module. Step 2: Add routes...' });
  if (elapsed > 2800) entries.push({ nodeId: 'code', time: ts(), duration: 1450, responseLength: 1200, promptPreview: 'Implement the following plan...', responsePreview: 'Created src/auth.ts with login(), logout()...' });
  if (elapsed > 4500) entries.push({ nodeId: 'review', time: ts(), duration: 340, responseLength: 150, promptPreview: 'Review these changes...', responsePreview: 'Changes look correct. No security issues.' });
  return entries;
}

// ── Map demo data to IApiClient types ────────────────────────

function mapDemoBlocks(filter?: { type?: string; designation?: string; category?: string; contract?: string }): any[] {
  let blocks = DEMO_BLOCKS.map(b => ({
    id: b.id,
    name: b.name,
    type: b.type,
    blockType: b.type,
    version: b.version,
    description: `${b.name} block`,
    isAtomic: b.isAtomic,
    fitness: b.fitness,
    capabilities: b.capabilities || [],
    contract: (b as any).contract || undefined,
    children: [] as any[],
  }));
  if (filter?.type) {
    blocks = blocks.filter(b => b.type === filter.type);
  }
  if (filter?.designation) {
    blocks = blocks.filter(b => {
      const orig = DEMO_BLOCKS.find(d => d.id === b.id);
      return orig?.designation === filter.designation;
    });
  }
  if (filter?.contract) {
    blocks = blocks.filter(b => b.contract === filter!.contract);
  }
  return blocks;
}

function mapDemoSessions() {
  return DEMO_SESSIONS.map(s => ({
    id: s.id,
    name: s.name,
    status: s.status === 'active' ? 'running' : s.status,
    type: s.type,
    startedAt: '2026-02-25T10:00:00Z',
    completedAt: s.status === 'completed' ? '2026-02-25T10:12:00Z' : null,
    workingDirectory: `C:\\${s.repo}`,
    variables: {},
  }));
}

function mapDemoModels() {
  return DEMO_MODELS.map(m => ({
    modelId: m.id,
    name: m.name,
    size: m.provider === 'Local' ? '7B' : undefined,
    category: m.provider === 'Local' ? 'local' : 'cloud',
    isLocal: m.provider === 'Local',
    recommended: m.status === 'available',
  }));
}

function mapDemoProjects(): any[] {
  return DEMO_REPOS.map(r => ({
    id: r.id,
    name: r.name,
    rootPath: r.path,
    containerStatus: 'active',
    maestroInfo: { blocks: 4, artifacts: 2, metrics: 8, logs: 15 },
    sessionIds: [] as string[],
  }));
}

function mapDemoWorkspaces(): any[] {
  return DEMO_WORKSPACES.map(ws => ({
    id: ws.id,
    name: ws.name,
    type: 'development',
    status: 'active',
    description: `${ws.name} workspace`,
    repositoryPath: 'C:\\Meastro',
    sessionIds: [] as string[],
    settings: {
      maxConcurrentSessions: 5,
      autoPromotionEnabled: false,
      minFitnessForPromotion: 0.8,
    },
  }));
}

// ── DemoApiClient class ──────────────────────────────────────

class DemoApiClient implements IMaestroCodeApiClient {
  DEMO_SESSION_ID = DEMO_SESSION_ID;
  private startTime = 0;

  // ── IApiClient methods ──────────────────────────────────

  async listSessions(): Promise<any[]> {
    return mapDemoSessions();
  }

  async getSession(id: string): Promise<any> {
    const elapsed = Date.now() - this.startTime;
    const tree = getTree(elapsed);
    const allDone = tree.every((n: any) => n.status === 'completed');
    return {
      id,
      name: 'Demo Session — Add Login Page',
      status: allDone ? 'idle' : 'running',
      type: 'project',
      startedAt: '2026-02-25T10:00:00Z',
      completedAt: allDone ? new Date().toISOString() : null,
      workingDirectory: 'C:\\Projects\\demo',
      variables: {
        _executionTree: tree,
        _executionLog: getLog(elapsed),
        _llmActivity: getLLM(elapsed),
        _scoreHistory: elapsed > 3000 ? [0.3, 0.5, 0.7, 0.85] : [0.3],
        currentFitness: elapsed > 4000 ? 0.85 : elapsed > 2000 ? 0.5 : 0.3,
      },
    };
  }

  async getHealth() {
    return { status: 'ok', version: '0.1.0-demo', uptime: '1h 23m' };
  }

  async getLLMHealth(): Promise<any> {
    return {
      status: 'healthy',
      activeModel: 'claude-sonnet-4-6',
      backend: 'Anthropic API',
      device: 'cloud',
      gpuMemory: 'N/A',
      modelsLoaded: 1,
      cudaAvailable: false,
    };
  }

  async listLLMModels(): Promise<any[]> {
    return mapDemoModels();
  }

  async getLLMStats() {
    return {
      totalRequests: 142,
      totalErrors: 2,
      errorRate: 0.014,
      promptTokens: 45000,
      completionTokens: 12000,
      totalTokens: 57000,
      latencyP50Ms: 230,
      latencyP95Ms: 890,
      latencyP99Ms: 1450,
      avgLatencyMs: 350,
      perModel: [
        { model: 'claude-sonnet-4-6', requests: 120, avgLatencyMs: 320, totalTokens: 48000, rpm: 8 },
        { model: 'gpt-4o', requests: 22, avgLatencyMs: 510, totalTokens: 9000, rpm: 2 },
      ],
    };
  }

  async getLLMQueueStats() {
    return {
      activeModel: 'claude-sonnet-4-6',
      depth: 0,
      avgWaitMs: 12,
      totalEnqueued: 142,
      totalProcessed: 142,
      depthByModel: {},
    };
  }

  async getLLMStatus() {
    return {
      activeModel: 'claude-sonnet-4-6',
      maxTokens: 4096,
      temperature: 0.7,
      totalRequests: 142,
      avgLatency: 850,
      peakLatency: 2100,
      errorCount: 2,
      tokensIn: 45000,
      tokensOut: 12000,
      throughput: 42,
      uptime: '1h 23m',
      load: 'medium',
    };
  }

  async listBlocks(filter?: { type?: string; designation?: string; category?: string }): Promise<any[]> {
    return mapDemoBlocks(filter);
  }

  async getBlock(id: string): Promise<any> {
    const blocks = mapDemoBlocks();
    return blocks.find(b => b.id === id) || null;
  }

  async getBlockMetrics(id: string) {
    const block = DEMO_BLOCKS.find(b => b.id === id);
    return {
      successRate: block ? block.fitness : 0,
      totalRuns: 25,
      avgDuration: 1200,
      lastRun: '2026-02-25T09:45:00Z',
    };
  }

  async getTopBlocks(options?: { designation?: string; type?: string; limit?: number }): Promise<any[]> {
    let blocks = mapDemoBlocks({ type: options?.type, designation: options?.designation });
    blocks.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
    if (options?.limit) blocks = blocks.slice(0, options.limit);
    return blocks;
  }

  async designateBlock(_id: string, _designation: string) {
    return { success: true };
  }

  async recordBlockRun(_id: string, _data: unknown) {
    return { success: true };
  }

  async getModelPerformance(_modelId: string) {
    return {
      bestFitness: 0.85,
      sessionCount: 12,
      taskFitness: [
        { task: 'code-generation', fitness: 0.87 },
        { task: 'code-review', fitness: 0.82 },
        { task: 'test-writing', fitness: 0.79 },
      ],
      fitnessHistory: [0.6, 0.7, 0.75, 0.8, 0.85],
    };
  }

  async listProjects() {
    return mapDemoProjects();
  }

  async getProject(id: string) {
    const projects = mapDemoProjects();
    return projects.find(p => p.id === id) || projects[0];
  }

  async getWorkspace(id: string) {
    const workspaces = mapDemoWorkspaces();
    return workspaces.find(w => w.id === id) || workspaces[0];
  }

  async get(path: string) {
    if (path.includes('/api/workspaces')) {
      return mapDemoWorkspaces();
    }
    if (path.includes('/api/blocks')) {
      // Support contract filter in get()
      const url = new URL(path, 'http://localhost');
      const contract = url.searchParams.get('contract');
      if (contract) return mapDemoBlocks({ contract });
      return mapDemoBlocks();
    }
    if (path.includes('/api/contracts/')) {
      const contractId = path.split('/api/contracts/')[1];
      return DEMO_CONTRACTS[contractId] || null;
    }
    if (path.includes('/api/contracts')) {
      return Object.values(DEMO_CONTRACTS);
    }
    if (path.includes('/api/sessions')) {
      return mapDemoSessions();
    }
    if (path.includes('/api/health')) {
      return { status: 'ok' };
    }
    return {};
  }

  getApiUrl() {
    return 'http://localhost:5000 (demo)';
  }

  // ── Extra methods for SessionManager compat ─────────────

  async _fetch(method: string, path: string, _options?: { body?: unknown }) {
    if (path === '/api/health') return { status: 'ok' };
    if (method === 'DELETE' && path.startsWith('/api/sessions/')) return { success: true };
    // Contract query: GET /api/blocks?contract=xxx
    if (method === 'GET' && path.startsWith('/api/blocks')) {
      const url = new URL(path, 'http://localhost');
      const contract = url.searchParams.get('contract');
      if (contract) return mapDemoBlocks({ contract });
      return mapDemoBlocks();
    }
    // Contract definitions
    if (method === 'GET' && path.startsWith('/api/contracts/')) {
      const contractId = path.split('/api/contracts/')[1];
      const contract = DEMO_CONTRACTS[contractId];
      if (contract) return contract;
      throw new Error(`Contract not found: ${contractId}`);
    }
    if (method === 'GET' && path === '/api/contracts') {
      return Object.values(DEMO_CONTRACTS);
    }
    return {};
  }

  // ── Contract methods ──────────────────────────────────────

  async listContracts() {
    return Object.values(DEMO_CONTRACTS);
  }

  async getContract(id: string) {
    return DEMO_CONTRACTS[id] || null;
  }

  async testContract(contractId: string, blockId: string) {
    const contract = DEMO_CONTRACTS[contractId];
    if (!contract) throw new Error(`Contract not found: ${contractId}`);

    // Simulate a delay (real tests take 30-60s)
    await new Promise(r => setTimeout(r, 200));

    const featureIds = Object.keys(contract.features || {});
    const features = featureIds.map(fid => ({
      featureId: fid,
      description: contract.features[fid]?.description || '',
      active: true,
      score: 0.95 + Math.random() * 0.05,
      weight: 1.0,
      minimumScore: 0.7,
      meetsThreshold: true,
      testsPassed: 5,
      testsTotal: 5,
    }));

    const totalTests = features.length * 5;
    return {
      contractId,
      contractVersion: '2.0.0',
      blockId,
      fitness: 0.15,
      performanceScore: 0.95,
      passed: true,
      meetsRequiredCapabilities: true,
      features,
      testResults: [] as any[],
      totalTests,
      passedTests: totalTests,
      failedTests: 0,
      skippedTests: 0,
      durationMs: 45200,
      estimatedCostUsd: 0.42,
      failureReasons: [] as string[],
      fitnessBreakdown: {
        performance: 0.95,
        specialization: 0.48,
        composability: 1.0,
        economicCost: 2.3,
        computeCost: 11.0,
        hardwareCost: 1.0,
        totalFitness: 0.15,
        numerator: 0.81,
        combinedCost: 4.1,
      },
    };
  }

  // ── Cost methods ──────────────────────────────────────────

  async getCostsSummary() {
    return {
      today: { totalCost: 1.42, totalTokens: 45000, requestCount: 28 },
      thisWeek: { totalCost: 8.75, totalTokens: 280000, requestCount: 142 },
      thisMonth: { totalCost: 23.50, totalTokens: 750000, requestCount: 380 },
      allTime: { totalCost: 67.20, totalTokens: 2100000, requestCount: 1050 },
      byProvider: { 'Anthropic': { totalCost: 45.00, totalTokens: 1400000 }, 'Local': { totalCost: 22.20, totalTokens: 700000 } },
      byModel: {},
      limits: { maxPerDay: 10.00, maxPerMonth: 100.00 },
    };
  }

  async getCostsLimits() {
    return { maxPerSession: null as number | null, maxPerDay: 10.00, maxPerWeek: null as number | null, maxPerMonth: 100.00 };
  }

  async setCostsLimits(limits: any) {
    return limits;
  }

  async createSession(_opts: CreateSessionOptions) {
    this.startTime = Date.now();
    return { id: DEMO_SESSION_ID };
  }

  async startSession(_id: string) {}

  _startTime() {
    this.startTime = Date.now();
  }
}

export { DemoApiClient, DEMO_SESSION_ID };
