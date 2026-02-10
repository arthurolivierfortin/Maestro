const http = require('http');
const sessionId = process.argv[2] || 'cadcd213-6f12-4bff-bfc8-beb8b5281656';

http.get(`http://localhost:5000/api/sessions/${sessionId}`, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const d = JSON.parse(Buffer.concat(chunks).toString());
    const phases = d.variables._phases || [];
    console.log('=== Phase Status ===');
    phases.forEach(p => {
      const r = p.result || {};
      const f = r.fitness != null ? ` fitness=${r.fitness} iter=${r.iterations}` : '';
      const prog = p.progress ? ` progress=${p.progress}%` : '';
      console.log(`  ${p.id}: ${p.status}${f}${prog}`);
    });
    console.log('---');
    const ab = d.variables._activeBlock;
    if (ab) console.log(`activeBlock: ${ab.id} (${ab.status})`);
    const log = d.variables._executionLog || [];
    console.log(`\nLast 5 log entries:`);
    log.slice(-5).forEach(e => console.log(`  [${e.time}] ${e.level}: ${e.msg}`));
  });
}).on('error', e => console.error('Error:', e.message));
