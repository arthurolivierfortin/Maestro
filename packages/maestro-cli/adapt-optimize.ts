/**
 * Phase 39: maestro adapt + maestro optimize
 *
 * CLI-side orchestration for automatic workflow adaptation and block optimization.
 * Uses sandbox foundry (Phase 38) for reproducible fitness measurement.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import type { BlockDependencyManifest, DependencyValidationResult } from '@maestro/client';

const fs = require('fs');
const path = require('path');
const { SandboxManager } = require('./sandbox-manager.ts');

// ── Minimal type declarations for CJS imports ──────────────────

interface SandboxCheckpoint {
  id: string;
  description?: string;
  git_ref?: string;
}

interface SandboxImage {
  id: string;
  type: string;
  source_path: string;
  checkpoints: SandboxCheckpoint[];
}

interface SandboxManagerInstance {
  get(id: string): SandboxImage | null;
  provisionWorktree(sandboxId: string, checkpointId: string): string;
  destroyWorktree(sourceRepo: string, worktreePath: string): void;
}

/** Minimal API client interface used by adapt-optimize functions. */
interface AdaptClient {
  getBlock(id: string): Promise<Record<string, unknown>>;
  getBlockManifest(id: string): Promise<BlockDependencyManifest>;
  getBlockManifestModels(id: string): Promise<Record<string, string[]>>;
  validateBlock(id: string): Promise<DependencyValidationResult>;
  listLLMModels(): Promise<{ models?: LLMModelInfo[] } | LLMModelInfo[]>;
  executeWorkflow(id: string, opts: { inputs: Record<string, unknown>; workingDirectory: string }): Promise<ExecutionResult>;
  _fetch(method: string, path: string, options?: { body?: unknown }): Promise<Record<string, unknown>>;
}

interface LLMModelInfo {
  modelId?: string;
  id?: string;
  provider?: string;
  providerType?: string;
  isLocal?: boolean;
  parametersB?: number;
  parametersBillions?: number;
  costPerMillionInputTokens?: number;
  averageCostPerMillion?: number;
}

interface ExecutionResult {
  success: boolean;
  totalTokens?: number;
  estimatedCostUsd?: number;
  [key: string]: unknown;
}

/** CLI color utilities interface. */
interface CliColors {
  boldColor(color: string, text: string): string;
  bold(text: string): string;
  gray(text: string): string;
  ok(text: string): string;
  fail(text: string): string;
}

interface StrategyOptions {
  threshold?: number;
  checkpoints?: string;
  inputKey?: string;
  extraInputs?: Record<string, string>;
  [key: string]: unknown;
}

// ── Types ───────────────────────────────────────────────────────

interface FlatModelMap {
  [model: string]: string[]; // model → [blockId, blockId, ...]
}

interface ModelAvailability {
  modelId: string;
  available: boolean;
  provider?: string;
  isLocal?: boolean;
  parametersB?: number;
  costPerMillion?: number;
}

interface SubstitutionResult {
  blockId: string;
  originalModel: string;
  candidateModel: string;
  fitness: number;
  duration: number;
  accepted: boolean;
}

interface AdaptResult {
  workflowId: string;
  manifest: BlockDependencyManifest;
  availability: ModelAvailability[];
  substitutions: SubstitutionResult[];
  globalFitness: number;
  blockOverrides: { [blockId: string]: { model: string } };
}

interface OptimizationCandidate {
  label: string;
  fitness: number;
  delta: number;
  accepted: boolean;
  tokens?: number;
  cost?: number;
}

interface OptimizationResult {
  strategyId: string;
  blockId: string;
  originalModel: string;
  originalFitness: number;
  candidates: OptimizationCandidate[];
  bestCandidate: OptimizationCandidate | null;
}

// ── Manifest Helpers (backed by backend API via AdaptClient) ────

/**
 * Derive a list of { blockId, model } pairs from the manifestModels endpoint.
 * Inverts the model→blockIds map, excluding planning model entries.
 */
