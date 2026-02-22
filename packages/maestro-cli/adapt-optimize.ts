// @ts-nocheck
/**
 * Phase 39: maestro adapt + maestro optimize
 *
 * CLI-side orchestration for automatic workflow adaptation and block optimization.
 * Uses sandbox foundry (Phase 38) for reproducible fitness measurement.
 */

const fs = require('fs');
const path = require('path');
const { SandboxManager } = require('./sandbox-manager.ts');

// ── Types ───────────────────────────────────────────────────────

interface BlockManifest {
  blockId: string;
  blockType: string;
  model: string | null;
  planningModel: string | null;
  childBlocks: BlockManifest[];
}

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
  manifest: BlockManifest;
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

// ── Manifest Extraction ─────────────────────────────────────────

/**
 * Recursively extract model requirements from a block and its children.
 * Handles both atomic agents (config.model) and composite agents/workflows (config.nodes[].config.model + blockRef).
 */
async function extractManifest(blockId: string, client: any, visited = new Set<string>()): Promise<BlockManifest> {
  if (visited.has(blockId)) {
    return { blockId, blockType: 'ref', model: null, planningModel: null, childBlocks: [] };
  }
  visited.add(blockId);

  let block;
  try {
    block = await client.getBlock(blockId);
  } catch {
    return { blockId, blockType: 'unknown', model: null, planningModel: null, childBlocks: [] };
  }

  const config = block.config || {};
  const model = config.model || null;
  const planningModel = config.planningModel || null;
  const childBlocks: BlockManifest[] = [];

  // Composite: walk config.nodes for inline models and blockRefs
  const nodes = config.nodes || [];
  for (const node of nodes) {
    const nodeConfig = node.config || {};
    if (nodeConfig.model || nodeConfig.planningModel) {
      // Inline model override in a node
      childBlocks.push({
        blockId: node.blockRef || node.id || 'inline',
        blockType: 'node',
        model: nodeConfig.model || null,
        planningModel: nodeConfig.planningModel || null,
        childBlocks: [],
      });
    }
    // Recurse into blockRef
    if (node.blockRef && !visited.has(node.blockRef)) {
      const childManifest = await extractManifest(node.blockRef, client, visited);
      childBlocks.push(childManifest);
    }
    // Recurse into nested nodes (while, conditional, for-each)
    if (node.nodes) {
      for (const subNode of node.nodes) {
        if (subNode.blockRef && !visited.has(subNode.blockRef)) {
          childBlocks.push(await extractManifest(subNode.blockRef, client, visited));
        }
        // Handle conditional then/else
        if (subNode.then?.nodes) {
          for (const thenNode of subNode.then.nodes) {
            if (thenNode.blockRef && !visited.has(thenNode.blockRef)) {
              childBlocks.push(await extractManifest(thenNode.blockRef, client, visited));
            }
          }
        }
        if (subNode.else?.nodes) {
          for (const elseNode of subNode.else.nodes) {
            if (elseNode.blockRef && !visited.has(elseNode.blockRef)) {
              childBlocks.push(await extractManifest(elseNode.blockRef, client, visited));
            }
          }
        }
        // Nested sub-nodes (for-each, while bodies)
        if (subNode.nodes) {
          for (const deep of subNode.nodes) {
            if (deep.blockRef && !visited.has(deep.blockRef)) {
              childBlocks.push(await extractManifest(deep.blockRef, client, visited));
            }
          }
        }
      }
    }
    // Handle then/else at top level node
    if (node.then) {
      if (node.then.blockRef && !visited.has(node.then.blockRef)) {
        childBlocks.push(await extractManifest(node.then.blockRef, client, visited));
      }
      if (node.then.nodes) {
        for (const thenNode of node.then.nodes) {
          if (thenNode.blockRef && !visited.has(thenNode.blockRef)) {
            childBlocks.push(await extractManifest(thenNode.blockRef, client, visited));
          }
        }
      }
    }
    if (node.else) {
      if (node.else.blockRef && !visited.has(node.else.blockRef)) {
        childBlocks.push(await extractManifest(node.else.blockRef, client, visited));
      }
      if (node.else.nodes) {
        for (const elseNode of node.else.nodes) {
          if (elseNode.blockRef && !visited.has(elseNode.blockRef)) {
            childBlocks.push(await extractManifest(elseNode.blockRef, client, visited));
          }
        }
      }
    }
  }

  return {
    blockId,
    blockType: block.blockType || 'unknown',
    model,
    planningModel,
    childBlocks,
  };
}

