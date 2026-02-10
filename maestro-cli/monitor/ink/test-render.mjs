/**
 * Headless render test for Ink monitor components.
 * Uses ink's render() with custom stdout to capture output without a TTY.
 */
import { createElement as h } from 'react';
import { render, Text } from 'ink';
import { Writable, Readable } from 'stream';

// Create a fake stdout that captures output
class CapturingStream extends Writable {
  constructor() {
    super();
    this.chunks = [];
    this.columns = 100;
    this.rows = 40;
  }
  _write(chunk, encoding, callback) {
    this.chunks.push(chunk.toString());
    callback();
  }
  get output() {
    return this.chunks.join('');
  }
}

// Create a fake stdin (no raw mode needed)
class FakeStdin extends Readable {
  constructor() {
    super();
    this.isTTY = false;
    this.isRaw = false;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
  _read() {}
}

// Import components
import { GlobalMonitor } from './components/GlobalMonitor.js';
import { SessionMonitor } from './components/SessionMonitor.js';
import { Panel } from './components/Panel.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { WorkflowTree } from './components/WorkflowTree.js';
import { PhaseWorkflow } from './components/PhaseWorkflow.js';
import { ExecutionLog } from './components/ExecutionLog.js';
import { LLMActivity } from './components/LLMActivity.js';
import { MetricsPanel } from './components/MetricsPanel.js';
import { Variables } from './components/Variables.js';
import { CommandLog } from './components/CommandLog.js';
import { Artifacts } from './components/Artifacts.js';
import { BlockDetail } from './components/BlockDetail.js';
import { WidgetsPanel } from './components/WidgetsPanel.js';
import { SessionList } from './components/SessionList.js';
import { PhaseList } from './components/PhaseList.js';
import { Filesystem } from './components/Filesystem.js';
import { flattenExecutionTree, autoExpandRunningPath } from './components/WorkflowTree.js';
import { flattenPhaseWorkflow } from './components/PhaseWorkflow.js';

console.log('=== Ink Component Render Tests ===\n');

// Mock session data (compliance-tester style)
const mockSession = {
  id: '467c0be0-498c-4944-9c98-408798c79f10',
  name: 'Model Compliance Test',
  status: 'running',
  type: 'project',
  authority: 'human',
  createdAt: '2026-02-10T19:05:28',
  startedAt: '2026-02-10T19:05:30',
  variables: {
    sessionMode: 'autonomous',
    currentFitness: 0.75,
    targetFitness: 0.95,
    currentIteration: 3,
    maxIterations: 10,
    scoreHistory: [0.45, 0.62, 0.75],
    currentPhase: 'optimization',
    _phases: [
      { id: 'creation', name: 'Creation', status: 'done' },
      { id: 'optimization', name: 'Optimization', status: 'running' },
      { id: 'validation', name: 'Validation', status: 'pending' },
    ],
    _activeWorkflow: 'workflow:foundry/compliance-test-loop',
    _executionTree: {
      id: 'root',
      name: 'compliance-test-loop',
      type: 'workflow',
      status: 'running',
      children: [
        { id: 'n1', name: 'create-artifact', type: 'inference', status: 'done', output: 'Created artifact' },
        { id: 'n2', name: 'evaluate-fitness', type: 'validator', status: 'running' },
        { id: 'n3', name: 'optimize', type: 'inference', status: 'pending' },
      ]
    },
    _executionLog: [
      { timestamp: '2026-02-10T19:06:00', level: 'info', message: 'Starting phase: optimization' },
      { timestamp: '2026-02-10T19:06:05', level: 'success', message: 'Artifact created successfully' },
      { timestamp: '2026-02-10T19:06:10', level: 'info', message: 'Running evaluation...' },
    ],
    _llmActivity: [
      { nodeId: 'create-artifact', timestamp: '2026-02-10T19:06:01', prompt: 'Generate a test commit message', response: '{"message":"fix: resolve null pointer"}', durationMs: 1200, tokens: 45 },
    ],
    _blockOutputs: {},
    _artifacts: [
      { name: 'commit-message.json', type: 'json', status: 'new', size: '128B' },
    ],
    _commandLog: [
      { command: 'session start', status: 'success', timestamp: '2026-02-10T19:05:30', result: 'Session started' },
    ],
  },
  monitorWidgets: [
    { id: 'fitness-progress', type: 'progress-bar', config: { label: 'Fitness', current: '$.variables.currentFitness', max: '$.variables.targetFitness', showPercentage: true } },
    { id: 'iteration-counter', type: 'counter', config: { label: 'Iteration', value: '$.variables.currentIteration', max: '$.variables.maxIterations' } },
    { id: 'score-history', type: 'score-chart', config: { label: 'Score History', data: '$.variables.scoreHistory', threshold: '$.variables.targetFitness' } },
  ],
  workingDirectory: 'C:\\Meastro',
  entryPoints: { start: 'workflow:foundry/compliance-test-loop' },
};

const mockContext = {
  mode: 'execution',
  activeWorkflow: 'workflow:foundry/compliance-test-loop',
  executionTree: mockSession.variables._executionTree,
  workingDirectory: mockSession.workingDirectory,
  phases: mockSession.variables._phases,
  activeBlock: null,
  blockOutputs: mockSession.variables._blockOutputs,
  executionLog: mockSession.variables._executionLog,
  artifacts: mockSession.variables._artifacts,
  monitorDescriptor: null,
  llmActivity: mockSession.variables._llmActivity,
};

const mockSessions = [
  { id: '467c0be0', name: 'Model Compliance Test', status: 'running', type: 'project', createdAt: '2026-02-10T19:05:28' },
  { id: 'abcdef01', name: 'Foundry Training', status: 'stopped', type: 'project', createdAt: '2026-02-10T18:00:00' },
];

// Test function - renders a component and captures output
function testComponent(name, element) {
  try {
    const stdout = new CapturingStream();
    const stdin = new FakeStdin();
    const instance = render(element, { stdout, stdin, debug: false, exitOnCtrlC: false, patchConsole: false });
    instance.unmount();
    const output = stdout.output;
    const hasContent = output.replace(/\s/g, '').replace(/[\x1b\[\]0-9;m]/g, '').length > 0;
    console.log(`  [PASS] ${name} ${hasContent ? '(has content)' : '(empty but no error)'}`);
    return true;
  } catch (err) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    return false;
  }
}