function modelMapToModelBlocks(modelMap: FlatModelMap): Array<{ blockId: string; model: string }> {
  const results: Array<{ blockId: string; model: string }> = [];
  const seen = new Set<string>();
  for (const [model, blockIds] of Object.entries(modelMap)) {
    for (const bid of blockIds) {
      // Skip planning model entries (e.g. "block-id (planning)")
      if (bid.endsWith(' (planning)')) continue;
      if (!seen.has(bid)) {
        seen.add(bid);
        results.push({ blockId: bid, model });
      }
    }
  }
  return results;
}

// ── Model Detection ─────────────────────────────────────────────

/**
 * Detect which models are available via LLM-Provider.
 */
async function detectModels(requiredModels: string[], client: AdaptClient): Promise<ModelAvailability[]> {
  let availableModels: LLMModelInfo[] = [];
  try {
    const response = await client.listLLMModels();
    const raw = Array.isArray(response) ? response : ((response as { models?: LLMModelInfo[] })?.models || []);
    availableModels = Array.isArray(raw) ? raw : [];
  } catch {
    // LLM-Provider not running — nothing available
  }

  return requiredModels.map(modelId => {
    // Exact match first
    let match = availableModels.find(m => m.modelId === modelId || m.id === modelId);
    // Fuzzy match: claude-sonnet matches claude-sonnet-4-6
    if (!match) {
      match = availableModels.find(m =>
        (m.modelId || m.id || '').startsWith(modelId) ||
        modelId.startsWith(m.modelId || m.id || '')
      );
    }
    return {
      modelId,
      available: !!match,
      provider: match?.provider || match?.providerType,
      isLocal: match?.isLocal ?? false,
      parametersB: match?.parametersB || match?.parametersBillions,
      costPerMillion: match?.costPerMillionInputTokens || match?.averageCostPerMillion,
    };
  });
}

/**
 * Get all available models from LLM-Provider (not filtered).
 */
async function getAllAvailableModels(client: AdaptClient): Promise<LLMModelInfo[]> {
  try {
    const response = await client.listLLMModels();
    const models = Array.isArray(response) ? response : ((response as { models?: LLMModelInfo[] })?.models || []);
    return Array.isArray(models) ? models : [];
  } catch {
    return [];
  }
}

// ── Block Variant Helper ────────────────────────────────────────

/**
 * Find the .block.json file for a given block ID by scanning the blocks root.
 */
function findBlockFile(blocksRoot: string, blockId: string): string | null {
  // Common naming patterns: <id>.block.json, <id>.agent.block.json, <id>.workflow.block.json, etc.
  function searchDir(dir: string): string | null {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = searchDir(fullPath);
        if (found) return found;
      } else if (entry.name.endsWith('.block.json')) {
        // Check if this file contains the target block ID
        if (entry.name.startsWith(blockId + '.') || entry.name.startsWith(blockId + '-')) {
          return fullPath;
        }
        // Also check by reading the file's id field for cases where filename doesn't match
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          if (content.id === blockId) return fullPath;
        } catch { /* skip unreadable files */ }
      }
    }
    return null;
  }
  return searchDir(blocksRoot);
}

/**
 * Find the blocks root directory (where FileSystemBlockDiscoveryService scans).
 * Checks common locations relative to the CLI package.
 */
