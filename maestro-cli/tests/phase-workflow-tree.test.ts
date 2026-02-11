/**
 * Tests for PhaseWorkflow tree flatten logic.
 *
 * Now imports from shared/utils/tree instead of inlining functions.
 *
 * Run: npx tsx tests/phase-workflow-tree.test.ts
 */

import {
  getExecNodes,
  cloneTreeWithStatus,
  flattenExecNode,
  flattenPhaseWorkflow,
} from '../../shared/utils/tree.ts';

// ── Test data ───────────────────────────────────────────────────

const PHASES = [
  { id: 'creation', name: 'Phase 1: Creation', status: 'done', result: { iterations: 2, fitness: 0.95, tokenCount: 39 } },
  { id: 'optimization', name: 'Phase 2: Optimization', status: 'done', result: { iterations: 6, fitness: 0.95 } },
  { id: 'validation', name: 'Phase 3: Validation', status: 'done', result: { iterations: 28, fitness: 0.95, tokenCount: 28 } },
  { id: 'publish', name: 'Phase 4: Publish', status: 'running' },
];

const EXEC_TREE = [
  { id: 'load-agent', name: 'Load Agent', status: 'done', children: [] },
  { id: 'improvement-loop', name: 'Improvement Loop', status: 'running', children: [
    { id: 'run-training', name: 'Run Training', status: 'done', children: [] },
    { id: 'evaluate-results', name: 'Evaluate Results', status: 'done', children: [] },
    { id: 'generate-improvements', name: 'Generate Improvements', status: 'running', children: [] },
    { id: 'update-metrics', name: 'Update Metrics', status: 'pending', children: [] },
    { id: 'apply-improvements', name: 'Apply Improvements', status: 'pending', children: [] },
  ]},
  { id: 'finalize', name: 'Finalize', status: 'pending', children: [] },
] as any;

// ── Test helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertEq(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Tests ───────────────────────────────────────────────────────

console.log('=== cloneTreeWithStatus ===');
{
  const cloned = cloneTreeWithStatus(EXEC_TREE, 'done');
  assertEq(cloned.length, 3, 'cloned has 3 top nodes');
  assertEq(cloned[0].status, 'done', 'load-agent status overridden to done');
  assertEq(cloned[1].status, 'done', 'improvement-loop status overridden to done');
  assertEq(cloned[1].children.length, 5, 'improvement-loop children preserved');
  assertEq(cloned[1].children[2].status, 'done', 'nested child status overridden');
  assertEq(cloned[2].status, 'done', 'finalize status overridden to done');
  assertEq(EXEC_TREE[1].status, 'running', 'original tree not mutated');
}

console.log('=== flattenPhaseWorkflow — all collapsed ===');
{
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, new Set());
  assertEq(flat.length, 4, '4 collapsed phases = 4 nodes');
  assert(flat.every(n => n.depth === 0), 'all at depth 0');
  assert(flat.every(n => n.hasChildren === true), 'all have children (exec tree exists)');
  assert(flat.every(n => n.isExpanded === false), 'all collapsed');
  assertEq(flat[0].id, 'creation', 'first phase is creation');
  assertEq(flat[3].id, 'publish', 'last phase is publish');
}

