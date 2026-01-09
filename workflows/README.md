# Workflows Directory

This directory contains B-One Maestro workflow definitions stored as JSON files.

## 📁 Structure

```
workflows/
├── examples/                        # Example workflows (provided)
│   ├── simple-coder.json
│   ├── full-feature-pipeline.json
│   └── pr-review-workflow.json
├── my-workflow.json                 # Your custom workflows
└── team-workflow.json               # Shared workflows
```

## 🎯 Purpose

Workflows are stored as JSON files in Git for several reasons:

- **Version Control**: Track changes to workflows over time
- **Collaboration**: Share workflows via pull requests
- **Portability**: Copy workflows between machines
- **Human-Readable**: Inspect and edit workflows as JSON
- **Backup**: Git provides automatic backup

## 📝 Workflow Format

Each workflow is a JSON file conforming to the [Workflow Schema](../docs/schemas/workflow-schema.json).

### Basic Structure

```json
{
  "$schema": "../docs/schemas/workflow-schema.json",
  "id": "unique-uuid",
  "name": "Workflow Name",
  "description": "What this workflow does",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node-1",
      "type": "AgentNode",
      "agentType": "Coder",
      "name": "Generate Code",
      "position": { "x": 100, "y": 100 },
      "config": { /* node-specific config */ }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "from": "node-1",
      "to": "node-2",
      "fromOutput": "code",
      "toInput": "input"
    }
  ],
  "metadata": {
    "tags": ["example"],
    "estimatedDuration": "PT10M"
  }
}
```

## 🔧 Node Types

Workflows consist of different node types:

### 1. **AgentNode**
Executes an AI agent (Planner, Coder, Tester, Reviewer, Debugger).

```json
{
  "type": "AgentNode",
  "agentType": "Coder",
  "config": {
    "language": "csharp",
    "tools": ["filesystem", "bash"]
  }
}
```

### 2. **ToolNode**
Runs a tool (Bash command, Git operation, File system access).

```json
{
  "type": "ToolNode",
  "toolType": "Git",
  "config": {
    "command": "create-pr"
  }
}
```

### 3. **DecisionNode**
Conditional branching based on previous outputs.

```json
{
  "type": "DecisionNode",
  "config": {
    "condition": {
      "type": "boolean",
      "path": "testResults.allPassed"
    }
  }
}
```

### 4. **ValidatorNode**
Validates outputs against rules or schemas.

```json
{
  "type": "ValidatorNode",
  "config": {
    "validationType": "syntax",
    "rules": { "requireCompilation": true }
  }
}
```

### 5. **TriggerNode**
Initiates workflow (manual, webhook, schedule).

```json
{
  "type": "TriggerNode",
  "config": {
    "triggerType": "manual",
    "inputSchema": { /* expected inputs */ }
  }
}
```

## 📚 Examples

### Simple Code Generator

See [`examples/simple-coder.json`](./examples/simple-coder.json)

A basic workflow that:
1. Takes a task description
2. Generates code using Coder agent
3. Validates the output

**Use case**: Quick code generation for simple tasks.

### Full Feature Pipeline

See [`examples/full-feature-pipeline.json`](./examples/full-feature-pipeline.json)

An advanced workflow that:
1. Plans feature implementation
2. Writes code
3. Creates tests
4. Runs tests (with retry on failure)
5. Reviews code
6. Creates pull request

**Use case**: Complete end-to-end feature development.

## ✏️ Creating Workflows

### Option 1: Visual Editor (Recommended)

Use the Maestro UI to:
1. Drag and drop nodes
2. Connect nodes visually
3. Configure each node
4. Save workflow to file

### Option 2: Manual JSON Creation

1. Copy an example workflow
2. Modify the JSON structure
3. Validate against schema
4. Save to `workflows/` directory

### Option 3: Programmatic Creation

Use the Maestro API to create workflows programmatically (future feature).

## ✅ Validation

Workflows are validated against the JSON Schema before execution:

```bash
# Validate a workflow (example)
npx ajv-cli validate -s docs/schemas/workflow-schema.json -d workflows/my-workflow.json
```

The application also validates workflows at runtime before execution.

## 🔄 Versioning

Workflows use semantic versioning (e.g., `1.2.3`):

- **Major**: Breaking changes to workflow structure
- **Minor**: New features or nodes added
- **Patch**: Bug fixes or minor adjustments

Update the `version` field when modifying a workflow.

## 🤝 Sharing Workflows

### Via Git

1. Create a workflow in `workflows/`
2. Commit to Git: `git add workflows/my-workflow.json`
3. Push to remote: `git push`
4. Create PR for team review

### Via Export

1. Export workflow from UI
2. Send JSON file to colleague
3. Colleague imports via UI or copies to `workflows/`

## 🏷️ Metadata

Add metadata to help organize workflows:

```json
{
  "metadata": {
    "tags": ["feature", "testing", "production"],
    "estimatedDuration": "PT30M",
    "requiredTools": ["git", "dotnet", "bash"],
    "author": "team@example.com",
    "lastModified": "2024-01-09"
  }
}
```

## 🔒 Security

**Important**:
- Do NOT commit API keys or secrets in workflows
- Use environment variables or secret management
- Review workflows before execution
- Restrict tool permissions appropriately

## 🚀 Tips

1. **Start simple**: Begin with example workflows
2. **Test incrementally**: Add nodes one at a time
3. **Use descriptive names**: Name nodes clearly (e.g., "Generate User Service" not "Node 1")
4. **Document complex logic**: Add descriptions to nodes
5. **Version control**: Commit workflows regularly
6. **Share templates**: Create reusable workflow templates for common tasks

## 📖 Additional Resources

- [Workflow Schema](../docs/schemas/workflow-schema.json) - Complete JSON schema
- [Project Structure](../docs/PROJECT_STRUCTURE.md) - Full project organization
- [Architecture Decision Records](../docs/adr/) - Key design decisions
- [Main README](../README.md) - Project overview

---

Happy workflow building! 🎉