function findBlocksRoot(): string {
  // Try Maestro repo root first
  const candidates = [
    path.resolve(__dirname, '../../content/system/blocks'),       // From packages/maestro-cli/
    path.resolve(__dirname, '../../../content/system/blocks'),     // Alternate depth
    'C:/Meastro/content/system/blocks',                           // Absolute fallback
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Cannot find blocks root directory. Ensure Maestro repo structure is intact.');
}

/**
 * Create a temporary block variant with modified config, run a function, then delete it.
 *
 * Uses filesystem-based block creation: writes a .block.json file to the blocks directory
 * where FileSystemBlockDiscoveryService will discover it. This is needed because the
 * backend API's block creation endpoint uses a request model that doesn't accept raw block JSON.
 *
 * After the function completes (or errors), the variant file is deleted.
 */
async function withBlockVariant<T>(
  blockId: string,
  mutations: Record<string, unknown>,
  client: AdaptClient,
  fn: (variantId: string) => Promise<T>,
  options: { skipDiscovery?: boolean } = {}
): Promise<T> {
  // Fetch original block
  const original = await client.getBlock(blockId);
  const variantId = `${blockId}--variant-${Date.now()}`;

  // Deep clone and apply mutations
  const variant: Record<string, any> = JSON.parse(JSON.stringify(original));
  variant.id = variantId;
  variant.name = `${variant.name} (variant)`;

  for (const [key, value] of Object.entries(mutations)) {
    const parts = key.split('.');
    let target: Record<string, any> = variant;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]] as Record<string, any>;
    }
    target[parts[parts.length - 1]] = value;
  }

  // Remove config.path from the variant: when the discovery service reads the variant JSON,
  // it deserializes string values as JsonElement (not native string). GetBlockPath checks
  // `p is string` which fails for JsonElement. By removing config.path, the discovery service
  // will inject a fresh native string path based on the file's actual directory.
  if (variant.config) delete variant.config.path;

  // Write variant in the same directory as the original block
  // so that companion files (system-prompt.md, etc.) are found by the executor.
  // The discovery service sets config.path = directory of the .block.json file,
  // so the variant must be co-located with the original.
  const blocksRoot = findBlocksRoot();
  let variantDir: string;

  // Find the original block's directory by searching for its .block.json file
  const originalFile = findBlockFile(blocksRoot, blockId);
  if (originalFile) {
    variantDir = path.dirname(originalFile);
  } else {
    // Fallback: use _variants dir (companion files won't work, but at least it runs)
    variantDir = path.join(blocksRoot, '_variants');
    fs.mkdirSync(variantDir, { recursive: true });
  }
  const variantFile = path.join(variantDir, `${variantId}.block.json`);

  try {
    fs.writeFileSync(variantFile, JSON.stringify(variant, null, 2));
  } catch (err) {
    throw new Error(`Failed to write variant block file: ${(err as Error).message}`);
  }

  // Wait for FileSystemWatcher to discover the new block file.
  // Poll the API until the block is discoverable (up to 5 seconds).
  // Skip in test mode (no backend running).
  if (!options.skipDiscovery) {
    let discovered = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        await client.getBlock(variantId);
        discovered = true;
        break;
      } catch { /* not yet discovered */ }
    }
    if (!discovered) {
      // Clean up and throw
      try { fs.unlinkSync(variantFile); } catch { /* ignore */ }
      throw new Error(`Variant block ${variantId} not discovered by backend after 5s`);
    }
  }

  // Run the test function
  try {
    const result = await fn(variantId);
    return result;
  } finally {
    // Always clean up the variant file
    try {
      fs.unlinkSync(variantFile);
    } catch { /* best effort cleanup */ }
    // Remove _variants dir if empty
    try {
      const remaining = fs.readdirSync(variantDir);
      if (remaining.length === 0) fs.rmdirSync(variantDir);
    } catch { /* ignore */ }
  }
}

// ── Batch Test (lightweight, reusable) ──────────────────────────

/**
 * Run a block against sandbox checkpoints and return fitness.
 * Lightweight version of batchTestBlock from cli.ts, designed for programmatic use.
 */
