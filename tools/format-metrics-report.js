#!/usr/bin/env node
'use strict';

/**
 * format-metrics-report.js — Generic script to format _phaseMetrics JSON into markdown reports.
 *
 * Usage:
 *   node format-metrics-report.js <metrics-json-path> <output-dir>
 *
 * Reads the metrics JSON file (written by system:file-writer from _phaseMetrics),
 * generates per-phase .md files and a summary report.
 *
 * Auto-detects report mode:
 *   - If phases use DIFFERENT models → "Compliance Report" (model-focused)
 *   - If phases use the SAME model → "Training Report" (phase-focused)
 *
 * This script is invoked from a workflow node (system:shell) — NOT from the CLI.
 * The CLI stays generic; content-specific formatting lives here.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node format-metrics-report.js <metrics-json> <output-dir>');
  process.exit(1);
}

const metricsPath = args[0];
const outputDir = args[1];

if (!fs.existsSync(metricsPath)) {
  console.error(`Metrics file not found: ${metricsPath}`);
  process.exit(1);
}

// Read inputs
const phaseMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));

// Ensure output dir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build per-phase data
const phaseReports = [];

for (const [phaseId, phaseData] of Object.entries(phaseMetrics)) {
  if (typeof phaseData !== 'object' || !phaseData) continue;
  const iterations = phaseData.iterations || [];
  if (iterations.length === 0) continue;

  const modelId = phaseData.model || iterations[0]?.model || 'unknown';
  const phaseSlug = slugify(phaseId);

  const firstIter = iterations[0] || {};
  const lastIter = iterations[iterations.length - 1] || {};
  const coldStartMs = firstIter.totalMs || firstIter.inferenceMs || 0;
  const warmStartMs = iterations.length > 1 ? (lastIter.totalMs || lastIter.inferenceMs || 0) : coldStartMs;
  const totalPromptTokens = iterations.reduce((s, i) => s + (i.promptTokens || 0), 0);
  const totalCompletionTokens = iterations.reduce((s, i) => s + (i.completionTokens || 0), 0);
  const bestFitness = Math.max(...iterations.map(i => i.fitness || 0));
  const passed = bestFitness >= 0.85;

  const report = {
    phaseId, phaseSlug, modelId,
    iterations, coldStartMs, warmStartMs,
    totalPromptTokens, totalCompletionTokens,
    bestFitness, passed, iterationCount: iterations.length
  };
  phaseReports.push(report);

  // Write per-phase file
  const phaseMd = generatePhaseMarkdown(report);
  const phaseFile = path.join(outputDir, `phase-${phaseSlug}.md`);
  fs.writeFileSync(phaseFile, phaseMd, 'utf-8');
  console.log(`  Written: ${phaseFile}`);
}

// Auto-detect mode: compliance (multiple models) vs training (single model)
const uniqueModels = new Set(phaseReports.map(r => r.modelId));
const isComplianceMode = uniqueModels.size > 1;

// Write summary
const summaryMd = generateSummaryMarkdown(phaseReports, isComplianceMode);
const summaryName = isComplianceMode ? 'compliance-report.md' : 'training-report.md';
const summaryFile = path.join(outputDir, summaryName);
fs.writeFileSync(summaryFile, summaryMd, 'utf-8');
console.log(`  Written: ${summaryFile}`);

const mode = isComplianceMode ? 'compliance' : 'training';
console.log(`\nReport complete (${mode} mode): ${phaseReports.length} phase(s), ${phaseReports.filter(r => r.passed).length} passed.`);

// --- Helpers ---

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function stripCodeFences(text) {
  if (!text) return text;
  return text
    .replace(/^```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

// --- Per-Phase Report ---

function generatePhaseMarkdown(report) {
  const lines = [];
  const shortModel = report.modelId.includes('/') ? report.modelId.split('/').pop() : report.modelId;

  lines.push(`# Phase Report: ${report.phaseId}`);
  lines.push('');
  lines.push(`**Model**: \`${report.modelId}\``);
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
    lines.push(i === 0 ? `## Iteration 1 (Cold Start)` : `## Iteration ${i + 1}`);
    lines.push('');

    const totalMs = iter.totalMs || iter.inferenceMs || 0;
    const switchMs = iter.modelSwitchMs || 0;
    const inferMs = iter.inferenceMs || 0;
    lines.push(`- **Total Time**: ${totalMs}ms (model switch: ${switchMs}ms, inference: ${inferMs}ms)`);
    lines.push(`- **Tokens**: prompt=${iter.promptTokens || 0}, completion=${iter.completionTokens || 0}`);
    lines.push(`- **Fitness**: ${(iter.fitness || 0).toFixed(4)}`);
    lines.push(`- **Passed**: ${iter.passed ? 'Yes' : 'No'}`);

    if (iter.criteriaScores && typeof iter.criteriaScores === 'object') {
      lines.push('- **Criteria**:');
      for (const [k, v] of Object.entries(iter.criteriaScores)) {
        const icon = v >= 1.0 ? 'PASS' : v > 0 ? `${(v * 100).toFixed(0)}%` : 'FAIL';
        lines.push(`  - ${k}: ${v} (${icon})`);
      }
    }

    if (iter.systemPrompt) {
      lines.push('');
      lines.push('<details><summary><b>System Prompt</b></summary>');
      lines.push('');
      lines.push('```');
      lines.push(stripCodeFences(iter.systemPrompt));
      lines.push('```');
      lines.push('</details>');
    }

    if (iter.userPrompt) {
      lines.push('');
      lines.push('<details><summary><b>User Prompt</b></summary>');
      lines.push('');
      lines.push('```');
      lines.push(stripCodeFences(iter.userPrompt));
      lines.push('```');
      lines.push('</details>');
    }

    if (iter.fullResponse) {
      lines.push('');
      lines.push('**LLM Response**:');
      lines.push('```json');
      lines.push(stripCodeFences(iter.fullResponse));
      lines.push('```');
    }

    lines.push('');
  }

  return lines.join('\n');
}

// --- Summary Report ---

function generateSummaryMarkdown(reports, isCompliance) {
  const lines = [];
  const title = isCompliance
    ? 'LLM Structured Output Compliance Report'
    : 'Training Session Report';

  lines.push(`# ${title}`);
  lines.push('');
  lines.push('## Configuration');
  lines.push('');
  lines.push(`- **Phases**: ${reports.length}`);
  if (isCompliance) {
    lines.push(`- **Unique Models**: ${new Set(reports.map(r => r.modelId)).size}`);
  } else {
    lines.push(`- **Model**: \`${reports[0]?.modelId || 'unknown'}\``);
  }
  lines.push(`- **Generated**: ${new Date().toISOString()}`);
  lines.push('');

  // Results table
  lines.push('## Results Overview');
  lines.push('');

  if (isCompliance) {
    lines.push('| Phase | Model | Fitness | Cold Start | Warm Start | Prompt Tokens | Completion Tokens | Pass |');
    lines.push('|-------|-------|---------|------------|------------|---------------|-------------------|------|');
  } else {
    lines.push('| Phase | Fitness | Iterations | Cold Start | Warm Start | Prompt Tokens | Completion Tokens | Pass |');
    lines.push('|-------|---------|------------|------------|------------|---------------|-------------------|------|');
  }

  for (const r of reports) {
    const shortModel = r.modelId.includes('/') ? r.modelId.split('/').pop() : r.modelId;
    if (isCompliance) {
      lines.push(`| ${r.phaseId} | ${shortModel} | ${r.bestFitness.toFixed(4)} | ${r.coldStartMs}ms | ${r.warmStartMs}ms | ${r.totalPromptTokens} | ${r.totalCompletionTokens} | ${r.passed ? 'PASS' : 'FAIL'} |`);
    } else {
      lines.push(`| ${r.phaseId} | ${r.bestFitness.toFixed(4)} | ${r.iterationCount} | ${r.coldStartMs}ms | ${r.warmStartMs}ms | ${r.totalPromptTokens} | ${r.totalCompletionTokens} | ${r.passed ? 'PASS' : 'FAIL'} |`);
    }
  }
  lines.push('');

  // Timing analysis
  const sorted = [...reports].sort((a, b) => a.coldStartMs - b.coldStartMs);
  lines.push('## Timing Analysis');
  lines.push('');
  if (sorted.length > 0) {
    lines.push(`- **Fastest cold start**: ${sorted[0].phaseId} (${sorted[0].coldStartMs}ms)`);
    const warmSorted = [...reports].sort((a, b) => a.warmStartMs - b.warmStartMs);
    lines.push(`- **Fastest warm inference**: ${warmSorted[0].phaseId} (${warmSorted[0].warmStartMs}ms)`);
    const totalTime = reports.reduce((s, r) => s + r.coldStartMs, 0);
    lines.push(`- **Total execution time**: ${(totalTime / 1000).toFixed(1)}s`);
    const totalTokens = reports.reduce((s, r) => s + r.totalPromptTokens + r.totalCompletionTokens, 0);
    lines.push(`- **Total tokens**: ${totalTokens}`);
  }
  lines.push('');

  // Summary
  const passedPhases = reports.filter(r => r.passed);
  const failedPhases = reports.filter(r => !r.passed);

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Passed**: ${passedPhases.length}/${reports.length}`);
  lines.push(`- **Failed**: ${failedPhases.length}/${reports.length}`);
  lines.push('');

  if (passedPhases.length > 0) {
    lines.push('### Passed Phases');
    lines.push('');
    for (const r of passedPhases) {
      lines.push(`- **${r.phaseId}** (fitness: ${r.bestFitness.toFixed(4)}, iterations: ${r.iterationCount})`);
    }
    lines.push('');
  }

  if (failedPhases.length > 0) {
    lines.push('### Failed Phases');
    lines.push('');
    for (const r of failedPhases) {
      lines.push(`- **${r.phaseId}** (fitness: ${r.bestFitness.toFixed(4)})`);
    }
    lines.push('');
  }

  // Links to per-phase reports
  lines.push('## Per-Phase Details');
  lines.push('');
  for (const r of reports) {
    lines.push(`- [${r.phaseId}](phase-${r.phaseSlug}.md)`);
  }
  lines.push('');

  return lines.join('\n');
}