let passed = 0;
let failed = 0;

function run(name, element) {
  if (testComponent(name, element)) passed++;
  else failed++;
}

// Test individual components
run('Panel (basic)', h(Panel, { title: 'TEST PANEL' }, h(Text, {}, 'Panel content')));
run('Panel (focused)', h(Panel, { title: 'FOCUSED', focused: true, showScroll: true, canScrollUp: true, canScrollDown: true }, h(Text, {}, 'Focused panel')));
run('Panel (scrolled)', h(Panel, { title: 'SCROLLED', scrollOffset: 5 }, h(Text, {}, 'Scrolled content')));
run('Panel (anchor=bottom)', h(Panel, { title: 'LOG', anchor: 'bottom' }, h(Text, {}, 'Log line 1'), h(Text, {}, 'Log line 2')));
run('Panel (anchor=bottom + scroll)', h(Panel, { title: 'LOG SCROLLED', anchor: 'bottom', scrollOffset: 2 }, h(Text, {}, 'Log line 1'), h(Text, {}, 'Log line 2')));
run('Header', h(Header, { session: mockSession, context: mockContext }));
run('StatusBar (idle)', h(StatusBar, { connectionStatus: 'connected', latency: 45, lastRefresh: new Date(), mode: 'idle', visiblePanels: { tree: true, files: true, widgets: true, vars: true, logs: true }, hasBackOption: true, focusedPanel: 'tree', zoomedPanel: null }));
run('StatusBar (descriptor)', h(StatusBar, { connectionStatus: 'connected', latency: 45, lastRefresh: new Date(), mode: 'descriptor', visiblePanels: {}, hasBackOption: false }));
run('StatusBar (zoomed)', h(StatusBar, { connectionStatus: 'connected', latency: 45, lastRefresh: new Date(), mode: 'execution', visiblePanels: { tree: true }, hasBackOption: true, focusedPanel: 'tree', zoomedPanel: 'tree' }));
run('WorkflowTree', h(WorkflowTree, { session: mockSession, context: mockContext }));
run('PhaseWorkflow', h(PhaseWorkflow, { session: mockSession, context: mockContext }));
run('PhaseList', h(PhaseList, { session: mockSession, context: mockContext }));
run('ExecutionLog', h(ExecutionLog, { session: mockSession, context: mockContext }));
run('LLMActivity', h(LLMActivity, { session: mockSession, context: mockContext }));
run('MetricsPanel', h(MetricsPanel, { session: mockSession, context: mockContext }));
run('Variables', h(Variables, { session: mockSession, context: mockContext }));
run('CommandLog', h(CommandLog, { session: mockSession, context: mockContext }));
run('Artifacts', h(Artifacts, { session: mockSession, context: mockContext }));
run('BlockDetail', h(BlockDetail, { session: mockSession, context: mockContext }));
run('WidgetsPanel', h(WidgetsPanel, { session: mockSession, context: mockContext }));
run('SessionList', h(SessionList, { sessions: mockSessions, selectedIndex: 0 }));

