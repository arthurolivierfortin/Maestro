/**
 * Tests for shared/app/transforms — Pure functions, no React dependency.
 *
 * Run: npx tsx tests/shared-app-transforms.test.ts
 */

import {
  extractActiveModel,
  isServiceHealthy,
  toServiceHealth,
  toLLMServiceHealth,
  extractMaxTokens,
  extractDevice,
  extractBackend,
  type LLMHealthResponse,
} from '../../shared/app/transforms/health';

import {
  countByStatus,
  filterByStatus,
  filterRunning,
  extractFitness,
  statusToSemantic,
  type SessionSummary,
} from '../../shared/app/transforms/session';

import {
  sortByType,
  groupByType,
  countByType,
  type BlockSummary,
} from '../../shared/app/transforms/block';

import {
  normalizeModelEntry,
  getModelName,
  isActiveModel,
} from '../../shared/app/transforms/model';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    console.log(`  \u2717 ${msg}`);
  }
}

function assertEq(actual: unknown, expected: unknown, msg: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    console.log(`  \u2717 ${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Health Transforms ────────────────────────────────────────────────

console.log('\n=== Health Transforms ===');

// extractActiveModel
assertEq(extractActiveModel(null), null, 'extractActiveModel: null input → null');
assertEq(extractActiveModel(undefined), null, 'extractActiveModel: undefined → null');
assertEq(extractActiveModel({ activeModel: 'gpt-4' }), 'gpt-4', 'extractActiveModel: activeModel field');
assertEq(extractActiveModel({ model: 'llama-7b' }), 'llama-7b', 'extractActiveModel: model field');
assertEq(extractActiveModel({ model_id: 'smollm2' }), 'smollm2', 'extractActiveModel: model_id field');
assertEq(
  extractActiveModel({ activeModel: 'preferred', model: 'fallback' }),
  'preferred',
  'extractActiveModel: activeModel takes priority over model'
);

// isServiceHealthy
assert(!isServiceHealthy(null), 'isServiceHealthy: null → false');
assert(!isServiceHealthy(undefined), 'isServiceHealthy: undefined → false');
assert(isServiceHealthy({ status: 'healthy' }), 'isServiceHealthy: status=healthy → true');
assert(isServiceHealthy({ status: 'ready' }), 'isServiceHealthy: status=ready → true');
assert(!isServiceHealthy({ error: true }), 'isServiceHealthy: error=true → false');
assert(!isServiceHealthy({ error: 'timeout' }), 'isServiceHealthy: error=string → false');
assert(isServiceHealthy({ error: false }), 'isServiceHealthy: error=false → true');
assert(isServiceHealthy({}), 'isServiceHealthy: empty object (no error field) → true');

// toServiceHealth
const backendDown = toServiceHealth('Backend', null, 100);
assertEq(backendDown.status, 'down', 'toServiceHealth: null → status down');
assertEq(backendDown.detail, 'Unreachable', 'toServiceHealth: null → detail Unreachable');

const backendOk = toServiceHealth('Backend', { status: 'healthy', version: '1.0.0' }, 42);
assertEq(backendOk.status, 'healthy', 'toServiceHealth: healthy response → status healthy');
assertEq(backendOk.detail, '1.0.0', 'toServiceHealth: uses version as detail');
assertEq(backendOk.latencyMs, 42, 'toServiceHealth: passes latency through');

const backendErr = toServiceHealth('Backend', { error: 'connect refused' }, 0);
assertEq(backendErr.status, 'degraded', 'toServiceHealth: error response → status degraded');

// toLLMServiceHealth
const llmDown = toLLMServiceHealth(null);
assertEq(llmDown.name, 'LLM Provider', 'toLLMServiceHealth: name is LLM Provider');
assertEq(llmDown.status, 'down', 'toLLMServiceHealth: null → down');

const llmOk = toLLMServiceHealth({ status: 'healthy', activeModel: 'SmolLM2' });
assertEq(llmOk.status, 'healthy', 'toLLMServiceHealth: healthy → healthy');
assertEq(llmOk.detail, 'SmolLM2', 'toLLMServiceHealth: detail is model name');

const llmNoModel = toLLMServiceHealth({ status: 'healthy' });
assertEq(llmNoModel.detail, 'No model loaded', 'toLLMServiceHealth: no model → "No model loaded"');

// extractMaxTokens
assertEq(extractMaxTokens(null), null, 'extractMaxTokens: null → null');
assertEq(extractMaxTokens({ maxTokens: 2048 }), 2048, 'extractMaxTokens: maxTokens');
assertEq(extractMaxTokens({ max_tokens: 4096 }), 4096, 'extractMaxTokens: max_tokens');

// extractDevice
assertEq(extractDevice(null), '-', 'extractDevice: null → dash');
assertEq(extractDevice({ device: 'cuda:0' }), 'cuda:0', 'extractDevice: returns device');

// extractBackend
assertEq(extractBackend(null), '-', 'extractBackend: null → dash');
assertEq(extractBackend({ backend: 'vllm' }), 'vllm', 'extractBackend: returns backend');
assertEq(extractBackend({ framework: 'torch' }), 'torch', 'extractBackend: falls back to framework');

// ── Session Transforms ───────────────────────────────────────────────

console.log('\n=== Session Transforms ===');

const sessions: SessionSummary[] = [
  { id: '1', status: 'running' },
  { id: '2', status: 'completed' },
  { id: '3', status: 'failed' },
  { id: '4', status: 'active' },
  { id: '5', status: 'pending' },
  { id: '6', status: 'paused' },
  { id: '7', status: 'done' },
  { id: '8', status: 'error' },
  { id: '9', status: 'waiting' },
  { id: '10' }, // no status
];

// countByStatus
const counts = countByStatus(sessions);
assertEq(counts.total, 10, 'countByStatus: total = 10');
assertEq(counts.running, 2, 'countByStatus: running = 2 (running + active)');
assertEq(counts.completed, 2, 'countByStatus: completed = 2 (completed + done)');
assertEq(counts.failed, 2, 'countByStatus: failed = 2 (failed + error)');
assertEq(counts.pending, 2, 'countByStatus: pending = 2 (pending + waiting)');
assertEq(counts.paused, 1, 'countByStatus: paused = 1');

const emptyCounts = countByStatus([]);
assertEq(emptyCounts.total, 0, 'countByStatus: empty array → total 0');

// filterByStatus
assertEq(filterByStatus(sessions, 'running').length, 1, 'filterByStatus: running → 1');
assertEq(filterByStatus(sessions, 'completed').length, 1, 'filterByStatus: completed → 1');

// filterRunning
const running = filterRunning(sessions);
assertEq(running.length, 2, 'filterRunning: 2 (running + active)');
assert(running.some(s => s.id === '1'), 'filterRunning: includes id 1 (running)');
assert(running.some(s => s.id === '4'), 'filterRunning: includes id 4 (active)');

// extractFitness
assertEq(extractFitness({ id: '1', variables: { currentFitness: 0.85 } }), 0.85, 'extractFitness: currentFitness');
assertEq(extractFitness({ id: '2', variables: { fitness: 0.5 } }), 0.5, 'extractFitness: fitness fallback');
assertEq(extractFitness({ id: '3' }), null, 'extractFitness: no variables → null');
assertEq(extractFitness({ id: '4', variables: {} }), null, 'extractFitness: empty variables → null');

// statusToSemantic
assertEq(statusToSemantic('running'), 'info', 'statusToSemantic: running → info');
assertEq(statusToSemantic('active'), 'info', 'statusToSemantic: active → info');
assertEq(statusToSemantic('completed'), 'success', 'statusToSemantic: completed → success');
assertEq(statusToSemantic('done'), 'success', 'statusToSemantic: done → success');
assertEq(statusToSemantic('failed'), 'error', 'statusToSemantic: failed → error');
assertEq(statusToSemantic('error'), 'error', 'statusToSemantic: error → error');
assertEq(statusToSemantic('paused'), 'warning', 'statusToSemantic: paused → warning');
assertEq(statusToSemantic(undefined), 'muted', 'statusToSemantic: undefined → muted');
assertEq(statusToSemantic('unknown'), 'muted', 'statusToSemantic: unknown → muted');

// ── Block Transforms ─────────────────────────────────────────────────

console.log('\n=== Block Transforms ===');

const blocks: BlockSummary[] = [
  { id: 'b1', name: 'gen-commit', type: 'workflow' },
  { id: 'b2', name: 'lint-tool', type: 'tool' },
  { id: 'b3', name: 'code-agent', type: 'agent' },
  { id: 'b4', name: 'z-script', type: 'script' },
  { id: 'b5', name: 'a-script', type: 'script' },
];

// sortByType
const sorted = sortByType(blocks);
assertEq(sorted[0].type, 'workflow', 'sortByType: workflow first');
assertEq(sorted[1].type, 'agent', 'sortByType: agent second');
assertEq(sorted[2].type, 'tool', 'sortByType: tool third');
assertEq(sorted[3].name, 'a-script', 'sortByType: same type sorted by name (a-script)');
assertEq(sorted[4].name, 'z-script', 'sortByType: same type sorted by name (z-script)');

// groupByType
const groups = groupByType(blocks);
assertEq(groups.size, 4, 'groupByType: 4 groups (workflow, tool, agent, script)');
// Actually 4 groups
assert(groups.has('workflow'), 'groupByType: has workflow group');
assert(groups.has('tool'), 'groupByType: has tool group');
assert(groups.has('agent'), 'groupByType: has agent group');
assert(groups.has('script'), 'groupByType: has script group');
assertEq(groups.get('script')!.length, 2, 'groupByType: script group has 2 blocks');

// countByType
const typeCounts = countByType(blocks);
assertEq(typeCounts['workflow'], 1, 'countByType: workflow = 1');
assertEq(typeCounts['tool'], 1, 'countByType: tool = 1');
assertEq(typeCounts['agent'], 1, 'countByType: agent = 1');
assertEq(typeCounts['script'], 2, 'countByType: script = 2');

// ── Model Transforms ─────────────────────────────────────────────────

console.log('\n=== Model Transforms ===');

// normalizeModelEntry
assertEq(normalizeModelEntry('SmolLM2').id, 'SmolLM2', 'normalizeModelEntry: string → id');
assertEq(normalizeModelEntry('SmolLM2').name, 'SmolLM2', 'normalizeModelEntry: string → name');
assertEq(normalizeModelEntry({ id: 'a', name: 'B' }).id, 'a', 'normalizeModelEntry: object uses id');
assertEq(normalizeModelEntry({ id: 'a', name: 'B' }).name, 'B', 'normalizeModelEntry: object uses name');
assertEq(normalizeModelEntry({ model_id: 'x' }).id, 'x', 'normalizeModelEntry: model_id fallback');
assertEq(normalizeModelEntry({}).id, 'unknown', 'normalizeModelEntry: empty → unknown');

// getModelName
assertEq(getModelName('gpt-4'), 'gpt-4', 'getModelName: string');
assertEq(getModelName({ name: 'Llama-7B' }), 'Llama-7B', 'getModelName: object.name');

// isActiveModel
assert(isActiveModel('gpt-4', 'gpt-4'), 'isActiveModel: string match');
assert(!isActiveModel('gpt-4', 'llama'), 'isActiveModel: string no match');
assert(isActiveModel({ id: 'gpt-4' }, 'gpt-4'), 'isActiveModel: object.id match');
assert(isActiveModel({ name: 'gpt-4' }, 'gpt-4'), 'isActiveModel: object.name match');
assert(!isActiveModel('gpt-4', null), 'isActiveModel: null active → false');

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
