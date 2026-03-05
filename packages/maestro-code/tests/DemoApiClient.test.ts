/**
 * Tests for DemoApiClient — verifies it implements IApiClient contract
 * with realistic mock data.
 */
import { describe, it, expect } from 'vitest';
import { DemoApiClient } from '../mocks/DemoApiClient.ts';

describe('DemoApiClient', () => {
  it('listBlocks returns 14 blocks with correct shape', async () => {
    const client = new DemoApiClient();
    const blocks = await client.listBlocks();
    expect(blocks).toHaveLength(14);
    for (const block of blocks) {
      expect(block).toHaveProperty('id');
      expect(block).toHaveProperty('name');
      expect(block).toHaveProperty('type');
      expect(block).toHaveProperty('isAtomic');
    }
  });

  it('listBlocks filters by type', async () => {
    const client = new DemoApiClient();
    const agents = await client.listBlocks({ type: 'agent' });
    expect(agents.length).toBeGreaterThan(0);
    for (const block of agents) {
      expect(block.type).toBe('agent');
    }
  });

  it('getBlock returns block by id', async () => {
    const client = new DemoApiClient();
    const block = await client.getBlock('code-analyzer');
    expect(block).not.toBeNull();
    expect(block.name).toBe('Code Analyzer');
  });

  it('getBlock returns null for unknown id', async () => {
    const client = new DemoApiClient();
    const block = await client.getBlock('nonexistent-block');
    expect(block).toBeNull();
  });

  it('listSessions returns 5 sessions', async () => {
    const client = new DemoApiClient();
    const sessions = await client.listSessions();
    expect(sessions).toHaveLength(5);
    for (const sess of sessions) {
      expect(sess).toHaveProperty('id');
      expect(sess).toHaveProperty('name');
      expect(sess).toHaveProperty('status');
    }
  });

  it('getSession returns evolving execution tree', async () => {
    const client = new DemoApiClient();
    // Simulate session start
    await client.createSession({});
    const session = await client.getSession('test-id');
    expect(session).toHaveProperty('variables');
    expect(session.variables).toHaveProperty('_executionTree');
    expect(Array.isArray(session.variables._executionTree)).toBe(true);
  });

  it('getHealth returns ok status', async () => {
    const client = new DemoApiClient();
    const health = await client.getHealth();
    expect(health.status).toBe('ok');
  });

  it('getLLMHealth returns healthy status', async () => {
    const client = new DemoApiClient();
    const health = await client.getLLMHealth();
    expect(health.status).toBe('healthy');
    expect(health).toHaveProperty('activeModel');
  });

  it('listLLMModels returns 6 models', async () => {
    const client = new DemoApiClient();
    const models = await client.listLLMModels();
    expect(models).toHaveLength(6);
    for (const m of models) {
      expect(m).toHaveProperty('modelId');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('category');
    }
  });

  it('getLLMStatus returns valid status', async () => {
    const client = new DemoApiClient();
    const status = await client.getLLMStatus();
    expect(status).toHaveProperty('activeModel');
    expect(status).toHaveProperty('maxTokens');
    expect(status).toHaveProperty('temperature');
  });

  it('listProjects returns projects from demo repos', async () => {
    const client = new DemoApiClient();
    const projects = await client.listProjects();
    expect(projects.length).toBeGreaterThan(0);
    for (const p of projects) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('rootPath');
    }
  });

  it('getTopBlocks returns blocks sorted by fitness', async () => {
    const client = new DemoApiClient();
    const top = await client.getTopBlocks({ limit: 3 });
    expect(top).toHaveLength(3);
    // Should be sorted descending by fitness
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].fitness).toBeGreaterThanOrEqual(top[i].fitness);
    }
  });

  it('getApiUrl returns demo URL', () => {
    const client = new DemoApiClient();
    expect(client.getApiUrl()).toContain('demo');
  });

  it('get /api/workspaces returns workspaces', async () => {
    const client = new DemoApiClient();
    const result = await client.get('/api/workspaces');
    expect(Array.isArray(result)).toBe(true);
  });

  it('_fetch returns ok for health endpoint', async () => {
    const client = new DemoApiClient();
    const result = await client._fetch('GET', '/api/health');
    expect(result.status).toBe('ok');
  });

  it('createSession sets startTime and returns session id', async () => {
    const client = new DemoApiClient();
    const result = await client.createSession({});
    expect(result).toHaveProperty('id');
    expect(result.id).toBe(client.DEMO_SESSION_ID);
  });

  it('_fetch GET /api/blocks?contract=maestro-assistant returns only assistant blocks', async () => {
    const client = new DemoApiClient();
    const result = await client._fetch('GET', '/api/blocks?contract=maestro-assistant') as any[];
    expect(result.length).toBe(2);
    for (const b of result) {
      expect(b.contract).toBe('maestro-assistant');
    }
  });

  it('_fetch GET /api/contracts/maestro-assistant returns contract definition', async () => {
    const client = new DemoApiClient();
    const result = await client._fetch('GET', '/api/contracts/maestro-assistant') as any;
    expect(result.id).toBe('maestro-assistant');
    expect(result.requiredCapabilities).toContain('conversation');
    expect(result.features).toHaveProperty('conversation');
    expect(result.features).toHaveProperty('tool-use');
    expect(result.features).toHaveProperty('session-orchestration');
  });

  it('listBlocks includes contract field for assistant blocks', async () => {
    const client = new DemoApiClient();
    const blocks = await client.listBlocks();
    const assistants = blocks.filter((b: any) => b.contract === 'maestro-assistant');
    expect(assistants).toHaveLength(2);
  });
});
