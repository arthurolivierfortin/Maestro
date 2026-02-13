/**
 * Verify that shared/app exports and ink re-exports resolve correctly.
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

// ── shared/app barrel exports ────────────────────────────────────────

console.log('\n=== shared/app barrel exports ===');

import * as appExports from '../../shared/app/index';

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

// ── ink hooks re-export chain ────────────────────────────────────────

console.log('\n=== ink hooks re-export chain ===');

// These verify the re-export files load and export the expected symbols
import { useApiData as inkUseApiData } from '../monitor/ink/hooks/useApiData';
import { usePolling as inkUsePolling } from '../monitor/ink/hooks/useApiData';
assert(typeof inkUseApiData === 'function', 'ink useApiData re-export is function');
assert(typeof inkUsePolling === 'function', 'ink usePolling re-export is function');
assert(inkUseApiData === inkUsePolling, 'ink useApiData === usePolling (same function)');

import { usePanelFocus } from '../monitor/ink/hooks/usePanelFocus';
assert(typeof usePanelFocus === 'function', 'ink usePanelFocus re-export is function');

import { useScroll } from '../monitor/ink/hooks/useScroll';
assert(typeof useScroll === 'function', 'ink useScroll re-export is function');

import { useTreeNav } from '../monitor/ink/hooks/useTreeNav';
assert(typeof useTreeNav === 'function', 'ink useTreeNav re-export is function');

import { useMouse } from '../monitor/ink/hooks/useMouse';
assert(typeof useMouse === 'function', 'ink useMouse re-export is function');

// ── shared/tui/hooks useApiData chain ────────────────────────────────

console.log('\n=== shared/tui/hooks useApiData chain ===');

import { useApiData as tuiUseApiData } from '../../shared/tui/hooks/useApiData';
assert(typeof tuiUseApiData === 'function', 'tui useApiData re-export is function');
// The canonical implementation should be the same function
assert(tuiUseApiData === appExports.usePolling, 'tui useApiData === shared/app usePolling (single source of truth)');

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
