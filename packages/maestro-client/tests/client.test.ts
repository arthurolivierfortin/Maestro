import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaestroClient } from '../src/client.js';
import { ApiError, ConnectionError } from '../src/errors.js';
import { ClientBlockRegistry } from '../src/client-blocks.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

describe('MaestroClient', () => {
  let client: MaestroClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new MaestroClient({
      baseUrl: 'http://localhost:5000',
      retryAttempts: 1,
      timeout: 5000,
    });
  });

  it('has all domain modules', () => {
    expect(client.health).toBeDefined();
    expect(client.blocks).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.variables).toBeDefined();
    expect(client.workspaces).toBeDefined();
    expect(client.projects).toBeDefined();
    expect(client.templates).toBeDefined();
    expect(client.llm).toBeDefined();
    expect(client.metrics).toBeDefined();
    expect(client.foundry).toBeDefined();
    expect(client.workflows).toBeDefined();
    expect(client.training).toBeDefined();
    expect(client.testing).toBeDefined();
    expect(client.runs).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.filesystem).toBeDefined();
    expect(client.realtime).toBeDefined();
    expect(client.clientBlocks).toBeDefined();
  });

  it('exposes baseUrl', () => {
    expect(client.baseUrl).toBe('http://localhost:5000');
  });

  describe('health', () => {
    it('checks health', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'healthy' }));
      const result = await client.health.check();
      expect(result.status).toBe('healthy');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/discovery/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('isReady returns true when healthy', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'healthy' }));
      expect(await client.health.isReady()).toBe(true);
    });

    it('isReady returns false on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      expect(await client.health.isReady()).toBe(false);
    });
  });

  describe('blocks', () => {
    it('lists blocks', async () => {
      const blocks = [{ id: 'b1', name: 'Block 1' }];
      mockFetch.mockResolvedValueOnce(jsonResponse(blocks));
      const result = await client.blocks.list();
      expect(result).toEqual(blocks);
    });

    it('lists blocks with filter', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      await client.blocks.list({ type: 'agent', designation: 'orchestrator' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=agent'),
        expect.any(Object),
      );
    });

    it('gets a block by id', async () => {
      const block = { id: 'jarvis', name: 'Jarvis' };
      mockFetch.mockResolvedValueOnce(jsonResponse(block));
      const result = await client.blocks.get('jarvis');
      expect(result.id).toBe('jarvis');
    });
  });

  describe('sessions', () => {
    it('creates a session', async () => {
      const session = { id: 'sess-1', name: 'Test' };
      mockFetch.mockResolvedValueOnce(jsonResponse(session));
      const result = await client.sessions.create({ repositoryPath: '/repo' });
      expect(result.id).toBe('sess-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/sessions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('starts a session', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 's1', status: 'active' }));
      await client.sessions.start('s1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/sessions/s1/start',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('invokes a session entry point', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await client.sessions.invoke('s1', 'dev', { task: 'hello' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/sessions/s1/invoke/dev',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('variables', () => {
    it('gets a variable', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [1, 2, 3] }));
      const result = await client.variables.get('sess-1', '_phases');
      expect(result).toEqual({ data: [1, 2, 3] });
    });

    it('sets a variable', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await client.variables.set('sess-1', '_phases', [{ id: 'p1' }]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/sessions/sess-1/variables/_phases',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('error handling', () => {
    it('throws ApiError on 4xx', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404));
      await expect(client.blocks.get('nonexistent')).rejects.toThrow(ApiError);
    });

    it('throws ConnectionError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(client.health.check()).rejects.toThrow(ConnectionError);
    });
  });
});

describe('ClientBlockRegistry', () => {
  it('registers and executes a handler', async () => {
    const registry = new ClientBlockRegistry();
    const handler = { execute: vi.fn().mockResolvedValue({ transcript: 'hello' }) };
    registry.register('speech-to-text', handler);

    expect(registry.has('speech-to-text')).toBe(true);
    const result = await registry.execute('speech-to-text', { language: 'en-US' });
    expect(result.transcript).toBe('hello');
    expect(handler.execute).toHaveBeenCalledWith({ language: 'en-US' });
  });

  it('throws on missing handler', async () => {
    const registry = new ClientBlockRegistry();
    await expect(registry.execute('unknown', {})).rejects.toThrow(
      "No client-side handler registered for block 'unknown'",
    );
  });

  it('lists registered blocks', () => {
    const registry = new ClientBlockRegistry();
    registry.register('stt', { execute: async () => ({}) });
    registry.register('tts', { execute: async () => ({}) });
    expect(registry.registeredBlocks()).toEqual(['stt', 'tts']);
  });

  it('unregisters a handler', () => {
    const registry = new ClientBlockRegistry();
    registry.register('stt', { execute: async () => ({}) });
    registry.unregister('stt');
    expect(registry.has('stt')).toBe(false);
  });
});
