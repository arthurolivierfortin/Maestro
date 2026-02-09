const http = require('http');
const sid = process.argv[2];
http.get(`http://localhost:5000/api/sessions/${sid}`, res => {
  const c = [];
  res.on('data', d => c.push(d));
  res.on('end', () => {
    const d = JSON.parse(Buffer.concat(c).toString());
    const bo = d.variables._blockOutputs || {};

    console.log('=== LLM Output ===');
    const gen = bo['generate-structured-output'];
    if (gen) console.log(gen.output || 'N/A');

    console.log('\n=== Write Node Output ===');
    const wr = bo['apply-result'];
    if (wr) console.log(wr.output || 'N/A');

    console.log('\n=== Validation ===');
    const v = bo['validation'];
    if (v) {
      console.log('score:', v.totalScore);
      console.log('criteria:', JSON.stringify(v.criteriaScores));
    }

    console.log('\n=== Artifacts ===');
    const arts = d.variables._artifacts || [];
    arts.forEach(a => console.log(`  ${a.name} (${a.size}) - ${a.status}`));
  });
}).on('error', e => console.error(e.message));
