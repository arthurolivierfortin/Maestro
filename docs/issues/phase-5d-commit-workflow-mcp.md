# Phase 5D: Commit Description Workflow & MCP Server Foundation

**Goal**: Create a working end-to-end workflow (Commit Description Generator) and establish the foundation for exposing Maestro capabilities via MCP (Model Context Protocol) server for VS Code integration.

**Duration**: 1-2 weeks  
**Team**: Backend (1-2 developers)  
**Dependencies**: Phase 5C complete (workflow orchestration)  
**Status**: Not Started

---

## 🎯 Strategic Context

This phase delivers the first **real, usable workflow** and prepares for MCP integration:

1. **Proof of Concept**: Demonstrate the entire stack works end-to-end
2. **MCP Foundation**: Prepare Maestro to be used as a tool by LLM agents in VS Code
3. **Dogfooding**: Use Maestro to generate Maestro commit messages
4. **Template for Future Workflows**: Establish patterns for other workflows

### End Goal

After this phase, you can:
1. Run `maestro execute commit-generator` in a repo with staged changes
2. Get a properly formatted commit message
3. (Future) Have VS Code Copilot call Maestro to generate commits

---

## 🗂️ Tasks

### 5D.1 Git Diff Tool Block

Create a reusable tool block for getting git diff:

```
blocks/tools/git-diff/
├── block.json
├── script.sh
├── script.ps1          # Windows version
└── output-schema.json
```

- [x] Create `block.json` with input/output definitions
- [x] Implement `script.sh` for Unix
- [x] Implement `script.ps1` for Windows
- [x] Define output schema: `{ diff: string, files: string[], stats: object }`
- [x] Add `mock-response.json` for testing
- [x] Add unit tests (git-diff.unit.test.js)

### 5D.2 Commit Description Prompt Block

Create the prompt template for generating commit messages:

```
blocks/prompts/commit-description/
├── block.json
├── template.md
└── examples/
    ├── feat-example.md
    ├── fix-example.md
    └── refactor-example.md
```

- [x] Create `block.json` with template variables
- [x] Create `template.md`
- [x] Create example files for few-shot prompting
- [x] Add unit tests (commit-description.unit.test.js)

### 5D.3 Commit Description Inference Block

Create the inference unit that calls the LLM:

```
blocks/inference/describe-commit/
├── block.json
├── user-prompt.md
├── output-schema.json
└── mock-response.json
```

- [x] Create `block.json` with model configuration
- [x] Reference prompt block for building the prompt
- [x] Define output schema
- [x] Create `mock-response.json` for testing
- [x] Add unit tests (describe-commit.unit.test.js)

### 5D.4 Commit Format Validator Block

Create a validator to ensure proper format:

```
blocks/validators/commit-format/
├── block.json
├── validation-schema.json
└── custom-rules.js
```

- [x] Create `block.json` with validation config
- [x] Implement Conventional Commits regex validation
- [x] Check subject length (≤72 chars)
- [x] Validate type is in allowed list
- [x] Add unit tests (commit-format.unit.test.js)

### 5D.5 Commit Generator Workflow

Assemble the complete workflow:

```
blocks/workflows/commit-generator/
├── block.json
├── nodes.json
└── connections.json
```

- [x] Create `block.json` with workflow metadata
- [x] Create `nodes.json`
- [x] Create `connections.json`
- [x] Add unit tests (commit-generator.unit.test.js)

### 5D.6 End-to-End Workflow Test

- [x] Create integration test that runs full workflow (Maestro.Workflows.Integration/commit-generator.integration.test.js)
- [x] Test with mocked LLM responses
- [x] Verify correct data flow between blocks
- [x] Verify output format matches schema
- [x] Test error handling (invalid diff, LLM error)
- [x] Add test coverage report

### 5D.7 CLI Execution

Create a simple CLI to execute workflows:

- [x] Create `Maestro.Cli` project (tools/maestro-cli)
- [x] Implement `maestro execute <workflow-id>` command
- [x] Implement `maestro list` command
- [x] Implement `maestro validate <workflow-id>` command
- [x] Support `--mock` flag for testing
- [x] Support `--input key=value` for passing inputs
- [x] Output result to stdout (JSON or formatted)
- [x] Add integration tests (tests/maestro-cli.integration.test.js)

### 5D.8 MCP Server Foundation

