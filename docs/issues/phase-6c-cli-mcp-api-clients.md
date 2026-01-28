# Phase 6C: CLI/MCP API Client Migration

**Phase**: 6C  
**Priority**: High  
**Duration**: 1 week  
**Team**: Tools (1 developer)  
**Dependencies**: Phase 6A, 5D complete  
**Blocks**: Phase 6E, 10  
**Status**: Complete

---

## Overview

Migrate the CLI (`tools/maestro-cli/`) and MCP Server (`tools/maestro-mcp/`) from direct filesystem reads to using the Backend HTTP API. This is critical for Docker support and ensuring a single source of truth.

## Current Problem

### CLI (`tools/maestro-cli/index.js`)

```javascript
// PROBLEM: Direct filesystem read
const blocksDir = path.join(__dirname, '../../blocks');

async function listBlocks() {
  const blocks = [];
  const categories = await fs.readdir(blocksDir);
  for (const category of categories) {
    // ... reads filesystem directly
  }
  return blocks;
}
```

### MCP (`tools/maestro-mcp/index.js`)

```javascript
// PROBLEM: Same pattern - direct filesystem read
const blocksDir = path.join(__dirname, '../../blocks');

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const blocks = await discoverBlocks(); // reads from filesystem
  // ...
});
```

### Impact

