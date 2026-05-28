/* global React, Ic, StatusDot, Badge, Btn, Bar, Panel, BlockCard, AgentBanner */
/* Block taxonomy data + the new unified Foundry pages + block-internals viewer */

const { useState: useStateB } = React;

/* ═══════════════════════════════════════════════════════════════
   BLOCK TAXONOMY · 15 types in 6 categories
   ═══════════════════════════════════════════════════════════════ */
const BLOCK_TYPES = {
  agent:       { cat: 'compose',  ic: 'user',     color: 'var(--agent)', label: 'agent',
                 desc: 'Black box with prompt-like I/O (variables in, text/structured out). Internally composes any blocks — workflows, tools, prompts. The composition is hidden from callers.' },
  workflow:    { cat: 'compose',  ic: 'graph',    color: 'var(--accent)', label: 'workflow',
                 desc: 'Transparent composition of blocks (DAG). Arbitrary I/O. The internal graph is visible and editable.' },
  tool:        { cat: 'execute',  ic: 'terminal', color: 'var(--info)',   label: 'tool',
                 desc: 'Atomic action against the world (filesystem, shell, git, network).' },
  inference:   { cat: 'execute',  ic: 'sparkle',  color: 'var(--warn)',   label: 'inference',
                 desc: 'Single-shot LLM call. No tools, no state. The cheapest unit.' },
  transformer: { cat: 'execute',  ic: 'diff',     color: 'var(--info)',   label: 'transformer',
                 desc: 'Pure data transform. Deterministic. No model, no side effects.' },
  prompt:      { cat: 'define',   ic: 'chat',     color: 'var(--ok)',     label: 'prompt',
                 desc: 'Prompt template. Variables in {{braces}}. Composable.' },
  schema:      { cat: 'define',   ic: 'contract', color: 'var(--ok)',     label: 'schema',
                 desc: 'JSON schema for inputs/outputs. Backbone of every contract.' },
  dataset:     { cat: 'define',   ic: 'db',       color: 'var(--ok)',     label: 'dataset',
                 desc: 'Eval corpus. Drives fitness scoring in the foundry.' },
  validator:   { cat: 'quality',  ic: 'check',    color: '#7a8a52',       label: 'validator',
                 desc: 'Checks data against schema. Hard gate before output.' },
  evaluator:   { cat: 'quality',  ic: 'pulse',    color: '#7a8a52',       label: 'evaluator',
                 desc: 'Produces a fitness score given (expected, actual).' },
  router:      { cat: 'control',  ic: 'graph',    color: '#9b7a3f',       label: 'router',
                 desc: 'Conditional branching block. switch / if-else for workflows.' },
  trigger:     { cat: 'control',  ic: 'bolt',     color: '#9b7a3f',       label: 'trigger',
                 desc: 'Event source. Webhooks, schedules, file watches.' },
  hook:        { cat: 'control',  ic: 'plug',     color: '#9b7a3f',       label: 'hook',
                 desc: 'Pre/post lifecycle callback. Telemetry, audit, sign-off.' },
  policy:      { cat: 'control',  ic: 'settings', color: '#9b7a3f',       label: 'policy',
                 desc: 'Permission + budget rules. What an agent is allowed to do.' },
  memory:      { cat: 'state',    ic: 'layers',   color: '#7259a8',       label: 'memory',
                 desc: 'KV / vector / chat history store. Bound to an agent.' },
  contract:    { cat: 'define',   ic: 'contract', color: 'var(--accent)', label: 'contract',
                 desc: 'Interface defining a role: "an agent fulfilling this can do X". Independent of implementation.' },
};

const BLOCK_CATEGORIES = {
  compose: { label: 'Compose',  hint: 'agents · workflows',  kbd: 'c' },
  execute: { label: 'Execute',  hint: 'tools · inference · transformer', kbd: 'e' },
  define:  { label: 'Define',   hint: 'prompts · schemas · datasets', kbd: 'd' },
  quality: { label: 'Quality',  hint: 'validators · evaluators', kbd: 'q' },
  control: { label: 'Control',  hint: 'routers · triggers · hooks · policies', kbd: 'r' },
  state:   { label: 'State',    hint: 'memory stores',  kbd: 's' },
};

/* ═══════════════════════════════════════════════════════════════
   BLOCKS · the full registry (sample of 142 with varied types)
   ═══════════════════════════════════════════════════════════════ */
