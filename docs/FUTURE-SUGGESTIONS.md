# Future Suggestions for Maestro

Based on the current integration work, here are recommendations for future development phases.

## Recently Completed (Phase 1)

### 1. Real Workflow Execution - COMPLETED

**Implementation Summary:**
- Added `POST /api/workflows/{id}/execute` endpoint in `WorkflowsController.cs`
- Added `POST /api/blocks/{id}/execute` endpoint in `BlocksController.cs`
- `ToolBlockExecutor` now properly executes git commands (git diff, git status, git log)
- `InferenceBlockExecutor` is connected to LLM-Provider gateway
- Workflow execution resolves block references and executes DAG-based workflow
- CLI supports real execution without `--mock` flag

**Key Files Modified:**
- `Maestro.Api/Controllers/WorkflowsController.cs` - Added execute endpoint with block resolution
- `Maestro.Api/Controllers/BlocksController.cs` - Added execute endpoint
- `Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` - Fixed JsonElement handling, added command+args support
- `Maestro.Application/DTOs/BlockDto.cs` - Fixed JSON serialization for JsonElement values

### 4. CLI Real Execution Mode - COMPLETED

**Implementation Summary:**
- CLI now supports real workflow execution via backend API
- Added `run` command for executing individual blocks
- Added `--working-dir` option for specifying git repository path
- Mock mode is optional with `--mock` flag

**Usage Examples:**
```bash
# Execute a single block
maestro run git-status --input workingDir=/path/to/repo

# Execute a workflow
maestro execute generate-commit-message-workflow --working-dir /path/to/repo

# Execute in mock mode (for testing)
maestro execute generate-commit-message --mock
```

## Immediate Priorities (Next Phase)

### 2. Project-Scoped Block Discovery (Medium Priority)

**Current State:** Blocks are discovered globally; project-specific blocks are not automatically loaded.

**Suggested Actions:**
- When a project is opened/bound, add its `.maestro/blocks` path to the search paths
- Implement block priority: project > user > global
- Add project context to workflow execution

### 3. Streaming LLM Responses (Medium Priority)

**Current State:** `LLMProviderGateway.StreamAsync()` returns full response as single chunk.

**Suggested Actions:**
- Implement WebSocket streaming for LLM-Provider
- Add real-time token streaming to frontend via SignalR
- Update `InferenceBlockExecutor` to handle streaming properly

### 5. Frontend Workflow Execution UI (High Priority)

**Current State:** No UI for executing workflows or viewing results.

**Suggested Actions:**
- Add "Execute" button on workflow detail page
- Add input form for workflow parameters
- Show execution progress with real-time updates via SignalR
- Display execution results and logs

## Architecture Improvements

### 6. Unified Block Format

**Current State:** Two formats exist - flat (`*.block.json`) and folder-based (`block.json` + `prompt.md`).

**Suggested Actions:**
- Standardize on a single format (recommend flat format)
- Migrate all existing blocks to new format
- Update documentation and schemas
- Update CLI mock execution to use new format

### 7. Workflow Definition Standardization

**Current State:** Workflows use different structures in different places.

**Suggested Actions:**
- Unify workflow schema with nodes/connections
- Create workflow editor in frontend
- Add workflow validation on save
- Implement workflow versioning

### 8. Project Configuration Enhancement

**Current State:** Basic project.json with minimal fields.

**Suggested Actions:**
- Add environment variables support
- Add secrets management (encrypted)
- Add custom tool configurations
- Add workflow-specific model overrides

## LLM Provider Integration

### 9. Multiple Provider Support

**Current State:** Only LLM-Provider is supported.

**Suggested Actions:**
- Abstract LLM provider interface further
- Add OpenAI/Azure OpenAI support
- Add Anthropic Claude support
- Implement provider selection per-block or per-project

### 10. Model Management

**Current State:** Default model is configured globally.

**Suggested Actions:**
- Add model selection UI in frontend
- Implement model caching/preloading
- Add token usage tracking and limits
- Add cost estimation

### 11. Context Management

**Current State:** No context/conversation memory between blocks.

**Suggested Actions:**
- Implement conversation context for multi-step workflows
- Add context windowing options
- Support for large context models
- Implement context summarization

## Frontend Enhancements

### 12. Visual Workflow Builder

**Current State:** Workflows are defined via JSON.

**Suggested Actions:**
- Create drag-and-drop workflow editor
- Add block palette with search
- Implement connection validation
- Add workflow testing/debugging UI

### 13. Project Dashboard

**Current State:** Basic project list.

**Suggested Actions:**
- Add project health/status overview
- Show recent executions
- Display block usage statistics
- Add quick actions (run workflow, view logs)

### 14. Real-time Execution Monitoring

**Current State:** SignalR hubs exist but limited use.

**Suggested Actions:**
- Show real-time execution progress
- Display streaming LLM output
- Add execution history with logs
- Implement execution cancellation

## Security & Production Readiness

### 15. Authentication & Authorization

**Current State:** No authentication.

**Suggested Actions:**
- Add user authentication (JWT/OAuth)
- Implement role-based access control
- Add API key management
- Audit logging

### 16. Rate Limiting & Quotas

**Current State:** No limits on API calls.

**Suggested Actions:**
- Implement rate limiting
- Add token usage quotas
- Add execution time limits
- Implement cost tracking

### 17. Error Handling & Recovery

**Current State:** Basic error handling.

**Suggested Actions:**
- Add comprehensive error codes
- Implement workflow checkpoint/resume
- Add automatic retry with backoff
- Implement dead letter queue for failed executions

## Developer Experience

### 18. Block Development SDK

**Current State:** Blocks are created manually via JSON.

**Suggested Actions:**
- Create block scaffolding CLI command
- Add block testing framework
- Implement block validation
- Create block marketplace/registry

### 19. Documentation & Examples

**Current State:** Limited documentation.

**Suggested Actions:**
- Create comprehensive API documentation
- Add block development guide
- Create workflow examples library
- Add video tutorials

### 20. Testing Infrastructure

**Current State:** Limited tests.

**Suggested Actions:**
- Add integration tests for API
- Create workflow testing framework
- Add end-to-end tests
- Implement performance benchmarks

## Recommended Implementation Order

1. **Phase 1 (Completed):** Real workflow execution (#1, #4)
2. **Phase 2 (Next):** Frontend execution UI & project-scoped blocks (#5, #2, #3)
3. **Phase 3:** Format standardization (#6, #7)
4. **Phase 4:** Multiple providers & model management (#9, #10)
5. **Phase 5:** Frontend visual workflow builder (#12, #13, #14)
6. **Phase 6:** Security & production features (#15, #16, #17)

## Quick Wins (Remaining)

These can be implemented quickly with high impact:

1. ~~**Add `/api/workflows/{id}/execute` endpoint** - DONE~~
2. ~~**Fix ToolBlockExecutor** - DONE~~
3. **Add project blocks to search path** - Automatic project block loading
4. **Improve CLI help** - Better documentation of available commands
5. **Add health check with LLM status** - Show LLM-Provider connection status
6. **Add execution button in frontend** - Allow triggering workflows from UI

## Conclusion

The foundation is now functional with:
- Real block and workflow execution via API
- CLI support for real execution
- LLM-Provider integration ready (requires LLM-Provider to be running)

The main remaining gaps are:
- Frontend workflow execution UI
- Visual workflow editing
- Multi-provider LLM support
- Project-scoped block discovery

Focus on enabling frontend execution UI next, then enhance the developer and user experience.