- ❌ Cannot work with remote/containerized backend
- ❌ Block changes not synchronized
- ❌ Duplicated discovery logic
- ❌ No validation (backend validates, CLI/MCP don't)

## Tasks

### 6C.1 Create API Client Package

- [x] Create shared API client (can be inline or package)
- [x] Design client interface with all required methods
- [x] Export MaestroApiClient and ApiError classes

```javascript
// api-client.js
class MaestroApiClient {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  // Blocks
  async listBlocks(filter = {}) { }
  async getBlock(id) { }
  async createBlock(block) { }
  async updateBlock(id, updates) { }
  async deleteBlock(id) { }
  async searchBlocks(query) { }

  // Discovery
  async getHealth() { }
  async getCapabilities() { }
  async getConfig() { }

  // Execution
  async executeWorkflow(id, options = {}) { }
  async getExecutionStatus(executionId) { }
  async cancelExecution(executionId) { }

  // Models
  async listModels() { }
  async getModel(id) { }
}

module.exports = { MaestroApiClient };
```

### 6C.2 Implement API Client

- [x] Implement all methods using `fetch`
- [x] Add proper error handling with typed errors (ApiError)
- [x] Add retry logic for transient failures
- [x] Add request timeout configuration
- [x] Add debug logging for debugging
- [x] Handle authentication (future-proofing)

```javascript
async listBlocks(filter = {}) {
  const params = new URLSearchParams();
  if (filter.type) params.set('type', filter.type);
  if (filter.capability) params.set('capability', filter.capability);
  if (filter.search) params.set('q', filter.search);

  const response = await fetch(`${this.baseUrl}/api/blocks?${params}`, {
    headers: { 'Content-Type': 'application/json' },
    timeout: this.timeout
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}
```

### 6C.3 Refactor CLI to Use API Client

- [x] Remove all direct filesystem reads from CLI
- [x] Update `listBlocks()` to use API client
- [x] Update `listWorkflows()` to use API client
- [x] Add `--api-url` flag for remote backends
- [x] Add `health` command to check backend status
- [x] Add `search` command for block search
- [x] Add `info` command for block details
- [x] Add helpful error messages for common failures
- [x] Add `--help` documentation

```javascript
#!/usr/bin/env node
const { MaestroApiClient } = require('./api-client');

const argv = yargs(hideBin(process.argv))
  .option('api-url', {
    alias: 'u',
    type: 'string',
    description: 'Backend API URL',
    default: process.env.MAESTRO_API_URL || 'http://localhost:5000'
  })
  // ... other options
  .argv;

const client = new MaestroApiClient(argv.apiUrl);

async function listBlocks() {
  try {
    const blocks = await client.listBlocks();
    console.table(blocks.map(b => ({
      ID: b.id,
      Name: b.name,
      Type: b.type,
      Path: b.sourcePath
    })));
  } catch (error) {
    console.error(`Failed to list blocks: ${error.message}`);
    if (error.status === 'ECONNREFUSED') {
      console.error('Is the backend running? Try: dotnet run --project backend/src/Maestro.Api');
    }
    process.exit(1);
  }
}
```

### 6C.4 Refactor MCP to Use API Client

- [ ] Remove all direct filesystem reads from MCP
- [ ] Update tool discovery to use API client
- [ ] Update tool execution to use API client
- [ ] Add environment variable for API URL

```javascript
const { MaestroApiClient } = require('./api-client');

const API_URL = process.env.MAESTRO_API_URL || 'http://localhost:5000';
const client = new MaestroApiClient(API_URL);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const blocks = await client.listBlocks({ type: 'tool' });
  
  return {
    tools: blocks.map(block => ({
      name: `maestro_${block.id}`,
      description: block.description,
      inputSchema: block.config.inputSchema || {}
    }))
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const blockId = name.replace('maestro_', '');
  
  const result = await client.executeWorkflow(blockId, { inputs: args });
  
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }]
  };
});
```

### 6C.5 CLI Command Updates

- [x] Update `maestro blocks` command
- [x] Update `maestro workflows` command
- [x] Add `maestro info` command (show block details)
- [x] Add `maestro search` command (search blocks)
- [x] Add `maestro health` command (check backend status)

```bash
# New commands
maestro --api-url http://backend:5000 list blocks
maestro --api-url http://backend:5000 run workflow commit-generator
maestro health                    # Check backend connectivity
maestro config                    # Show current configuration
```

### 6C.6 Environment Variable Support

- [x] Support `MAESTRO_API_URL` environment variable
- [x] Support `MAESTRO_DEBUG` for verbose logging
- [ ] Support `MAESTRO_API_TIMEOUT` for timeout configuration
- [ ] Document all environment variables

```bash
# Example usage
export MAESTRO_API_URL=http://localhost:5000
export MAESTRO_API_TIMEOUT=30000
export MAESTRO_DEBUG=true

maestro list blocks
```

### 6C.7 Error Handling

- [x] Handle connection refused (backend not running)
- [x] Handle timeout errors  
- [x] Handle 404 (block/workflow not found)
- [x] Handle 500 (server errors)
- [x] Provide helpful error messages

```javascript
class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static fromResponse(response, body) {
    return new ApiError(
      response.status,
      body.message || `HTTP ${response.status}`,
      body.details || {}
    );
  }
}

// Usage
try {
  await client.executeWorkflow('unknown-id');
} catch (error) {
  if (error.status === 404) {
    console.error(`Workflow not found: ${error.details.id}`);
  } else if (error.code === 'ECONNREFUSED') {
    console.error('Cannot connect to backend. Is it running?');
  }
}
```

### 6C.8 Integration Tests

- [ ] Test CLI with real backend
- [ ] Test MCP with real backend
- [ ] Test error scenarios
- [ ] Test with Docker containerized backend

```javascript
// tests/cli-integration.test.js
describe('CLI Integration', () => {
  const client = new MaestroApiClient('http://localhost:5000');

  beforeAll(async () => {
    // Ensure backend is running
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });

  test('list blocks returns array', async () => {
    const result = await execSync('node index.js list blocks');
    expect(result).toContain('ID');
  });

  test('run workflow executes successfully', async () => {
    const result = await execSync('node index.js run commit-generator');
    expect(result).toContain('completed');
  });
});
```

### 6C.9 Documentation Updates

- [x] Update CLI README with new flags
- [x] Document API URL configuration
- [x] Add Docker usage examples
- [x] Document environment variables
- [ ] Update MCP setup documentation

## Files to Modify

### CLI
- `tools/maestro-cli/index.js` - Remove fs reads, use API client
- `tools/maestro-cli/package.json` - Add axios or keep fetch
- `tools/maestro-cli/README.md` - Update documentation

### MCP
- `tools/maestro-mcp/index.js` - Remove fs reads, use API client
- `tools/maestro-mcp/package.json` - Dependencies
- `docs/mcp-setup.md` - Update with API configuration

### New Files
- `tools/shared/api-client.js` - Shared API client
- `tools/shared/errors.js` - Custom error classes
- `tests/cli-integration.test.js` - Integration tests
- `tests/mcp-integration.test.js` - Integration tests

## Acceptance Criteria

1. [ ] CLI works without direct filesystem access
2. [ ] MCP works without direct filesystem access
3. [ ] `--api-url` flag works in CLI
4. [ ] `MAESTRO_API_URL` environment variable works
5. [ ] Helpful error messages for common failures
6. [ ] CLI can connect to Docker containerized backend
7. [ ] Integration tests pass
8. [ ] Documentation updated

## Breaking Changes

⚠️ **Users must have backend running to use CLI/MCP**

Previously, CLI/MCP could work standalone by reading filesystem. After this change:

1. Backend must be running (`dotnet run --project backend/src/Maestro.Api`)
2. API URL must be configured if not using default `http://localhost:5000`

**Migration guide:**
```bash
# Old usage (no longer works)
maestro list blocks

# New usage (backend must be running)
# Terminal 1: Start backend
dotnet run --project backend/src/Maestro.Api

# Terminal 2: Use CLI
maestro list blocks

# Or with explicit URL
maestro --api-url http://localhost:5000 list blocks
```

## Notes

- Consider bundling a simple HTTP client to avoid dependencies
- API client should be isomorphic (work in Node.js and browser)
- MCP needs to handle long-running workflow executions
- Consider WebSocket support for execution progress

---

**Related Issues:**
- Phase 6A: [Unified Block Source](phase-6a-unified-block-source.md)
- Phase 6E: [Docker Preparation](phase-6e-docker-preparation.md)
- Phase 5D: [Commit Workflow & MCP](phase-5d-commit-workflow-mcp.md)
