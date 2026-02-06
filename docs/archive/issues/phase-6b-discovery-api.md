# Phase 6B: Complete Discovery API

**Phase**: 6B  
**Priority**: High  
**Duration**: 1 week  
**Team**: Backend (1 developer)  
**Dependencies**: Phase 6A complete  
**Blocks**: Phase 6D  
**Status**: Complete

---

## Overview

Implement the full Discovery API that the frontend's `realDiscoveryService.ts` expects. Currently, the frontend expects discovery endpoints that don't exist, causing the real backend integration to fail.

## Current Problem

The frontend's `realDiscoveryService.ts` expects these endpoints:

```typescript
// frontend/src/services/real/realDiscoveryService.ts
export const realDiscoveryService: IDiscoveryService = {
  async discoverBlocks(): Promise<Block[]> {
    const response = await apiClient.get('/api/discovery/blocks');
    return response.data;
  },
  
  async discoverBlocksByType(type: BlockType): Promise<Block[]> {
    const response = await apiClient.get(`/api/discovery/blocks?type=${type}`);
    return response.data;
  },
  
  // ... more methods expecting /api/discovery/* endpoints
};
```

**But no `DiscoveryController` exists in the backend!**

## Tasks

### 6B.1 Create DiscoveryController

- [x] Create `DiscoveryController.cs` in `Maestro.Api/Controllers/`
- [x] Add route prefix `[Route("api/discovery")]`
- [x] Inject necessary services (`IBlockDiscoveryService`, `IConfiguration`)

### 6B.2 Health Check Endpoint

- [x] Implement `GET /api/discovery/health`
  ```csharp
  [HttpGet("health")]
  public ActionResult<HealthResponse> GetHealth()
  {
      return Ok(new HealthResponse
      {
          Status = "healthy",
          Version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(),
          Uptime = DateTime.UtcNow - _startTime,
          BlockCount = _blockService.GetBlockCount(),
          Services = new Dictionary<string, string>
          {
              ["LLMGateway"] = _llmGateway.IsAvailable ? "connected" : "disconnected",
              ["FileWatcher"] = _fileWatcher.IsWatching ? "active" : "inactive"
          }
      });
  }
  ```

### 6B.3 Capabilities Endpoint

- [x] Implement `GET /api/discovery/capabilities`
  ```csharp
  [HttpGet("capabilities")]
  public ActionResult<CapabilitiesResponse> GetCapabilities()
  {
      return Ok(new CapabilitiesResponse
      {
          BlockTypes = Enum.GetValues<BlockType>().Select(t => new BlockTypeInfo
          {
              Type = t.ToString(),
              DisplayName = t.GetDisplayName(),
              Icon = t.GetIcon(),
              CanContain = BlockTypeRegistry.GetAllowedChildren(t),
              DefaultConfig = BlockTypeRegistry.GetDefaultConfig(t)
          }).ToList(),
          Executors = _executorRegistry.GetAvailableExecutors(),
          LLMProviders = _llmGateway.GetAvailableProviders(),
          Features = new List<string> { "hot-reload", "signalr-events", "workflow-execution" }
      });
  }
  ```

### 6B.4 Configuration Endpoint

- [x] Implement `GET /api/discovery/config`
  ```csharp
  [HttpGet("config")]
  public ActionResult<ConfigResponse> GetConfig()
  {
      return Ok(new ConfigResponse
      {
          BlockSearchPaths = _blockService.GetSearchPaths(),
          DefaultLLMProvider = _config["LLM:DefaultProvider"],
          ExecutionTimeout = TimeSpan.Parse(_config["Execution:Timeout"]),
          MaxConcurrentExecutions = int.Parse(_config["Execution:MaxConcurrent"]),
          SignalREnabled = true
      });
  }
  ```

### 6B.5 Block Types Endpoint

- [x] Implement `GET /api/discovery/blocks/types`
  ```csharp
  [HttpGet("blocks/types")]
  public ActionResult<List<BlockTypeInfo>> GetBlockTypes()
  {
      return Ok(BlockTypeRegistry.GetAllTypes().Select(t => new BlockTypeInfo
      {
          Type = t.Type.ToString(),
          DisplayName = t.DisplayName,
          Description = t.Description,
          Icon = t.Icon,
          Color = t.Color,
          Category = t.Category,
          CanContain = t.AllowedChildren,
          RequiredFields = t.RequiredFields,
          DefaultConfig = t.DefaultConfig
      }).ToList());
  }
  ```

### 6B.6 Block Discovery Endpoints

- [x] Implement `GET /api/discovery/blocks` - List all discoverable blocks
- [x] Implement `GET /api/discovery/blocks/by-type/{type}` - Filter by type
- [x] Implement `GET /api/discovery/blocks/by-capability/{capability}` - Filter by capability
- [x] Implement `GET /api/discovery/blocks/search?q={query}` - Search blocks

### 6B.7 Response DTOs

