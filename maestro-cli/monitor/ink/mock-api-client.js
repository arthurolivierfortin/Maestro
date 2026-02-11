/**
 * Mock API Client — Provides realistic fake data for visual testing.
 *
 * Usage: node index.js monitor --mock
 *
 * Returns deterministic data that exercises all TUI features:
 * - Sessions with different statuses (running, done, idle)
 * - Phases (done, running, pending) with execution tree
 * - LLM activity entries
 * - Execution log entries
 * - Variables, metrics, artifacts
 * - Blocks catalog, projects, workspaces
 * - LLM model info
 */

// ── Helpers ─────────────────────────────────────────────────────

let tick = 0;
const nextTick = () => ++tick;

const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const timeStr = (minutes) => {
  const d = new Date(Date.now() - minutes * 60000);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// ── Mock session (descriptor mode — phases + exec tree) ─────────

const MOCK_SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MOCK_SESSION_IDLE_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const MOCK_SESSION_EXEC_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const makePhases = () => [
  {
    id: 'creation',
    name: 'Phase 1: Creation',
    status: 'done',
    result: { iterations: 3, fitness: 0.92, tokenCount: 42 },
  },
  {
    id: 'optimization',
    name: 'Phase 2: Optimization',
    status: 'done',
    result: { iterations: 8, fitness: 0.95, tokenCount: 156 },
  },
  {
    id: 'validation',
    name: 'Phase 3: Validation',
    status: 'running',
  },
  {
    id: 'publish',
    name: 'Phase 4: Publish',
    status: 'pending',
  },
];

const makeExecTree = () => [
  { id: 'load-config', name: 'Load Configuration', status: 'done', children: [] },
  {
    id: 'improvement-loop',
    name: 'Improvement Loop',
    status: 'running',
    children: [
      { id: 'read-artifact', name: 'Read Artifact', status: 'done', children: [] },
      { id: 'run-training', name: 'Run Training', status: 'done', children: [] },
      {
        id: 'evaluate',
        name: 'Evaluate Results',
        status: 'running',
        children: [
          { id: 'parse-output', name: 'Parse Output', status: 'done', children: [] },
          { id: 'compute-fitness', name: 'Compute Fitness', status: 'running', children: [] },
          { id: 'check-threshold', name: 'Check Threshold', status: 'pending', children: [] },
        ],
      },
      { id: 'generate-improvements', name: 'Generate Improvements', status: 'pending', children: [] },
      { id: 'apply-improvements', name: 'Apply Improvements', status: 'pending', children: [] },
      { id: 'update-metrics', name: 'Update Metrics', status: 'pending', children: [] },
    ],
  },
  { id: 'finalize', name: 'Finalize & Report', status: 'pending', children: [] },
];

const makeLLMActivity = () => [
  {
    nodeId: 'run-training',
    time: timeStr(5),
    duration: 2.4,
    responseLength: 1280,
    promptPreview: 'Generate a JSON commit message for: Added new authentication middleware with JWT token validation. Include type, scope, subject, and body fields.',
    responsePreview: '{"type":"feat","scope":"auth","subject":"add JWT authentication middleware","body":"Implements token validation and refresh logic for protected API routes"}',
  },
  {
    nodeId: 'evaluate',
    time: timeStr(4),
    duration: 1.1,
    responseLength: 256,
    promptPreview: 'Evaluate the following output against quality criteria: hasRequiredFields, isValidJSON, subjectUnder50Chars, bodyIsDescriptive',
    responsePreview: '{"fitness":0.92,"details":{"hasRequiredFields":true,"isValidJSON":true,"subjectUnder50Chars":true,"bodyIsDescriptive":true}}',
  },
  {
    nodeId: 'generate-improvements',
    time: timeStr(3),
    duration: 3.2,
    responseLength: 2048,
    promptPreview: 'Based on the current fitness of 0.92 and the following evaluation details, suggest specific improvements to the system prompt to increase output quality.',
    responsePreview: 'Improvement suggestions: 1. Add constraint for conventional commit prefix validation. 2. Include example of ideal output format. 3. Emphasize brevity in subject line (max 50 chars).',
  },
  {
    nodeId: 'run-training',
    time: timeStr(1),
    duration: 2.8,
    responseLength: 1536,
    promptPreview: 'Generate a JSON commit message for: Refactored database connection pooling to use async/await pattern with configurable pool size and timeout settings.',
    responsePreview: '{"type":"refactor","scope":"db","subject":"use async connection pooling","body":"Replaces callback-based pool with async/await pattern. Adds configurable pool size (default: 10) and timeout (default: 30s)."}',
  },
];

const makeExecutionLog = () => [
  { time: timeStr(10), level: 'info', message: 'Session started', source: 'SessionServer' },
  { time: timeStr(9), level: 'info', message: 'Entry point "start" invoked → workflow gen-commit', source: 'EntryPointExecutor' },
  { time: timeStr(8), level: 'info', message: 'Phase "creation" started (for-each iteration 1)', source: 'EntryPointExecutor' },
  { time: timeStr(7), level: 'info', message: 'Node load-config completed (142ms)', source: 'BlockExecutor' },
  { time: timeStr(6), level: 'info', message: 'LLM call: SmolLM2-1.7B-Instruct (run-training)', source: 'LLMGateway' },
  { time: timeStr(5), level: 'info', message: 'Fitness: 0.85 → 0.92 (+7%)', source: 'EntryPointExecutor' },
  { time: timeStr(4), level: 'info', message: 'Phase "creation" completed: 3 iterations, fitness 92%', source: 'EntryPointExecutor' },
  { time: timeStr(3), level: 'info', message: 'Phase "optimization" started', source: 'EntryPointExecutor' },
  { time: timeStr(2), level: 'info', message: 'Fitness: 0.92 → 0.95 (+3%)', source: 'EntryPointExecutor' },
  { time: timeStr(1), level: 'info', message: 'Phase "optimization" completed: 8 iterations, fitness 95%', source: 'EntryPointExecutor' },
  { time: timeStr(0), level: 'info', message: 'Phase "validation" started', source: 'EntryPointExecutor' },
  { time: timeStr(0), level: 'warn', message: 'LLM response latency above threshold (3.2s)', source: 'LLMGateway' },
];

const makeDescriptorSession = () => ({
  id: MOCK_SESSION_ID,
  name: 'gen-commit training',
  status: 'running',
  type: 'foundry',
  startedAt: ago(10),
  completedAt: null,
  workingDirectory: 'C:\\Projects\\my-repo',
  entryPoints: { start: 'gen-commit-workflow' },
  commandHistory: [
    { command: 'session create --type foundry --name "gen-commit training"', time: ago(12) },
    { command: 'session import-template a1b2c3d4 foundry-default', time: ago(11) },
    { command: 'session start a1b2c3d4', time: ago(10) },
    { command: 'session invoke a1b2c3d4 start', time: ago(10) },
  ],
  variables: {
    _monitorDescriptor: {
      layout: 'descriptor',
      title: 'Gen-Commit Training',
    },
    _phases: makePhases(),
    _executionTree: makeExecTree(),
    _activeWorkflow: 'gen-commit-workflow',
    _activeBlock: {
      id: 'compute-fitness',
      name: 'Compute Fitness',
      type: 'tool',
      status: 'running',
    },
    _llmActivity: makeLLMActivity(),
    _executionLog: makeExecutionLog(),
    _artifacts: [
      { path: '.maestro/artifacts/commit-message.json', size: 1280, updatedAt: ago(1) },
      { path: '.maestro/metrics/training-metrics.json', size: 4096, updatedAt: ago(2) },
      { path: '.maestro/artifacts/session-tree.md', size: 2048, updatedAt: ago(3) },
    ],
    _workflowConfig: {
      'gen-commit-workflow': {
        creation: { llm: { systemPrompt: 'Generate commit messages...' } },
        optimization: { llm: { systemPrompt: 'Optimize the prompt...' } },
      },
    },
    _bestFitness: 0.95,
    _improvementPhases: ['creation', 'optimization'],
    currentFitness: 0.95,
    currentIteration: 12,
    scoreHistory: [0.65, 0.72, 0.78, 0.85, 0.88, 0.90, 0.92, 0.93, 0.94, 0.95, 0.95, 0.95],
    targetFitness: 0.95,
    model: 'SmolLM2-1.7B-Instruct',
  },
});

// ── Idle session ────────────────────────────────────────────────

const makeIdleSession = () => ({
  id: MOCK_SESSION_IDLE_ID,
  name: 'api-docs generator',
  status: 'idle',
  type: 'foundry',
  startedAt: ago(60),
  completedAt: null,
  workingDirectory: 'C:\\Projects\\api-service',
  entryPoints: { start: 'api-docs-workflow' },
  commandHistory: [
    { command: 'session create --type foundry --name "api-docs generator"', time: ago(65) },
  ],
  variables: {
    currentFitness: 0.72,
    model: 'Qwen2.5-Coder-1.5B',
  },
});

// ── Execution mode session ──────────────────────────────────────

const makeExecSession = () => ({
  id: MOCK_SESSION_EXEC_ID,
  name: 'compliance-tester',
  status: 'running',
  type: 'compliance',
  startedAt: ago(30),
  completedAt: null,
  workingDirectory: 'C:\\Projects\\compliance',
  entryPoints: { start: 'compliance-workflow' },
  commandHistory: [],
  variables: {
    _activeWorkflow: 'compliance-workflow',
    _executionTree: [
      { id: 'setup', name: 'Setup Environment', status: 'done', children: [] },
      {
        id: 'test-models',
        name: 'Test Models',
        status: 'running',
        children: [
          { id: 'test-smol', name: 'Test SmolLM2', status: 'done', children: [] },
          { id: 'test-qwen', name: 'Test Qwen2.5', status: 'running', children: [] },
          { id: 'test-phi', name: 'Test Phi-3', status: 'pending', children: [] },
        ],
      },
      { id: 'generate-report', name: 'Generate Report', status: 'pending', children: [] },
    ],
    currentIteration: 2,
    fitness: 0.88,
  },
});

// ── Done session ────────────────────────────────────────────────

const makeDoneSession = () => ({
  id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  name: 'readme-writer',
  status: 'completed',
  type: 'foundry',
  startedAt: ago(120),
  completedAt: ago(90),
  entryPoints: { start: 'readme-workflow' },
  commandHistory: [],
  variables: {
    currentFitness: 0.97,
    _phases: [
      { id: 'creation', name: 'Creation', status: 'done', result: { iterations: 2, fitness: 0.90 } },
      { id: 'optimization', name: 'Optimization', status: 'done', result: { iterations: 5, fitness: 0.97 } },
      { id: 'publish', name: 'Publish', status: 'done', result: { iterations: 1, fitness: 0.97 } },
    ],
  },
});

// ── Blocks catalog ──────────────────────────────────────────────

const MOCK_BLOCKS = [
  { id: 'gen-commit-workflow', name: 'Gen Commit Message', type: 'workflow', version: '1.2.0', description: 'Generate conventional commit messages from diffs', fitness: 0.95, isAtomic: false },
  { id: 'gen-readme-workflow', name: 'Gen README', type: 'workflow', version: '1.0.0', description: 'Generate README.md from codebase analysis', fitness: 0.88, isAtomic: false },
  { id: 'compliance-workflow', name: 'Compliance Tester', type: 'workflow', version: '2.1.0', description: 'Test multiple LLM models against compliance criteria', fitness: null, isAtomic: false },
  { id: 'code-reviewer', name: 'Code Reviewer', type: 'agent', version: '1.0.0', description: 'Reviews pull requests for code quality', fitness: 0.82, isAtomic: false },
  { id: 'llm-generate', name: 'LLM Generate', type: 'tool', version: '3.0.0', description: 'Core inference tool — calls LLM provider', fitness: null, isAtomic: true },
  { id: 'json-validator', name: 'JSON Validator', type: 'tool', version: '1.1.0', description: 'Validates JSON output against schema', fitness: null, isAtomic: true },
  { id: 'fitness-evaluator', name: 'Fitness Evaluator', type: 'tool', version: '2.0.0', description: 'Computes fitness score from quality criteria', fitness: null, isAtomic: true },
  { id: 'file-writer', name: 'File Writer', type: 'tool', version: '1.0.0', description: 'Writes content to filesystem paths', fitness: null, isAtomic: true },
  { id: 'diff-parser', name: 'Diff Parser', type: 'tool', version: '1.0.0', description: 'Parses git diff into structured format', fitness: null, isAtomic: true },
  { id: 'metrics-reporter', name: 'Metrics Reporter', type: 'tool', version: '1.0.0', description: 'Formats and writes metrics reports', fitness: null, isAtomic: true },
];

// ── Projects ────────────────────────────────────────────────────

const MOCK_PROJECTS = [
  { id: 'proj-001', name: 'my-repo', rootPath: 'C:\\Projects\\my-repo', containerStatus: 'running' },
  { id: 'proj-002', name: 'api-service', rootPath: 'C:\\Projects\\api-service', containerStatus: 'idle' },
  { id: 'proj-003', name: 'frontend-app', rootPath: 'C:\\Projects\\frontend-app', containerStatus: 'idle' },
];

// ── LLM models ──────────────────────────────────────────────────

const MOCK_LLM_HEALTH = {
  status: 'healthy',
  model: 'SmolLM2-1.7B-Instruct',
  backend: 'vllm',
  device: 'cuda:0',
  gpuMemory: '2.1GB / 8.0GB',
};

const MOCK_LLM_MODELS = [
  { id: 'SmolLM2-1.7B-Instruct', name: 'SmolLM2 1.7B Instruct', size: '1.7B', loaded: true },
  { id: 'Qwen2.5-Coder-1.5B-Instruct', name: 'Qwen 2.5 Coder 1.5B', size: '1.5B', loaded: false },
  { id: 'SmolLM2-360M-Instruct', name: 'SmolLM2 360M Instruct', size: '360M', loaded: false },
  { id: 'Phi-3-mini-4k-instruct', name: 'Phi-3 Mini 4K', size: '3.8B', loaded: false },
];

const MOCK_LLM_STATUS = {
  activeModel: 'SmolLM2-1.7B-Instruct',
  maxTokens: 512,
  temperature: 0.3,
  totalRequests: 47,
  avgLatency: 2.1,
};

// ── Mock API Client class ───────────────────────────────────────

class MockApiClient {
  constructor() {
    this.baseUrl = 'http://localhost:5000 (mock)';
  }

  async _delay(ms = 5) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Sessions ──
  async listSessions() {
    await this._delay();
    return [
      makeDescriptorSession(),
      makeExecSession(),
      makeIdleSession(),
      makeDoneSession(),
    ];
  }

  async getSession(id) {
    await this._delay();
    if (id === MOCK_SESSION_ID) return makeDescriptorSession();
    if (id === MOCK_SESSION_IDLE_ID) return makeIdleSession();
    if (id === MOCK_SESSION_EXEC_ID) return makeExecSession();
    // Default: return the descriptor session for any ID
    return makeDescriptorSession();
  }

  // ── Health ──
  async getHealth() {
    await this._delay();
    return { status: 'healthy', uptime: '2h 15m', version: '1.0.0-mock' };
  }

  // ── LLM ──
  async getLLMHealth() {
    await this._delay();
    return MOCK_LLM_HEALTH;
  }

  async listLLMModels() {
    await this._delay();
    return MOCK_LLM_MODELS;
  }

  async getLLMStatus() {
    await this._delay();
    return MOCK_LLM_STATUS;
  }

  // ── Blocks ──
  async listBlocks() {
    await this._delay();
    return MOCK_BLOCKS;
  }

  // ── Projects ──
  async listProjects() {
    await this._delay();
    return MOCK_PROJECTS;
  }

  // ── Generic GET (workspaces etc.) ──
  async get(path) {
    await this._delay();
    if (path === '/api/workspaces') {
      return [
        { id: 'ws-001', name: 'training-research', type: 'research' },
        { id: 'ws-002', name: 'gen-commit-dev', type: 'development' },
      ];
    }
    return [];
  }

  // ── Stubs for completeness ──
  async post() { return {}; }
  async put() { return {}; }
  async delete() { return {}; }

  getApiUrl() { return this.baseUrl; }
}

export { MockApiClient };
