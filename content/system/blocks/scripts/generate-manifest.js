#!/usr/bin/env node
/**
 * generate-manifest.js
 *
 * Generates a publication manifest for a block.
 * Reads the block definition and (optionally) training metrics from a foundry session
 * to produce a structured manifest with model requirements, fitness scores, and substitutes.
 *
 * Usage:
 *   node generate-manifest.js --blockId <id> [--sessionId <id>] [--apiUrl <url>]
 *
 * Output: JSON manifest to stdout
 */

const http = require('http');
const path = require('path');

const args = process.argv.slice(2);
const blockId = getArg(args, '--blockId') || getArg(args, '--input-blockId');
const sessionId = getArg(args, '--sessionId') || getArg(args, '--input-sessionId');
const apiUrl = getArg(args, '--apiUrl') || 'http://localhost:5000';

function getArg(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse response from ${url}: ${data.substring(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  if (!blockId) {
    console.error(JSON.stringify({ error: 'Missing required --blockId argument' }));
    process.exit(1);
  }

  // 1. Fetch the block definition
  let block;
  try {
    block = await httpGet(`${apiUrl}/api/blocks/${blockId}`);
  } catch (e) {
    console.error(JSON.stringify({ error: `Failed to fetch block ${blockId}: ${e.message}` }));
    process.exit(1);
  }

  // 2. Extract model assignments from metadata or config.nodes
  const modelMap = {};
  if (block.metadata && block.metadata.models) {
    Object.assign(modelMap, block.metadata.models);
  } else if (block.config && block.config.nodes) {
    for (const node of block.config.nodes) {
      if (node.blockRef && node.inputs && node.inputs.model) {
        modelMap[node.blockRef] = node.inputs.model;
      }
    }
  }

  // 3. Group blocks by model
  const modelGroups = {};
  for (const [subBlock, model] of Object.entries(modelMap)) {
    if (!modelGroups[model]) modelGroups[model] = [];
    modelGroups[model].push(subBlock);
  }

  // 4. Build model requirements
  const modelRequirements = Object.entries(modelGroups).map(([modelId, usedBy]) => ({
    id: modelId,
    usedBy,
    substitutable: true,
    testedSubstitutes: []
  }));

  // 5. Fetch training metrics if session provided
  let fitnessPerBlock = {};
  let overallFitness = null;

  if (sessionId) {
    try {
      const session = await httpGet(`${apiUrl}/api/sessions/${sessionId}`);
      const vars = session.variables || {};

      // Read training metrics from session variables
      if (vars['training-metrics'] || vars['_trainingMetrics']) {
        const metrics = vars['training-metrics'] || vars['_trainingMetrics'];
        if (typeof metrics === 'object') {
          for (const [key, val] of Object.entries(metrics)) {
            if (val && typeof val === 'object' && val.fitness !== undefined) {
              fitnessPerBlock[key] = { fitness: val.fitness, model: val.model || modelMap[key] || 'unknown' };
            }
          }
        }
      }

      // Read overall fitness
      if (vars.currentFitness !== undefined) {
        overallFitness = parseFloat(vars.currentFitness);
      }
    } catch (e) {
      // Session metrics are optional — continue without them
    }
  }

  // 6. Merge existing manifest data if present
  const existingManifest = (block.metadata && block.metadata.manifest) || {};
  const existingModels = (existingManifest.requirements && existingManifest.requirements.models) || [];

  // Merge tested substitutes from existing manifest
  for (const req of modelRequirements) {
    const existing = existingModels.find(m => m.id === req.id);
    if (existing && existing.testedSubstitutes) {
      req.testedSubstitutes = existing.testedSubstitutes;
      req.substitutable = existing.substitutable;
    }
    if (existing && existing.reason) {
      req.reason = existing.reason;
    }
  }

  // 7. Build the manifest
  const manifest = {
    version: '1.0',
    publishedAt: new Date().toISOString(),
    blockId: blockId,
    tier: (block.metadata && block.metadata.tier) || null,
    qualityTarget: (block.metadata && block.metadata.qualityTarget) || null,
    requirements: {
      models: modelRequirements
    },
    fitness: {
      overall: overallFitness,
      qualityTarget: (block.metadata && block.metadata.qualityTarget) || null,
      perBlock: fitnessPerBlock
    },
    evaluationCriteria: (existingManifest.evaluationCriteria) || {},
    limitations: (existingManifest.limitations) || []
  };

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
