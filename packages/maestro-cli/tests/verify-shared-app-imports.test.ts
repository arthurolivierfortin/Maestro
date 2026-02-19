/**
 * Verify that @maestro/tui app exports resolve correctly.
 *
 * Run: npx tsx tests/verify-shared-app-imports.test.ts
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    console.log(`  \u2717 ${msg}`);
  }
}

// ── @maestro/tui app barrel exports ────────────────────────────────────────

console.log('\n=== @maestro/tui app barrel exports ===');

import * as appExports from '@maestro/tui/app';

assert(typeof appExports.extractActiveModel === 'function', 'barrel: extractActiveModel');
assert(typeof appExports.isServiceHealthy === 'function', 'barrel: isServiceHealthy');
assert(typeof appExports.toServiceHealth === 'function', 'barrel: toServiceHealth');
assert(typeof appExports.toLLMServiceHealth === 'function', 'barrel: toLLMServiceHealth');
assert(typeof appExports.extractMaxTokens === 'function', 'barrel: extractMaxTokens');
assert(typeof appExports.extractDevice === 'function', 'barrel: extractDevice');
assert(typeof appExports.extractBackend === 'function', 'barrel: extractBackend');
assert(typeof appExports.countByStatus === 'function', 'barrel: countByStatus');
assert(typeof appExports.filterByStatus === 'function', 'barrel: filterByStatus');
assert(typeof appExports.filterRunning === 'function', 'barrel: filterRunning');
assert(typeof appExports.extractFitness === 'function', 'barrel: extractFitness');
assert(typeof appExports.statusToSemantic === 'function', 'barrel: statusToSemantic');
assert(typeof appExports.sortByType === 'function', 'barrel: sortByType');
assert(typeof appExports.groupByType === 'function', 'barrel: groupByType');
assert(typeof appExports.countByType === 'function', 'barrel: countByType');
assert(typeof appExports.normalizeModelEntry === 'function', 'barrel: normalizeModelEntry');
assert(typeof appExports.getModelName === 'function', 'barrel: getModelName');
assert(typeof appExports.isActiveModel === 'function', 'barrel: isActiveModel');

// Hooks are exported too (React functions)
assert(typeof appExports.usePolling === 'function', 'barrel: usePolling');
assert(typeof appExports.useApiData === 'function', 'barrel: useApiData (alias)');
assert(typeof appExports.useHealthMonitor === 'function', 'barrel: useHealthMonitor');
assert(typeof appExports.useSessionList === 'function', 'barrel: useSessionList');
assert(typeof appExports.useModelList === 'function', 'barrel: useModelList');

// ── @maestro/tui hooks direct imports ────────────────────────────────────────

console.log('\n=== @maestro/tui hooks direct imports ===');

import { useApiData as tuiUseApiData } from '@maestro/tui/hooks';
assert(typeof tuiUseApiData === 'function', 'tui useApiData is function');
// The canonical implementation should be the same function (re-export of usePolling)
assert(tuiUseApiData === appExports.usePolling, 'tui useApiData === app usePolling (single source of truth)');

import { usePanelFocus } from '@maestro/tui/hooks';
assert(typeof usePanelFocus === 'function', '@maestro/tui usePanelFocus is function');

import { useScroll } from '@maestro/tui/hooks';
assert(typeof useScroll === 'function', '@maestro/tui useScroll is function');

import { useTreeNav } from '@maestro/tui/hooks';
assert(typeof useTreeNav === 'function', '@maestro/tui useTreeNav is function');

import { useMouse } from '@maestro/tui/hooks';
assert(typeof useMouse === 'function', '@maestro/tui useMouse is function');

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
