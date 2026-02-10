const assert = require('assert');
const cp = require('child_process');

describe('maestro MCP (integration)', function() {
  this.timeout(10000);

  it('mcp list-workflows tool should respond', () => {
    const input = JSON.stringify({ tool: 'list-workflows' }) + '\n';
    const out = cp.spawnSync('node', ['maestro-mcp/index.js'], { input, encoding: 'utf8' });
    assert.strictEqual(out.status, 0);
    assert.ok(out.stdout.includes('commit-generator') || out.stdout.length > 0);
  });

  it('mcp get-workflow should respond', () => {
    const input = JSON.stringify({ tool: 'get-workflow', arguments: { workflowId: 'commit-generator' } }) + '\n';
    const out = cp.spawnSync('node', ['maestro-mcp/index.js'], { input, encoding: 'utf8' });
    assert.strictEqual(out.status, 0);
    assert.ok(out.stdout.length > 0);
  });
});