async function measureFitness(
  blockId: string,
  sandboxId: string,
  client: AdaptClient,
  options: {
    checkpoints?: string;
    inputKey?: string;
    extraInputs?: Record<string, string>;
    silent?: boolean;
  } = {}
): Promise<{ fitness: number; passed: number; total: number; duration: number; tokens: number; cost: number }> {
  const sandbox: SandboxManagerInstance = new SandboxManager(process.cwd());
  const image = sandbox.get(sandboxId);
  if (!image) throw new Error(`Sandbox '${sandboxId}' not found`);

  let checkpoints = image.checkpoints;
  if (options.checkpoints) {
    const ids = options.checkpoints.split(',');
    checkpoints = checkpoints.filter(cp => ids.includes(cp.id));
  }
  if (checkpoints.length === 0) throw new Error('No checkpoints to test');

  const inputKey = options.inputKey || 'repoPath';
  const extraInputs = options.extraInputs || {};

  let passed = 0;
  let totalDuration = 0;
  let totalTokens = 0;
  let totalCost = 0;

  // Fetch block to check type
  let block: Record<string, unknown>;
  try {
    block = await client._fetch('GET', `/api/blocks/${blockId}`);
  } catch {
    throw new Error(`Block '${blockId}' not found`);
  }

  for (const cp of checkpoints) {
    let worktreePath: string | null = null;
    try {
      worktreePath = sandbox.provisionWorktree(sandboxId, cp.id);
      const inputs: Record<string, unknown> = { ...extraInputs, [inputKey]: worktreePath };
      const startTime = Date.now();

      let result: ExecutionResult;
      if (block.blockType === 'workflow') {
        result = await client.executeWorkflow(blockId, { inputs, workingDirectory: worktreePath });
      } else {
        result = await client._fetch('POST', `/api/blocks/${blockId}/execute`, {
          body: { inputs, workingDirectory: worktreePath }
        }) as ExecutionResult;
      }

      const duration = Date.now() - startTime;
      totalDuration += duration;

      if (result.success) {
        passed++;
        totalTokens += result.totalTokens || 0;
        totalCost += result.estimatedCostUsd || 0;
      }
    } catch {
      // ERROR counts as failure
    } finally {
      if (worktreePath) {
        try { sandbox.destroyWorktree(image.source_path, worktreePath); } catch { /* best effort */ }
      }
    }
  }

  const fitness = checkpoints.length > 0 ? passed / checkpoints.length : 0;
  return { fitness, passed, total: checkpoints.length, duration: totalDuration, tokens: totalTokens, cost: totalCost };
}

// ── maestro adapt ───────────────────────────────────────────────

/**
 * Main adapt orchestration: extract manifest → detect models → test substitutions → generate tier.
 */
