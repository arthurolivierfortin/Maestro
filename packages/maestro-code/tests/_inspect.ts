/**
 * _inspect.ts — Let Claude visually inspect the TUI by capturing frames.
 * Temporary script. Navigates all pages, prints what the user would see.
 */
import { captureSequence } from './frame-capture.ts';
import type { KeystrokeStep } from './frame-capture.ts';

const steps: KeystrokeStep[] = [
  { key: 'h', label: 'Home', waitMs: 1500 },
  { key: 's', label: 'Spaces', waitMs: 1500 },
  { key: 'f', label: 'Foundry', waitMs: 1500 },
  { key: 'c', label: 'Catalog', waitMs: 1500 },
  { key: 'm', label: 'Models', waitMs: 1500 },
  { key: 'a', label: 'Agent (return)', waitMs: 1500 },
];

const labels = ['Agent (initial)', ...steps.map(s => s.label!)];

async function main() {
  console.log('Capturing all pages...\n');
  const cols = parseInt(process.argv[2] || '120', 10);
  const rows = parseInt(process.argv[3] || '40', 10);
  console.log(`Terminal size: ${cols}x${rows}\n`);
  const frames = await captureSequence(steps, { cols, rows, waitMs: 8000 });

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PAGE: ${labels[i]}  (${f.timestamp}ms)`);
    console.log('='.repeat(80));
    // Print only non-empty lines, trimmed
    const nonEmpty = f.lines.map(l => l.trimEnd()).filter(l => l.length > 0);
    for (const line of nonEmpty) {
      console.log(line);
    }
    console.log(`(${nonEmpty.length} lines)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
