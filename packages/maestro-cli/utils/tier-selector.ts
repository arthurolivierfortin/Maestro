/**
 * tier-selector.ts
 *
 * Tier selection logic for the autonomous-dev agent.
 * Tiers are model assignment configurations, not separate blocks.
 * All tiers use the same block (autonomous-dev) with different model overrides.
 */

export interface TierInfo {
  tier: number;
  blockId: string;
  name: string;
  qualityTarget: number;
  requiredModels: string[];
  description: string;
  modelOverrides: Record<string, string>;
}

/** Static tier definitions — model assignment variants for autonomous-dev */
export const TIERS: TierInfo[] = [
  {
    tier: 1,
    blockId: 'autonomous-dev',
    name: 'Tier 1 — Maximum Quality',
    qualityTarget: 1.0,
    requiredModels: ['claude-sonnet'],
    description: 'Claude Sonnet for all tasks. Best quality, highest cost.',
    modelOverrides: {}
  },
  {
    tier: 2,
    blockId: 'autonomous-dev',
    name: 'Tier 2 — High Quality',
    qualityTarget: 0.95,
    requiredModels: ['claude-sonnet', 'claude-haiku'],
    description: 'Sonnet for critical tasks, Haiku for simple tasks. 95%+ quality.',
    modelOverrides: {
      'project-preparer': 'claude-haiku',
      'context-analyzer': 'claude-haiku',
      'task-planner': 'claude-haiku',
      'test-executor': 'claude-haiku',
      'git-committer': 'claude-haiku'
    }
  },
  {
    tier: 3,
    blockId: 'autonomous-dev',
    name: 'Tier 3 — Balanced',
    qualityTarget: 0.90,
    requiredModels: ['claude-sonnet', 'claude-haiku', 'Qwen2.5-Coder-1.5B-Instruct'],
    description: 'Sonnet for code, Haiku for reasoning, local for simple tasks. 90%+ quality.',
    modelOverrides: {
      'project-preparer': 'Qwen2.5-Coder-1.5B-Instruct',
      'context-analyzer': 'claude-haiku',
      'task-planner': 'claude-haiku',
      'test-executor': 'Qwen2.5-Coder-1.5B-Instruct',
      'git-committer': 'Qwen2.5-Coder-1.5B-Instruct'
    }
  },
  {
    tier: 4,
    blockId: 'autonomous-dev',
    name: 'Tier 4 — Mostly Local',
    qualityTarget: 0.80,
    requiredModels: ['claude-haiku', 'Qwen2.5-Coder-1.5B-Instruct'],
    description: 'Only Haiku for code gen, everything else local. 80%+ quality.',
    modelOverrides: {
      'project-preparer': 'Qwen2.5-Coder-1.5B-Instruct',
      'context-analyzer': 'Qwen2.5-Coder-1.5B-Instruct',
      'task-planner': 'Qwen2.5-Coder-1.5B-Instruct',
      'code-implementer': 'claude-haiku',
      'test-executor': 'Qwen2.5-Coder-1.5B-Instruct',
      'code-reviewer': 'Qwen2.5-Coder-1.5B-Instruct',
      'git-committer': 'Qwen2.5-Coder-1.5B-Instruct'
    }
  },
  {
    tier: 5,
    blockId: 'autonomous-dev',
    name: 'Tier 5 — Full Local',
    qualityTarget: 0.70,
    requiredModels: ['Qwen2.5-Coder-1.5B-Instruct'],
    description: '100% local. Zero cost, full privacy. 70%+ quality.',
    modelOverrides: {
      'project-preparer': 'Qwen2.5-Coder-1.5B-Instruct',
      'context-analyzer': 'Qwen2.5-Coder-1.5B-Instruct',
      'task-planner': 'Qwen2.5-Coder-1.5B-Instruct',
      'code-implementer': 'Qwen2.5-Coder-1.5B-Instruct',
      'test-executor': 'Qwen2.5-Coder-1.5B-Instruct',
      'code-reviewer': 'Qwen2.5-Coder-1.5B-Instruct',
      'git-committer': 'Qwen2.5-Coder-1.5B-Instruct'
    }
  }
];

/**
 * Select the best available tier based on which models are accessible.
 */
export function selectBestTier(availableModelIds: string[]): TierInfo {
  const available = new Set(availableModelIds.map(id => normalizeModelId(id)));

  // Try from tier 1 (best) down to tier 5 (cheapest)
  for (const tier of TIERS) {
    const allAvailable = tier.requiredModels.every(m => available.has(normalizeModelId(m)));
    if (allAvailable) return tier;
  }

  // Fallback: return tier 5 (always possible if any local model is available)
  return TIERS[TIERS.length - 1];
}

/**
 * Check which tiers are available given the current model list.
 */
export function getAvailableTiers(availableModelIds: string[]): TierInfo[] {
  const available = new Set(availableModelIds.map(id => normalizeModelId(id)));

  return TIERS.filter(tier =>
    tier.requiredModels.every(m => available.has(normalizeModelId(m)))
  );
}

/**
 * Get missing models for a specific tier.
 */
export function getMissingModels(tier: TierInfo, availableModelIds: string[]): string[] {
  const available = new Set(availableModelIds.map(id => normalizeModelId(id)));
  return tier.requiredModels.filter(m => !available.has(normalizeModelId(m)));
}

/**
 * Normalize model ID for comparison (lowercase, strip version suffixes).
 */
function normalizeModelId(id: string): string {
  return id.toLowerCase().trim();
}

/**
 * Format a comparative report of all tiers.
 */
export function formatTierReport(availableModelIds: string[]): string {
  const available = new Set(availableModelIds.map(id => normalizeModelId(id)));
  const best = selectBestTier(availableModelIds);

  const lines: string[] = [];
  lines.push('');
  lines.push('  Autonomous Developer — Tier Comparison');
  lines.push('  =======================================');
  lines.push('');
  lines.push('  Tier  Quality  Cost      Models                              Status');
  lines.push('  ----  -------  --------  ----------------------------------  ------');

  const costEstimates = ['$$$', '$$', '$', '<$0.01', 'Free'];

  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    const isAvailable = tier.requiredModels.every(m => available.has(normalizeModelId(m)));
    const isBest = tier.tier === best.tier;
    const missing = getMissingModels(tier, availableModelIds);

    const quality = `${Math.round(tier.qualityTarget * 100)}%`.padEnd(7);
    const cost = costEstimates[i].padEnd(8);
    const models = tier.requiredModels.join(', ').substring(0, 34).padEnd(34);

    let status = '';
    if (isBest && isAvailable) {
      status = '<-- recommended';
    } else if (isAvailable) {
      status = 'available';
    } else {
      status = `missing: ${missing.join(', ')}`;
    }

    lines.push(`  ${tier.tier}     ${quality}  ${cost}  ${models}  ${status}`);
  }

  lines.push('');
  lines.push(`  Recommended: Tier ${best.tier} (${best.name})`);
  lines.push(`  Use: maestro code --agent ${best.blockId}`);
  lines.push('');

  return lines.join('\n');
}
