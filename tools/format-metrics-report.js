#!/usr/bin/env node
'use strict';

/**
 * format-metrics-report.js — Standalone script to format _phaseMetrics JSON into markdown reports.
 *
 * Usage:
 *   node format-metrics-report.js <metrics-json-path> <output-dir> [phases-json-path]
 *
 * Reads the metrics JSON file (written by system:file-writer from _phaseMetrics),
 * generates per-model .md files and a summary compliance-report.md.
 *
 * This script is invoked from a workflow node (system:shell) — NOT from the CLI.
 * The CLI stays generic; content-specific formatting lives here.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node format-metrics-report.js <metrics-json> <output-dir> [phases-json]');
  process.exit(1);
}

const metricsPath = args[0];
const outputDir = args[1];
const phasesPath = args[2] || null;

if (!fs.existsSync(metricsPath)) {
  console.error(`Metrics file not found: ${metricsPath}`);
  process.exit(1);
}

// Read inputs
const phaseMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
const phases = phasesPath && fs.existsSync(phasesPath)
  ? JSON.parse(fs.readFileSync(phasesPath, 'utf-8'))
  : [];

// Ensure output dir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build per-model data
const modelReports = [];

for (const [phaseId, phaseData] of Object.entries(phaseMetrics)) {
  if (typeof phaseData !== 'object' || !phaseData) continue;
  const iterations = phaseData.iterations || [];
  if (iterations.length === 0) continue;

  const modelId = phaseData.model || iterations[0]?.model || 'unknown';
  const modelSlug = slugifyModel(modelId);
  const phaseDef = Array.isArray(phases) ? phases.find(p => p.id === phaseId) : null;
  const phaseName = phaseDef?.name || phaseId;

  const firstIter = iterations[0] || {};
  const lastIter = iterations[iterations.length - 1] || {};
  const coldStartMs = firstIter.totalMs || firstIter.inferenceMs || 0;
  const warmStartMs = iterations.length > 1 ? (lastIter.totalMs || lastIter.inferenceMs || 0) : coldStartMs;
  const totalPromptTokens = iterations.reduce((s, i) => s + (i.promptTokens || 0), 0);
  const totalCompletionTokens = iterations.reduce((s, i) => s + (i.completionTokens || 0), 0);
  const bestFitness = Math.max(...iterations.map(i => i.fitness || 0));
  const passed = bestFitness >= 0.85;

  const report = {
    phaseId, phaseName, modelId, modelSlug,
    iterations, coldStartMs, warmStartMs,
    totalPromptTokens, totalCompletionTokens,
    bestFitness, passed, iterationCount: iterations.length
  };
  modelReports.push(report);

  // Write per-model file
  const modelMd = generateModelMarkdown(report);
  const modelFile = path.join(outputDir, `model-${modelSlug}.md`);
  fs.writeFileSync(modelFile, modelMd, 'utf-8');
  console.log(`  Written: ${modelFile}`);
}

// Write summary
const summaryMd = generateSummaryMarkdown(modelReports, phases);
const summaryFile = path.join(outputDir, 'compliance-report.md');
fs.writeFileSync(summaryFile, summaryMd, 'utf-8');
console.log(`  Written: ${summaryFile}`);

console.log(`\nReport complete: ${modelReports.length} model(s), ${modelReports.filter(r => r.passed).length} passed.`);

// --- Formatting functions ---

function slugifyModel(modelId) {
  const name = modelId.includes('/') ? modelId.split('/').pop() : modelId;
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function generateModelMarkdown(report) {
  const lines = [];
  lines.push(`# Model Report: ${report.phaseName}`);
  lines.push(`**Model ID**: \`${report.modelId}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Best Fitness | ${report.bestFitness.toFixed(4)} |`);
  lines.push(`| Iterations | ${report.iterationCount} |`);
  lines.push(`| Cold Start | ${report.coldStartMs}ms |`);
  lines.push(`| Warm Start | ${report.warmStartMs}ms |`);
  lines.push(`| Total Prompt Tokens | ${report.totalPromptTokens} |`);
  lines.push(`| Total Completion Tokens | ${report.totalCompletionTokens} |`);
  lines.push(`| Pass/Fail | ${report.passed ? 'PASS' : 'FAIL'} |`);
  lines.push('');

  for (let i = 0; i < report.iterations.length; i++) {
    const iter = report.iterations[i];
    const label = i === 0 ? 'Cold Start' : 'Warm Start';
    lines.push(`## Iteration ${i + 1} (${label})`);
    lines.push('');

    const totalMs = iter.totalMs || iter.inferenceMs || 0;
    const switchMs = iter.modelSwitchMs || 0;
    const inferMs = iter.inferenceMs || 0;
    lines.push(`- **Total Time**: ${totalMs}ms (model switch: ${switchMs}ms, inference: ${inferMs}ms)`);
    lines.push(`- **Tokens**: prompt=${iter.promptTokens || 0}, completion=${iter.completionTokens || 0}`);
    lines.push(`- **Fitness**: ${(iter.fitness || 0).toFixed(4)}`);
    lines.push(`- **Passed**: ${iter.passed ? 'Yes' : 'No'}`);

    if (iter.criteriaScores && typeof iter.criteriaScores === 'object') {
      const scores = Object.entries(iter.criteriaScores).map(([k, v]) => `${k}=${v}`).join(', ');
      lines.push(`- **Criteria**: ${scores}`);
    }

    if (iter.systemPrompt) {
      lines.push('');
      lines.push('**System Prompt**:');
      lines.push('```');
      lines.push(iter.systemPrompt);
      lines.push('```');
    }

    if (iter.userPrompt) {
      lines.push('');
      lines.push('**User Prompt**:');
      lines.push('```');
      lines.push(iter.userPrompt);
      lines.push('```');
    }

    if (iter.fullResponse) {
      lines.push('');
      lines.push('**Response**:');
      lines.push('```');
      lines.push(iter.fullResponse);
      lines.push('```');
    }

    lines.push('');
  }

  return lines.join('\n');
}

function generateSummaryMarkdown(modelReports, phases) {
  const lines = [];
  lines.push('# LLM Structured Output Compliance Report');
  lines.push('');
  lines.push('## Test Configuration');
  lines.push('');
  lines.push(`- **Models Tested**: ${modelReports.length}`);
  lines.push(`- **Generated**: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Results Overview');
  lines.push('');
  lines.push('| Model | Fitness | Cold Start | Warm Start | Prompt Tokens | Completion Tokens | Pass |');
  lines.push('|-------|---------|------------|------------|---------------|-------------------|------|');

  for (const r of modelReports) {
    const shortName = r.modelId.includes('/') ? r.modelId.split('/').pop() : r.modelId;
    lines.push(`| ${shortName} | ${r.bestFitness.toFixed(4)} | ${r.coldStartMs}ms | ${r.warmStartMs}ms | ${r.totalPromptTokens} | ${r.totalCompletionTokens} | ${r.passed ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');

  const sorted = [...modelReports].sort((a, b) => a.coldStartMs - b.coldStartMs);
  const passedModels = modelReports.filter(r => r.passed);
  const failedModels = modelReports.filter(r => !r.passed);

  lines.push('## Timing Analysis');
  lines.push('');
  if (sorted.length > 0) {
    lines.push(`- **Fastest cold start**: ${sorted[0].phaseName} (${sorted[0].coldStartMs}ms)`);
    const warmSorted = [...modelReports].sort((a, b) => a.warmStartMs - b.warmStartMs);
    lines.push(`- **Fastest warm inference**: ${warmSorted[0].phaseName} (${warmSorted[0].warmStartMs}ms)`);
    const avgOverhead = modelReports.reduce((s, r) => s + (r.coldStartMs - r.warmStartMs), 0) / modelReports.length;
    lines.push(`- **Average model loading overhead**: ${Math.round(avgOverhead)}ms (cold - warm)`);
  }
  lines.push('');

  lines.push('## Compliance Summary');
  lines.push('');
  lines.push(`- **Passed**: ${passedModels.length}/${modelReports.length}`);
  lines.push(`- **Failed**: ${failedModels.length}/${modelReports.length}`);
  lines.push('');

  if (passedModels.length > 0) {
    lines.push('### Passed Models');
    lines.push('');
    for (const r of passedModels) {
      lines.push(`- **${r.phaseName}** (fitness: ${r.bestFitness.toFixed(4)}, warm: ${r.warmStartMs}ms)`);
    }
    lines.push('');
  }

  if (failedModels.length > 0) {
    lines.push('### Failed Models');
    lines.push('');
    for (const r of failedModels) {
      lines.push(`- **${r.phaseName}** (fitness: ${r.bestFitness.toFixed(4)})`);
    }
    lines.push('');
  }

  lines.push('## Per-Model Details');
  lines.push('');
  for (const r of modelReports) {
    lines.push(`- [${r.phaseName}](model-${r.modelSlug}.md)`);
  }
  lines.push('');

  return lines.join('\n');
}
