const fs = require('fs');
const path = require('path');

const file = process.env.MAESTRO_INPUT_FILE || '';
const content = process.env.MAESTRO_INPUT_CONTENT || '';
const mode = process.env.MAESTRO_INPUT_MODE || 'write';
const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || process.cwd();

if (!file) {
  console.log(JSON.stringify({ success: false, error: 'Missing required input: file', filePath: '', bytesWritten: 0 }));
  process.exit(0);
}

if (!content) {
  console.log(JSON.stringify({ success: false, error: 'Missing required input: content', filePath: '', bytesWritten: 0 }));
  process.exit(0);
}

const memoryDir = path.join(workingDir, '.maestro', 'memory');
const filePath = path.join(memoryDir, file);

try {
  // Ensure directory exists
  fs.mkdirSync(memoryDir, { recursive: true });

  if (mode === 'append') {
    // Add a newline separator before appending
    const separator = fs.existsSync(filePath) ? '\n\n' : '';
    fs.appendFileSync(filePath, separator + content, 'utf-8');
  } else {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  const bytesWritten = Buffer.byteLength(content, 'utf-8');
  console.log(JSON.stringify({
    success: true,
    filePath: path.resolve(filePath),
    bytesWritten
  }));
} catch (err) {
  console.log(JSON.stringify({ success: false, error: err.message, filePath: '', bytesWritten: 0 }));
}
