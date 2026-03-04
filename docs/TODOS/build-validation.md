# TODO: Build Validation Tests

## Validate tarball before packaging

**Problem discovered**: `build-dist.js --skip-llm` cleans `dist/` then skips LLM-Provider compilation,
leaving the binary absent. The tarball is created without it, and `maestro code` crashes at startup
with `ENOENT` trying to spawn `LLMProvider.Web.exe`.

**Fix needed in `scripts/build-dist.js`**: After tarball creation (or before), validate that all
expected binaries exist in the staging directory. If any are missing, abort with a clear error
instead of silently producing a broken tarball.

```js
// After bundling, before npm pack — validate required binaries
const required = [
  path.join(stagingPkg, 'dist', rid, 'backend', 'Maestro.Api.exe'),
  path.join(stagingPkg, 'dist', rid, 'llm-provider', 'LLMProvider.Web.exe'),
];
for (const bin of required) {
  if (!fs.existsSync(bin)) {
    console.error(`  [build] ABORT: required binary missing: ${bin}`);
    process.exit(1);
  }
}
```

**Also consider**: `--skip-llm` should only skip *compilation*, not *inclusion*. If a pre-existing
`dist/llm-provider/` exists, it should be preserved even when `--skip-llm` is passed.
Alternatively, refuse `--skip-llm` when `dist/` is being cleaned.