/**
 * Flatten a manifest tree into a map of model → [blockIds].
 */
function flattenModels(manifest: BlockManifest): FlatModelMap {
  const map: FlatModelMap = {};

  function walk(m: BlockManifest) {
    if (m.model) {
      if (!map[m.model]) map[m.model] = [];
      if (!map[m.model].includes(m.blockId)) map[m.model].push(m.blockId);
    }
    if (m.planningModel) {
      if (!map[m.planningModel]) map[m.planningModel] = [];
      if (!map[m.planningModel].includes(m.blockId + ' (planning)')) map[m.planningModel].push(m.blockId + ' (planning)');
    }
    for (const child of m.childBlocks) {
      walk(child);
    }
  }

  walk(manifest);
  return map;
}

/**
 * Collect all unique block IDs that have a direct model reference (leaf blocks to test).
 */
function collectModelBlocks(manifest: BlockManifest): Array<{ blockId: string; model: string }> {
  const results: Array<{ blockId: string; model: string }> = [];
  const seen = new Set<string>();

  function walk(m: BlockManifest) {
    if (m.model && !seen.has(m.blockId) && m.blockType !== 'node') {
      seen.add(m.blockId);
      results.push({ blockId: m.blockId, model: m.model });
    }
    for (const child of m.childBlocks) walk(child);
  }

  walk(manifest);
  return results;
}

// ── Model Detection ─────────────────────────────────────────────

/**
 * Detect which models are available via LLM-Provider.
 */
