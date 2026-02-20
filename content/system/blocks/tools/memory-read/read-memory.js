const fs = require('fs');
const path = require('path');

const file = process.env.MAESTRO_INPUT_FILE || '';
const topic = process.env.MAESTRO_INPUT_TOPIC || '';
const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || process.cwd();

const memoryDir = path.join(workingDir, '.maestro', 'memory');

if (!fs.existsSync(memoryDir)) {
  console.log(JSON.stringify({
    success: true,
    content: '',
    file: file || 'index.md',
    exists: false
  }));
  process.exit(0);
}

if (topic) {
  // Search across all .md files for the topic
  const results = [];
  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const content = fs.readFileSync(path.join(memoryDir, f), 'utf-8');
    if (content.toLowerCase().includes(topic.toLowerCase())) {
      // Extract the relevant section (lines around the match)
      const lines = content.split('\n');
      const matchLines = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(topic.toLowerCase())) {
          const start = Math.max(0, i - 2);
          const end = Math.min(lines.length, i + 5);
          matchLines.push(`[${f}:${i + 1}]\n${lines.slice(start, end).join('\n')}`);
        }
      }
      if (matchLines.length > 0) {
        results.push(matchLines.join('\n---\n'));
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    content: results.length > 0 ? results.join('\n\n===\n\n') : `No results found for topic '${topic}'`,
    file: `search:${topic}`,
    exists: true
  }));
} else {
  // Read specific file
  const fileName = file || 'index.md';
  const filePath = path.join(memoryDir, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({
      success: true,
      content: '',
      file: fileName,
      exists: false
    }));
  } else {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(JSON.stringify({
      success: true,
      content,
      file: fileName,
      exists: true
    }));
  }
}
