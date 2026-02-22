import { describe, it, expect, vi } from 'vitest';
import { detectMaestroRoot, getServicePaths } from '../src/config.js';
import * as path from 'path';

// We can't easily test the full sidecar start/stop without running services,
// so we test the config/detection logic and the public interface.

describe('config', () => {
  it('detectMaestroRoot throws without valid root', () => {
    // Clear env to avoid interference
    const original = process.env.MAESTRO_ROOT;
    delete process.env.MAESTRO_ROOT;

    expect(() => detectMaestroRoot('/nonexistent/path')).toThrow('does not exist');

    process.env.MAESTRO_ROOT = original;
  });

  it('getServicePaths returns expected paths', () => {
    const root = '/fake/maestro';
    const paths = getServicePaths(root);
    expect(paths.backendDir).toContain(path.join('apps', 'backend'));
    expect(paths.backendProject).toContain('Maestro.Api.csproj');
    expect(paths.llmProviderDir).toContain(path.join('llm-provider', 'dotnet'));
    expect(paths.llmProviderProject).toContain('LLMProvider.Web.csproj');
  });
});

describe('MaestroSidecar', () => {
  it('can be imported', async () => {
    const { MaestroSidecar } = await import('../src/sidecar.js');
    expect(MaestroSidecar).toBeDefined();
  });
});
