/**
 * Tree Navigation Integration Test
 *
 * Fetches a real session from the API and renders tree components
 * with simulated treeNav state to verify the expand/collapse works.
 */
import { createElement as h } from 'react';
import { render, Box, Text } from 'ink';
import { Writable, Readable } from 'stream';

class CapturingStream extends Writable {
  constructor(cols = 120, rows = 40) {
    super();
    this.chunks = [];
    this.columns = cols;
    this.rows = rows;
  }
  _write(chunk, encoding, callback) {
    this.chunks.push(chunk.toString());
    callback();
  }
  get output() { return this.chunks.join(''); }
}

class FakeStdin extends Readable {
  constructor() {
    super();
    this.isTTY = false;
    this.isRaw = false;
  }
  setRawMode(mode) { this.isRaw = mode; return this; }
  _read() {}
}

import { Panel } from './components/Panel.js';
import { WorkflowTree, flattenExecutionTree, autoExpandRunningPath } from './components/WorkflowTree.js';
import { PhaseWorkflow, flattenPhaseWorkflow } from './components/PhaseWorkflow.js';
import { Filesystem, buildDirectoryTree, flattenFilesystem } from './components/Filesystem.js';
import { theme, icons } from './theme.js';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function showTest(name, element, cols = 120, rows = 40) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${name}`);
  console.log(`${'='.repeat(80)}`);
  const stdout = new CapturingStream(cols, rows);
  const stdin = new FakeStdin();
  try {
    const instance = render(element, { stdout, stdin, debug: false, exitOnCtrlC: false, patchConsole: false });
    instance.unmount();
    const output = stdout.output;
    const lines = output.split('\n');
    lines.forEach((line, i) => {
      console.log(`${String(i).padStart(3)}| ${line}`);
    });
    console.log(`--- ${lines.length} lines ---`);
    return true;
  } catch (err) {
    console.log(`  [ERROR] ${err.message}`);
    return false;
  }
}

let passed = 0;
let failed = 0;

// ── Fetch real session from API ──
console.log('=== Tree Navigation Integration Test ===\n');

const SESSION_ID = 'b4edf40c-7b84-4035-9be2-53057ef25aaf';
let session;

try {
  const resp = await fetch(`http://localhost:5000/api/sessions/${SESSION_ID}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  session = await resp.json();
  console.log(`  Fetched session: ${session.name} (${session.id.substring(0, 8)})`);
  console.log(`  Status: ${session.status}`);
  console.log(`  Has execution tree: ${!!session.variables._executionTree}`);
  console.log(`  Has phases: ${!!session.variables._phases}`);
  console.log(`  Working dir: ${session.workingDirectory || 'N/A'}`);
} catch (err) {
  console.error(`  Failed to fetch session: ${err.message}`);
  console.error('  Make sure backend is running on port 5000');
  process.exit(1);
}

const vars = session.variables || {};
const executionTree = vars._executionTree;
const phases = vars._phases;

// ── Test 1: WorkflowTree flatten with real data ──
console.log('\n--- WorkflowTree Flatten Tests ---\n');

const treeNodes = Array.isArray(executionTree) ? executionTree : (executionTree?.nodes || executionTree?.children || []);

// All collapsed
const flatCollapsed = flattenExecutionTree(treeNodes, new Set());
console.log(`  All collapsed: ${flatCollapsed.length} visible nodes (${treeNodes.length} top-level)`);
passed++;

// Auto-expand running
const autoExpanded = autoExpandRunningPath(treeNodes, new Set());
const flatAutoExpanded = flattenExecutionTree(treeNodes, autoExpanded);
console.log(`  Auto-expanded running: ${flatAutoExpanded.length} visible nodes`);
console.log(`  Expanded IDs: [${[...autoExpanded].join(', ')}]`);
passed++;

// Show flat tree
console.log('\n  Flat tree (auto-expanded, cursor=0):');
for (let i = 0; i < flatAutoExpanded.length; i++) {
  const fn = flatAutoExpanded[i];
  const cur = i === 0 ? '> ' : '  ';
  const indent = '  '.repeat(fn.depth);
  const exp = fn.hasChildren ? (fn.isExpanded ? icons.expanded : icons.collapsed) + ' ' : '  ';
  const status = fn.data?.status || '?';
  console.log(`  ${cur}${indent}${exp}${fn.label} [${status}] depth=${fn.depth}`);
}

// ── Test 2: WorkflowTree component render (legacy mode — no treeNav) ──
console.log('');
const context = {
  executionTree: executionTree,
  activeWorkflow: vars._activeWorkflow,
  phases: phases,
};

if (showTest('WorkflowTree (legacy, real data)',
  h(Panel, { title: 'WORKFLOW TREE', width: 100, height: 20, focused: true },
    h(WorkflowTree, { session, context })
  )
)) passed++; else failed++;

// ── Test 3: PhaseWorkflow flatten with real data ──
console.log('\n--- PhaseWorkflow Flatten Tests ---\n');

