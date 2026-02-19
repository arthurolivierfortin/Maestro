/**
 * Block transforms — Pure functions for block data processing.
 * Zero dependencies. Used by both TUI and Frontend.
 */

export interface BlockSummary {
  id: string;
  name?: string;
  type?: string;
  designation?: string;
  isAtomic?: boolean;
  [key: string]: unknown;
}

/** Default sort order for block types. */
const TYPE_ORDER: Record<string, number> = {
  workflow: 0,
  agent: 1,
  tool: 2,
  template: 3,
  prompt: 4,
  instruction: 5,
  decision: 6,
  validator: 7,
  trigger: 8,
  inference: 9,
  script: 10,
};

/**
 * Sorts blocks by type (workflow first, then agent, tool, etc.).
 */
export function sortByType(blocks: BlockSummary[]): BlockSummary[] {
  return [...blocks].sort((a, b) => {
    const aOrder = TYPE_ORDER[(a.type || '').toLowerCase()] ?? 99;
    const bOrder = TYPE_ORDER[(b.type || '').toLowerCase()] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || a.id).localeCompare(b.name || b.id);
  });
}

/**
 * Groups blocks by type, returning a map of type -> blocks.
 */
export function groupByType(blocks: BlockSummary[]): Map<string, BlockSummary[]> {
  const groups = new Map<string, BlockSummary[]>();
  for (const block of blocks) {
    const type = (block.type || 'unknown').toLowerCase();
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(block);
  }
  return groups;
}

/**
 * Counts blocks by type.
 */
export function countByType(blocks: BlockSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const block of blocks) {
    const type = (block.type || 'unknown').toLowerCase();
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}
