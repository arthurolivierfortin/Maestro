// Quick diagnostic: check what the API returns vs what's on disk
const http = require('http');
const path = require('path');
const fs = require('fs');

const globalBlocksPath = 'C:\\Meastro\\content\\system\\blocks';

// Count files on disk
function countFiles(dir, pattern) {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const fullPath = path.join(e.parentPath || e.path || dir, e.name);
      if (fullPath.endsWith(pattern)) count++;
    }
  } catch(err) { console.log('  Error:', err.message); }
  return count;
}

console.log('=== Block Discovery Diagnostic ===\n');
console.log('Files on disk:');
const blockFiles = countFiles(globalBlocksPath, '.block.json');
const toolFiles = countFiles(globalBlocksPath, '.tool.json');
console.log(`  ${globalBlocksPath}: ${blockFiles} .block.json, ${toolFiles} .tool.json`);

// Check subfolders
['tools', 'agents', 'workflows', 'system', 'inference', 'context'].forEach(sub => {
  const subPath = path.join(globalBlocksPath, sub);
  if (fs.existsSync(subPath)) {
    const n = countFiles(subPath, '.block.json');
    console.log(`    ${sub}/: ${n} .block.json files`);
  }
});

// Query API
console.log('\nAPI /api/blocks:');
http.get('http://localhost:5000/api/blocks', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const blocks = JSON.parse(data);
      console.log(`  Total: ${blocks.length} blocks`);
      // Group by source
      const bySource = {};
      blocks.forEach(b => {
        const src = (b.metadata?._sourcePath || 'unknown').replace(/\\[^\\]+$/, '');
        bySource[src] = (bySource[src] || 0) + 1;
      });
      console.log('  By source directory:');
      Object.entries(bySource).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
    } catch(e) { console.log('  Parse error:', e.message); }
  });
}).on('error', e => console.log('  API error:', e.message));
