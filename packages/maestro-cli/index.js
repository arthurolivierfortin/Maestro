#!/usr/bin/env node
// Bootstrap: re-exec with --no-experimental-strip-types (disable Node 22 native TS)
// and --import tsx (register both CJS+ESM hooks for .ts under node_modules).
if (!process.env.__MAESTRO_BOOTSTRAPPED) {
  const { spawnSync } = require('child_process');
  const { pathToFileURL } = require('url');
  const tsxPath = pathToFileURL(require.resolve('tsx')).href;
  const result = spawnSync(process.execPath, [
    '--no-experimental-strip-types',
    '--no-warnings',
    '--import', tsxPath,
    __filename,
    ...process.argv.slice(2),
  ], {
    stdio: 'inherit',
    env: { ...process.env, __MAESTRO_BOOTSTRAPPED: '1' },
  });
  process.exit(result.status || 0);
}
require('./cli.ts');
