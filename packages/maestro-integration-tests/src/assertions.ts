/**
 * Assertion helpers for integration tests.
 *
 * Provides utilities to verify execution trees and logs
 * from session variables.
 */

import { expect } from 'vitest';

/**
 * Parse an execution tree from session variables.
 * The tree may be a JSON string or already an object.
 */
export function parseTree(tree: unknown): any[] {
  if (!tree) return [];
  if (typeof tree === 'string') {
    try { return JSON.parse(tree); } catch { return []; }
  }
  if (Array.isArray(tree)) return tree;
  return [];
}

/**
 * Parse an execution log from session variables.
 */
export function parseLog(log: unknown): any[] {
  if (!log) return [];
  if (typeof log === 'string') {
    try { return JSON.parse(log); } catch { return []; }
  }
  if (Array.isArray(log)) return log;
  return [];
}

/**
 * Assert that all nodes in the execution tree have status 'done'.
 * Recursively checks nested nodes (conditionals, branches).
 */
export function assertAllNodesDone(tree: unknown): void {
  const nodes = parseTree(tree);
  const flatNodes = flattenNodes(nodes);

  expect(flatNodes.length).toBeGreaterThan(0);
  for (const node of flatNodes) {
    if (node.status) {
      expect(
        node.status,
        `Node "${node.id}" should be done but is "${node.status}"`
      ).toBe('done');
    }
  }
}

/**
 * Assert that NO nodes have status 'error'.
 */
export function assertNoNodeErrors(tree: unknown): void {
  const nodes = parseTree(tree);
  const flatNodes = flattenNodes(nodes);

  const errorNodes = flatNodes.filter(n => n.status === 'error');
  if (errorNodes.length > 0) {
    const ids = errorNodes.map(n => n.id).join(', ');
    throw new Error(`Found ${errorNodes.length} error nodes: ${ids}`);
  }
}

/**
 * Assert no error-level entries in the execution log.
 */
export function assertNoLogErrors(log: unknown): void {
  const entries = parseLog(log);
  const errors = entries.filter((e: any) => e.level === 'error');

  if (errors.length > 0) {
    const messages = errors.map((e: any) => e.message || e.error || JSON.stringify(e)).join('\n');
    throw new Error(`Found ${errors.length} error log entries:\n${messages}`);
  }
}

/**
 * Check if a specific node exists in the tree.
 */
export function assertNodeExists(tree: unknown, nodeId: string): void {
  const nodes = parseTree(tree);
  const flatNodes = flattenNodes(nodes);
  const found = flatNodes.find(n => n.id === nodeId);
  expect(found, `Node "${nodeId}" not found in execution tree`).toBeDefined();
}

/**
 * Get the status of a specific node.
 */
export function getNodeStatus(tree: unknown, nodeId: string): string | undefined {
  const nodes = parseTree(tree);
  const flatNodes = flattenNodes(nodes);
  const found = flatNodes.find(n => n.id === nodeId);
  return found?.status;
}

/**
 * Flatten a tree of nodes, including children of conditionals.
 */
function flattenNodes(nodes: any[]): any[] {
  const result: any[] = [];
  for (const node of nodes) {
    result.push(node);
    // Conditional branches
    if (node.then?.nodes) result.push(...flattenNodes(node.then.nodes));
    if (node.else?.nodes) result.push(...flattenNodes(node.else.nodes));
    // Children
    if (node.children) result.push(...flattenNodes(node.children));
    if (node.nodes) result.push(...flattenNodes(node.nodes));
  }
  return result;
}

/**
 * Extract a variable value from the getAll response.
 * The getAll endpoint may return values directly or wrapped.
 */
export function extractVar(vars: Record<string, unknown>, key: string): unknown {
  const raw = vars[key];
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return (raw as any).value;
  }
  return raw;
}
