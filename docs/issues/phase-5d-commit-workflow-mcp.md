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

- [ ] Create `block.json` with input/output definitions
- [ ] Implement `script.sh` for Unix:
  ```bash
  #!/bin/bash
  git diff --staged --no-color
  ```
- [ ] Implement `script.ps1` for Windows
- [ ] Define output schema: `{ diff: string, files: string[], stats: object }`
- [ ] Add mock-response.json for testing
- [ ] Add unit tests
 - [x] Create `block.json` with input/output definitions
 - [x] Implement `script.sh` for Unix:
 - [x] Implement `script.ps1` for Windows
 - [x] Define output schema: `{ diff: string, files: string[], stats: object }`
 - [x] Add mock-response.json for testing
 - [ ] Add unit tests

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

- [ ] Create `block.json` with template variables
- [ ] Create `template.md`:
  ```markdown
  You are a commit message generator following Conventional Commits.
  
  ## Git Diff
  {{diff}}
  
  ## Context (optional)
  {{context}}
  
  ## Instructions
  Generate a commit message following this format:
  - Type: feat, fix, refactor, docs, test, chore
  - Scope: optional, in parentheses
  - Subject: imperative, lowercase, no period
  - Body: optional, explain what and why
  
  ## Examples
  {{#each examples}}
  {{this}}
  {{/each}}
  ```
- [ ] Create example files for few-shot prompting
- [ ] Add unit tests
 - [x] Create `block.json` with template variables
 - [x] Create `template.md`:
 - [x] Create example files for few-shot prompting
 - [ ] Add unit tests

### 5D.3 Commit Description Inference Block

Create the inference unit that calls the LLM:

```
blocks/inference/describe-commit/
├── block.json
├── user-prompt.md
├── output-schema.json
└── mock-response.json
```

- [ ] Create `block.json` with model configuration
- [ ] Reference prompt block for building the prompt
- [ ] Define output schema:
  ```json
  {
    "type": "object",
    "properties": {
      "type": { "type": "string", "enum": ["feat", "fix", "refactor", "docs", "test", "chore"] },
      "scope": { "type": "string" },
      "subject": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["type", "subject"]
  }
  ```
- [ ] Create mock-response.json for testing
- [ ] Add unit tests
 - [x] Create `block.json` with model configuration
 - [x] Reference prompt block for building the prompt
 - [x] Define output schema:
 - [x] Create mock-response.json for testing
 - [ ] Add unit tests

### 5D.4 Commit Format Validator Block

Create a validator to ensure proper format:

```
blocks/validators/commit-format/
├── block.json
├── validation-schema.json
└── custom-rules.js
```

- [ ] Create `block.json` with validation config
- [ ] Implement Conventional Commits regex validation
- [ ] Check subject length (≤72 chars)
- [ ] Validate type is in allowed list
- [ ] Add unit tests
 - [x] Create `block.json` with validation config
 - [x] Implement Conventional Commits regex validation
 - [x] Check subject length (≤72 chars)
 - [x] Validate type is in allowed list
 - [ ] Add unit tests

### 5D.5 Commit Generator Workflow

Assemble the complete workflow:

```
blocks/workflows/commit-generator/
├── block.json
├── nodes.json
└── connections.json
```

- [ ] Create `block.json` with workflow metadata
- [ ] Create `nodes.json`:
  ```json
  [
    { "id": "trigger", "blockRef": "triggers/manual", "position": { "x": 100, "y": 200 } },
    { "id": "git-diff", "blockRef": "tools/git-diff", "position": { "x": 300, "y": 200 } },
    { "id": "describe", "blockRef": "inference/describe-commit", "position": { "x": 500, "y": 200 } },
    { "id": "validate", "blockRef": "validators/commit-format", "position": { "x": 700, "y": 200 } }
  ]
  ```
- [ ] Create `connections.json`:
  ```json
  [
    { "from": "trigger", "fromPort": "context", "to": "describe", "toPort": "context" },
    { "from": "git-diff", "fromPort": "diff", "to": "describe", "toPort": "diff" },
    { "from": "describe", "fromPort": "message", "to": "validate", "toPort": "input" }
  ]
  ```
- [ ] Add unit tests
 - [x] Create `block.json` with workflow metadata
 - [x] Create `nodes.json`:
 - [x] Create `connections.json`:
 - [ ] Add unit tests

