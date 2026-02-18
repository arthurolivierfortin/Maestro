// Test file-write via CLI (simulating what an agent sends)
const { execSync } = require('child_process');

// This simulates what happens when the CLI receives --input-json
// The real test: can we use the `run` command with --input-json?

try {
  const result = execSync(
    'node index.js run file-write --input-json "{\\"path\\":\\"C:\\\\temp\\\\ts-errors-test\\\\write-test-cli.txt\\",\\"content\\":\\"hello from CLI test\\\\nsecond line\\"}"',
    { cwd: 'C:\\Meastro\\maestro-cli', encoding: 'utf8', timeout: 15000 }
  );
  console.log('CLI result:', result);
} catch (e) {
  console.log('CLI error:', e.stderr || e.stdout || e.message);
}

// Verify
const fs = require('fs');
const testPath = 'C:\\temp\\ts-errors-test\\write-test-cli.txt';
if (fs.existsSync(testPath)) {
  console.log('File exists:', testPath);
  console.log('Content:', fs.readFileSync(testPath, 'utf8'));
} else {
  console.log('File NOT created');
}
