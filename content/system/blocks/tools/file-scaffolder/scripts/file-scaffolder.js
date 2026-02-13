#!/usr/bin/env node
// file-scaffolder.js — Creates directory structures and files from a template
// Input: CWD = target directory (set via workingDir input)
// Reads template from stdin or from args
// Output: JSON with created files/dirs list

const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();

// Read template from command line args or env
// Template format: JSON with "structure" array
// Each entry: { "path": "relative/path", "type": "dir"|"file", "content": "optional content" }
let templateJson;

try {
  // Try reading from stdin (non-blocking)
  if (!process.stdin.isTTY) {
    templateJson = fs.readFileSync(0, 'utf-8').trim();
  }
} catch { /* no stdin */ }

// Fallback: check for SCAFFOLD_TEMPLATE env var
if (!templateJson) {
  templateJson = process.env.SCAFFOLD_TEMPLATE;
}

// Fallback: check for template file path as first argument
if (!templateJson && process.argv[2]) {
  const templatePath = path.resolve(process.argv[2]);
  if (fs.existsSync(templatePath)) {
    templateJson = fs.readFileSync(templatePath, 'utf-8');
  }
}

if (!templateJson) {
  const output = {
    success: false,
    error: 'No template provided. Pass via stdin, SCAFFOLD_TEMPLATE env var, or as file path argument.',
    created: [],
    targetDir
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

let template;
try {
  template = JSON.parse(templateJson);
} catch (e) {
  const output = {
    success: false,
    error: `Invalid JSON template: ${e.message}`,
    created: [],
    targetDir
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

const structure = template.structure || template.files || template;
if (!Array.isArray(structure)) {
  const output = {
    success: false,
    error: 'Template must have a "structure" or "files" array, or be an array directly.',
    created: [],
    targetDir
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

const created = [];
const errors = [];

for (const entry of structure) {
  const entryPath = path.join(targetDir, entry.path);
  const type = entry.type || (entry.path.endsWith('/') ? 'dir' : 'file');

  try {
    if (type === 'dir') {
      fs.mkdirSync(entryPath, { recursive: true });
      created.push({ path: entry.path, type: 'dir' });
    } else {
      // Ensure parent directory exists
      const parentDir = path.dirname(entryPath);
      fs.mkdirSync(parentDir, { recursive: true });

      const content = entry.content || '';
      fs.writeFileSync(entryPath, content, 'utf-8');
      created.push({ path: entry.path, type: 'file', size: Buffer.byteLength(content) });
    }
  } catch (e) {
    errors.push({ path: entry.path, error: e.message });
  }
}

const output = {
  success: errors.length === 0,
  created,
  errors: errors.length > 0 ? errors : undefined,
  totalFiles: created.filter(c => c.type === 'file').length,
  totalDirs: created.filter(c => c.type === 'dir').length,
  targetDir
};

process.stdout.write(JSON.stringify(output));
