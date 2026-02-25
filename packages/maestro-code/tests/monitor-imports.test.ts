// @ts-nocheck
/**
 * Tests for monitor component importability from maestro-code.
 * Phase 41-A — verifies granular exports work.
 */
import { describe, it, expect } from 'vitest';

describe('Monitor component imports', () => {
  it('SessionMonitor is importable and is a function', async () => {
    const mod = await import('@maestro/monitor/components/SessionMonitor.ts');
    expect(mod.SessionMonitor).toBeDefined();
    expect(typeof mod.SessionMonitor).toBe('function');
  });

  it('CatalogScreen is importable and is a function', async () => {
    const mod = await import('@maestro/monitor/components/CatalogScreen.ts');
    expect(mod.CatalogScreen).toBeDefined();
    expect(typeof mod.CatalogScreen).toBe('function');
  });

  it('SpacesScreen is importable and is a function', async () => {
    const mod = await import('@maestro/monitor/components/SpacesScreen.ts');
    expect(mod.SpacesScreen).toBeDefined();
    expect(typeof mod.SpacesScreen).toBe('function');
  });

  it('ModelsScreen is importable and is a function', async () => {
    const mod = await import('@maestro/monitor/components/ModelsScreen.ts');
    expect(mod.ModelsScreen).toBeDefined();
    expect(typeof mod.ModelsScreen).toBe('function');
  });

  it('WorkflowTree is importable and is a function', async () => {
    const mod = await import('@maestro/monitor/components/WorkflowTree.ts');
    expect(mod.WorkflowTree).toBeDefined();
    expect(typeof mod.WorkflowTree).toBe('function');
  });

  it('monitor theme is importable', async () => {
    const mod = await import('@maestro/monitor/theme');
    expect(mod).toBeDefined();
    // theme re-exports statusColor and icons from @maestro/tui
    expect(typeof mod.statusColor).toBe('function');
    expect(mod.icons).toBeDefined();
  });
});
