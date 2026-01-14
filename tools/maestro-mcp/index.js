#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch(e){ return null; } }

function runMockWorkflow(id, inputs) {
  const wfPath = path.join(__dirname, '../../blocks/workflows', id);
  if (!fs.existsSync(wfPath)) return { error: 'workflow not found' };
  const nodes = loadJson(path.join(wfPath, 'nodes.json')) || [];
  const result = {};
  for (const node of nodes) {
    const ref = node.blockRef;
    const parts = ref.split('/');
    const refPath = path.join(__dirname, '../../blocks', ...parts);
    const mock = loadJson(path.join(refPath, 'mock-response.json'));
    result[node.id] = mock || null;
  }
  return { workflow: id, inputs, result };
}

function handleRequest(req) {
  if (!req || !req.tool) return { error: 'invalid request' };
  if (req.tool === 'execute-workflow') {
    const workflowId = req.arguments && req.arguments.workflowId;
    const inputs = req.arguments && req.arguments.inputs || {};
    if (!workflowId) return { error: 'workflowId required' };
    return runMockWorkflow(workflowId, inputs);
  }
  return { error: 'unknown tool' };
}

// read lines from stdin
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', (line) => {
  try {
    const req = JSON.parse(line);
    const res = handleRequest(req);
    process.stdout.write(JSON.stringify(res) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: 'invalid json' }) + '\n');
  }
});