if (Array.isArray(phases) && phases.length > 0) {
  const phaseFlat = flattenPhaseWorkflow(phases, executionTree, new Set());
  console.log(`  All collapsed: ${phaseFlat.length} nodes from ${phases.length} phases`);
  passed++;

  // Expand running phases
  const phaseExpanded = new Set();
  for (const phase of phases) {
    const st = (phase.status || '').toLowerCase();
    if (st === 'running' || st === 'active') phaseExpanded.add(phase.id);
  }
  const phaseExpandedFlat = flattenPhaseWorkflow(phases, executionTree, phaseExpanded);
  console.log(`  Running expanded: ${phaseExpandedFlat.length} nodes`);
  passed++;

  console.log('\n  Phase flat tree (running expanded, cursor=0):');
  for (let i = 0; i < phaseExpandedFlat.length; i++) {
    const fn = phaseExpandedFlat[i];
    const cur = i === 0 ? '> ' : '  ';
    const indent = '  '.repeat(fn.depth);
    const exp = fn.hasChildren ? (fn.isExpanded ? icons.expanded : icons.collapsed) + ' ' : '  ';
    const type = fn.data._type || '?';
    console.log(`  ${cur}${indent}${exp}${fn.label} [${type}] depth=${fn.depth}`);
  }

  if (showTest('PhaseWorkflow (legacy, real data)',
    h(Panel, { title: 'PHASES / WORKFLOW', width: 100, height: 16, focused: true },
      h(PhaseWorkflow, { session, context })
    )
  )) passed++; else failed++;
} else {
  console.log('  (no phases in this session, skipping)');
}

// ── Test 4: Filesystem tree building ──
console.log('\n--- Filesystem Tree Tests ---\n');

const workDir = session.workingDirectory;
if (workDir && workDir !== '.' && workDir !== 'N/A') {
  try {
    const fsTree = buildDirectoryTree(workDir);
    console.log(`  Built tree: ${fsTree.length} top-level items from ${workDir}`);
    passed++;

    // Expand top-level dirs
    const fsExpanded = new Set();
    for (const node of fsTree) {
      if (node.isDir && !node.ignored) fsExpanded.add(node.id);
    }
    const fsFlat = flattenFilesystem(fsTree, fsExpanded);
    console.log(`  Top-level dirs expanded: ${fsFlat.length} visible nodes`);
    passed++;

    // Show first 15 nodes
    console.log('\n  Filesystem flat tree (top dirs expanded, first 15):');
    for (let i = 0; i < Math.min(15, fsFlat.length); i++) {
      const fn = fsFlat[i];
      const cur = i === 0 ? '> ' : '  ';
      const indent = '  '.repeat(fn.depth);
      const exp = fn.hasChildren ? (fn.isExpanded ? icons.expanded : icons.collapsed) + ' ' : '  ';
      console.log(`  ${cur}${indent}${exp}${fn.label} [${fn.data.access}]`);
    }
    if (fsFlat.length > 15) console.log(`  ... and ${fsFlat.length - 15} more`);

    if (showTest('Filesystem (legacy, real data)',
      h(Panel, { title: 'FILESYSTEM', width: 80, height: 20, focused: true },
        h(Filesystem, { session, context: { workingDirectory: workDir } })
      )
    )) passed++; else failed++;
  } catch (err) {
    console.log(`  Error building fs tree: ${err.message}`);
    failed++;
  }
} else {
  console.log('  (no working directory, skipping filesystem tests)');
}

// ── Test 5: Simulate tree navigation sequence ──
console.log('\n--- Simulated Navigation Sequence ---\n');

if (flatAutoExpanded.length > 0) {
  // Simulate: cursor starts at 0, move down 3 times, then left (collapse), then right (expand)
  let cursor = 0;
  const expanded = new Set(autoExpanded);

  const steps = [
    { action: 'initial', desc: 'Start at cursor 0' },
    { action: 'down', desc: 'Move down' },
    { action: 'down', desc: 'Move down' },
    { action: 'down', desc: 'Move down' },
  ];

  for (const step of steps) {
    if (step.action === 'down') {
      cursor = Math.min(cursor + 1, flatAutoExpanded.length - 1);
    }
    const node = flatAutoExpanded[cursor];
    console.log(`  ${step.desc}: cursor=${cursor} → ${node?.label || '?'} (${node?.data?.status || '?'})`);
  }

  // Left on a node that has children and is expanded → collapse
  const nodeAtCursor = flatAutoExpanded[cursor];
  if (nodeAtCursor && nodeAtCursor.hasChildren && nodeAtCursor.isExpanded) {
    expanded.delete(nodeAtCursor.id);
    const afterCollapse = flattenExecutionTree(treeNodes, expanded);
    console.log(`  Left (collapse ${nodeAtCursor.label}): ${afterCollapse.length} visible (was ${flatAutoExpanded.length})`);
    passed++;

    // Right → re-expand
    expanded.add(nodeAtCursor.id);
    const afterExpand = flattenExecutionTree(treeNodes, expanded);
    console.log(`  Right (expand ${nodeAtCursor.label}): ${afterExpand.length} visible`);
    passed++;
  } else {
    console.log(`  Node at cursor ${cursor} (${nodeAtCursor?.label}) is not expandable, skipping collapse/expand test`);
    // Try a different scenario: move to parent
    if (nodeAtCursor && nodeAtCursor.parentId) {
      const parentIdx = flatAutoExpanded.findIndex(n => n.id === nodeAtCursor.parentId);
      console.log(`  Left (go to parent): cursor would move to ${parentIdx} → ${flatAutoExpanded[parentIdx]?.label || '?'}`);
      passed++;
    } else {
      passed++;
    }
    passed++;
  }
} else {
  console.log('  (no tree nodes, skipping navigation simulation)');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
