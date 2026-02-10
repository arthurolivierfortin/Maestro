/**
 * Fitness Calculator Script
 * Implements the Maestro fitness formula:
 *
 * ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ
 *
 * Where:
 * - P = Performance (quality score normalized to 0-1)
 * - S = Specialization (P / TaskEntropy)
 * - W = Composability (success rate × retry penalty)
 * - C_norm = Normalized economic cost
 * - C_compute = Computational cost
 * - C_hw = Hardware requirements
 * - λ = Cost sensitivity exponent
 */

// Default configuration
const DEFAULT_CONFIG = {
  lambda: 0.3,
  weights: {
    performance: 1.0,
    specialization: 0.8,
    composability: 0.9
  },
  costFactors: {
    economic: { alpha: 0.4, beta: 0.3, gamma: 0.3 },
    compute: { paramsWeight: 0.5, flopsWeight: 0.5 },
    hardware: { vramWeight: 0.4, ramWeight: 0.3, gpuWeight: 0.3 }
  },
  thresholds: {
    S: 0.9,  // S-rank
    A: 0.7,  // A-rank
    B: 0.5,  // B-rank
    C: 0.3,  // C-rank
    D: 0.1   // D-rank, below is F
  }
};

// Default model profiles (can be overridden)
const MODEL_PROFILES = {
  'smollm2:135m': { params: 135e6, flops: 1e9, vram: 0.5, ram: 1, gpu: 0.1 },
  'smollm2:360m': { params: 360e6, flops: 2e9, vram: 1, ram: 2, gpu: 0.2 },
  'smollm2:1.7b': { params: 1.7e9, flops: 5e9, vram: 4, ram: 8, gpu: 0.5 },
  'llama3:8b': { params: 8e9, flops: 20e9, vram: 16, ram: 32, gpu: 1.0 },
  'llama3:70b': { params: 70e9, flops: 150e9, vram: 140, ram: 280, gpu: 4.0 },
  'mistral:7b': { params: 7e9, flops: 18e9, vram: 14, ram: 28, gpu: 0.9 },
  'mixtral:8x7b': { params: 46.7e9, flops: 100e9, vram: 96, ram: 192, gpu: 2.0 },
  'gpt-4': { params: 1.8e12, flops: 1e12, vram: 0, ram: 0, gpu: 0, isApi: true, costPerToken: 0.03 },
  'gpt-3.5-turbo': { params: 175e9, flops: 500e9, vram: 0, ram: 0, gpu: 0, isApi: true, costPerToken: 0.002 },
  'claude-3-opus': { params: 2e12, flops: 1.2e12, vram: 0, ram: 0, gpu: 0, isApi: true, costPerToken: 0.015 },
  'claude-3-sonnet': { params: 500e9, flops: 600e9, vram: 0, ram: 0, gpu: 0, isApi: true, costPerToken: 0.003 }
};

// Task entropy values (lower = more specialized)
const TASK_ENTROPY = {
  'general': 1.0,
  'coding': 0.7,
  'math': 0.6,
  'reasoning': 0.65,
  'creative': 0.75,
  'translation': 0.5,
  'summarization': 0.55,
  'qa': 0.6
};

function calculateFitness(inputs) {
  const { executionMetrics, modelId, taskType = 'general', configOverrides = {} } = inputs;

  // Merge config
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  // Get model profile
  const modelProfile = MODEL_PROFILES[modelId] || {
    params: 1e9,
    flops: 5e9,
    vram: 4,
    ram: 8,
    gpu: 0.5
  };

  // Get task entropy
  const taskEntropy = TASK_ENTROPY[taskType] || TASK_ENTROPY['general'];

  // Extract metrics
  const qualityScore = executionMetrics.qualityScore || 0;
  const successRate = executionMetrics.successRate || 1.0;
  const retryCount = executionMetrics.retryCount || 0;

  // Calculate P (Performance) - normalize to 0-1
  const P = Math.min(1.0, Math.max(0, qualityScore / 100));

  // Calculate S (Specialization) = P / TaskEntropy
  const S = P / taskEntropy;

  // Calculate W (Composability) = successRate × retryPenalty
  const retryPenalty = 1 / (1 + 0.1 * retryCount);
  const W = successRate * retryPenalty;

  // Calculate cost components
  const { alpha, beta, gamma } = config.costFactors.economic;

  // C_norm (normalized economic cost) - logarithmic scaling
  const baseCost = modelProfile.isApi
    ? modelProfile.costPerToken * 1000  // per 1K tokens
    : Math.log10(modelProfile.params + 1) * 0.01;  // local model
  const C_norm = Math.max(0.01, Math.log10(baseCost * 1000 + 1) / 10);

  // C_compute (computational cost)
  const C_compute = Math.log10(modelProfile.params + 1) * (modelProfile.flops / 1e9) / 1000;
  const C_compute_norm = Math.max(0.01, C_compute / 100);

  // C_hw (hardware requirements)
  const { vramWeight, ramWeight, gpuWeight } = config.costFactors.hardware;
  const C_hw = vramWeight * modelProfile.vram +
               ramWeight * modelProfile.ram +
               gpuWeight * modelProfile.gpu;
  const C_hw_norm = Math.max(0.01, C_hw / 100);

  // Calculate total cost factor
  const costFactor = Math.pow(C_norm * C_compute_norm * C_hw_norm, config.lambda);

  // Calculate total fitness
  const numerator = P * S * W;
  const totalFitness = numerator / Math.max(0.001, costFactor);

  // Normalize to 0-1 range (cap at reasonable max)
  const normalizedFitness = Math.min(1.0, totalFitness / 10);

  // Determine rank
  let rank;
  if (normalizedFitness >= config.thresholds.S) rank = 'S';
  else if (normalizedFitness >= config.thresholds.A) rank = 'A';
  else if (normalizedFitness >= config.thresholds.B) rank = 'B';
  else if (normalizedFitness >= config.thresholds.C) rank = 'C';
  else if (normalizedFitness >= config.thresholds.D) rank = 'D';
  else rank = 'F';

  // Generate interpretation
  const interpretation = generateInterpretation(normalizedFitness, rank, { P, S, W }, modelId, taskType);

  return {
    totalFitness: normalizedFitness,
    breakdown: {
      performance: P,
      specialization: S,
      composability: W,
      economicCost: C_norm,
      computeCost: C_compute_norm,
      hardwareCost: C_hw_norm,
      costFactor: costFactor
    },
    interpretation,
    rank,
    modelId,
    taskType
  };
}

function generateInterpretation(fitness, rank, components, modelId, taskType) {
  const { P, S, W } = components;

  let message = `Model ${modelId} achieved rank ${rank} (fitness: ${(fitness * 100).toFixed(1)}%) for ${taskType} tasks. `;

  if (P < 0.5) {
    message += 'Performance is below average - consider model fine-tuning. ';
  } else if (P > 0.8) {
    message += 'Excellent performance metrics. ';
  }

  if (S > 1.2) {
    message += 'Strong specialization for this task type. ';
  } else if (S < 0.8) {
    message += 'Model is generalist - specialization could improve fitness. ';
  }

  if (W < 0.7) {
    message += 'Composability issues detected - check retry rates. ';
  }

  return message.trim();
}

// Main execution
const inputs = JSON.parse(process.argv[2] || '{}');
const result = calculateFitness(inputs);
console.log(JSON.stringify(result, null, 2));
