/**
 * Tests for ModelsScreen — MetricsPanel and QueuePanel (Phase 49-C).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text } from 'ink';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// Create a mock apiClient that returns test data
function createMockApiClient(overrides: Record<string, any> = {}) {
  return {
    getLLMHealth: vi.fn().mockResolvedValue(overrides.health ?? { status: 'ok', activeModel: 'test-model', device: 'cpu' }),
    listLLMModels: vi.fn().mockResolvedValue(overrides.models ?? []),
    getLLMStatus: vi.fn().mockResolvedValue(overrides.llmStatus ?? null),
    getLLMStats: vi.fn().mockResolvedValue(overrides.stats ?? null),
    getLLMQueueStats: vi.fn().mockResolvedValue(overrides.queue ?? null),
    listSessions: vi.fn().mockResolvedValue([]),
  };
}

describe('ModelsScreen', () => {
  afterEach(() => cleanup());

  it('renders METRICS panel', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({
      stats: {
        totalRequests: 150,
        totalErrors: 3,
        errorRate: 0.02,
        promptTokens: 5000,
        completionTokens: 3000,
        totalTokens: 8000,
        latencyP50Ms: 120,
        latencyP95Ms: 450,
        avgLatencyMs: 200,
      },
    });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('METRICS');
  });

  it('renders QUEUE panel', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({
      queue: {
        depth: 2,
        avgWaitMs: 50,
        totalEnqueued: 100,
        totalProcessed: 98,
      },
    });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('QUEUE');
  });

  it('shows metrics data when stats available', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({
      stats: {
        totalRequests: 250,
        totalErrors: 0,
        errorRate: 0,
        promptTokens: 10000,
        completionTokens: 5000,
        totalTokens: 15000,
        latencyP50Ms: 100,
        latencyP95Ms: 300,
        avgLatencyMs: 150,
      },
    });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('250');      // totalRequests
    expect(frame).toContain('15000');    // totalTokens
    expect(frame).toContain('100ms');    // p50
  });

  it('shows queue depth data', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({
      queue: {
        depth: 5,
        avgWaitMs: 120,
        totalEnqueued: 200,
        totalProcessed: 195,
      },
    });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('200');    // totalEnqueued
    expect(frame).toContain('195');    // totalProcessed
    expect(frame).toContain('120ms');  // avgWait
  });

  it('shows fallback when no metrics available', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({ stats: null, queue: null });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No metrics available');
    expect(frame).toContain('No queue data');
  });

  it('preserves AVAILABLE MODELS panel', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({
      models: [
        { modelId: 'model-a', name: 'Model A', category: 'general' },
        { modelId: 'model-b', name: 'Model B', category: 'code' },
      ],
    });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('AVAILABLE MODELS');
    expect(frame).toContain('Model A');
    expect(frame).toContain('Model B');
    expect(frame).toContain('2 model(s) available');
  });

  it('preserves MODEL STATUS panel', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient({
      health: { status: 'ok', activeModel: 'claude-sonnet', device: 'cuda' },
    });

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('MODEL STATUS');
    expect(frame).toContain('claude-sonnet');
  });

  it('preserves PROVIDERS panel', async () => {
    const { ModelsScreen } = await import('../components/ModelsScreen.ts');
    const api = createMockApiClient();

    const { lastFrame } = render(h(ModelsScreen, {
      apiClient: api,
      onNavigate: vi.fn(),
      onQuit: vi.fn(),
      chrome: false,
      providers: { claudeCode: { cliPath: '/usr/bin/claude' } },
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('PROVIDERS');
    expect(frame).toContain('Claude Code (CLI)');
  });
});
