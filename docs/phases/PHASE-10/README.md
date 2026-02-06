# Phase 10: Autonomous Agents for Cantante Development

## Vision
Use Maestro to build the Cantante project entirely through autonomous AI agents. No direct programming - everything goes through the Maestro CLI and agent execution system.

## End State Requirements

### 1. CLI Capabilities (Must Have)
- [ ] `maestro project create <name> --path <path>` - Create a new project
- [ ] `maestro project list` - List all projects
- [ ] `maestro project bind <path>` - Bind existing project
- [ ] `maestro block create <type> <name>` - Create new block
- [ ] `maestro block list [--type <type>]` - List blocks
- [ ] `maestro workflow create <name>` - Create workflow
- [ ] `maestro workflow run <id> [--inputs <json>]` - Execute workflow
- [ ] `maestro agent create <name>` - Create agent block
- [ ] `maestro agent run <id> [--task <description>]` - Run autonomous agent
- [ ] `maestro run list` - List execution history
- [ ] `maestro run get <id>` - Get execution details with metrics
- [ ] `maestro training start <config-id>` - Start training run
- [ ] `maestro training status <run-id>` - Get training status
- [ ] `maestro metrics list` - List metrics/scores

### 2. LLM Provider Integration
- [ ] Backend properly configured to use local LLM models
- [ ] Models available: distilgpt2, deepseek-coder, etc.
- [ ] LLM Provider health endpoint accessible
- [ ] Inference blocks can execute with local models
- [ ] Streaming support for long-running generations

### 3. Agent Execution System
- [ ] Agents can:
  - Read/analyze code files
  - Write/modify code files
  - Execute shell commands (git, npm, dotnet, etc.)
  - Make decisions based on context
  - Chain multiple blocks together
  - Report progress and results
- [ ] Execution traces stored in database/files
- [ ] Real-time monitoring via SignalR

### 4. Traceability & Monitoring
- [ ] Every execution logged with:
  - Start/end time
  - Input/output data
  - Token usage
  - Cost estimation
  - Quality score (if applicable)
  - Error messages (if failed)
- [ ] Dashboard shows:
  - Active runs
  - Historical runs
  - Metrics aggregation
  - Training progress

### 5. Cantante Project Setup
- [ ] Project created in Maestro
- [ ] Blocks defined for Cantante development tasks
- [ ] Workflows for common operations
- [ ] Agents for autonomous development

---

## Implementation Plan

### Phase 10.1: CLI Enhancement
**Goal:** Complete CLI with all necessary commands

**Tasks:**
1. Extend `maestro-cli/index.js` with missing commands
2. Add project management commands (create, list, bind)
3. Add block creation commands
4. Add workflow creation and execution commands
5. Add agent commands
6. Add run history and metrics commands
7. Add training commands

### Phase 10.2: LLM Provider Configuration
**Goal:** Ensure local LLM models work properly

**Tasks:**
1. Verify LLM-Provider is configured for local models
2. Update backend `appsettings.json` with correct LLM settings
3. Test inference blocks with local models
4. Ensure token counting and cost estimation work
5. Add model listing endpoint if missing

### Phase 10.3: Block Executors
**Goal:** Ensure all block types can execute

**Tasks:**
1. Verify InferenceBlockExecutor works with LLM-Provider
2. Verify ToolBlockExecutor can run shell commands
3. Create AgentBlockExecutor for autonomous agents
4. Ensure WorkflowExecutor properly chains blocks
5. Add file read/write capabilities to tool blocks

### Phase 10.4: Agent Framework
**Goal:** Create autonomous agent capability

**Tasks:**
1. Define agent block schema
2. Create agent execution loop (observe → think → act)
3. Add context management for agents
4. Add decision-making inference
5. Add tool selection logic
6. Add progress reporting

### Phase 10.5: Cantante Development Blocks
**Goal:** Create blocks specific to Cantante development

**Blocks to Create:**
1. `code-analyzer.inference.block.json` - Analyze code structure
2. `code-writer.inference.block.json` - Generate code based on spec
3. `test-generator.inference.block.json` - Generate tests
4. `file-reader.tool.block.json` - Read file contents
5. `file-writer.tool.block.json` - Write file contents
6. `shell-executor.tool.block.json` - Execute shell commands
7. `cantante-developer.agent.block.json` - Main development agent
8. `cantante-dev-workflow.workflow.block.json` - Development workflow

### Phase 10.6: Cantante Project Initialization
**Goal:** Set up Cantante in Maestro

**Tasks:**
1. Create Cantante project via CLI
2. Analyze existing Cantante codebase (if any)
3. Create initial development plan
4. Configure agent with project context
5. Start first development run

---

## Current State Assessment

### What Exists:
- CLI with basic commands (list-blocks, execute-workflow, health)
- Backend API with comprehensive endpoints
- LLM-Provider gateway implementation
- Some block executors (Tool, Inference, Workflow)
- Git tool blocks (git-diff, git-status, git-log)
- Commit message inference block
- Training and metrics infrastructure

### What's Missing:
- CLI project management commands
- CLI block/workflow creation commands
- CLI agent commands
- CLI run history/metrics commands
- Agent block type and executor
- File read/write tool blocks
- Cantante-specific blocks
- Cantante project setup

---

## Success Criteria

1. **CLI Complete**: Can perform all operations via `maestro` CLI
2. **Agent Autonomous**: Agent can work on Cantante without human intervention
3. **Full Traceability**: Every action logged and visible in UI/CLI
4. **LLM Working**: Local models execute inference successfully
5. **Cantante Progress**: Agent makes meaningful progress on Cantante

---

## Execution Order

1. First, fix/verify LLM Provider integration (critical path)
2. Extend CLI with missing commands
3. Create file read/write tool blocks
4. Create agent block type and executor
5. Create Cantante project
6. Create Cantante-specific blocks
7. Run first autonomous agent session
8. Monitor and iterate

---

## Notes

- Never program Cantante directly - only through Maestro
- All changes must be traceable
- LLM Provider uses local models only (for now)
- Focus on CLI-first development
- UI is for monitoring, not primary interaction