Prepare for Model Context Protocol integration:

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│                (Copilot / Other LLM Agent)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ MCP Protocol
┌─────────────────────────────────────────────────────────────┐
│                   Maestro MCP Server                         │
│  - Tools: execute-workflow, list-workflows, get-block       │
│  - Resources: workflows, blocks, executions                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Maestro Execution Engine                    │
└─────────────────────────────────────────────────────────────┘
```

- [x] Create `Maestro.McpServer` project (tools/maestro-mcp)
- [x] Implement MCP tool: `execute-workflow`
  ```json
  {
    "name": "execute-workflow",
    "description": "Execute a Maestro workflow",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workflowId": { "type": "string" },
        "inputs": { "type": "object" }
      }
    }
  }
  ```
- [x] Implement MCP tool: `list-workflows`
- [x] Implement MCP tool: `get-workflow`
- [x] Implement MCP resource: `workflows://` for listing
- [x] Implement MCP resource: `workflow://{id}` for details
- [x] Add stdio transport for VS Code integration
- [x] Add integration tests (tests/maestro-mcp.integration.test.js)

### 5D.9 VS Code MCP Configuration

Document how to configure VS Code to use Maestro as MCP server:

- [x] Create `docs/mcp-setup.md` with setup instructions
- [x] Create example `.vscode/mcp.json` configuration
- [x] Document available tools and their usage (docs/mcp-tools.md)
- [x] Add example prompts for Copilot

### 5D.10 Project Block Discovery (.maestro folder)

Enable per-project block definitions:

- [x] Implement `.maestro/blocks/` discovery in `FileSystemBlockDiscoveryService`
- [x] Support `.maestro/workflows/` for project workflows
- [x] Implement block override logic (project > global)
- [x] Add `.maestro/config.json` for project settings
- [x] Document `.maestro/` folder structure
- [x] Add unit tests

### 5D.9 VS Code MCP Configuration

Document how to configure VS Code to use Maestro as MCP server:

- [x] Create `docs/mcp-setup.md` with setup instructions
- [x] Create example `.vscode/mcp.json` configuration:
  ```json
  {
    "servers": {
      "maestro": {
        "command": "maestro",
        "args": ["mcp-server"],
        "env": {
          "MAESTRO_ROOT": "${workspaceFolder}/.maestro"
        }
      }
    }
  }
  ```
- [ ] Document available tools and their usage
- [ ] Add example prompts for Copilot

### 5D.10 Project Block Discovery (.maestro folder)

Enable per-project block definitions:

- [x] Implement `.maestro/blocks/` discovery in `FileSystemBlockDiscoveryService`
- [x] Support `.maestro/workflows/` for project workflows
- [x] Implement block override logic (project > global)
- [x] Add `.maestro/config.json` for project settings
- [x] Document `.maestro/` folder structure
- [ ] Add unit tests

---

## 📤 Outputs

- ✅ Working commit description generator workflow
- ✅ Reusable blocks: git-diff, commit-prompt, describe-commit, commit-validator
- ✅ CLI for executing workflows
- ✅ MCP server for VS Code integration
- ✅ Project-level block discovery (.maestro folder)
- ✅ Documentation for MCP setup

---

## 🧪 Acceptance Criteria

1. **Manual Execution**: Run `maestro execute commit-generator` and get a commit message
2. **Mock Mode**: Run with `--mock` flag uses mock-response.json
3. **Frontend**: Workflow appears in Foundry, can be opened in Canvas
4. **End-to-End**: With staged git changes, workflow produces valid commit message
5. **MCP Server**: VS Code can discover and call Maestro via MCP
6. **Project Blocks**: `.maestro/blocks/` in a repo are discovered

---

## 🔧 Usage Examples

### CLI Usage

```bash
# List available workflows
maestro list

# Execute commit generator
cd my-project
git add .
maestro execute commit-generator

# Execute with additional context
maestro execute commit-generator --input context="Adding user auth"

# Execute in mock mode (no LLM calls)
maestro execute commit-generator --mock
```

### MCP Usage (VS Code Copilot)

User prompt to Copilot:
> "Generate a commit message for my staged changes using Maestro"

Copilot calls:
```json
{
  "tool": "execute-workflow",
  "arguments": {
    "workflowId": "commit-generator",
    "inputs": {}
  }
}
```

---

## ⚠️ Design Decisions

### Block Reference vs. Inline Definition

In `nodes.json`, we use `blockRef` to reference block definitions:
```json
{ "id": "git-diff", "blockRef": "tools/git-diff" }
```

Not inline definitions. This enables:
- Block reuse across workflows
- Independent block versioning
- Smaller workflow files

### MCP vs. Direct API

We support both:
- **MCP**: For LLM agent integration (VS Code Copilot, Claude Desktop)
- **REST API**: For frontend and programmatic access

MCP is a transport layer on top of the same execution engine.

### Mock Response Strategy

Each block can have `mock-response.json`:
- CLI `--mock` flag enables mock mode
- Useful for testing without API keys
- Enables deterministic benchmarking
- Frontend can use mocks during development