### 5D.6 End-to-End Workflow Test

- [ ] Create integration test that runs full workflow
- [ ] Test with mocked LLM responses
- [ ] Verify correct data flow between blocks
- [ ] Verify output format matches schema
- [ ] Test error handling (invalid diff, LLM error)
- [ ] Add test coverage report
 - [ ] Create integration test that runs full workflow
 - [ ] Test with mocked LLM responses
 - [ ] Verify correct data flow between blocks
 - [ ] Verify output format matches schema
 - [ ] Test error handling (invalid diff, LLM error)
 - [ ] Add test coverage report

### 5D.7 CLI Execution

Create a simple CLI to execute workflows:

- [ ] Create `Maestro.Cli` project
- [ ] Implement `maestro execute <workflow-id>` command
- [ ] Implement `maestro list` command
- [ ] Implement `maestro validate <workflow-id>` command
- [ ] Support `--mock` flag for testing
- [ ] Support `--input key=value` for passing inputs
- [ ] Output result to stdout (JSON or formatted)
- [ ] Add integration tests
- [x] Create `Maestro.Cli` project (lightweight Node.js PoC under `tools/maestro-cli`)
- [x] Implement `maestro execute <workflow-id>` command (PoC, supports `--mock`)
- [x] Implement `maestro list` command (PoC)
- [ ] Implement `maestro validate <workflow-id>` command
- [x] Support `--mock` flag for testing (PoC)
- [x] Support `--input key=value` for passing inputs (PoC)
- [x] Output result to stdout (JSON or formatted)
- [ ] Add integration tests


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

- [ ] Create `Maestro.McpServer` project
- [ ] Implement MCP tool: `execute-workflow`
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
- [ ] Implement MCP tool: `list-workflows`
- [ ] Implement MCP tool: `get-workflow`
- [ ] Implement MCP resource: `workflows://` for listing
- [ ] Implement MCP resource: `workflow://{id}` for details
- [ ] Add stdio transport for VS Code integration
- [ ] Add integration tests
 - [x] Create `Maestro.McpServer` project (lightweight PoC under `tools/maestro-mcp`)
 - [x] Implement MCP tool: `execute-workflow` (stdio PoC)
 - [ ] Implement MCP tool: `list-workflows`
 - [ ] Implement MCP tool: `get-workflow`
 - [ ] Implement MCP resource: `workflows://` for listing
 - [ ] Implement MCP resource: `workflow://{id}` for details
 - [x] Add stdio transport for VS Code integration (PoC: `tools/maestro-mcp/index.js`)
 - [ ] Add integration tests
 - [ ] Create `Maestro.McpServer` project
 - [ ] Implement MCP tool: `execute-workflow`
 - [ ] Implement MCP tool: `list-workflows`
 - [ ] Implement MCP tool: `get-workflow`
 - [ ] Implement MCP resource: `workflows://` for listing
 - [ ] Implement MCP resource: `workflow://{id}` for details
 - [ ] Add stdio transport for VS Code integration
 - [ ] Add integration tests

### 5D.9 VS Code MCP Configuration

Document how to configure VS Code to use Maestro as MCP server:

- [ ] Create `docs/mcp-setup.md` with setup instructions
- [ ] Create example `.vscode/mcp.json` configuration:
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
 - [x] Create `docs/mcp-setup.md` with setup instructions
 - [x] Create example `.vscode/mcp.json` configuration:
 - [ ] Document available tools and their usage
 - [ ] Add example prompts for Copilot

### 5D.10 Project Block Discovery (.maestro folder)

Enable per-project block definitions:

- [ ] Implement `.maestro/blocks/` discovery in `FileSystemBlockDiscoveryService`
- [ ] Support `.maestro/workflows/` for project workflows
- [ ] Implement block override logic (project > global)
- [ ] Add `.maestro/config.json` for project settings
- [ ] Document `.maestro/` folder structure
- [ ] Add unit tests
 - [ ] Implement `.maestro/blocks/` discovery in `FileSystemBlockDiscoveryService`
 - [ ] Support `.maestro/workflows/` for project workflows
 - [ ] Implement block override logic (project > global)
 - [ ] Add `.maestro/config.json` for project settings
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

