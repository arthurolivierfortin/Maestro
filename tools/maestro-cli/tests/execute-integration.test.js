const { spawnSync } = require('child_process');
const path = require('path');

function run() {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const cli = path.join(repoRoot, 'tools', 'maestro-cli', 'index.js');
  const res = spawnSync('node', [cli, 'execute', 'commit-generator', '--mock'], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error('CLI exited with non-zero status', res.status, res.stderr);
    process.exit(4);
  }
  let out = res.stdout.trim();
  try {
    const obj = JSON.parse(out);
    if (!obj.workflow || obj.workflow !== 'commit-generator') {
      console.error('Unexpected workflow id in output', obj.workflow);
      process.exit(5);
    }
    if (!obj.describe && !obj['describe']) {
      // some older PoC used describe key
    }
  } catch (e) {
    console.error('Failed to parse CLI JSON output');
    console.error(out);
    process.exit(6);
  }
  console.log('execute-integration.test.js: OK');
}

if (require.main === module) run();