const BLOCKS = [
  // Agents
  { type: 'agent', id: 'agent.planner',          v: 'v4',   scope: 'global',  fit: 0.91, uses: 1240,  cost: '$0.08',  publisher: 'maestro/core', training: 'idle',
    desc: 'Decomposes a task into ordered, atomic steps. Outputs a Plan.' },
  { type: 'agent', id: 'agent.coder',            v: 'v6',   scope: 'global',  fit: 0.88, uses: 3402,  cost: '$0.18',  publisher: 'maestro/core', training: 'idle' , agentInControl: true,
    desc: 'Implements code changes from a plan. Composes edit-file + shell + git.' },
  { type: 'agent', id: 'agent.reviewer',         v: 'v3',   scope: 'global',  fit: 0.84, uses: 1810,  cost: '$0.11',  publisher: 'maestro/core', training: 'idle',
    desc: 'Critiques a patch for quality, security, and project conventions.' },
  { type: 'agent', id: 'agent.tester',           v: 'v3',   scope: 'global',  fit: 0.79, uses: 940,   cost: '$0.09',  publisher: 'maestro/core', training: 'idle',
    desc: 'Generates and runs tests against a patch. Reports failing cases.' },
  { type: 'agent', id: 'agent.debugger',         v: 'v2',   scope: 'user',    fit: 0.74, uses: 188,   cost: '$0.22',  publisher: 'you', training: 'idle',
    desc: 'Investigates failing tests, produces hypotheses, proposes fixes.' },
  { type: 'agent', id: 'commit-message.generator', v: 'v3.5', scope: 'user',  fit: 0.89, uses: 612,   cost: '$0.012', publisher: 'you', training: 'live', agentInControl: true,
    desc: 'Conventional-commit message from a diff. Schema-constrained output.' },

  // Workflows
  { type: 'workflow', id: 'workflow.feature-pipeline', v: 'v3', scope: 'project', fit: 0.86, uses: 218, cost: '$0.42', publisher: 'cantante', training: 'idle',
    desc: 'Plan → Specify → Code → Test → Review → Commit. The default coding workflow.' },
  { type: 'workflow', id: 'workflow.bugfix-loop',      v: 'v2', scope: 'project', fit: 0.81, uses: 84,  cost: '$0.28', publisher: 'cantante', training: 'idle',
    desc: 'Repro → fix → regression test. Loops up to 3× on failure.' },
  { type: 'workflow', id: 'workflow.block-forge',      v: 'v3', scope: 'global',  fit: 0.88, uses: 162, cost: '$1.20', publisher: 'maestro/core', training: 'idle', agentInControl: true,
    desc: 'Spec → forge → benchmark → publish. Maestro uses this to create new blocks.' },
  { type: 'workflow', id: 'workflow.docs-pass',        v: 'v1', scope: 'user',    fit: 0.78, uses: 22,  cost: '$0.14', publisher: 'you', training: 'queued',
    desc: 'Reads changed files, updates README and inline docs.' },

  // Tools
  { type: 'tool', id: 'tool.shell',        v: 'v2', scope: 'global', fit: null, uses: 18420, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Sandboxed shell. Allowlisted commands · bash + powershell.' },
  { type: 'tool', id: 'tool.edit-file',    v: 'v2', scope: 'global', fit: null, uses: 9210,  cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Patch-based file editor with built-in diff preview.' },
  { type: 'tool', id: 'tool.read-file',    v: 'v2', scope: 'global', fit: null, uses: 22140, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Reads a file. Streams for >100kb. Auto-detects binary.' },
  { type: 'tool', id: 'tool.git',          v: 'v1', scope: 'global', fit: null, uses: 5210,  cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Branches, commits, opens PRs. Sign-off rules respected.' },
  { type: 'tool', id: 'tool.http',         v: 'v1', scope: 'global', fit: null, uses: 1420,  cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'HTTP fetch. Allowlisted hosts only. JSON / text / stream.' },

  // Inference
  { type: 'inference', id: 'inf.diff-summary',  v: 'v2', scope: 'global', fit: 0.82, uses: 4210, cost: '$0.004', publisher: 'maestro/core', training: 'idle',
    desc: 'Single-shot diff summarizer. JSON output, no tools.' },
  { type: 'inference', id: 'inf.commit-type',   v: 'v1', scope: 'user',   fit: 0.93, uses: 612,  cost: '$0.002', publisher: 'you', training: 'idle',
    desc: 'Classifies a diff into conventional-commit type (feat/fix/chore/…).' },
  { type: 'inference', id: 'inf.intent-detect', v: 'v3', scope: 'global', fit: 0.88, uses: 8420, cost: '$0.003', publisher: 'maestro/core', training: 'idle',
    desc: 'Classifies user message into intent (task / question / cancel / clarify).' },

  // Transformer
  { type: 'transformer', id: 'xform.diff-to-hunks', v: 'v1', scope: 'global', fit: null, uses: 4210, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Unified diff → array of hunks. Pure parser.' },
  { type: 'transformer', id: 'xform.ast-walk',      v: 'v2', scope: 'global', fit: null, uses: 1840, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'AST walker for TS/JS/Rust. Yields nodes matching a query.' },

  // Prompt
  { type: 'prompt', id: 'prompt.coder-system', v: 'v6',   scope: 'global', fit: null, uses: 3402, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'System prompt for agent.coder. 2.4k tokens.' },
  { type: 'prompt', id: 'prompt.review-conventions', v: 'v2', scope: 'project', fit: null, uses: 1810, cost: '$0', publisher: 'cantante', training: 'idle',
    desc: 'Project review conventions injected into reviewer system prompt.' },

  // Schema
  { type: 'schema', id: 'schema.plan-step', v: 'v3', scope: 'global', fit: null, uses: 1240, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Plan step: { id, action, inputs, dependsOn }.' },
  { type: 'schema', id: 'schema.git-patch', v: 'v1', scope: 'global', fit: null, uses: 9210, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Unified git patch with hunks, hashes, conflict markers.' },

  // Dataset
  { type: 'dataset', id: 'ds.commit-eval',  v: 'v2', scope: 'user',   fit: null, uses: 612, cost: '$0', publisher: 'you', training: 'idle',
    desc: '24 sample diffs with expected commit messages. Hand-curated.' },
  { type: 'dataset', id: 'ds.codegen-tasks', v: 'v4', scope: 'global', fit: null, uses: 218, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: '180 small codegen tasks across 6 languages. Used by agent.coder.' },

  // Validator
  { type: 'validator', id: 'val.json-schema',   v: 'v1', scope: 'global', fit: null, uses: 14210, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Generic JSON schema validator. Used by every contract gate.' },
  { type: 'validator', id: 'val.commit-format', v: 'v2', scope: 'user',   fit: null, uses: 612, cost: '$0', publisher: 'you', training: 'idle',
    desc: 'Validates a commit message against conventional-commit grammar.' },

  // Evaluator
  { type: 'evaluator', id: 'eval.semantic-diff', v: 'v2', scope: 'global', fit: null, uses: 940, cost: '$0.001', publisher: 'maestro/core', training: 'idle',
    desc: 'Semantic similarity scorer between expected vs. produced text.' },
  { type: 'evaluator', id: 'eval.test-pass-rate', v: 'v1', scope: 'global', fit: null, uses: 1140, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Fraction of tests passing after a patch. Deterministic.' },

  // Router
  { type: 'router', id: 'router.tests-pass-or-fix', v: 'v1', scope: 'project', fit: null, uses: 218, cost: '$0', publisher: 'cantante', training: 'idle',
    desc: 'If tests pass → reviewer; else → debugger. Used by feature-pipeline.' },
  { type: 'router', id: 'router.tier-by-budget', v: 'v2', scope: 'global', fit: null, uses: 1840, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Routes to tier 1/2/3 based on remaining session budget.' },

  // Trigger
  { type: 'trigger', id: 'trg.on-pr-opened', v: 'v1', scope: 'project', fit: null, uses: 84,  cost: '$0', publisher: 'cantante', training: 'idle',
    desc: 'Fires when a PR is opened. Webhook from GitHub.' },
  { type: 'trigger', id: 'trg.on-failing-test', v: 'v1', scope: 'project', fit: null, uses: 22, cost: '$0', publisher: 'cantante', training: 'idle',
    desc: 'Fires when CI reports a failing test. Hands off to debugger.' },

  // Hook
  { type: 'hook', id: 'hook.sign-off-destructive', v: 'v1', scope: 'global', fit: null, uses: 320, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Pre-execute hook on destructive shell commands. Asks for confirm.' },
  { type: 'hook', id: 'hook.audit-token-spend',    v: 'v2', scope: 'global', fit: null, uses: 5800, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Post-inference hook. Records token + cost to telemetry.' },

  // Policy
  { type: 'policy', id: 'pol.tier-budget',     v: 'v3', scope: 'user', fit: null, uses: 1240, cost: '$0', publisher: 'you', training: 'idle',
    desc: '$2 / session, $25 / day. Hard stop on Tier 1; degrade to Tier 2.' },
  { type: 'policy', id: 'pol.fs-readonly',     v: 'v1', scope: 'project', fit: null, uses: 86, cost: '$0', publisher: 'cantante', training: 'idle',
    desc: 'Read-only filesystem outside packages/maestro-code. Strict.' },

  // Memory
  { type: 'memory', id: 'mem.session-kv',  v: 'v2', scope: 'global', fit: null, uses: 4210, cost: '$0', publisher: 'maestro/core', training: 'idle',
    desc: 'Per-session key-value memory. Evicted on session end.' },
  { type: 'memory', id: 'mem.coder-context', v: 'v1', scope: 'project', fit: null, uses: 218, cost: '$0', publisher: 'cantante', training: 'idle',
    desc: 'Project-scoped memory: recently-read files, last 10 diffs.' },

  // Contracts — the role definitions
  { type: 'contract', id: 'contract.diff-to-commit-message', v: 'v2', scope: 'user', fit: null, uses: 612, cost: '$0', publisher: 'you', training: 'idle',
    complexity: 'simple', candidates: 5, passing: 3,
    role: 'Conventional-commit message writer',
    desc: 'Given a unified diff, produce a single-line conventional-commit message matching the project style.' },
  { type: 'contract', id: 'contract.implement-from-plan',    v: 'v6', scope: 'global', fit: null, uses: 3402, cost: '$0', publisher: 'maestro/core', training: 'idle',
    complexity: 'complex', candidates: 12, passing: 4,
    role: 'Feature implementer',
    desc: 'Given a Plan + Workspace, emit a Patch that fulfills the plan with passing tests, minimal hunks, and idempotent changes.' },
  { type: 'contract', id: 'contract.review-patch',           v: 'v3', scope: 'global', fit: null, uses: 1810, cost: '$0', publisher: 'maestro/core', training: 'idle',
    complexity: 'moderate', candidates: 6, passing: 4,
    role: 'Patch reviewer',
    desc: 'Critique a Patch for quality, security, and project conventions. Emit findings + a verdict.' },
  { type: 'contract', id: 'contract.test-from-patch',        v: 'v3', scope: 'global', fit: null, uses: 940,  cost: '$0', publisher: 'maestro/core', training: 'idle',
    complexity: 'moderate', candidates: 4, passing: 2,
    role: 'Test generator',
    desc: 'Given a Patch, generate the minimal test suite that exercises the new behavior + regression tests.' },
  { type: 'contract', id: 'contract.summarize-diff',         v: 'v1', scope: 'user', fit: null, uses: 4210, cost: '$0', publisher: 'you', training: 'idle',
    complexity: 'simple', candidates: 7, passing: 5,
    role: 'Diff summarizer',
    desc: 'Given a diff, return a 1-2 sentence summary in plain English. No code, no technical jargon.' },
  { type: 'contract', id: 'contract.plan-from-task',         v: 'v4', scope: 'global', fit: null, uses: 1240, cost: '$0', publisher: 'maestro/core', training: 'idle',
    complexity: 'complex', candidates: 8, passing: 3,
    role: 'Task planner',
    desc: 'Given a high-level task + Workspace, emit an ordered list of atomic steps with dependencies.' },
  { type: 'contract', id: 'contract.debug-failure',          v: 'v2', scope: 'project', fit: null, uses: 86, cost: '$0', publisher: 'cantante', training: 'idle',
    complexity: 'complex', candidates: 3, passing: 1,
    role: 'Failure debugger',
    desc: 'Given a failing test report + Patch, produce a hypothesis + minimal fix patch. Loop up to 3×.' },
];

Object.assign(window, { BLOCK_TYPES, BLOCK_CATEGORIES, BLOCKS });
