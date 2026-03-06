/**
 * Contract Resolver — Resolves blocks by contract and computes active features.
 *
 * A contract defines a role (e.g. "maestro-assistant"). Multiple blocks can implement
 * the same contract with different capabilities. Features of a contract are gated
 * by the capabilities of the chosen block.
 */

import type { IMaestroCodeApiClient } from '../types.ts';

// --- Check types for contract tests ---

export interface CheckNonEmpty {
  type: 'non-empty';
  minLength?: number;
}

export interface CheckContains {
  type: 'contains';
  value: string;
}

export interface CheckContainsAll {
  type: 'contains-all';
  values: string[];
}

export interface CheckContainsAny {
  type: 'contains-any';
  values: string[];
}

export interface CheckDoesNotContain {
  type: 'does-not-contain';
  values: string[];
  description?: string;
}

export interface CheckToolCall {
  type: 'tool-call';
  toolName: string;
  requiredArgs?: string[];
}

export interface CheckJsonParseable {
  type: 'json-parseable';
}

export interface CheckRegex {
  type: 'regex';
  pattern: string;
  flags?: string;
}

export type ContractCheck =
  | CheckNonEmpty
  | CheckContains
  | CheckContainsAll
  | CheckContainsAny
  | CheckDoesNotContain
  | CheckToolCall
  | CheckJsonParseable
  | CheckRegex;

// --- Test definitions ---

export interface ContractTestTurn {
  prompt: string;
  check?: ContractCheck;
}

/** Single-turn test: has `prompt` + `check`. Multi-turn test: has `turns`. */
export interface ContractTest {
  id: string;
  description?: string;
  /** Single-turn prompt */
  prompt?: string;
  /** Single-turn check */
  check?: ContractCheck;
  /** Multi-turn conversation */
  turns?: ContractTestTurn[];
}

// --- Feature and Contract ---

export interface ContractFeature {
  description: string;
  requires: string[];
  weight?: number;
  minimumScore?: number;
  tests?: ContractTest[];
}

export interface ContractScoring {
  method: string;
  description?: string;
}

export interface ContractDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  requiredCapabilities: string[];
  minimumFitness?: number;
  features: Record<string, ContractFeature>;
  scoring?: ContractScoring;
}

export interface BlockSummary {
  id: string;
  name: string;
  description?: string;
  blockType: string;
  capabilities?: string[];
  /** The contract this block implements (e.g. "maestro-assistant") */
  contract?: string;
}

export interface BlockForContract {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  activeFeatures: string[];
  inactiveFeatures: string[];
  meetsRequired: boolean;
}

/**
 * Get all blocks that implement a given contract.
 *
 * The backend doesn't support contract-based filtering yet, so we:
 * 1. Fetch all blocks
 * 2. Filter client-side: agent blocks whose ID contains the contract name
 * 3. Load contract definition (fallback to embedded if API returns 404)
 */
export async function getBlocksForContract(
  client: IMaestroCodeApiClient,
  contractId: string,
): Promise<BlockForContract[]> {
  const resp = await client._fetch('GET', '/api/blocks');
  const allBlocks = Array.isArray(resp) ? (resp as BlockSummary[]) : [];

  // Client-side filter: blocks that declare this contract in their `contract` field.
  // Falls back to ID matching for blocks that don't declare `contract` explicitly.
  const blocks = allBlocks.filter((b) => {
    if (b.contract === contractId) return true;
    // Legacy fallback: agent blocks whose ID contains the contract name
    const id = b.id.replace(/^system:/, '');
    return !b.contract && id.includes(contractId) && b.blockType === 'agent';
  });

  if (blocks.length === 0) return [];

  const contractDef = await loadContractDefinition(client, contractId);

  return blocks.map((block) => {
    const caps = block.capabilities ?? [];
    const { active, inactive } = computeActiveFeatures(contractDef, caps);
    const meetsRequired = contractDef
      ? contractDef.requiredCapabilities.every((rc) => caps.includes(rc))
      : true;

    return {
      id: block.id,
      name: block.name,
      description: block.description,
      capabilities: caps,
      activeFeatures: active,
      inactiveFeatures: inactive,
      meetsRequired,
    };
  });
}

/**
 * Compute which features of a contract are active/inactive given a set of capabilities.
 */
