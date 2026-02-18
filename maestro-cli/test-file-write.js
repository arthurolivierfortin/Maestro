// Quick test: verify file-write works with --input-json
const { execSync } = require('child_process');

// Test 1: Direct API call to backend (bypass CLI parsing)
const http = require('http');
const path = 'C:\\\\temp\\\\ts-errors-test\\\\write-test.txt';
const content = 'hello from file-write test\\nline 2';

const body = JSON.stringify({
  inputs: { path: 'C:\\temp\\ts-errors-test\\write-test.txt', content: 'hello from file-write test\nline 2' },
  workingDirectory: 'C:\\temp\\ts-errors-test'
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/blocks/file-write/execute',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);

    // Check if file was created
    const fs = require('fs');
    const testPath = 'C:\\temp\\ts-errors-test\\write-test.txt';
    if (fs.existsSync(testPath)) {
      console.log(`File exists: ${testPath}`);
      console.log(`Content: ${fs.readFileSync(testPath, 'utf8')}`);
    } else {
      console.log('File NOT created');
    }
  });
});
req.on('error', (e) => console.error(`Error: ${e.message}`));
req.write(body);
req.end();