async function detectModels(requiredModels: string[], client: any): Promise<ModelAvailability[]> {
  let availableModels: any[] = [];
  try {
    const response = await client.listLLMModels();
    availableModels = response?.models || response || [];
    if (!Array.isArray(availableModels)) availableModels = [];
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
async function getAllAvailableModels(client: any): Promise<any[]> {
  try {
    const response = await client.listLLMModels();
    const models = response?.models || response || [];
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
async function withBlockVariant(
  blockId: string,
  mutations: { [key: string]: any },
  client: any,
  fn: (variantId: string) => Promise<any>,
  options: { skipDiscovery?: boolean } = {}
): Promise<any> {
  // Fetch original block
  const original = await client.getBlock(blockId);
  const variantId = `${blockId}--variant-${Date.now()}`;

  // Deep clone and apply mutations
  const variant = JSON.parse(JSON.stringify(original));
  variant.id = variantId;
  variant.name = `${variant.name} (variant)`;

  for (const [key, value] of Object.entries(mutations)) {
    const parts = key.split('.');
    let target = variant;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
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
    throw new Error(`Failed to write variant block file: ${err.message}`);
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
  client: any,
  options: {
    checkpoints?: string;
    inputKey?: string;
    extraInputs?: { [key: string]: string };
    silent?: boolean;
  } = {}
): Promise<{ fitness: number; passed: number; total: number; duration: number; tokens: number; cost: number }> {
  const sandbox = new SandboxManager(process.cwd());
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
  let block;
  try {
    block = await client._fetch('GET', `/api/blocks/${blockId}`);
  } catch {
    throw new Error(`Block '${blockId}' not found`);
  }

  for (const cp of checkpoints) {
    let worktreePath: string | null = null;
    try {
      worktreePath = sandbox.provisionWorktree(sandboxId, cp.id);
      const inputs = { ...extraInputs, [inputKey]: worktreePath };
      const startTime = Date.now();

      let result;
      if (block.blockType === 'workflow') {
        result = await client.executeWorkflow(blockId, { inputs, workingDirectory: worktreePath });
      } else {
        result = await client._fetch('POST', `/api/blocks/${blockId}/execute`, {
          body: { inputs, workingDirectory: worktreePath }
        });
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
  client: any,
  c: any,
  options: {
    threshold?: number;
    checkpoints?: string;
    dryRun?: boolean;
    save?: boolean;
    jsonMode?: boolean;
    inputKey?: string;
    extraInputs?: { [key: string]: string };
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
  const manifest = await extractManifest(workflowId, client);
  const modelMap = flattenModels(manifest);
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
  const modelBlocks = collectModelBlocks(manifest);
  const substitutions: SubstitutionResult[] = [];

  if (modelBlocks.length === 0) {
    console.log(`\n  ${c.gray('No blocks with direct model references to substitute.')}\n`);
    return null;
  }

  // Find candidate models that differ from current ones
  console.log(`\n  ${c.bold('Testing Substitutions:')}\n`);

  for (const { blockId, model: originalModel } of modelBlocks) {
    // Find candidate models (available, different from original)
    const candidates = allModels.filter(m => {
      const mId = m.modelId || m.id;
      return mId && mId !== originalModel && !originalModel.startsWith(mId) && !mId.startsWith(originalModel);
    });

    if (candidates.length === 0) continue;

    for (const candidate of candidates.slice(0, 3)) { // Test up to 3 alternatives per block
      const candidateId = candidate.modelId || candidate.id;
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
        console.log(`${c.fail('ERROR')} ${c.gray(err.message?.substring(0, 50) || 'unknown')}`);
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
  client: any
): Promise<string> {
  const original = await client.getBlock(workflowId);
  const adapted = JSON.parse(JSON.stringify(original));
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

function applyOverridesToNodes(nodes: any[], overrides: { [blockId: string]: { model: string } }) {
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
  client: any,
  c: any,
  options: any
): Promise<OptimizationResult> {
  const block = await client.getBlock(blockId);
  const originalModel = block.config?.model;
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
    .filter(m => {
      const mId = m.modelId || m.id;
      return mId && mId !== originalModel && !originalModel.startsWith(mId) && !mId.startsWith(originalModel);
    })
    .sort((a, b) => {
      const costA = a.costPerMillionInputTokens || a.averageCostPerMillion || 999;
      const costB = b.costPerMillionInputTokens || b.averageCostPerMillion || 999;
      return costA - costB;
    });

  for (const model of sorted.slice(0, 5)) { // Test up to 5 models
    const modelId = model.modelId || model.id;
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

  const best = candidates.filter(c => c.accepted).sort((a, b) => b.fitness - a.fitness)[0] || null;

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
  client: any,
  c: any,
  options: any
): Promise<OptimizationResult> {
  const block = await client.getBlock(blockId);
  const originalModel = block.config?.model || 'unknown';
  const currentTemp = block.config?.temperature ?? 0;

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

  const best = candidates.filter(c => c.accepted).sort((a, b) => b.fitness - a.fitness)[0] || null;

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
  client: any,
  c: any,
  options: {
    strategy?: string;
    threshold?: number;
    recursive?: boolean;
    checkpoints?: string;
    save?: boolean;
    jsonMode?: boolean;
    inputKey?: string;
    extraInputs?: { [key: string]: string };
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
    // Recursive: extract manifest, sort bottom-up, optimize each
    const manifest = await extractManifest(blockId, client);
    const modelBlocks = collectModelBlocks(manifest);

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
        console.log(`    ${c.fail('ERROR')}: ${err.message}\n`);
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
  extractManifest,
  flattenModels,
  collectModelBlocks,
  detectModels,
  getAllAvailableModels,
  withBlockVariant,
  measureFitness,
  maestroAdapt,
  maestroOptimize,
  STRATEGIES,
};
