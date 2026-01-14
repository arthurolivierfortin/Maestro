#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) { return null; }
}

function findWorkflow(id) {
  const wfPath = path.join(__dirname, '../../blocks/workflows', id);
  if (!fs.existsSync(wfPath)) return null;
  const block = loadJson(path.join(wfPath, 'block.json'));
  const nodes = loadJson(path.join(wfPath, 'nodes.json'));
  const conns = loadJson(path.join(wfPath, 'connections.json'));
  return { block, nodes, conns, path: wfPath };
}

function runMockWorkflow(id, inputs) {
  const wf = findWorkflow(id);
  if (!wf) { console.error('workflow not found:', id); process.exitCode = 2; return; }
  // simple implementation: run nodes in order and use mock-response.json from referenced blocks
  const result = {};
  for (const node of wf.nodes) {
    const ref = node.blockRef;
    const parts = ref.split('/');
    const kind = parts[0];
    const refPath = path.join(__dirname, '../../blocks', ...parts);
    const mock = loadJson(path.join(refPath, 'mock-response.json'));
    if (mock) {
      result[node.id] = mock;
    } else {
      result[node.id] = { message: null };
    }
  }
  // aggregate final output from the validate node if present
  const validateNode = wf.nodes.find(n => n.blockRef === 'validators/commit-format');
  const describeNode = wf.nodes.find(n => n.blockRef === 'inference/describe-commit');
  const gitDiffNode = wf.nodes.find(n => n.blockRef === 'tools/git-diff');
  const git = gitDiffNode && result[gitDiffNode.id] ? result[gitDiffNode.id] : { diff: '' };
  const described = describeNode && result[describeNode.id] ? result[describeNode.id] : null;
  const validated = validateNode && result[validateNode.id] ? result[validateNode.id] : null;

  const output = {
    workflow: id,
    inputs,
    git,
    describe: described,
    validate: validated
  };
  console.log(JSON.stringify(output, null, 2));
}

function listWorkflows() {
  const base = path.join(__dirname, '../../blocks/workflows');
  if (!fs.existsSync(base)) { console.log('No workflows found'); return; }
  const items = fs.readdirSync(base).filter(d => fs.existsSync(path.join(base, d, 'block.json')));
  for (const it of items) console.log(it);
}

function main() {
  const argv = minimist(process.argv.slice(2), { boolean: ['mock'] });
  const cmd = argv._[0];
  if (!cmd) { console.log('usage: maestro <command> [args]'); process.exit(1); }
  if (cmd === 'list') return listWorkflows();
  if (cmd === 'execute') {
    const wf = argv._[1];
    if (!wf) { console.error('workflow id required'); process.exit(1); }
    const inputs = {};
    if (argv.input) {
      // support multiple --input key=value
      const raw = Array.isArray(argv.input) ? argv.input : [argv.input];
      for (const kv of raw) {
        const [k,v] = kv.split('='); inputs[k] = v;
      }
    }
    if (argv.mock) runMockWorkflow(wf, inputs);
    else {
      console.error('Only --mock execution is supported by this CLI PoC');
      process.exit(1);
    }
    return;
  }
  console.error('unknown command', cmd);
  process.exit(1);
}

if (require.main === module) main();
