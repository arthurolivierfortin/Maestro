// @ts-nocheck
/**
 * Demo mock data — used by CatalogPage, SpacesPage, ModelsPage
 * when demoMode=true. Replaces API calls with static data.
 *
 * Phase 41-G.
 */

// ── Catalog: 12 blocks ──────────────────────────────────────

export const DEMO_BLOCKS = [
  { id: 'code-analyzer', name: 'Code Analyzer', type: 'agent', designation: 'tool', isAtomic: false, version: '1.2.0', fitness: 0.87 },
  { id: 'file-read', name: 'File Read', type: 'tool', designation: 'tool', isAtomic: true, version: '2.0.0', fitness: 0.95 },
  { id: 'file-write', name: 'File Write', type: 'tool', designation: 'tool', isAtomic: true, version: '2.0.0', fitness: 0.93 },
  { id: 'dev-orchestrator', name: 'Dev Orchestrator', type: 'agent', designation: 'agent', isAtomic: false, version: '3.1.0', fitness: 0.82 },
  { id: 'json-validator', name: 'JSON Validator', type: 'validator', designation: 'tool', isAtomic: true, version: '1.0.0', fitness: 0.98 },
  { id: 'task-planner', name: 'Task Planner', type: 'inference', designation: 'tool', isAtomic: true, version: '1.4.0', fitness: 0.79 },
  { id: 'code-reviewer', name: 'Code Reviewer', type: 'agent', designation: 'agent', isAtomic: false, version: '2.0.0', fitness: 0.84 },
  { id: 'test-runner', name: 'Test Runner', type: 'tool', designation: 'tool', isAtomic: true, version: '1.1.0', fitness: 0.91 },
  { id: 'commit-helper', name: 'Commit Helper', type: 'tool', designation: 'tool', isAtomic: true, version: '1.0.0', fitness: 0.88 },
  { id: 'refactor-agent', name: 'Refactor Agent', type: 'agent', designation: 'agent', isAtomic: false, version: '1.0.0', fitness: 0.76 },
  { id: 'doc-generator', name: 'Doc Generator', type: 'inference', designation: 'tool', isAtomic: true, version: '1.2.0', fitness: 0.85 },
  { id: 'autonomous-dev', name: 'Autonomous Dev', type: 'workflow', designation: 'workflow', isAtomic: false, version: '3.0.0', fitness: 0.80 },
];

// ── Spaces: repos, workspaces, sessions ─────────────────────

export const DEMO_REPOS = [
  { id: 'repo-cantante', name: 'Cantante', path: 'C:\\Cantante', language: 'TypeScript', lastActivity: '2h ago' },
  { id: 'repo-maestro', name: 'Maestro', path: 'C:\\Meastro', language: 'C# / TypeScript', lastActivity: '5m ago' },
  { id: 'repo-webapp', name: 'WebApp', path: 'C:\\Projects\\webapp', language: 'React', lastActivity: '1d ago' },
];

export const DEMO_WORKSPACES = [
  { id: 'ws-dev', name: 'Development', repos: ['repo-cantante', 'repo-maestro'], sessions: 3, created: '2026-02-20' },
  { id: 'ws-experiment', name: 'Experiments', repos: ['repo-webapp'], sessions: 2, created: '2026-02-18' },
];

export const DEMO_SESSIONS = [
  { id: 'sess-001', name: 'Cantante - File Tree Module', type: 'project', status: 'completed', repo: 'Cantante', duration: '12m' },
  { id: 'sess-002', name: 'Cantante - TTS Accessibility', type: 'project', status: 'active', repo: 'Cantante', duration: '3m' },
  { id: 'sess-003', name: 'Maestro - Agent Loop Fix', type: 'project', status: 'completed', repo: 'Maestro', duration: '8m' },
  { id: 'sess-004', name: 'Task Planner v2', type: 'foundry', status: 'completed', repo: 'Maestro', duration: '25m' },
  { id: 'sess-005', name: 'WebApp - Login Page', type: 'project', status: 'error', repo: 'WebApp', duration: '5m' },
];

// ── Models: 6 models ────────────────────────────────────────

export const DEMO_MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', status: 'available', latency: 850, tokensPerSec: 42 },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', status: 'available', latency: 2100, tokensPerSec: 18 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'Azure', status: 'available', latency: 1200, tokensPerSec: 35 },
  { id: 'qwen-2.5-coder', name: 'Qwen 2.5 Coder 7B', provider: 'Local', status: 'available', latency: 320, tokensPerSec: 65 },
  { id: 'smollm2-1.7b', name: 'SmolLM2 1.7B', provider: 'Local', status: 'offline', latency: 0, tokensPerSec: 0 },
  { id: 'deepseek-coder', name: 'DeepSeek Coder V2', provider: 'Azure', status: 'rate-limited', latency: 1800, tokensPerSec: 28 },
];

/**
 * Create a mock API client that returns demo data.
 * Pages can use this instead of the real apiClient when demoMode=true.
 */
export function createDemoApiClient() {
  return {
    _fetch: async (method: string, url: string) => {
      // Blocks
      if (url.includes('/api/blocks')) {
        return { data: DEMO_BLOCKS };
      }
      // Sessions
      if (url.includes('/api/sessions')) {
        return { data: DEMO_SESSIONS };
      }
      // Models
      if (url.includes('/api/v1/models') || url.includes('/api/models')) {
        return { data: DEMO_MODELS };
      }
      // Health
      if (url.includes('/api/health')) {
        return { status: 'ok' };
      }
      return { data: [] };
    },
  };
}
