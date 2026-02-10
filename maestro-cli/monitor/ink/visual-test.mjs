/**
 * Visual render test — captures and displays actual Ink output.
 * Lets us inspect the rendered layout without a real terminal.
 */
import { createElement as h } from 'react';
import { render, Box, Text } from 'ink';
import { Writable, Readable } from 'stream';

// Fake streams
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

// Import components
import { Panel } from './components/Panel.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { PhaseWorkflow } from './components/PhaseWorkflow.js';
import { LLMActivity } from './components/LLMActivity.js';
import { ExecutionLog } from './components/ExecutionLog.js';
import { MetricsPanel } from './components/MetricsPanel.js';
import { Variables } from './components/Variables.js';
import { WorkflowTree, flattenExecutionTree } from './components/WorkflowTree.js';
import { SessionList } from './components/SessionList.js';
import { Filesystem } from './components/Filesystem.js';
import { theme, icons } from './theme.js';

// Mock data
const mockSession = {
  id: '467c0be0-498c-4944-9c98-408798c79f10',
  name: 'Model Compliance Test',
  status: 'running',
  startedAt: '2026-02-10T19:05:30',
  variables: {
    currentFitness: 0.75, targetFitness: 0.95,
    currentIteration: 3, maxIterations: 10,
    scoreHistory: [0.45, 0.62, 0.75],
    _phases: [
      { id: 'creation', name: 'Creation', status: 'done' },
      { id: 'optimization', name: 'Optimization', status: 'running' },
      { id: 'validation', name: 'Validation', status: 'pending' },
    ],
    _activeWorkflow: 'workflow:foundry/compliance-test-loop',
    _executionTree: {
      id: 'root', name: 'compliance-test-loop', type: 'workflow', status: 'running',
      children: [
        { id: 'n1', name: 'create-artifact', type: 'inference', status: 'done' },
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
      { nodeId: 'create-artifact', timestamp: '2026-02-10T19:06:01', prompt: 'Generate commit', response: '{"msg":"fix"}', durationMs: 1200, tokens: 45 },
    ],
  },
  monitorWidgets: [],
};

const mockContext = {
  mode: 'execution',
  activeWorkflow: 'workflow:foundry/compliance-test-loop',
  executionTree: mockSession.variables._executionTree,
  phases: mockSession.variables._phases,
  executionLog: mockSession.variables._executionLog,
  llmActivity: mockSession.variables._llmActivity,
};

// Strip ANSI escape codes for character counting, keep them for display
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function renderAndCapture(name, element, cols = 120, rows = 40) {
  const stdout = new CapturingStream(cols, rows);
  const stdin = new FakeStdin();
  try {
    const instance = render(element, { stdout, stdin, debug: false, exitOnCtrlC: false, patchConsole: false });
    instance.unmount();
    return stdout.output;
  } catch (err) {
    return `[ERROR] ${err.message}`;
  }
}

function showTest(name, element, cols = 120, rows = 40) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${name}`);
  console.log(`${'='.repeat(80)}`);
  const output = renderAndCapture(name, element, cols, rows);
  // Show raw output with visible line count
  const lines = output.split('\n');
  lines.forEach((line, i) => {
    const visible = stripAnsi(line);
    console.log(`${String(i).padStart(3)}| ${line}`);
  });
  console.log(`--- ${lines.length} lines ---`);
}

// ── Test 1: Panel alone ──
showTest('Panel (unfocused)',
  h(Panel, { title: 'TEST PANEL', width: 50, height: 8 },
    h(Text, {}, 'Line 1 content'),
    h(Text, {}, 'Line 2 content'),
    h(Text, {}, 'Line 3 content'),
  )
);

showTest('Panel (focused with scroll)',
  h(Panel, { title: 'FOCUSED PANEL', focused: true, width: 50, height: 8,
    showScroll: true, canScrollUp: true, canScrollDown: true },
    h(Text, {}, 'Line 1'),
    h(Text, {}, 'Line 2'),
    h(Text, {}, 'Line 3'),
  )
);

// ── Test 2: Scroll test — offset=2 should hide first 2 lines ──
showTest('Panel (scrollOffset=2, should hide Line 1 and Line 2)',
  h(Panel, { title: 'SCROLLED', width: 50, height: 10, scrollOffset: 2 },
    h(Text, {}, 'Line 1 - should be HIDDEN'),
    h(Text, {}, 'Line 2 - should be HIDDEN'),
    h(Text, {}, 'Line 3 - should be VISIBLE'),
    h(Text, {}, 'Line 4 - should be VISIBLE'),
    h(Text, {}, 'Line 5 - should be VISIBLE'),
  )
);

// ── Test: Panel anchor='bottom' (content anchored to bottom) ──
showTest('Panel anchor=bottom (tail-f style, 10 lines in 6-line panel)',
  h(Panel, { title: 'LOG PANEL', width: 60, height: 8, anchor: 'bottom' },
    h(Text, {}, 'Log 1 - oldest (may be clipped)'),
    h(Text, {}, 'Log 2'),
    h(Text, {}, 'Log 3'),
    h(Text, {}, 'Log 4'),
    h(Text, {}, 'Log 5'),
    h(Text, {}, 'Log 6'),
    h(Text, {}, 'Log 7'),
    h(Text, {}, 'Log 8'),
    h(Text, {}, 'Log 9'),
    h(Text, {}, 'Log 10 - newest (should be visible at bottom)'),
  )
);

showTest('Panel anchor=bottom + scrollOffset=2 (manual scroll up)',
  h(Panel, { title: 'LOG SCROLLED', width: 60, height: 8, anchor: 'bottom', scrollOffset: 2 },
    h(Text, {}, 'Log 1 - oldest'),
    h(Text, {}, 'Log 2'),
    h(Text, {}, 'Log 3'),
    h(Text, {}, 'Log 4'),
    h(Text, {}, 'Log 5'),
    h(Text, {}, 'Log 6'),
    h(Text, {}, 'Log 7'),
    h(Text, {}, 'Log 8 - should be visible (shifted by 2)'),
    h(Text, {}, 'Log 9 - shifted down by scrollOffset'),
    h(Text, {}, 'Log 10 - newest (shifted down, may be partially visible)'),
  )
);

// ── Test 3: Descriptor Layout simulation ──
const hh = theme.layout.headerHeight;
showTest('Descriptor Layout (simulated)',
  h(Box, { flexDirection: 'column', width: 120, height: 35 },
    // Header row
    h(Box, { flexDirection: 'row', width: '100%', height: hh },
      h(Panel, { title: 'SESSION', width: '60%' },
        h(Header, { session: mockSession, context: mockContext })
      ),
      h(Panel, { title: 'METRICS', width: '40%' },
        h(MetricsPanel, { session: mockSession, context: mockContext })
      )
    ),
    // Middle row
    h(Box, { flexDirection: 'row', width: '100%', flexGrow: 3 },
      h(Panel, { title: 'PHASES / WORKFLOW', width: '55%', flexGrow: 1, focused: true },
        h(PhaseWorkflow, { session: mockSession, context: mockContext })
      ),
      h(Panel, { title: 'LLM ACTIVITY', width: '45%', flexGrow: 1, anchor: 'bottom' },
        h(LLMActivity, { session: mockSession, context: mockContext })
      )
    ),
    // Bottom row
    h(Panel, { title: 'EXECUTION LOG', width: '100%', flexGrow: 1, anchor: 'bottom' },
      h(ExecutionLog, { session: mockSession, context: mockContext })
    ),
    // StatusBar
    h(StatusBar, {
      connectionStatus: 'connected', latency: 42, lastRefresh: new Date(),
      mode: 'descriptor', focusedPanel: 'phases', zoomedPanel: null, hasBackOption: true,
    }),
  )
);

// ── Test 4: StatusBar with focus/zoom ──
showTest('StatusBar (focused=phases)',
  h(StatusBar, {
    connectionStatus: 'connected', latency: 42, lastRefresh: new Date(),
    mode: 'descriptor', focusedPanel: 'phases', zoomedPanel: null, hasBackOption: true,
  })
);

showTest('StatusBar (zoomed=phases)',
  h(StatusBar, {
    connectionStatus: 'connected', latency: 42, lastRefresh: new Date(),
    mode: 'execution', focusedPanel: 'tree', zoomedPanel: 'tree', hasBackOption: true,
    visiblePanels: { tree: true, files: true, widgets: true },
  })
);

// ── Test 5: GlobalMonitor ListHeader simulation (matches actual code) ──
showTest('GlobalMonitor (actual layout)',
  h(Box, { flexDirection: 'column', width: 80, height: 20 },
    h(Panel, { title: 'MAESTRO SESSIONS', height: 5, width: '100%' },
      h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 2 },
        h(Text, { color: 'gray' }, '2 session(s)'),
        h(Text, { color: 'cyan' }, '1 running'),
      )
    ),
    h(Panel, { title: 'SESSIONS', flexGrow: 1, width: '100%' },
      h(SessionList, { sessions: [
        { id: '467c0be0', name: 'Model Compliance', status: 'running', createdAt: '2026-02-10' },
        { id: 'abcdef01', name: 'Foundry Training', status: 'stopped', createdAt: '2026-02-10' },
      ], selectedIndex: 0 })
    ),
    h(StatusBar, {
      connectionStatus: 'connected', latency: 42, lastRefresh: new Date(),
      mode: 'idle', hasBackOption: false,
    }),
  )
);

// ── Test 6: WorkflowTree with simulated treeNav (static snapshot) ──
// We simulate treeNav by creating a fake object matching the treeNav interface
const deepTree = {
  children: [
    { id: 'n1', name: 'create-artifact', status: 'done', children: [] },
    { id: 'n2', name: 'evaluate-fitness', status: 'running', children: [
      { id: 'n2a', name: 'sub-eval-1', status: 'done', children: [] },
      { id: 'n2b', name: 'sub-eval-2', status: 'running', children: [
        { id: 'n2b1', name: 'deep-task', status: 'pending', children: [] },
      ] },
    ]},
    { id: 'n3', name: 'optimize', status: 'pending', children: [] },
  ]
};

// Show what the flat tree looks like with n2 expanded, n2b expanded
const expandedSet = new Set(['n2', 'n2b']);
const flatNodes = flattenExecutionTree(deepTree.children, expandedSet);

// Build a simple static view of the flat tree (not using React, just text)
console.log(`\n${'='.repeat(80)}`);
console.log('  WorkflowTree Flat Nodes (n2+n2b expanded, cursor=2)');
console.log(`${'='.repeat(80)}`);
const cursorIdx = 2;
for (let i = 0; i < flatNodes.length; i++) {
  const fn = flatNodes[i];
  const cur = i === cursorIdx ? '> ' : '  ';
  const indent = '  '.repeat(fn.depth);
  const exp = fn.hasChildren ? (fn.isExpanded ? icons.expanded : icons.collapsed) + ' ' : '  ';
  console.log(`${cur}${indent}${exp}${fn.label} [depth=${fn.depth}, parent=${fn.parentId || '-'}]`);
}
console.log(`--- ${flatNodes.length} flat nodes ---`);

// Show WorkflowTree component rendering in legacy mode (no treeNav)
showTest('WorkflowTree (legacy, no treeNav)',
  h(Panel, { title: 'WORKFLOW TREE', width: 80, height: 12, focused: true },
    h(WorkflowTree, { session: mockSession, context: {
      ...mockContext,
      executionTree: deepTree,
    }})
  )
);

// ── Test 7: Panel with cursorInfo ──
showTest('Panel (with cursorInfo)',
  h(Panel, { title: 'WORKFLOW TREE', cursorInfo: '3/7', width: 60, height: 6, focused: true },
    h(Text, {}, 'Some tree content'),
    h(Text, {}, 'More content'),
  )
);

console.log('\n\nDone. Check output above for visual issues.');
