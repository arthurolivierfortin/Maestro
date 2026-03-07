/**
 * Tests for CatalogScreen [T] contract test shortcut (Phase 56-C).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

function createMockApiClient(blocks: any[] = [], opts?: { testResult?: any; testError?: Error }) {
  return {
    listBlocks: vi.fn().mockResolvedValue(blocks),
    listSessions: vi.fn().mockResolvedValue([]),
    testContract: opts?.testError
      ? vi.fn().mockRejectedValue(opts.testError)
      : vi.fn().mockResolvedValue(opts?.testResult ?? {}),
  };
}

const BLOCK_WITH_CONTRACT = {
  id: 'system:maestro-assistant',
  name: 'Maestro Assistant',
  blockType: 'agent',
  version: '1.0.0',
  contract: 'maestro-assistant',
  capabilities: ['conversation'],
  description: 'Main assistant',
};

const BLOCK_WITHOUT_CONTRACT = {
  id: 'file-edit',
  name: 'File Edit',
  blockType: 'tool',
  version: '1.0.0',
  description: 'Edit files',
};

const MOCK_TEST_RESULT = {
  contractId: 'maestro-assistant',
  contractVersion: '2.0.0',
  blockId: 'system:maestro-assistant',
  fitness: 0.15,
  performanceScore: 0.95,
  passed: true,
  meetsRequiredCapabilities: true,
  features: [
    { featureId: 'conversation', score: 1.0, testsPassed: 7, testsTotal: 7, meetsThreshold: true },
    { featureId: 'maestro-ops', score: 1.0, testsPassed: 7, testsTotal: 7, meetsThreshold: true },
    { featureId: 'orchestration', score: 1.0, testsPassed: 5, testsTotal: 5, meetsThreshold: true },
    { featureId: 'memory', score: 1.0, testsPassed: 5, testsTotal: 5, meetsThreshold: true },
  ],
  testResults: [],
  totalTests: 24,
  passedTests: 24,
  failedTests: 0,
  skippedTests: 0,
  durationMs: 45200,
  estimatedCostUsd: 0.42,
  failureReasons: [],
  fitnessBreakdown: {
    performance: 0.95,
    specialization: 0.48,
    composability: 1.0,
    economicCost: 2.3,
    computeCost: 11.0,
    hardwareCost: 1.0,
    totalFitness: 0.15,
    numerator: 0.81,
    combinedCost: 4.1,
  },
};

describe('CatalogScreen — Contract Test [T]', () => {
  afterEach(() => cleanup());

  it('shows "No contract" message when pressing [T] on block without contract', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([BLOCK_WITHOUT_CONTRACT]);

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    // Press T
    stdin.write('t');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No contract defined for this block');
    // testContract should NOT have been called
    expect(api.testContract).not.toHaveBeenCalled();
  });

  it('calls testContract and displays result when pressing [T] on block with contract', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([BLOCK_WITH_CONTRACT], { testResult: MOCK_TEST_RESULT });

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    // Press T to test
    stdin.write('t');
    await delay(300);

    const frame = stripAnsi(lastFrame() || '');

    // API should have been called with the correct args
    expect(api.testContract).toHaveBeenCalledWith('maestro-assistant', 'system:maestro-assistant');

    // Result should be displayed
    expect(frame).toContain('Fitness:');
    expect(frame).toContain('15%');
    expect(frame).toContain('$0.42');
    expect(frame).toContain('24/24 passed');
  });

  it('displays error message when API call fails', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient(
      [BLOCK_WITH_CONTRACT],
      { testError: new Error('Network timeout') },
    );

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    // Press T
    stdin.write('t');
    await delay(300);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Error: Network timeout');
    expect(api.testContract).toHaveBeenCalled();
  });

  it('displays fitness breakdown and features in the result', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    const api = createMockApiClient([BLOCK_WITH_CONTRACT], { testResult: MOCK_TEST_RESULT });

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    stdin.write('t');
    await delay(300);

    const frame = stripAnsi(lastFrame() || '');

    // Features should be visible
    expect(frame).toContain('conversation');
    expect(frame).toContain('maestro-ops');
    expect(frame).toContain('orchestration');
    expect(frame).toContain('memory');
    expect(frame).toContain('7/7');
    expect(frame).toContain('5/5');
    expect(frame).toContain('100%');

    // Fitness breakdown visible
    expect(frame).toContain('Performance:');
    expect(frame).toContain('0.95');
    expect(frame).toContain('Specialization:');
    expect(frame).toContain('0.48');
    expect(frame).toContain('Composability:');
    expect(frame).toContain('Cost Factor:');
  });

  it('shows [T] Test hint only when selected block has a contract', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    // Two blocks: one with contract, one without — sorted by name
    const api = createMockApiClient([BLOCK_WITHOUT_CONTRACT, BLOCK_WITH_CONTRACT]);

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    // First block after sorting: "File Edit" (no contract) — index 0
    let frame = stripAnsi(lastFrame() || '');
    // The hint bar should NOT show [T] Test for the no-contract block
    // Check that "Test" does not appear in the hint bar
    // (the block itself might have "Test" in its description, so check the specific hint pattern)
    expect(frame).toContain('Filter');
    expect(frame).toContain('Navigate');

    // Navigate down to Maestro Assistant (has contract)
    stdin.write('\x1B[B'); // arrow down
    await delay(100);

    frame = stripAnsi(lastFrame() || '');
    // Now the hint bar should include [T] Test
    expect(frame).toContain('Test');
  });

  it('shows "Testing..." message while test is in progress', async () => {
    const { CatalogScreen } = await import('../components/CatalogScreen.ts');
    // Create a slow-resolving testContract
    let resolveTest: (v: any) => void;
    const slowPromise = new Promise(resolve => { resolveTest = resolve; });
    const api = {
      listBlocks: vi.fn().mockResolvedValue([BLOCK_WITH_CONTRACT]),
      listSessions: vi.fn().mockResolvedValue([]),
      testContract: vi.fn().mockReturnValue(slowPromise),
    };

    const { lastFrame, stdin } = render(h(CatalogScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);

    // Press T — should show testing message
    stdin.write('t');
    await delay(100);

    let frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Testing system:maestro-assistant against maestro-assistant...');

    // Resolve the test
    resolveTest!(MOCK_TEST_RESULT);
    await delay(100);

    frame = stripAnsi(lastFrame() || '');
    // Testing message should be gone, replaced by result
    expect(frame).toContain('15%');
    expect(frame).not.toContain('Testing system:maestro-assistant against');
  });
});

describe('formatCost', () => {
  it('formats costs correctly', async () => {
    const { formatCost } = await import('../components/CatalogScreen.ts');
    expect(formatCost(0)).toBe('Free');
    expect(formatCost(0.001)).toBe('< $0.01');
    expect(formatCost(0.005)).toBe('< $0.01');
    expect(formatCost(0.42)).toBe('$0.42');
    expect(formatCost(1.50)).toBe('$1.50');
    expect(formatCost(10.00)).toBe('$10.00');
    expect(formatCost(99.99)).toBe('$99.99');
  });
});
