#!/usr/bin/env node
// code-analyzer.js — Analyzes a source file for structure, imports, exports, and patterns
// Input: CWD = project dir, filePath from env MAESTRO_INPUT_FILEPATH or argv[2]
// Output: JSON analysis to stdout

const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();
const filePath = process.env.MAESTRO_INPUT_FILEPATH || process.argv[2];

if (!filePath) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: 'No file path provided. Set MAESTRO_INPUT_FILEPATH or pass as argument.'
  }));
  process.exit(0);
}

const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);

if (!fs.existsSync(fullPath)) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: `File not found: ${fullPath}`,
    filePath
  }));
  process.exit(0);
}

const content = fs.readFileSync(fullPath, 'utf-8');
const lines = content.split('\n');
const ext = path.extname(fullPath).toLowerCase();

// ── Analysis ──

const analysis = {
  filePath: path.relative(projectDir, fullPath),
  fileName: path.basename(fullPath),
  extension: ext,
  language: detectLanguage(ext),
  lineCount: lines.length,
  blankLines: lines.filter(l => l.trim() === '').length,
  commentLines: 0,
  imports: [],
  exports: [],
  functions: [],
  classes: [],
  interfaces: [],
  types: [],
  variables: [],
  patterns: {}
};

// Language-specific analysis
if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
  analyzeTypeScript(content, lines, analysis);
} else if (['.cs'].includes(ext)) {
  analyzeCSharp(content, lines, analysis);
} else if (['.py'].includes(ext)) {
  analyzePython(content, lines, analysis);
} else if (['.json'].includes(ext)) {
  analyzeJson(content, analysis);
}

// General patterns
analysis.patterns.hasTests = /\b(describe|it|test|expect|assert)\b/.test(content);
analysis.patterns.hasAsync = /\basync\b/.test(content);
analysis.patterns.hasTypes = /\b(interface|type|enum)\b/.test(content);
analysis.patterns.hasJsx = /\b(React|jsx|tsx)\b/.test(content) || /<[A-Z]/.test(content);
analysis.patterns.hasErrorHandling = /\b(try|catch|throw|Error)\b/.test(content);

const output = {
  success: true,
  analysis,
  summary: buildSummary(analysis)
};

process.stdout.write(JSON.stringify(output));

// ── Helpers ──

function detectLanguage(ext) {
  const map = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.cs': 'csharp',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.json': 'json',
    '.md': 'markdown',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss',
    '.yaml': 'yaml', '.yml': 'yaml',
  };
  return map[ext] || 'unknown';
}

function analyzeTypeScript(content, lines, a) {
  // Imports
  const importRegex = /^import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/gm;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    a.imports.push(m[1]);
  }
  // Require imports
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  while ((m = requireRegex.exec(content)) !== null) {
    if (!a.imports.includes(m[1])) a.imports.push(m[1]);
  }

  // Exports
  const exportRegex = /^export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm;
  while ((m = exportRegex.exec(content)) !== null) {
    a.exports.push(m[1]);
  }

  // Functions
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/gm;
  while ((m = fnRegex.exec(content)) !== null) {
    const name = m[1] || m[2];
    if (name) a.functions.push(name);
  }

  // Classes
  const classRegex = /(?:export\s+)?class\s+(\w+)/gm;
  while ((m = classRegex.exec(content)) !== null) {
    a.classes.push(m[1]);
  }

  // Interfaces
  const ifaceRegex = /(?:export\s+)?interface\s+(\w+)/gm;
  while ((m = ifaceRegex.exec(content)) !== null) {
    a.interfaces.push(m[1]);
  }

  // Type aliases
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=/gm;
  while ((m = typeRegex.exec(content)) !== null) {
    a.types.push(m[1]);
  }

  // Comments
  a.commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
}

function analyzeCSharp(content, lines, a) {
  let m;
  // Using statements
  const usingRegex = /^using\s+([\w.]+);/gm;
  while ((m = usingRegex.exec(content)) !== null) {
    a.imports.push(m[1]);
  }

  // Classes
  const classRegex = /(?:public|private|internal|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
  while ((m = classRegex.exec(content)) !== null) {
    a.classes.push(m[1]);
  }

  // Interfaces
  const ifaceRegex = /(?:public|private|internal)?\s*interface\s+(I\w+)/gm;
  while ((m = ifaceRegex.exec(content)) !== null) {
    a.interfaces.push(m[1]);
  }

  // Methods
  const methodRegex = /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:Task<?\w*>?\s+|void\s+|string\s+|int\s+|bool\s+|\w+\s+)(\w+)\s*\(/gm;
  while ((m = methodRegex.exec(content)) !== null) {
    if (!['if', 'for', 'while', 'switch', 'catch', 'class', 'new'].includes(m[1])) {
      a.functions.push(m[1]);
    }
  }

  a.commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*|#)/.test(l)).length;
}

function analyzePython(content, lines, a) {
  let m;
  // Imports
  const importRegex = /^(?:from\s+([\w.]+)\s+)?import\s+([\w.*,\s]+)/gm;
  while ((m = importRegex.exec(content)) !== null) {
    a.imports.push(m[1] || m[2].trim());
  }

  // Functions
  const fnRegex = /^(?:async\s+)?def\s+(\w+)/gm;
  while ((m = fnRegex.exec(content)) !== null) {
    a.functions.push(m[1]);
  }

  // Classes
  const classRegex = /^class\s+(\w+)/gm;
  while ((m = classRegex.exec(content)) !== null) {
    a.classes.push(m[1]);
  }

  a.commentLines = lines.filter(l => /^\s*#/.test(l)).length;
}

function analyzeJson(content, a) {
  try {
    const obj = JSON.parse(content);
    a.patterns.jsonKeys = Object.keys(obj).slice(0, 20);
    a.patterns.jsonType = Array.isArray(obj) ? 'array' : typeof obj;
  } catch {
    a.patterns.jsonValid = false;
  }
}

function buildSummary(a) {
  const parts = [];
  parts.push(`${a.language} file, ${a.lineCount} lines`);
  if (a.imports.length) parts.push(`${a.imports.length} imports`);
  if (a.exports.length) parts.push(`${a.exports.length} exports`);
  if (a.functions.length) parts.push(`${a.functions.length} functions`);
  if (a.classes.length) parts.push(`${a.classes.length} classes`);
  if (a.interfaces.length) parts.push(`${a.interfaces.length} interfaces`);
  return parts.join(', ');
}
