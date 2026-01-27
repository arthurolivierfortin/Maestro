# Future Suggestions for Maestro

Based on the current integration work, here are recommendations for future development phases.

## Immediate Priorities

### 1. Real Workflow Execution (High Priority)

**Current State:** Workflows can only run in mock mode via CLI.

**Suggested Actions:**
- Implement real workflow execution in `WorkflowExecutor`
- Add API endpoint for workflow execution: `POST /api/workflows/{id}/execute`
- Connect `InferenceBlockExecutor` to actually call LLM-Provider
- Implement `ToolBlockExecutor` to execute shell commands (git diff, git status, etc.)

**Files to Modify:**
- `Maestro.Infrastructure/Orchestration/WorkflowExecutor.cs`
- `Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs`
- `Maestro.Infrastructure/BlockExecutors/InferenceBlockExecutor.cs`
- `Maestro.Api/Controllers/WorkflowsController.cs`

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

### 4. CLI Real Execution Mode (Medium Priority)

**Current State:** CLI only supports `--mock` mode.

**Suggested Actions:**
- Add `--live` or remove `--mock` requirement
- Call backend API for real execution
- Implement progress/status polling
- Add streaming output support

## Architecture Improvements

### 5. Unified Block Format

**Current State:** Two formats exist - flat (`*.block.json`) and folder-based (`block.json` + `prompt.md`).

**Suggested Actions:**
- Standardize on a single format (recommend flat format)
- Migrate all existing blocks to new format
- Update documentation and schemas
- Update CLI mock execution to use new format

### 6. Workflow Definition Standardization

**Current State:** Workflows use different structures in different places.

**Suggested Actions:**
- Unify workflow schema with nodes/connections
- Create workflow editor in frontend
- Add workflow validation on save
- Implement workflow versioning

### 7. Project Configuration Enhancement

**Current State:** Basic project.json with minimal fields.

**Suggested Actions:**
- Add environment variables support
- Add secrets management (encrypted)
- Add custom tool configurations
- Add workflow-specific model overrides

## LLM Provider Integration

### 8. Multiple Provider Support

**Current State:** Only LLM-Provider is supported.

**Suggested Actions:**
- Abstract LLM provider interface further
- Add OpenAI/Azure OpenAI support
- Add Anthropic Claude support
- Implement provider selection per-block or per-project

### 9. Model Management

**Current State:** Default model is configured globally.

**Suggested Actions:**
- Add model selection UI in frontend
- Implement model caching/preloading
- Add token usage tracking and limits
- Add cost estimation

### 10. Context Management

**Current State:** No context/conversation memory between blocks.

**Suggested Actions:**
- Implement conversation context for multi-step workflows
- Add context windowing options
- Support for large context models
- Implement context summarization

## Frontend Enhancements

### 11. Visual Workflow Builder

**Current State:** Workflows are defined via JSON.

**Suggested Actions:**
- Create drag-and-drop workflow editor
- Add block palette with search
- Implement connection validation
- Add workflow testing/debugging UI

### 12. Project Dashboard

**Current State:** Basic project list.

**Suggested Actions:**
- Add project health/status overview
- Show recent executions
- Display block usage statistics
- Add quick actions (run workflow, view logs)

### 13. Real-time Execution Monitoring

**Current State:** SignalR hubs exist but limited use.

**Suggested Actions:**
- Show real-time execution progress
- Display streaming LLM output
- Add execution history with logs
- Implement execution cancellation

## Security & Production Readiness

### 14. Authentication & Authorization

**Current State:** No authentication.

**Suggested Actions:**
- Add user authentication (JWT/OAuth)
- Implement role-based access control
- Add API key management
- Audit logging

### 15. Rate Limiting & Quotas

**Current State:** No limits on API calls.

**Suggested Actions:**
- Implement rate limiting
- Add token usage quotas
- Add execution time limits
- Implement cost tracking

### 16. Error Handling & Recovery

**Current State:** Basic error handling.

**Suggested Actions:**
- Add comprehensive error codes
- Implement workflow checkpoint/resume
- Add automatic retry with backoff
- Implement dead letter queue for failed executions

## Developer Experience

### 17. Block Development SDK

**Current State:** Blocks are created manually via JSON.

**Suggested Actions:**
- Create block scaffolding CLI command
- Add block testing framework
- Implement block validation
- Create block marketplace/registry

### 18. Documentation & Examples

**Current State:** Limited documentation.

**Suggested Actions:**
- Create comprehensive API documentation
- Add block development guide
- Create workflow examples library
- Add video tutorials

### 19. Testing Infrastructure

**Current State:** Limited tests.

**Suggested Actions:**
- Add integration tests for API
- Create workflow testing framework
- Add end-to-end tests
- Implement performance benchmarks

## Recommended Implementation Order

1. **Phase 1 (Week 1-2):** Real workflow execution (#1, #4)
2. **Phase 2 (Week 3-4):** Project-scoped blocks & streaming (#2, #3)
3. **Phase 3 (Week 5-6):** Format standardization (#5, #6)
4. **Phase 4 (Week 7-8):** Multiple providers & model management (#8, #9)
5. **Phase 5 (Week 9-12):** Frontend visual workflow builder (#11, #12, #13)
6. **Phase 6 (Week 13+):** Security & production features (#14, #15, #16)

## Quick Wins

These can be implemented quickly with high impact:

1. **Add `/api/workflows/{id}/execute` endpoint** - Enable real workflow execution
2. **Fix ToolBlockExecutor** - Execute actual git commands
3. **Add project blocks to search path** - Automatic project block loading
4. **Improve CLI help** - Better documentation of available commands
5. **Add health check with LLM status** - Show LLM-Provider connection status

## Conclusion

The foundation is solid with clean architecture and good separation of concerns. The main gaps are in:
- Real execution (currently mock-only)
- Frontend workflow editing
- Multi-provider LLM support

Focus on enabling real workflow execution first, then enhance the developer and user experience.
