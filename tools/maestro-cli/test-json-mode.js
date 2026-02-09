'use strict';
const { JsonInputParser } = require('./json-parser');
const { OutputFormatter } = require('./output-formatter');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

// ===== JsonInputParser Tests =====
console.log('\n=== JsonInputParser Tests ===');

test('parse health command', () => {
  const r = JsonInputParser.parse('{"command":"health"}');
  assert.deepStrictEqual(r._, ['health']);
  assert.strictEqual(r.json, true);
});

test('parse session.info with positional id', () => {
  const r = JsonInputParser.parse('{"command":"session.info","params":{"id":"abc123"}}');
  assert.strictEqual(r._[0], 'session');
  assert.strictEqual(r._[1], 'info');
  assert.strictEqual(r._[2], 'abc123');
  assert.strictEqual(r.json, true);
});

test('parse session.create with flags', () => {
  const r = JsonInputParser.parse('{"command":"session.create","params":{"project":"proj-1","name":"Test","authority":"ai:claude"}}');
  assert.strictEqual(r._[0], 'session');
  assert.strictEqual(r._[1], 'create');
  assert.strictEqual(r.project, 'proj-1');
  assert.strictEqual(r.name, 'Test');
  assert.strictEqual(r.authority, 'ai:claude');
});

test('parse session.vars.set with positional mapping', () => {
  const r = JsonInputParser.parse('{"command":"session.vars.set","params":{"id":"s1","key":"foo","value":"bar"}}');
  assert.strictEqual(r._[0], 'session');
  assert.strictEqual(r._[1], 'vars');
  assert.strictEqual(r._[2], 's1');
  assert.strictEqual(r._[4], 'foo');
  assert.strictEqual(r._[5], 'bar');
});

test('parse session.invoke with default entry point', () => {
  const r = JsonInputParser.parse('{"command":"session.invoke","params":{"id":"s1","entryPoint":"start"}}');
  assert.strictEqual(r._[0], 'session');
  assert.strictEqual(r._[1], 'invoke');
  assert.strictEqual(r._[2], 's1');
  assert.strictEqual(r._[3], 'start');
});

test('parse workspace.create with name', () => {
  const r = JsonInputParser.parse('{"command":"workspace.create","params":{"name":"MyWorkspace"}}');
  assert.strictEqual(r._[0], 'workspace');
  assert.strictEqual(r._[1], 'create');
  assert.strictEqual(r._[2], 'MyWorkspace');
});

test('parse with camelCase to kebab-case conversion', () => {
  const r = JsonInputParser.parse('{"command":"session.create","params":{"project":"p1","repoPath":"/my/repo"}}');
  assert.strictEqual(r['repo-path'], '/my/repo');
});

test('throws on invalid JSON', () => {
  assert.throws(() => JsonInputParser.parse('not json'), /Invalid JSON/);
});

test('throws on missing command', () => {
  assert.throws(() => JsonInputParser.parse('{"params":{}}'), /Missing required field/);
});

test('throws on non-object input', () => {
  assert.throws(() => JsonInputParser.parse('"hello"'), /must be an object/);
});

// ===== OutputFormatter Tests =====
console.log('\n=== OutputFormatter Tests ===');

test('JSON mode success outputs valid JSON', () => {
  const output = [];
  const original = process.stdout.write;
  process.stdout.write = (s) => { output.push(s); return true; };

  const fmt = new OutputFormatter(true);
  fmt.setCommand('health');
  fmt.success({ status: 'ok' }, 'All good');

  process.stdout.write = original;

  const parsed = JSON.parse(output[0]);
  assert.strictEqual(parsed.status, 'ok');
  assert.deepStrictEqual(parsed.data, { status: 'ok' });
  assert.strictEqual(parsed.command, 'health');
  assert.strictEqual(parsed.message, 'All good');
});

test('JSON mode error outputs valid JSON', () => {
  const output = [];
  const original = process.stdout.write;
  process.stdout.write = (s) => { output.push(s); return true; };

  const fmt = new OutputFormatter(true);
  fmt.setCommand('test');
  fmt.error('Not found', 'NOT_FOUND', 'Details');

  process.stdout.write = original;

  const parsed = JSON.parse(output[0]);
  assert.strictEqual(parsed.status, 'error');
  assert.strictEqual(parsed.code, 'NOT_FOUND');
  assert.strictEqual(parsed.message, 'Not found');
  assert.strictEqual(parsed.details, 'Details');
});

test('JSON mode table outputs array data', () => {
  const output = [];
  const original = process.stdout.write;
  process.stdout.write = (s) => { output.push(s); return true; };

  const fmt = new OutputFormatter(true);
  fmt.setCommand('session.list');
  fmt.table([{ id: '1' }, { id: '2' }], 'Sessions');

  process.stdout.write = original;

  const parsed = JSON.parse(output[0]);
  assert.strictEqual(parsed.status, 'ok');
  assert.strictEqual(parsed.data.length, 2);
});

test('text mode success prints message', () => {
  // Just verify no error
  const fmt = new OutputFormatter(false);
  fmt.setCommand('health');
  fmt.success({ status: 'ok' }, 'All good');
});

test('formatter preserves command through calls', () => {
  const output = [];
  const original = process.stdout.write;
  process.stdout.write = (s) => { output.push(s); return true; };

  const fmt = new OutputFormatter(true);
  fmt.setCommand('session.info');
  fmt.success({ id: '123' });
  fmt.setCommand('session.list');
  fmt.success([]);

  process.stdout.write = original;

  const p1 = JSON.parse(output[0]);
  const p2 = JSON.parse(output[1]);
  assert.strictEqual(p1.command, 'session.info');
  assert.strictEqual(p2.command, 'session.list');
});

// ===== Summary =====
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