// Test with empty data
run('Header (empty session)', h(Header, { session: {}, context: {} }));
run('WorkflowTree (no tree)', h(WorkflowTree, { session: {}, context: {} }));
run('ExecutionLog (no logs)', h(ExecutionLog, { session: {}, context: {} }));
run('WidgetsPanel (no widgets)', h(WidgetsPanel, { session: { variables: {} }, context: {} }));
run('SessionList (empty)', h(SessionList, { sessions: [], selectedIndex: 0 }));

// ── useTreeNav headless tests ──────────────────────────────────
console.log('\n--- Tree Navigation Logic Tests ---\n');

// Test flattenExecutionTree
function testFlatten(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

const treeNodes = [
  { id: 'n1', name: 'create-artifact', status: 'done', children: [] },
  { id: 'n2', name: 'evaluate-fitness', status: 'running', children: [
    { id: 'n2a', name: 'sub-eval-1', status: 'done', children: [] },
    { id: 'n2b', name: 'sub-eval-2', status: 'running', children: [] },
  ]},
  { id: 'n3', name: 'optimize', status: 'pending', children: [] },
];

testFlatten('flattenExecutionTree (all collapsed)', () => {
  const flat = flattenExecutionTree(treeNodes, new Set());
  if (flat.length !== 3) throw new Error(`Expected 3 nodes, got ${flat.length}`);
  if (flat[1].hasChildren !== true) throw new Error('n2 should have children');
  if (flat[0].hasChildren !== false) throw new Error('n1 should not have children');
});

testFlatten('flattenExecutionTree (n2 expanded)', () => {
  const flat = flattenExecutionTree(treeNodes, new Set(['n2']));
  if (flat.length !== 5) throw new Error(`Expected 5 nodes, got ${flat.length}`);
  if (flat[2].id !== 'n2a') throw new Error(`Expected n2a at index 2, got ${flat[2].id}`);
  if (flat[2].depth !== 1) throw new Error(`Expected depth 1, got ${flat[2].depth}`);
  if (flat[2].parentId !== 'n2') throw new Error(`Expected parent n2, got ${flat[2].parentId}`);
});

testFlatten('flattenExecutionTree (empty)', () => {
  const flat = flattenExecutionTree([], new Set());
  if (flat.length !== 0) throw new Error(`Expected 0 nodes, got ${flat.length}`);
});

testFlatten('autoExpandRunningPath', () => {
  const expanded = autoExpandRunningPath(treeNodes, new Set());
  if (!expanded.has('n2')) throw new Error('Should expand n2 (running with children)');
});

// Test flattenPhaseWorkflow
const testPhases = [
  { id: 'creation', name: 'Creation', status: 'done', result: { iterations: 3, fitness: 0.85 } },
  { id: 'optimization', name: 'Optimization', status: 'running' },
  { id: 'validation', name: 'Validation', status: 'pending' },
];

const testExecTree = {
  children: [
    { id: 'e1', name: 'eval', status: 'running', children: [] },
  ],
};

testFlatten('flattenPhaseWorkflow (all collapsed)', () => {
  const flat = flattenPhaseWorkflow(testPhases, testExecTree, new Set());
  if (flat.length !== 3) throw new Error(`Expected 3 nodes, got ${flat.length}`);
  if (flat[0].hasChildren !== true) throw new Error('done phase should have children');
  if (flat[1].hasChildren !== true) throw new Error('running phase should have children');
  if (flat[2].hasChildren !== false) throw new Error('pending phase should not have children');
});

testFlatten('flattenPhaseWorkflow (running expanded)', () => {
  const flat = flattenPhaseWorkflow(testPhases, testExecTree, new Set(['optimization']));
  if (flat.length !== 4) throw new Error(`Expected 4 nodes, got ${flat.length}`);
  if (flat[2].id !== 'e1') throw new Error(`Expected e1 at index 2, got ${flat[2].id}`);
  if (flat[2].depth !== 1) throw new Error(`Expected depth 1, got ${flat[2].depth}`);
});

testFlatten('flattenPhaseWorkflow (done expanded)', () => {
  const flat = flattenPhaseWorkflow(testPhases, testExecTree, new Set(['creation']));
  if (flat.length !== 4) throw new Error(`Expected 4 nodes, got ${flat.length}`);
  if (!flat[1].id.includes('summary')) throw new Error(`Expected summary node at index 1, got ${flat[1].id}`);
});

// Test Panel with cursorInfo
run('Panel (cursorInfo)', h(Panel, { title: 'TEST', cursorInfo: '3/12', focused: true }, h(Text, {}, 'Content')));

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
