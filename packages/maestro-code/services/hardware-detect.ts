/**
 * Hardware detection for maestro-code first-run flow.
 *
 * Detects GPU, VRAM, RAM, and CPU to recommend appropriate local models.
 * Runs client-side (no backend required) via system commands.
 */
import { execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface HardwareCapabilities {
  platform: string;
  cudaAvailable: boolean;
  gpuName: string | null;
  vramMb: number;
  ramMb: number;
  cpuCores: number;
  cpuModel: string;
  detectedAt: string;
}

export interface RecommendedModel {
  modelId: string;
  name: string;
  category: string;
  sizeLabel: string;
  vramRequiredMb: number;
  description: string;
  cpuOnly?: boolean;
  slow?: boolean;
}

/** Detect GPU via nvidia-smi. Returns null if no NVIDIA GPU. */
function detectNvidiaGpu(): { name: string; vramMb: number } | null {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits',
      { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).toString().trim();

    if (!output) return null;

    // Format: "NVIDIA GeForce RTX 4090, 24564"
    const firstLine = output.split('\n')[0];
    const parts = firstLine.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      return {
        name: parts[0],
        vramMb: parseInt(parts[1], 10) || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Detect hardware capabilities. Safe to call without any backend running. */
export function detectHardware(): HardwareCapabilities {
  const gpu = detectNvidiaGpu();
  const ramMb = Math.round(os.totalmem() / (1024 * 1024));

  return {
    platform: `${os.platform()}-${os.arch()}`,
    cudaAvailable: gpu !== null,
    gpuName: gpu?.name ?? null,
    vramMb: gpu?.vramMb ?? 0,
    ramMb,
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'Unknown',
    detectedAt: new Date().toISOString(),
  };
}

/** Models ordered by VRAM requirement, covering key categories. */
const MODEL_CATALOG: RecommendedModel[] = [
  // CPU-only option (always available)
  {
    modelId: 'tinyllama-1.1b',
    name: 'TinyLlama 1.1B',
    category: 'general',
    sizeLabel: '~700MB',
    vramRequiredMb: 0,
    description: 'Minimal model for CPU-only systems. Very slow (~2-5 tok/s).',
    cpuOnly: true,
    slow: true,
  },
  // 4GB VRAM
  {
    modelId: 'phi-3-mini-4k',
    name: 'Phi-3 Mini 4K',
    category: 'general',
    sizeLabel: '~2.3GB',
    vramRequiredMb: 3000,
    description: 'Small but capable. Good for code and reasoning.',
  },
  // 6GB VRAM
  {
    modelId: 'codellama-7b-instruct',
    name: 'CodeLlama 7B Instruct',
    category: 'code',
    sizeLabel: '~4GB',
    vramRequiredMb: 5000,
    description: 'Code-focused 7B model. Good for tool use and coding tasks.',
  },
  // 8GB VRAM
  {
    modelId: 'mistral-7b-instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    category: 'general',
    sizeLabel: '~4.5GB',
    vramRequiredMb: 6000,
    description: 'Strong general model. Good reasoning and instruction following.',
  },
  // 12GB+ VRAM
  {
    modelId: 'codellama-13b-instruct',
    name: 'CodeLlama 13B Instruct',
    category: 'code',
    sizeLabel: '~8GB',
    vramRequiredMb: 10000,
    description: 'Larger code model. Better accuracy for complex coding.',
  },
  // 16GB+ VRAM
  {
    modelId: 'mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B Instruct',
    category: 'general',
    sizeLabel: '~26GB',
    vramRequiredMb: 14000,
    description: 'MoE architecture. Near-GPT-4 quality on many tasks.',
  },
];

/** Get recommended models based on available VRAM (or RAM for CPU-only). */
export function getRecommendedModels(hw: HardwareCapabilities): RecommendedModel[] {
  const availableMb = hw.cudaAvailable ? hw.vramMb : hw.ramMb;

  return MODEL_CATALOG.filter(m => {
    if (m.cpuOnly) return true; // Always include CPU-only option
    if (!hw.cudaAvailable) return false; // Skip GPU models if no GPU
    return m.vramRequiredMb <= availableMb;
  });
}

/** Capabilities storage path. */
function capabilitiesPath(): string {
  const dir = path.join(os.homedir(), '.maestro');
  return path.join(dir, 'capabilities.json');
}

/** Save detected capabilities to ~/.maestro/capabilities.json */
export function saveCapabilities(hw: HardwareCapabilities): void {
  const filePath = capabilitiesPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(hw, null, 2), 'utf-8');
}

/** Load previously saved capabilities, or null if not found. */
export function loadCapabilities(): HardwareCapabilities | null {
  try {
    const data = fs.readFileSync(capabilitiesPath(), 'utf-8');
    return JSON.parse(data) as HardwareCapabilities;
  } catch {
    return null;
  }
}