async function maestroAdapt(
  workflowId: string,
  sandboxId: string,
  client: AdaptClient,
  c: CliColors,
  options: {
    threshold?: number;
    checkpoints?: string;
    dryRun?: boolean;
    save?: boolean;
    jsonMode?: boolean;
    inputKey?: string;
    extraInputs?: Record<string, string>;
  } = {}
): Promise<AdaptResult | null> {
  const threshold = options.threshold ?? 0.80;

  // Step 1: Extract manifest
  console.log(`\n${c.boldColor('cyan', 'Maestro Adapt')}\n`);
  console.log(`  ${c.gray('Workflow:')}   ${workflowId}`);
  console.log(`  ${c.gray('Sandbox:')}    ${sandboxId}`);
  console.log(`  ${c.gray('Threshold:')}  ${(threshold * 100).toFixed(0)}%`);
  console.log('');

  process.stdout.write(`  ${c.gray('Extracting manifest...')} `);
  const manifest = await client.getBlockManifest(workflowId);
  const modelMap = await client.getBlockManifestModels(workflowId);
  const requiredModels = Object.keys(modelMap);
  console.log(c.ok('done'));

  // Step 2: Detect available models
  process.stdout.write(`  ${c.gray('Detecting models...')} `);
  const availability = await detectModels(requiredModels, client);
  console.log(c.ok('done'));

  // Step 3: Display manifest
  console.log(`\n  ${c.bold('Model Requirements:')}\n`);
  for (const [model, blocks] of Object.entries(modelMap)) {
    const avail = availability.find(a => a.modelId === model);
    const status = avail?.available ? c.ok('OK') : c.fail('--');
    const provider = avail?.provider ? ` (${avail.provider})` : '';
    console.log(`    ${status}  ${model}${provider}`);
    for (const b of blocks) {
      console.log(`        → ${c.gray(b)}`);
    }
  }

  // Get all available models for substitution candidates
  const allModels = await getAllAvailableModels(client);

  if (options.dryRun) {
    console.log(`\n  ${c.gray('(dry-run — no substitutions tested)')}\n`);
    return null;
  }

  // Step 4: Test substitutions
  const modelBlocks = modelMapToModelBlocks(modelMap);
  const substitutions: SubstitutionResult[] = [];

  if (modelBlocks.length === 0) {
    console.log(`\n  ${c.gray('No blocks with direct model references to substitute.')}\n`);
    return null;
  }

  // Find candidate models that differ from current ones
  console.log(`\n  ${c.bold('Testing Substitutions:')}\n`);

  for (const { blockId, model: originalModel } of modelBlocks) {
    // Find candidate models (available, different from original)
    const candidates = allModels.filter((m: LLMModelInfo) => {
      const mId = m.modelId || m.id || '';
      return mId && mId !== originalModel && !originalModel.startsWith(mId) && !mId.startsWith(originalModel);
    });

    if (candidates.length === 0) continue;

    for (const candidate of candidates.slice(0, 3)) { // Test up to 3 alternatives per block
      const candidateId = candidate.modelId || candidate.id || '';
      process.stdout.write(`    ${blockId.padEnd(24)} ${originalModel} → ${candidateId}... `);

      try {
        const startTime = Date.now();
        // Use model input override: ResolveModelId checks inputs["model"] first
        const result = await measureFitness(blockId, sandboxId, client, {
          checkpoints: options.checkpoints,
          inputKey: options.inputKey,
          extraInputs: { ...(options.extraInputs || {}), model: candidateId },
        });

        const duration = Date.now() - startTime;
        const accepted = result.fitness >= threshold;
        const fitnessStr = (result.fitness * 100).toFixed(0) + '%';

        if (accepted) {
          console.log(`fitness ${c.ok(fitnessStr)} (${c.ok('OK')}, substituting)`);
        } else {
          console.log(`fitness ${c.fail(fitnessStr)} (below ${(threshold * 100).toFixed(0)}%, keeping ${originalModel})`);
        }

        substitutions.push({
          blockId,
          originalModel,
          candidateModel: candidateId,
          fitness: result.fitness,
          duration,
          accepted,
        });

        // If this candidate was accepted, skip testing more for this block
        if (accepted) break;
      } catch (err) {
        console.log(`${c.fail('ERROR')} ${c.gray((err as Error).message?.substring(0, 50) || 'unknown')}`);
        substitutions.push({
          blockId,
          originalModel,
          candidateModel: candidateId,
          fitness: 0,
          duration: 0,
          accepted: false,
        });
      }
    }
  }

  // Step 5: Generate result
  const accepted = substitutions.filter(s => s.accepted);
  const blockOverrides: { [blockId: string]: { model: string } } = {};
  for (const s of accepted) {
    blockOverrides[s.blockId] = { model: s.candidateModel };
  }

  // Calculate global fitness (average of all tested blocks)
  const testedBlockIds = [...new Set(substitutions.map(s => s.blockId))];
  let globalFitness = 0;
  if (testedBlockIds.length > 0) {
    // For each block, use the best accepted substitute or original
    for (const bid of testedBlockIds) {
      const blockSubs = substitutions.filter(s => s.blockId === bid);
      const bestAccepted = blockSubs.filter(s => s.accepted).sort((a, b) => b.fitness - a.fitness)[0];
      globalFitness += bestAccepted ? bestAccepted.fitness : (blockSubs[0]?.fitness || 0);
    }
    globalFitness /= testedBlockIds.length;
  }

  // Step 6: Report
  console.log(`\n  ${c.bold('Result:')}`);
  console.log(`    ${c.gray('Blocks tested:')}  ${testedBlockIds.length}`);
  console.log(`    ${c.gray('Substitutions:')}  ${accepted.length}`);
  console.log(`    ${c.gray('Global fitness:')} ${(globalFitness * 100).toFixed(0)}%`);

  if (accepted.length > 0) {
    console.log(`\n    ${c.bold('Accepted substitutions:')}`);
    for (const s of accepted) {
      console.log(`      ${s.blockId}: ${s.originalModel} → ${c.ok(s.candidateModel)} (${(s.fitness * 100).toFixed(0)}%)`);
    }
  }

  const adaptResult: AdaptResult = {
    workflowId,
    manifest,
    availability,
    substitutions,
    globalFitness,
    blockOverrides,
  };

  // Step 7: Save adapted workflow if requested
  if (accepted.length > 0 && options.save) {
    const outputPath = await saveAdaptedWorkflow(workflowId, blockOverrides, client);
    console.log(`\n    ${c.ok('Saved:')} ${outputPath}`);
  }

  console.log('');
  return adaptResult;
}

