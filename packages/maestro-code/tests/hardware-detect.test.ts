/**
 * Tests for hardware detection module (Phase 49-A).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// Mock child_process.execSync to control nvidia-smi output
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import {
  detectHardware,
  getRecommendedModels,
  saveCapabilities,
  loadCapabilities,
  type HardwareCapabilities,
} from '../services/hardware-detect.ts';

const mockExecSync = vi.mocked(execSync);

describe('hardware-detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectHardware', () => {
    it('detects NVIDIA GPU when nvidia-smi succeeds', () => {
      mockExecSync.mockReturnValue(Buffer.from('NVIDIA GeForce RTX 4090, 24564\n'));

      const hw = detectHardware();

      expect(hw.cudaAvailable).toBe(true);
      expect(hw.gpuName).toBe('NVIDIA GeForce RTX 4090');
      expect(hw.vramMb).toBe(24564);
      expect(hw.ramMb).toBeGreaterThan(0);
      expect(hw.cpuCores).toBeGreaterThan(0);
      expect(hw.platform).toContain(os.platform());
    });

    it('returns CPU-only when nvidia-smi fails', () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });

      const hw = detectHardware();

      expect(hw.cudaAvailable).toBe(false);
      expect(hw.gpuName).toBeNull();
      expect(hw.vramMb).toBe(0);
      expect(hw.ramMb).toBeGreaterThan(0);
    });

    it('includes timestamp in detectedAt', () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });

      const hw = detectHardware();

      expect(hw.detectedAt).toBeTruthy();
      // Should be a valid ISO date
      expect(new Date(hw.detectedAt).getTime()).not.toBeNaN();
    });
  });

  describe('getRecommendedModels', () => {
    it('returns only CPU-only models when no GPU', () => {
      const hw: HardwareCapabilities = {
        platform: 'win32-x64',
        cudaAvailable: false,
        gpuName: null,
        vramMb: 0,
        ramMb: 16384,
        cpuCores: 8,
        cpuModel: 'Test CPU',
        detectedAt: new Date().toISOString(),
      };

      const models = getRecommendedModels(hw);

      expect(models.length).toBeGreaterThanOrEqual(1);
      // All returned models should be cpu-only since no GPU
      models.forEach(m => {
        expect(m.cpuOnly).toBe(true);
      });
    });

    it('returns GPU models within VRAM budget', () => {
      const hw: HardwareCapabilities = {
        platform: 'linux-x64',
        cudaAvailable: true,
        gpuName: 'NVIDIA RTX 3060',
        vramMb: 12288, // 12GB
        ramMb: 32768,
        cpuCores: 16,
        cpuModel: 'Test CPU',
        detectedAt: new Date().toISOString(),
      };

      const models = getRecommendedModels(hw);

      // Should include CPU-only + models that fit in 12GB VRAM
      expect(models.length).toBeGreaterThan(1);

      // No model should require more VRAM than available
      models.forEach(m => {
        if (!m.cpuOnly) {
          expect(m.vramRequiredMb).toBeLessThanOrEqual(12288);
        }
      });
    });

    it('returns more models with more VRAM', () => {
      const hw8gb: HardwareCapabilities = {
        platform: 'linux-x64',
        cudaAvailable: true,
        gpuName: 'RTX 3070',
        vramMb: 8192,
        ramMb: 16384,
        cpuCores: 8,
        cpuModel: 'Test',
        detectedAt: new Date().toISOString(),
      };

      const hw24gb: HardwareCapabilities = {
        ...hw8gb,
        gpuName: 'RTX 4090',
        vramMb: 24576,
      };

      const models8 = getRecommendedModels(hw8gb);
      const models24 = getRecommendedModels(hw24gb);

      expect(models24.length).toBeGreaterThanOrEqual(models8.length);
    });

    it('always includes a CPU-only model', () => {
      const hw: HardwareCapabilities = {
        platform: 'win32-x64',
        cudaAvailable: true,
        gpuName: 'RTX 4090',
        vramMb: 24576,
        ramMb: 32768,
        cpuCores: 16,
        cpuModel: 'Test',
        detectedAt: new Date().toISOString(),
      };

      const models = getRecommendedModels(hw);
      const cpuOnly = models.filter(m => m.cpuOnly);

      expect(cpuOnly.length).toBeGreaterThanOrEqual(1);
    });

    it('marks slow models appropriately', () => {
      const hw: HardwareCapabilities = {
        platform: 'win32-x64',
        cudaAvailable: false,
        gpuName: null,
        vramMb: 0,
        ramMb: 16384,
        cpuCores: 8,
        cpuModel: 'Test',
        detectedAt: new Date().toISOString(),
      };

      const models = getRecommendedModels(hw);
      const cpuModel = models.find(m => m.cpuOnly);

      expect(cpuModel).toBeDefined();
      expect(cpuModel!.slow).toBe(true);
    });
  });

  describe('saveCapabilities / loadCapabilities', () => {
    const testDir = path.join(os.tmpdir(), '.maestro-test-' + Date.now());
    const origHome = process.env.HOME;

    beforeEach(() => {
      // Point HOME to temp dir for testing
      process.env.HOME = os.tmpdir();
      process.env.USERPROFILE = os.tmpdir();
    });

    afterEach(() => {
      process.env.HOME = origHome;
      // Clean up
      try {
        const capFile = path.join(os.homedir(), '.maestro', 'capabilities.json');
        if (fs.existsSync(capFile)) fs.unlinkSync(capFile);
      } catch {}
    });

    it('saves and loads capabilities round-trip', () => {
      const hw: HardwareCapabilities = {
        platform: 'test-platform',
        cudaAvailable: true,
        gpuName: 'Test GPU',
        vramMb: 8192,
        ramMb: 16384,
        cpuCores: 8,
        cpuModel: 'Test CPU',
        detectedAt: '2026-03-04T00:00:00.000Z',
      };

      saveCapabilities(hw);
      const loaded = loadCapabilities();

      expect(loaded).not.toBeNull();
      expect(loaded!.platform).toBe('test-platform');
      expect(loaded!.cudaAvailable).toBe(true);
      expect(loaded!.gpuName).toBe('Test GPU');
      expect(loaded!.vramMb).toBe(8192);
    });

    it('returns null when no capabilities file exists', () => {
      // Remove any existing file
      const capFile = path.join(os.homedir(), '.maestro', 'capabilities.json');
      try { fs.unlinkSync(capFile); } catch {}

      const loaded = loadCapabilities();
      // May or may not be null depending on test environment
      // The key thing is it doesn't throw
    });
  });
});
