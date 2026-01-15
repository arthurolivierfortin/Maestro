const assert = require('assert');
const cp = require('child_process');

describe('maestro CLI (integration)', function() {
  this.timeout(10000);

  it('maestro list should return workflows', () => {
    const out = cp.spawnSync('node', ['tools/maestro-cli/index.js', 'list'], { encoding: 'utf8' });
    assert.strictEqual(out.status, 0);
    assert.ok(out.stdout.includes('commit-generator') || out.stdout.length > 0);
  });

  it('maestro execute commit-generator --mock should run', () => {
    const out = cp.spawnSync('node', ['tools/maestro-cli/index.js', 'execute', 'commit-generator', '--mock'], { encoding: 'utf8' });
    assert.strictEqual(out.status, 0);
    assert.ok(out.stdout.length > 0);
  });
});