/**
 * Save an adapted workflow with model overrides applied.
 */
async function saveAdaptedWorkflow(
  workflowId: string,
  overrides: { [blockId: string]: { model: string } },
  client: AdaptClient
): Promise<string> {
  const original = await client.getBlock(workflowId);
  const adapted: Record<string, any> = JSON.parse(JSON.stringify(original));
  adapted.id = `${workflowId}-adapted`;
  adapted.name = `${adapted.name} (Adapted)`;
  adapted.metadata = adapted.metadata || {};
  adapted.metadata.adaptedFrom = workflowId;
  adapted.metadata.adaptedAt = new Date().toISOString();
  adapted.metadata.tier = (adapted.metadata.tier || 1) + 1; // Bumped tier

  // Apply overrides to config.nodes
  if (adapted.config?.nodes) {
    applyOverridesToNodes(adapted.config.nodes, overrides);
  }

  // Write to file next to originals
  const blocksDir = path.join(process.cwd(), '.maestro', 'adapted');
  fs.mkdirSync(blocksDir, { recursive: true });
  const outputPath = path.join(blocksDir, `${adapted.id}.block.json`);
  fs.writeFileSync(outputPath, JSON.stringify(adapted, null, 2));
  return outputPath;
}

function applyOverridesToNodes(nodes: Record<string, any>[], overrides: { [blockId: string]: { model: string } }) {
  for (const node of nodes) {
    if (node.blockRef && overrides[node.blockRef]) {
      if (!node.config) node.config = {};
      node.config.model = overrides[node.blockRef].model;
    }
    if (node.nodes) applyOverridesToNodes(node.nodes, overrides);
    if (node.then?.nodes) applyOverridesToNodes(node.then.nodes, overrides);
    if (node.else?.nodes) applyOverridesToNodes(node.else.nodes, overrides);
  }
}

// ── maestro optimize ────────────────────────────────────────────

/**
 * Optimization strategies.
 */

async function strategyModelDowngrade(
  blockId: string,
  sandboxId: string,
  client: AdaptClient,
  c: CliColors,
  options: StrategyOptions
): Promise<OptimizationResult> {
  const block = await client.getBlock(blockId);
  const config = block.config as Record<string, unknown> | undefined;
  const originalModel = config?.model as string | undefined;
  if (!originalModel) {
    throw new Error(`Block '${blockId}' has no config.model — nothing to downgrade`);
  }

  // Get baseline fitness
  process.stdout.write(`    ${c.gray('Baseline')} (${originalModel})... `);
  const baseline = await measureFitness(blockId, sandboxId, client, {
    checkpoints: options.checkpoints,
    inputKey: options.inputKey,
    extraInputs: options.extraInputs,
  });
  console.log(`fitness ${(baseline.fitness * 100).toFixed(0)}%`);

  // Get all available models
  const allModels = await getAllAvailableModels(client);
  const candidates: OptimizationCandidate[] = [];
  const threshold = options.threshold ?? 0.80;

  // Sort models by cost (cheapest first), filter out current
  const sorted = allModels
    .filter((m: LLMModelInfo) => {
      const mId = m.modelId || m.id || '';
      return mId && mId !== originalModel && !originalModel.startsWith(mId) && !mId.startsWith(originalModel);
    })
    .sort((a: LLMModelInfo, b: LLMModelInfo) => {
      const costA = a.costPerMillionInputTokens || a.averageCostPerMillion || 999;
      const costB = b.costPerMillionInputTokens || b.averageCostPerMillion || 999;
      return costA - costB;
    });

  for (const model of sorted.slice(0, 5)) { // Test up to 5 models
    const modelId = model.modelId || model.id || '';
    process.stdout.write(`    ${c.gray('Testing')} ${modelId}... `);

    try {
      // Use model input override: ResolveModelId checks inputs["model"] first
      const result = await measureFitness(blockId, sandboxId, client, {
        checkpoints: options.checkpoints,
        inputKey: options.inputKey,
        extraInputs: { ...(options.extraInputs || {}), model: modelId },
      });

      const delta = result.fitness - baseline.fitness;
      const accepted = result.fitness >= threshold;
      const fitnessStr = (result.fitness * 100).toFixed(0) + '%';
      const deltaStr = `delta: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%`;

      if (accepted) {
        console.log(`fitness ${c.ok(fitnessStr)} (${deltaStr}) ${c.ok('OK')}`);
      } else {
        console.log(`fitness ${c.fail(fitnessStr)} (${deltaStr}) ${c.fail('FAIL')}`);
      }

      candidates.push({
        label: modelId,
        fitness: result.fitness,
        delta,
        accepted,
        tokens: result.tokens,
        cost: result.cost,
      });
    } catch (err) {
      console.log(`${c.fail('ERROR')} ${c.gray(err.message?.substring(0, 50) || 'unknown')}`);
      candidates.push({ label: modelId, fitness: 0, delta: -baseline.fitness, accepted: false });
    }
  }

  const best = candidates.filter(cand => cand.accepted).sort((a, b) => b.fitness - a.fitness)[0] || null;

  return {
    strategyId: 'model-downgrade',
    blockId,
    originalModel,
    originalFitness: baseline.fitness,
    candidates,
    bestCandidate: best,
  };
}

