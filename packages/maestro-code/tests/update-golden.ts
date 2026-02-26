/**
 * Regenerate golden files for Visual Gate tests.
 *
 * Run: npx tsx tests/update-golden.ts
 *
 * Captures each page in demo mode and writes normalized golden files
 * to packages/maestro-code/testdata/. Commit these files to track
 * visual changes over time.
 *
 * Phase 43-B: Visual Gate
 */

import { captureFrame, captureSequence, normalizeFrame } from './frame-capture.ts';
import { writeGolden } from './golden-utils.ts';

async function main() {
  console.log('Capturing golden files for Visual Gate...\n');

  // 1. Agent page (initial demo render)
  console.log('  Capturing agent page (5s wait)...');
  const agentFrame = await captureFrame({ waitMs: 5000 });
  writeGolden('agent', normalizeFrame(agentFrame.text));
  const agentLines = agentFrame.lines.filter(l => l.trim()).length;
  console.log(`    Done: ${agentLines} non-empty lines`);

  // 2. Navigate to each page and capture
  console.log('  Capturing all pages via navigation...');
  const frames = await captureSequence(
    [
      { key: 'h', label: 'Home', waitMs: 1500 },
      { key: 's', label: 'Spaces', waitMs: 1500 },
      { key: 'f', label: 'Foundry', waitMs: 1500 },
      { key: 'c', label: 'Catalog', waitMs: 1500 },
      { key: 'm', label: 'Models', waitMs: 1500 },
    ],
    { waitMs: 5000 },
  );

  const pageNames = ['agent-nav', 'home', 'spaces', 'foundry', 'catalog', 'models'];
  for (let i = 0; i < frames.length; i++) {
    const nonEmpty = frames[i].lines.filter(l => l.trim()).length;
    writeGolden(pageNames[i], normalizeFrame(frames[i].text));
    console.log(`    ${pageNames[i]}: ${nonEmpty} non-empty lines`);
  }

  console.log('\nGolden files written to packages/maestro-code/testdata/');
  console.log('Commit these files to track visual changes.');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
