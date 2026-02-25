/**
 * REAL demo check — goes through RootApp, exactly like startInteractive().
 * Tests the FULL path: RootApp → SplashScreen → InteractiveApp → AgentPage
 */
require('tsx/cjs');

async function main() {
  // Import exactly what startInteractive uses
  const mod = await import('../App.ts');
  const { InteractiveApp, SessionManager } = mod;
  const { createElement: h } = await import('react');
  const { render } = await import('ink-testing-library');
  const fs = require('fs');

  function stripAnsi(str) {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  const realApiClient = {
    _fetch: async (method, path) => {
      if (path === '/api/health') throw new Error('Backend not running');
      throw new Error('Backend not running');
    },
    getSession: async () => { throw new Error('Backend not running'); },
    createSession: async () => { throw new Error('Backend not running'); },
    startSession: async () => { throw new Error('Backend not running'); },
  };

  const realSessionManager = new SessionManager({
    apiClient: realApiClient,
    repoPath: 'C:/tmp/demo-project',
    template: 'project-autonomous',
    entryPoint: 'dev',
    importSessionTemplate: async () => {},
  });

  // Render InteractiveApp with REAL SM + REAL client + demoMode
  const { lastFrame } = render(h(InteractiveApp, {
    sessionManager: realSessionManager,
    apiClient: realApiClient,
    demoMode: true,
    repoPath: 'C:/tmp/demo-project',
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
    const hasAgent = frame.includes('Agent');
    const hasWorking = frame.includes('Agent working') || frame.includes('working');
    const isIdle = frame.includes('Agent ready') || frame.includes('Describe your task');
    console.log(`[${wait}ms] ${label}: agent=${hasAgent} working=${hasWorking} idle=${isIdle}`);
  }

  fs.writeFileSync('C:/tmp/demo-frames-all.txt', output);

  // Final assertions
  const final = stripAnsi(lastFrame() || '');
  const checks = [
    ['Agent page visible', final.includes('Agent')],
    ['Session in statusbar', final.includes('session:demo-')],
    ['SpatialStatusBar shows page', final.includes('Agent')],
    ['SpatialStatusBar shows DEMO', final.includes('DEMO')],
    ['No uncaught Error', !final.includes('Error:')],
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