async function strategyTemperatureTuning(
  blockId: string,
  sandboxId: string,
  client: AdaptClient,
  c: CliColors,
  options: StrategyOptions
): Promise<OptimizationResult> {
  const block = await client.getBlock(blockId);
  const config = block.config as Record<string, unknown> | undefined;
  const originalModel = (config?.model as string) || 'unknown';
  const currentTemp = (config?.temperature as number) ?? 0;

  // Get baseline fitness
  process.stdout.write(`    ${c.gray('Baseline')} (temp=${currentTemp})... `);
  const baseline = await measureFitness(blockId, sandboxId, client, {
    checkpoints: options.checkpoints,
    inputKey: options.inputKey,
    extraInputs: options.extraInputs,
  });
  console.log(`fitness ${(baseline.fitness * 100).toFixed(0)}%`);

  const temperatures = [0.0, 0.2, 0.5, 0.7, 1.0].filter(t => t !== currentTemp);
  const candidates: OptimizationCandidate[] = [];
  const threshold = options.threshold ?? 0.80;

  for (const temp of temperatures) {
    process.stdout.write(`    ${c.gray('Testing')} temp=${temp}... `);

    try {
      const result = await withBlockVariant(
        blockId,
        { 'config.temperature': temp },
        client,
        async (variantId) => measureFitness(variantId, sandboxId, client, {
          checkpoints: options.checkpoints,
          inputKey: options.inputKey,
          extraInputs: options.extraInputs,
        })
      );

      const delta = result.fitness - baseline.fitness;
      const accepted = result.fitness >= threshold;
      const fitnessStr = (result.fitness * 100).toFixed(0) + '%';
      const deltaStr = `delta: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%`;

      if (accepted) {
        console.log(`fitness ${c.ok(fitnessStr)} (${deltaStr}) ${c.ok('OK')}`);
      } else {
        console.log(`fitness ${c.fail(fitnessStr)} (${deltaStr}) ${c.fail('FAIL')}`);
      }

      candidates.push({
        label: `temp=${temp}`,
        fitness: result.fitness,
        delta,
        accepted,
        tokens: result.tokens,
        cost: result.cost,
      });
    } catch (err) {
      console.log(`${c.fail('ERROR')} ${c.gray(err.message?.substring(0, 50) || 'unknown')}`);
      candidates.push({ label: `temp=${temp}`, fitness: 0, delta: -baseline.fitness, accepted: false });
    }
  }

  const best = candidates.filter(cand => cand.accepted).sort((a, b) => b.fitness - a.fitness)[0] || null;

  return {
    strategyId: 'temperature-tuning',
    blockId,
    originalModel,
    originalFitness: baseline.fitness,
    candidates,
    bestCandidate: best,
  };
}

