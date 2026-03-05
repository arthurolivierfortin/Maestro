/**
 * Contract Resolver — Resolves blocks by contract and computes active features.
 *
 * A contract defines a role (e.g. "maestro-assistant"). Multiple blocks can implement
 * the same contract with different capabilities. Features of a contract are gated
 * by the capabilities of the chosen block.
 */

import type { IMaestroCodeApiClient } from '../types.ts';

export interface ContractFeature {
  description: string;
  requires: string[];
}

export interface ContractDefinition {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  features: Record<string, ContractFeature>;
}

export interface BlockSummary {
  id: string;
  name: string;
  description?: string;
  blockType: string;
  capabilities?: string[];
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

  // Client-side filter: agent blocks whose ID contains the contract name
  // Exclude workflows (they orchestrate agents, they're not agents themselves)
  const blocks = allBlocks.filter((b) => {
    const id = b.id.replace(/^system:/, '');
    return id.includes(contractId) && b.blockType === 'agent';
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
    description: 'Conversational assistant that orchestrates Maestro operations',
    requiredCapabilities: ['conversation'],
    features: {
      'Conversation': { description: 'Natural language interaction', requires: ['conversation'] },
      'Tool Calling': { description: 'Execute tools and blocks', requires: ['tool-calling'] },
      'Structured Output': { description: 'JSON-formatted responses', requires: ['structured-output'] },
      'Long Context': { description: 'Handle large conversations', requires: ['long-context'] },
      'Orchestration': { description: 'Multi-step agent workflows', requires: ['orchestration'] },
    },
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