console.log('=== flattenPhaseWorkflow — expand done phase ===');
{
  const expanded = new Set(['creation']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  assertEq(flat[0].id, 'creation', 'creation phase still at index 0');
  assertEq(flat[0].depth, 0, 'creation at depth 0');
  assertEq(flat[0].isExpanded, true, 'creation is expanded');

  assertEq(flat[1].id, 'creation/load-agent', 'first child is creation/load-agent');
  assertEq(flat[1].depth, 1, 'child at depth 1');
  assertEq(flat[1].data.status, 'done', 'done phase child has done status');

  assertEq(flat[2].id, 'creation/improvement-loop', 'second child is creation/improvement-loop');
  assertEq(flat[2].hasChildren, true, 'improvement-loop has children');
  assertEq(flat[2].data.status, 'done', 'improvement-loop forced to done');

  assertEq(flat[3].id, 'creation/finalize', 'third child is creation/finalize');
  assertEq(flat[3].data.status, 'done', 'finalize forced to done');

  assertEq(flat[4].id, 'creation__summary', 'summary node present');
  assert(flat[4].label.includes('2 iter'), 'summary contains iterations');
  assert(flat[4].label.includes('95%'), 'summary contains fitness');

  assertEq(flat[5].id, 'optimization', 'optimization still present after expanded creation');
  assertEq(flat[6].id, 'validation', 'validation still present');
  assertEq(flat[7].id, 'publish', 'publish still present');

  assertEq(flat.length, 8, 'total nodes = 8');
}

console.log('=== flattenPhaseWorkflow — expand running phase ===');
{
  const expanded = new Set(['publish']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  assertEq(flat[0].id, 'creation', 'creation present');
  assertEq(flat[1].id, 'optimization', 'optimization present');
  assertEq(flat[2].id, 'validation', 'validation present');
  assertEq(flat[3].id, 'publish', 'publish present');
  assertEq(flat[3].isExpanded, true, 'publish is expanded');

  assertEq(flat[4].id, 'publish/load-agent', 'running phase child');
  assertEq(flat[4].data.status, 'done', 'load-agent real status is done');
  assertEq(flat[5].id, 'publish/improvement-loop', 'improvement-loop present');
  assertEq(flat[5].data.status, 'running', 'improvement-loop real status is running');
  assertEq(flat[6].id, 'publish/finalize', 'finalize present');
  assertEq(flat[6].data.status, 'pending', 'finalize real status is pending');

  assertEq(flat.length, 7, 'total nodes = 7');
}

console.log('=== flattenPhaseWorkflow — multiple phases expanded ===');
{
  const expanded = new Set(['creation', 'publish']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  assertEq(flat.length, 11, 'total nodes = 11');

  const phaseNodes = flat.filter(n => (n.data as any)._type === 'phase');
  assertEq(phaseNodes.length, 4, 'all 4 phases always present');
  assertEq(phaseNodes[0].id, 'creation', 'creation present');
  assertEq(phaseNodes[1].id, 'optimization', 'optimization present');
  assertEq(phaseNodes[2].id, 'validation', 'validation present');
  assertEq(phaseNodes[3].id, 'publish', 'publish present');
}

console.log('=== Phase prefix prevents ID collisions ===');
{
  const expanded = new Set(['creation', 'optimization']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  const ids = flat.map(n => n.id);
  const uniqueIds = new Set(ids);
  assertEq(ids.length, uniqueIds.size, 'no duplicate IDs in flat list');

  assert(ids.includes('creation/load-agent'), 'creation/load-agent exists');
  assert(ids.includes('optimization/load-agent'), 'optimization/load-agent exists');
  assert(!ids.includes('load-agent'), 'no unprefixed load-agent');
}

console.log('=== Nested exec node expand within phase ===');
{
  const expanded = new Set(['creation', 'creation/improvement-loop']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  const ilNode = flat.find(n => n.id === 'creation/improvement-loop');
  assert(!!ilNode, 'improvement-loop node exists');
  assertEq(ilNode!.isExpanded, true, 'improvement-loop is expanded');
  assertEq(ilNode!.hasChildren, true, 'improvement-loop has children');

  const ilChildren = flat.filter(n => n.parentId === 'creation/improvement-loop');
  assertEq(ilChildren.length, 5, 'improvement-loop has 5 children');
  assertEq(ilChildren[0].id, 'creation/run-training', 'first child is creation/run-training');
  assertEq(ilChildren[0].data.status, 'done', 'child status forced to done');
  assertEq(ilChildren[0].depth, 2, 'child at depth 2');

  assertEq(flat.length, 13, 'total nodes after nested expand = 13');

  const phaseNodes = flat.filter(n => (n.data as any)._type === 'phase');
  assertEq(phaseNodes.length, 4, 'all 4 phases still present');
}

console.log('=== Pending phase expansion ===');
{
  const phasesWithPending = [
    { id: 'creation', name: 'Creation', status: 'done', result: { iterations: 2 } },
    { id: 'future', name: 'Future', status: 'pending' },
  ];
  const expanded = new Set(['future']);
  const flat = flattenPhaseWorkflow(phasesWithPending, EXEC_TREE, expanded);

  const futureChildren = flat.filter(n => n.parentId === 'future');
  assertEq(futureChildren.length, 3, 'pending phase has 3 exec children');
  assert(futureChildren.every(n => n.data.status === 'pending'), 'all children forced to pending');
}

console.log('=== Empty execution tree ===');
{
  const flat = flattenPhaseWorkflow(PHASES, [], new Set(['creation']));
  assertEq(flat.length, 4, 'no exec tree = 4 phases, no children');
  assert(flat.every(n => n.hasChildren === false), 'no children when exec tree empty');
}

console.log('=== Toggle simulation (expand then collapse) ===');
{
  let expandedSet = new Set<string>();

  let flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expandedSet);
  assertEq(flat.length, 4, 'step 1: 4 collapsed phases');

  expandedSet = new Set(expandedSet);
  expandedSet.add('creation');
  flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expandedSet);
  assertEq(flat.length, 8, 'step 2: creation expanded = 8 nodes');
  assertEq(flat[0].id, 'creation', 'step 2: creation at index 0');
  assertEq(flat[0].isExpanded, true, 'step 2: creation expanded');

  expandedSet = new Set(expandedSet);
  expandedSet.delete('creation');
  flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expandedSet);
  assertEq(flat.length, 4, 'step 3: back to 4 collapsed phases');
  assertEq(flat[0].id, 'creation', 'step 3: creation still at index 0');
  assertEq(flat[0].isExpanded, false, 'step 3: creation collapsed');
}

console.log('=== _phaseStatus propagated to exec children ===');
{
  const expanded = new Set(['creation', 'publish']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  const creationExec = flat.filter(n => (n.data as any)._type === 'exec' && n.id.startsWith('creation/'));
  assert(creationExec.length > 0, 'creation has exec children');
  assert(creationExec.every(n => (n.data as any)._phaseStatus === 'done'), 'all creation exec children have _phaseStatus=done');

  const publishExec = flat.filter(n => (n.data as any)._type === 'exec' && n.id.startsWith('publish/'));
  assert(publishExec.length > 0, 'publish has exec children');
  assert(publishExec.every(n => (n.data as any)._phaseStatus === 'running'), 'all publish exec children have _phaseStatus=running');
}

console.log('=== _phaseStatus for pending phases ===');
{
  const phasesWithPending = [
    { id: 'future', name: 'Future', status: 'pending' },
  ];
  const expanded = new Set(['future']);
  const flat = flattenPhaseWorkflow(phasesWithPending, EXEC_TREE, expanded);

  const futureExec = flat.filter(n => (n.data as any)._type === 'exec');
  assert(futureExec.length > 0, 'pending phase has exec children');
  assert(futureExec.every(n => (n.data as any)._phaseStatus === 'pending'), 'all pending exec children have _phaseStatus=pending');
}

console.log('=== _phaseStatus propagated to nested children ===');
{
  const expanded = new Set(['creation', 'creation/improvement-loop']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  const deepChildren = flat.filter(n => (n.data as any)._type === 'exec' && n.depth === 2);
  assert(deepChildren.length === 5, 'has 5 depth-2 exec nodes');
  assert(deepChildren.every(n => (n.data as any)._phaseStatus === 'done'), 'deeply nested children have _phaseStatus=done');
}

console.log('=== Phase nodes have no _phaseStatus (only exec nodes) ===');
{
  const expanded = new Set(['creation']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  const phaseNodes = flat.filter(n => (n.data as any)._type === 'phase');
  assert(phaseNodes.every(n => (n.data as any)._phaseStatus === undefined), 'phase nodes have no _phaseStatus');
}

console.log('=== Exec children preserve original status in data.status ===');
{
  const expanded = new Set(['publish', 'publish/improvement-loop']);
  const flat = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded);

  const loadAgent = flat.find(n => n.id === 'publish/load-agent')!;
  assertEq(loadAgent.data.status, 'done', 'load-agent keeps real done status');
  assertEq((loadAgent.data as any)._phaseStatus, 'running', 'but _phaseStatus = running (parent phase)');

  const genImprov = flat.find(n => n.id === 'publish/generate-improvements')!;
  assertEq(genImprov.data.status, 'running', 'generate-improvements keeps real running status');
  assertEq((genImprov.data as any)._phaseStatus, 'running', 'and _phaseStatus = running');

  const expanded2 = new Set(['creation', 'creation/improvement-loop']);
  const flat2 = flattenPhaseWorkflow(PHASES, EXEC_TREE, expanded2);

  const clonedGenImprov = flat2.find(n => n.id === 'creation/generate-improvements')!;
  assertEq(clonedGenImprov.data.status, 'done', 'cloned node has forced done status');
  assertEq((clonedGenImprov.data as any)._phaseStatus, 'done', '_phaseStatus matches phase status');
}

// ── Summary ─────────────────────────────────────────────────────

console.log('');
if (failed === 0) {
  console.log(`phase-workflow-tree.test.ts: ALL ${passed} tests passed`);
} else {
  console.error(`phase-workflow-tree.test.ts: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
}