const STRATEGIES: { [id: string]: typeof strategyModelDowngrade } = {
  'model-downgrade': strategyModelDowngrade,
  'temperature-tuning': strategyTemperatureTuning,
};

/**
 * Main optimize orchestration.
 */
async function maestroOptimize(
  blockId: string,
  sandboxId: string,
  client: AdaptClient,
  c: CliColors,
  options: {
    strategy?: string;
    threshold?: number;
    recursive?: boolean;
    checkpoints?: string;
    save?: boolean;
    jsonMode?: boolean;
    inputKey?: string;
    extraInputs?: Record<string, string>;
  } = {}
): Promise<OptimizationResult[]> {
  const strategyId = options.strategy || 'model-downgrade';
  const strategyFn = STRATEGIES[strategyId];
  if (!strategyFn) {
    throw new Error(`Unknown strategy '${strategyId}'. Available: ${Object.keys(STRATEGIES).join(', ')}`);
  }

  console.log(`\n${c.boldColor('cyan', 'Maestro Optimize')}\n`);
  console.log(`  ${c.gray('Block:')}      ${blockId}`);
  console.log(`  ${c.gray('Sandbox:')}    ${sandboxId}`);
  console.log(`  ${c.gray('Strategy:')}   ${strategyId}`);
  console.log(`  ${c.gray('Threshold:')}  ${((options.threshold ?? 0.80) * 100).toFixed(0)}%`);
  if (options.recursive) console.log(`  ${c.gray('Mode:')}       recursive`);
  console.log('');

  const results: OptimizationResult[] = [];

  if (options.recursive) {
    // Recursive: get model map from backend, derive model blocks
    const modelMap = await client.getBlockManifestModels(blockId);
    const modelBlocks = modelMapToModelBlocks(modelMap);

    if (modelBlocks.length === 0) {
      console.log(`  ${c.gray('No blocks with model references to optimize.')}\n`);
      return [];
    }

    console.log(`  ${c.bold(`Optimizing ${modelBlocks.length} blocks (bottom-up):`)}\n`);

    for (let i = 0; i < modelBlocks.length; i++) {
      const { blockId: bid, model } = modelBlocks[i];
      console.log(`  ${c.bold(`[${i + 1}/${modelBlocks.length}] ${bid}`)} (${model})\n`);

      try {
        const result = await strategyFn(bid, sandboxId, client, c, options);
        results.push(result);
      } catch (err) {
        console.log(`    ${c.fail('ERROR')}: ${(err as Error).message}\n`);
      }
    }
  } else {
    // Single block
    console.log(`  ${c.bold(`Optimizing ${blockId}:`)}\n`);
    const result = await strategyFn(blockId, sandboxId, client, c, options);
    results.push(result);
  }

  // Report summary
  console.log(`\n  ${c.bold('Summary:')}`);
  for (const r of results) {
    if (r.bestCandidate) {
      console.log(`    ${c.ok('+')} ${r.blockId}: ${r.originalModel} → ${c.ok(r.bestCandidate.label)} (fitness ${(r.bestCandidate.fitness * 100).toFixed(0)}%)`);
    } else {
      console.log(`    ${c.gray('-')} ${r.blockId}: ${r.originalModel} — no improvement found`);
    }
  }

  // Save if requested
  if (options.save) {
    const overrides: { [blockId: string]: { model: string } } = {};
    for (const r of results) {
      if (r.bestCandidate && r.strategyId === 'model-downgrade') {
        overrides[r.blockId] = { model: r.bestCandidate.label };
      }
    }
    if (Object.keys(overrides).length > 0) {
      // For single block, just report the recommendation
      console.log(`\n    ${c.bold('Recommended overrides:')}`);
      for (const [bid, o] of Object.entries(overrides)) {
        console.log(`      ${bid}: config.model = "${o.model}"`);
      }
    }
  }

  console.log('');
  return results;
}

// ── Exports ─────────────────────────────────────────────────────

module.exports = {
  modelMapToModelBlocks,
  detectModels,
  getAllAvailableModels,
  withBlockVariant,
  measureFitness,
  maestroAdapt,
  maestroOptimize,
  STRATEGIES,
};