export function computeActiveFeatures(
  contract: ContractDefinition | null,
  capabilities: string[],
): { active: string[]; inactive: string[] } {
  if (!contract) return { active: [], inactive: [] };

  const active: string[] = [];
  const inactive: string[] = [];

  for (const [featureName, feature] of Object.entries(contract.features)) {
    const hasAll = feature.requires.every((req) => capabilities.includes(req));
    if (hasAll) {
      active.push(featureName);
    } else {
      inactive.push(featureName);
    }
  }

  return { active, inactive };
}

/**
 * Embedded contract definitions — fallback when backend doesn't have a contracts API.
 */
const EMBEDDED_CONTRACTS: Record<string, ContractDefinition> = {
  'maestro-assistant': {
    id: 'maestro-assistant',
    name: 'Maestro Assistant',
    version: '2.0.0',
    description: 'Conversational assistant that orchestrates Maestro operations',
    requiredCapabilities: ['conversation'],
    minimumFitness: 0.3,
    features: {
      'conversation': {
        description: 'Natural language interaction',
        requires: ['conversation'],
        weight: 0.25,
        minimumScore: 0.8,
        tests: [
          { id: 'basic-response', description: 'Responds coherently', prompt: 'Hello, what can you do?', check: { type: 'non-empty', minLength: 20 } },
          { id: 'context-retention', description: 'Remembers context', turns: [{ prompt: 'My name is Alice' }, { prompt: 'What is my name?', check: { type: 'contains', value: 'Alice' } }] },
        ],
      },
      'maestro-operations': {
        description: 'Create and manage Maestro sessions and workspaces',
        requires: ['structured-output', 'tool-calling'],
        weight: 0.30,
        minimumScore: 0.7,
        tests: [
          { id: 'create-session', description: 'Calls session creation tool', prompt: 'Create a dev session for Cantante', check: { type: 'tool-call', toolName: 'session-create', requiredArgs: ['name'] } },
          { id: 'list-workspaces', description: 'Calls workspace-list tool', prompt: 'List my workspaces', check: { type: 'tool-call', toolName: 'workspace-list' } },
        ],
      },
      'orchestration': {
        description: 'Multi-step planning and session management',
        requires: ['orchestration', 'tool-calling', 'long-context'],
        weight: 0.30,
        minimumScore: 0.7,
        tests: [
          { id: 'multi-step-plan', description: 'Presents a plan', prompt: 'Set up a complete dev environment for Cantante', check: { type: 'contains-all', values: ['workspace', 'session'] } },
          { id: 'confirm-before-act', description: 'Asks confirmation before destructive action', prompt: 'Delete all my test sessions', check: { type: 'does-not-contain', values: ['session-delete'] } },
        ],
      },
      'memory': {
        description: 'Remember user preferences',
        requires: ['memory', 'long-context'],
        weight: 0.15,
        minimumScore: 0.6,
        tests: [
          { id: 'remember-preference', description: 'Stores and recalls preference', turns: [{ prompt: 'Remember that I always want verbose output' }, { prompt: 'What are my preferences?', check: { type: 'contains', value: 'verbose' } }] },
        ],
      },
    },
    scoring: { method: 'weighted-average' },
  },
  'test-designer': {
    id: 'test-designer',
    name: 'Test Designer',
    version: '1.0.0',
    description: 'Agent that reads contracts and generates executable test configurations',
    requiredCapabilities: ['conversation', 'structured-output'],
    minimumFitness: 0.5,
    features: {
      'contract-analysis': {
        description: 'Read and understand contract definitions',
        requires: ['conversation'],
        weight: 0.30,
        minimumScore: 0.7,
        tests: [
          { id: 'identify-features', description: 'Lists all features from a given contract', prompt: 'Analyze this contract and list all features that need testing: {"id":"example","features":{"greeting":{"description":"Say hello","requires":["conversation"]},"math":{"description":"Do math","requires":["reasoning"]}}}', check: { type: 'contains-all', values: ['greeting', 'math'] } },
          { id: 'identify-capabilities', description: 'Identifies required capabilities per feature', prompt: 'What capabilities are needed for the \'math\' feature? {"features":{"math":{"requires":["reasoning","structured-output"]}}}', check: { type: 'contains-all', values: ['reasoning', 'structured-output'] } },
        ],
      },
      'test-generation': {
        description: 'Generate BlockTestRun configs from contract tests',
        requires: ['structured-output'],
        weight: 0.40,
        minimumScore: 0.7,
        tests: [
          { id: 'generate-single-turn', description: 'Generates a test config for a single-turn test', prompt: 'Generate a test JSON for: {"id":"basic-response","prompt":"Hello","check":{"type":"non-empty","minLength":20}}', check: { type: 'json-parseable' } },
          { id: 'generate-multi-turn', description: 'Generates a test config for multi-turn', prompt: 'Generate a test JSON for: {"id":"context","turns":[{"prompt":"My name is Bob"},{"prompt":"What is my name?","check":{"type":"contains","value":"Bob"}}]}', check: { type: 'json-parseable' } },
          { id: 'generate-tool-call-test', description: 'Generates a test verifying tool call', prompt: 'Generate a test that verifies the agent calls \'session-create\' with argument \'name\'', check: { type: 'contains-all', values: ['session-create', 'name'] } },
        ],
      },
      'test-quality': {
        description: 'Generated tests are non-trivial and executable',
        requires: ['conversation', 'structured-output'],
        weight: 0.30,
        minimumScore: 0.6,
        tests: [
          { id: 'non-trivial-checks', description: 'Tests include meaningful checks', prompt: 'Generate 3 test cases for a code-reviewer feature. Include varied check types.', check: { type: 'contains-any', values: ['contains', 'regex', 'does-not-contain', 'tool-call'] } },
          { id: 'edge-case-coverage', description: 'Generates edge case tests', prompt: 'Generate edge case tests for a conversation feature: empty input, long input, multilingual.', check: { type: 'non-empty', minLength: 100 } },
        ],
      },
    },
    scoring: { method: 'weighted-average' },
  },
  'agent-creator': {
    id: 'agent-creator',
    name: 'Agent Creator',
    version: '1.0.0',
    description: 'Agent that creates block definitions from contract specifications',
    requiredCapabilities: ['conversation', 'structured-output', 'tool-calling'],
    minimumFitness: 0.5,
    features: {
      'block-generation': {
        description: 'Create valid block.json files',
        requires: ['structured-output'],
        weight: 0.30,
        minimumScore: 0.7,
        tests: [
          { id: 'valid-block-json', description: 'Generates valid block.json', prompt: 'Create a block.json for a code-reviewer agent using claude-sonnet-4-6.', check: { type: 'json-parseable' } },
          { id: 'required-fields', description: 'Block.json has required fields', prompt: 'Create a block.json for a commit-message-writer agent', check: { type: 'contains-all', values: ['blockType', 'name', 'config'] } },
          { id: 'capabilities-declared', description: 'Block declares capabilities matching contract', prompt: 'Create a block.json implementing maestro-assistant requiring: conversation, tool-calling, structured-output', check: { type: 'contains-all', values: ['capabilities', 'conversation', 'tool-calling'] } },
        ],
      },
      'prompt-writing': {
        description: 'Write effective system prompts',
        requires: ['conversation'],
        weight: 0.25,
        minimumScore: 0.6,
        tests: [
          { id: 'system-prompt-structure', description: 'Prompt has clear sections', prompt: 'Write a system-prompt.md for a code-reviewer agent reviewing bugs, style, and performance.', check: { type: 'contains-all', values: ['#', 'bug', 'style'] } },
          { id: 'tool-descriptions', description: 'Prompt describes available tools', prompt: 'Write a system-prompt.md for an agent using file-read, file-write, shell-execute tools.', check: { type: 'contains-all', values: ['file-read', 'file-write', 'shell-execute'] } },
        ],
      },
      'iterative-improvement': {
        description: 'Improve blocks based on test results',
        requires: ['conversation', 'structured-output'],
        weight: 0.25,
        minimumScore: 0.6,
        tests: [
          { id: 'diagnose-failure', description: 'Identifies why a test failed', prompt: 'Test \'basic-response\' failed: non-empty minLength 20, agent responded \'Hi.\' (3 chars). What\'s wrong?', check: { type: 'contains-any', values: ['short', 'longer', 'detailed', 'verbose', 'elaborate', 'minimum'] } },
          { id: 'iterate-on-results', description: 'Produces improved version after failures', turns: [{ prompt: 'Test results: review-quality FAILED (check: contains \'suggestion\'), code-format PASSED. What to change?' }, { prompt: 'Generate the updated system-prompt.md', check: { type: 'contains', value: 'suggestion' } }] },
        ],
      },
      'model-adaptation': {
        description: 'Adapt blocks for different model tiers',
        requires: ['conversation', 'structured-output'],
        weight: 0.20,
        minimumScore: 0.5,
        tests: [
          { id: 'adapt-for-smaller-model', description: 'Adjusts prompt for smaller model', prompt: 'Adapt a code-reviewer from claude-opus-4-6 to claude-haiku-4-5-20251001. What changes?', check: { type: 'contains-any', values: ['simpl', 'shorter', 'concise', 'fewer', 'explicit', 'structured', 'haiku'] } },
          { id: 'preserve-contract-compliance', description: 'Adapted variant keeps same contract', prompt: 'When adapting from opus to haiku, should the contract reference change?', check: { type: 'contains-any', values: ['no', 'same', 'contract', 'unchanged', 'keep'] } },
        ],
      },
    },
    scoring: { method: 'weighted-average' },
  },
  'block-forge': {
    id: 'block-forge',
    name: 'Block Forge',
    version: '1.0.0',
    description: 'End-to-end workflow for creating contract-compliant blocks',
    requiredCapabilities: ['orchestration', 'tool-calling'],
    minimumFitness: 0.5,
    features: {
      'end-to-end-creation': {
        description: 'From description to published block',
        requires: ['orchestration', 'tool-calling'],
        weight: 0.40,
        minimumScore: 0.7,
        tests: [
          { id: 'create-from-description', description: 'Creates block from description', prompt: 'Create a code-reviewer agent implementing the code-reviewer contract.', check: { type: 'contains-all', values: ['block', 'code-reviewer'] } },
          { id: 'workspace-usage', description: 'Uses workspace for development', prompt: 'Start creating a commit-message-writer block in a new workspace', check: { type: 'contains-any', values: ['workspace', 'foundry'] } },
          { id: 'publish-result', description: 'Published block in catalog', prompt: 'The block passed all tests. Publish it to the catalog.', check: { type: 'contains-any', values: ['publish', 'catalog', 'available'] } },
        ],
      },
      'contract-compliance': {
        description: 'Created blocks pass contract tests',
        requires: ['orchestration'],
        weight: 0.35,
        minimumScore: 0.7,
        tests: [
          { id: 'runs-contract-tests', description: 'Runs contract tests against created block', prompt: 'After creating the code-reviewer block, verify it passes the contract tests', check: { type: 'contains-any', values: ['test', 'pass', 'score', 'contract', 'verify'] } },
          { id: 'iterates-on-failure', description: 'Improves block when tests fail', prompt: 'The code-reviewer failed the review-quality test. What should the forge do?', check: { type: 'contains-any', values: ['improv', 'updat', 'modif', 'fix', 'retry', 'iterate', 'prompt'] } },
        ],
      },
      'adaptation': {
        description: 'Create model variants',
        requires: ['orchestration', 'tool-calling'],
        weight: 0.25,
        minimumScore: 0.6,
        tests: [
          { id: 'create-variant', description: 'Creates variant for different model', prompt: 'Create a haiku variant of the code-reviewer block', check: { type: 'contains-any', values: ['variant', 'haiku', 'adapt'] } },
          { id: 'variant-tested', description: 'Variant tested against same contract', prompt: 'After creating the haiku variant, how do you verify it meets the contract?', check: { type: 'contains-any', values: ['test', 'contract', 'score', 'verify', 'pass'] } },
        ],
      },
    },
    scoring: { method: 'weighted-average' },
  },
};

/**
 * Load a contract definition from the backend, falling back to embedded definitions.
 */
async function loadContractDefinition(
  client: IMaestroCodeApiClient,
  contractId: string,
): Promise<ContractDefinition | null> {
  try {
    const resp = await client._fetch('GET', `/api/contracts/${encodeURIComponent(contractId)}`);
    return resp as ContractDefinition;
  } catch {
    // Fallback to embedded contract definition
    return EMBEDDED_CONTRACTS[contractId] ?? null;
  }
}
