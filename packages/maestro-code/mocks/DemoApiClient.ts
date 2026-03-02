// @ts-nocheck
/**
 * DemoApiClient — Full IApiClient implementation with demo data.
 *
 * Used by maestro-code in --demo mode. Monitor screens call standard
 * IApiClient methods (listBlocks, listSessions, etc.) and get back
 * realistic mock data. The screens don't know they're in demo mode.
 *
 * Also includes extra methods needed by SessionManager (createSession,
 * startSession, _fetch) for the agent page's task submission flow.
 */

import {
  DEMO_BLOCKS,
  DEMO_REPOS,
  DEMO_WORKSPACES,
  DEMO_SESSIONS,
  DEMO_MODELS,
} from './demo-data.ts';

// ── Constants ────────────────────────────────────────────────

const DEMO_SESSION_ID = 'demo-0000-1111-2222-333344445555';

function ts() {
  return new Date().toISOString();
}

// ── Evolving session data (staged mock execution) ────────────

function getTree(elapsed: number) {
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

function mapDemoBlocks(filter?: { type?: string; designation?: string; category?: string }) {
  let blocks = DEMO_BLOCKS.map(b => ({
    id: b.id,
    name: b.name,
    type: b.type,
    version: b.version,
    description: `${b.name} block`,
    isAtomic: b.isAtomic,
    fitness: b.fitness,
    children: [],
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

function mapDemoProjects() {
  return DEMO_REPOS.map(r => ({
    id: r.id,
    name: r.name,
    rootPath: r.path,
    containerStatus: 'active',
    maestroInfo: { blocks: 4, artifacts: 2, metrics: 8, logs: 15 },
    sessionIds: [],
  }));
}

function mapDemoWorkspaces() {
  return DEMO_WORKSPACES.map(ws => ({
    id: ws.id,
    name: ws.name,
    type: 'development',
    status: 'active',
    description: `${ws.name} workspace`,
    repositoryPath: 'C:\\Meastro',
    sessionIds: [],
    settings: {
      maxConcurrentSessions: 5,
      autoPromotionEnabled: false,
      minFitnessForPromotion: 0.8,
    },
  }));
}

// ── DemoApiClient class ──────────────────────────────────────

class DemoApiClient {
  DEMO_SESSION_ID = DEMO_SESSION_ID;
  private startTime = 0;

  // ── IApiClient methods ──────────────────────────────────

  async listSessions() {
    return mapDemoSessions();
  }

  async getSession(id: string) {
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

  async getLLMHealth() {
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

  async listLLMModels() {
    return mapDemoModels();
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

  async listBlocks(filter?: { type?: string; designation?: string; category?: string }) {
    return mapDemoBlocks(filter);
  }

  async getBlock(id: string) {
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

  async getTopBlocks(options?: { designation?: string; type?: string; limit?: number }) {
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
      return mapDemoBlocks();
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

  async _fetch(method: string, path: string) {
    if (path === '/api/health') return { status: 'ok' };
    if (method === 'DELETE' && path.startsWith('/api/sessions/')) return { success: true };
    return {};
  }

  async createSession(_opts: any) {
    this.startTime = Date.now();
    return { id: DEMO_SESSION_ID };
  }

  async startSession() {}

  _startTime() {
    this.startTime = Date.now();
  }
}

export { DemoApiClient, DEMO_SESSION_ID };