- [x] Create HealthResponse DTO
- [x] Create CapabilitiesResponse DTO
- [x] Create ConfigResponse DTO
- [x] Create BlockTypeInfo DTO

```csharp
public record HealthResponse
{
    public string Status { get; init; }
    public string Version { get; init; }
    public TimeSpan Uptime { get; init; }
    public int BlockCount { get; init; }
    public Dictionary<string, string> Services { get; init; }
}

public record CapabilitiesResponse
{
    public List<BlockTypeInfo> BlockTypes { get; init; }
    public List<string> Executors { get; init; }
    public List<string> LLMProviders { get; init; }
    public List<string> Features { get; init; }
}

public record ConfigResponse
{
    public List<string> BlockSearchPaths { get; init; }
    public string DefaultLLMProvider { get; init; }
    public TimeSpan ExecutionTimeout { get; init; }
    public int MaxConcurrentExecutions { get; init; }
    public bool SignalREnabled { get; init; }
}

public record BlockTypeInfo
{
    public string Type { get; init; }
    public string DisplayName { get; init; }
    public string Description { get; init; }
    public string Icon { get; init; }
    public string Color { get; init; }
    public string Category { get; init; }
    public List<string> CanContain { get; init; }
    public List<string> RequiredFields { get; init; }
    public JsonDocument DefaultConfig { get; init; }
}
```

### 6B.8 Update Frontend realDiscoveryService

- [ ] Review `frontend/src/services/real/realDiscoveryService.ts`
- [ ] Ensure endpoints match backend implementation
- [ ] Add proper TypeScript types for responses
- [ ] Add error handling for network failures
- [ ] Add retry logic for transient failures

### 6B.9 OpenAPI Documentation

- [x] Add XML documentation to all endpoints
- [x] Configure response types in controller attributes
- [x] Document endpoint descriptions
- [ ] Create `docs/api/discovery-api.md` with examples
- [ ] Add Postman collection for testing

### 6B.10 Unit Tests

- [x] Test all discovery endpoints
- [x] Test error cases (no blocks, service unavailable)
- [x] Test response DTO serialization
- [x] Mock dependencies properly

## API Specification

### Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/discovery/health` | Backend health check |
| GET | `/api/discovery/capabilities` | Available features and types |
| GET | `/api/discovery/config` | Current configuration |
| GET | `/api/discovery/blocks/types` | Block type metadata |
| GET | `/api/discovery/blocks` | List all blocks |
| GET | `/api/discovery/blocks/by-type/{type}` | Blocks filtered by type |
| GET | `/api/discovery/blocks/by-capability/{cap}` | Blocks filtered by capability |
| GET | `/api/discovery/blocks/search` | Search blocks |

### Example Responses

**GET /api/discovery/health**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": "02:30:45",
  "blockCount": 42,
  "services": {
    "LLMGateway": "connected",
    "FileWatcher": "active"
  }
}
```

**GET /api/discovery/capabilities**
```json
{
  "blockTypes": [
    {
      "type": "Agent",
      "displayName": "Agent",
      "icon": "🤖",
      "canContain": ["Prompt", "Tool", "Instruction"]
    }
  ],
  "executors": ["PromptExecutor", "InferenceExecutor", "ToolExecutor"],
  "llmProviders": ["OpenAI", "Anthropic", "Ollama"],
  "features": ["hot-reload", "signalr-events", "workflow-execution"]
}
```

## Acceptance Criteria

1. [ ] All discovery endpoints return valid responses
2. [ ] Frontend `realDiscoveryService` works with backend
3. [ ] Health endpoint accurately reflects system state
4. [ ] Capabilities endpoint lists all available features
5. [ ] OpenAPI/Swagger documentation generated
6. [ ] Unit tests pass with 90%+ coverage

## Files to Create

- `backend/src/Maestro.Api/Controllers/DiscoveryController.cs`
- `backend/src/Maestro.Application/DTOs/HealthResponse.cs`
- `backend/src/Maestro.Application/DTOs/CapabilitiesResponse.cs`
- `backend/src/Maestro.Application/DTOs/ConfigResponse.cs`
- `backend/src/Maestro.Application/DTOs/BlockTypeInfo.cs`
- `backend/tests/Maestro.Api.Tests/Controllers/DiscoveryControllerTests.cs`
- `docs/api/discovery-api.md`

## Files to Modify

- `frontend/src/services/real/realDiscoveryService.ts` - Update to match API
- `frontend/src/types/discovery.types.ts` - Add response types

## Notes

- Discovery endpoints are read-only (no mutations)
- Consider caching capabilities response (rarely changes)
- Health endpoint should be fast (no heavy operations)
- Block search should support fuzzy matching

---

**Related Issues:**
- Phase 6A: [Unified Block Source](phase-6a-unified-block-source.md)
- Phase 6D: [Frontend Real Integration](phase-6d-frontend-real-integration.md)
