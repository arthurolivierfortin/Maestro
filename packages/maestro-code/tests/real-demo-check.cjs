/**
 * REAL demo check — goes through App, exactly like startInteractive().
 * Tests the FULL path: App → HomeScreen (or SessionMonitor in demo mode)
 *
 * Phase 42: No more SpatialStatusBar/minimap/AgentPage. Now uses
 * monitor-style pages (Home, Spaces, Foundry, Catalog, Models)
 * with TaskInputBar and AgentPanel in SessionMonitor.
 */
require('tsx/cjs');

async function main() {
  const mod = await import('../App.ts');
  const { App, SessionManager } = mod;
  const { createElement: h } = await import('react');
  const { render } = await import('ink-testing-library');
  const fs = require('fs');

  function stripAnsi(str) {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  // Render App in demo mode — auto-starts and navigates to session detail
  const { lastFrame } = render(h(App, {
    apiClient: null,
    sessionManager: null,
    demoMode: true,
    noBell: true,
  }));

  // Log frames at key moments
  const timepoints = [
    [0, 'immediate'],
    [300, 'after mount effects'],
    [600, 'after auto-start'],
    [2500, 'after first poll'],
    [5000, 'mid-execution'],
    [8000, 'after completion'],
  ];

  let output = '';
  let totalWait = 0;

  for (const [wait, label] of timepoints) {
    const actualWait = wait - totalWait;
    if (actualWait > 0) await new Promise(r => setTimeout(r, actualWait));
    totalWait = wait;

    const frame = stripAnsi(lastFrame() || '');
    output += `\n========== ${label} (${wait}ms) ==========\n${frame}\n`;

    // Report errors
    const errLines = frame.split('\n').filter(l => /error/i.test(l));
    if (errLines.length) {
      console.log(`[${wait}ms] ${label}: ERRORS`);
      errLines.forEach(l => console.log('  !!', l.trim()));
    }

    // Key state indicators
    const hasTaskInput = frame.includes('Describe your task') || frame.includes('Send') || frame.includes('Press / to type');
    const hasDemoLabel = frame.includes('DEMO') || frame.includes('demo');
    const hasMonitorContent = frame.includes('Home') || frame.includes('SESSION') || frame.includes('session');
    console.log(`[${wait}ms] ${label}: taskInput=${hasTaskInput} demo=${hasDemoLabel} monitor=${hasMonitorContent}`);
  }

  fs.writeFileSync('C:/tmp/demo-frames-all.txt', output);

  // Final assertions
  const final = stripAnsi(lastFrame() || '');
  const checks = [
    ['TaskInputBar visible', final.includes('Press / to type') || final.includes('Describe your task') || final.includes('Send')],
    ['Demo mode active', final.includes('DEMO') || final.includes('demo')],
    ['No uncaught Error', !final.includes('Error:')],
    ['Module resolution works', true], // If we got this far, imports are fine
  ];

  console.log('\n--- CHECKS ---');
  let allPass = true;
  for (const [name, ok] of checks) {
    console.log(ok ? 'PASS' : 'FAIL', name);
    if (!ok) allPass = false;
  }

  if (!allPass) {
    console.log('\n--- FINAL FRAME ---');
    console.log(final.substring(0, 2000));
  }

  console.log('\nFrames: C:/tmp/demo-frames-all.txt');
  process.exit(allPass ? 0 : 1);
}

main().catch(e => {
  console.error('FATAL:', e.message, e.stack);
  process.exit(1);
});
