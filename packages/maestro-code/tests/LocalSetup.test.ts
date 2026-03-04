/**
 * Tests for LocalSetup component in ProviderSetupScreen (Phase 49-A).
 * Verifies hardware-aware local provider setup flow.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// Mock hardware detection
vi.mock('../services/hardware-detect.ts', () => ({
  detectHardware: vi.fn().mockReturnValue({
    platform: 'win32-x64',
    cudaAvailable: true,
    gpuName: 'NVIDIA GeForce RTX 3060',
    vramMb: 12288,
    ramMb: 32768,
    cpuCores: 12,
    cpuModel: 'Intel Core i7-12700K',
    detectedAt: '2026-03-04T00:00:00.000Z',
  }),
  getRecommendedModels: vi.fn().mockReturnValue([
    { modelId: 'tinyllama-1.1b', name: 'TinyLlama 1.1B', category: 'general', sizeLabel: '~700MB', vramRequiredMb: 0, description: 'CPU-only', cpuOnly: true, slow: true },
    { modelId: 'phi-3-mini-4k', name: 'Phi-3 Mini 4K', category: 'general', sizeLabel: '~2.3GB', vramRequiredMb: 3000, description: 'Small model' },
    { modelId: 'codellama-7b-instruct', name: 'CodeLlama 7B Instruct', category: 'code', sizeLabel: '~4GB', vramRequiredMb: 5000, description: 'Code model' },
    { modelId: 'mistral-7b-instruct-v0.3', name: 'Mistral 7B Instruct', category: 'general', sizeLabel: '~4.5GB', vramRequiredMb: 6000, description: 'General model' },
    { modelId: 'codellama-13b-instruct', name: 'CodeLlama 13B Instruct', category: 'code', sizeLabel: '~8GB', vramRequiredMb: 10000, description: 'Larger code model' },
  ]),
  saveCapabilities: vi.fn(),
  loadCapabilities: vi.fn().mockReturnValue(null),
}));

describe('ProviderSetupScreen — Local Setup', () => {
  afterEach(() => cleanup());

  it('shows hardware detection results when local provider selected', async () => {
    const { ProviderSetupScreen } = await import('../components/ProviderSetupScreen.ts');
    const onComplete = vi.fn();

    const { lastFrame, stdin } = render(h(ProviderSetupScreen, {
      onComplete,
    }));

    await delay(100);

    // Select local provider (key 4)
    stdin.write('4');
    await delay(100);

    // Confirm selection
    stdin.write('\r');
    await delay(200);

    const frame = stripAnsi(lastFrame() || '');

    // Should show hardware info
    expect(frame).toContain('Local Provider Setup');
    expect(frame).toContain('Hardware Detected');
    expect(frame).toContain('NVIDIA GeForce RTX 3060');
  });

  it('shows recommended models based on hardware', async () => {
    const { ProviderSetupScreen } = await import('../components/ProviderSetupScreen.ts');
    const onComplete = vi.fn();

    const { lastFrame, stdin } = render(h(ProviderSetupScreen, {
      onComplete,
    }));

    await delay(100);
    stdin.write('4');
    await delay(100);
    stdin.write('\r');
    await delay(200);

    const frame = stripAnsi(lastFrame() || '');

    // Should show model recommendations
    expect(frame).toContain('Recommended Models');
    expect(frame).toContain('TinyLlama');
    expect(frame).toContain('Phi-3 Mini');
    expect(frame).toContain('CodeLlama 7B');
  });

  it('shows VRAM and RAM info', async () => {
    const { ProviderSetupScreen } = await import('../components/ProviderSetupScreen.ts');
    const onComplete = vi.fn();

    const { lastFrame, stdin } = render(h(ProviderSetupScreen, {
      onComplete,
    }));

    await delay(100);
    stdin.write('4');
    await delay(100);
    stdin.write('\r');
    await delay(200);

    const frame = stripAnsi(lastFrame() || '');

    // Should show VRAM (12.0 GB) and RAM (32.0 GB)
    expect(frame).toContain('12.0 GB');
    expect(frame).toContain('32.0 GB');
    expect(frame).toContain('12 cores');
  });

  it('completes setup on Enter with selected model', async () => {
    const { ProviderSetupScreen } = await import('../components/ProviderSetupScreen.ts');
    const onComplete = vi.fn();

    const { stdin } = render(h(ProviderSetupScreen, {
      onComplete,
    }));

    await delay(100);
    stdin.write('4');
    await delay(100);
    stdin.write('\r'); // Confirm provider selection
    await delay(200);
    stdin.write('\r'); // Confirm model selection

    await delay(100);

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        local: expect.objectContaining({
          url: 'http://localhost:8000',
          recommendedModel: 'tinyllama-1.1b', // First model is selected by default
        }),
      }),
    );
  });

  it('saves capabilities to disk', async () => {
    const { saveCapabilities } = await import('../services/hardware-detect.ts');
    const { ProviderSetupScreen } = await import('../components/ProviderSetupScreen.ts');

    const { stdin } = render(h(ProviderSetupScreen, {
      onComplete: vi.fn(),
    }));

    await delay(100);
    stdin.write('4');
    await delay(100);
    stdin.write('\r');
    await delay(200);

    // saveCapabilities should have been called during hardware detection
    expect(saveCapabilities).toHaveBeenCalled();
  });
});
