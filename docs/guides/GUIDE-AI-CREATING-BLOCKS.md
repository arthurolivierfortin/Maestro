# Guide: Creating Blocks

## For Autonomous Agents (Claude Code, GPT, etc.)

---

## 1. Block Hierarchy

```
COMPOSITE (can contain children)
├── workflow   → Root container, contains everything
├── agent      → Orchestrates tools, contains: inference, decision, prompt, validator, script, tool
├── tool       → Reusable capability, contains: command, inference, validator, script, prompt
└── task       → Validated step, contains: command, validator, decision, inference, script

ATOMIC (leaves, no children)
├── prompt      → Prompt template
├── instruction → File reference
├── command     → Shell command
├── decision    → Conditional branching
├── validator   → Output validation
├── trigger     → Trigger
├── inference   → LLM call
└── script      → Custom code
```

---

## 2. Fundamental Rule: Tools = Shell Commands

**Tools MUST NOT have custom backend code.**

They use shell commands with variable substitution `{{inputName}}`:

```json
{
  "id": "directory-list",
  "blockType": "tool",
  "isAtomic": false,
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Name"]
  }
}
```

The backend replaces `{{path}}` with the corresponding input value.

---

## 3. Create a Tool

### JSON Structure

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Description of what the tool does",

  "inputs": [
    {
      "id": "path",
      "name": "Path",
      "type": "string",
      "required": true,
      "description": "File/folder path"
    },
    {
      "id": "pattern",
      "name": "Pattern",
      "type": "string",
      "required": false,
      "default": "*"
    }
  ],

  "outputs": [
    {
      "id": "result",
      "name": "Result",
      "type": "string"
    },
    {
      "id": "success",
      "name": "Success",
      "type": "boolean"
    }
  ],

  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Filter '{{pattern}}' -Name"],
    "timeout": 30000
  },

  "children": [],

  "metadata": {
    "category": "filesystem",
    "tags": ["filesystem", "list", "directory"],
    "author": "claude-code"
  }
}
```

### Register the Tool

```bash
# Option 1: Create the JSON file then register
# Save to blocks/global/tools/my-tool.tool.block.json

# Option 2: Via CLI
maestro tools create \
  --name "My Tool" \
  --block <workflow-block-id> \
  --description "Description" \
  --category "filesystem" \
  --tags "filesystem,utility"
```

### Shell Command Examples

**List a directory:**
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Name"]
  }
}
```

**Search in files:**
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Select-String -Path '{{path}}' -Pattern '{{pattern}}' | ForEach-Object { $_.Line }"]
  }
}
```

**Read a file:**
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-Content -Path '{{path}}' -Raw"]
  }
}
```

**Write a file:**
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Set-Content -Path '{{path}}' -Value '{{content}}'"]
  }
}
```

**REST API call:**
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Invoke-RestMethod -Uri '{{url}}' -Method {{method}} -Body '{{body}}' -ContentType 'application/json'"]
  }
}
```

**Git command:**
```json
{
  "config": {
    "command": "git",
    "args": ["{{gitCommand}}", "{{gitArgs}}"]
  }
}
```

---

## 4. Create an Agent

### JSON Structure

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Agent that does X",

  "inputs": [
    {
      "id": "goal",
      "name": "Goal",
      "type": "string",
      "required": true,
      "description": "The objective to accomplish"
    },
    {
      "id": "workingDir",
      "name": "Working Directory",
      "type": "string",
      "required": true
    },
    {
      "id": "context",
      "name": "Context",
      "type": "string",
      "required": false
    }
  ],

  "outputs": [
    {
      "id": "result",
      "name": "Result",
      "type": "string"
    },
    {
      "id": "success",
      "name": "Success",
      "type": "boolean"
    },
    {
      "id": "filesModified",
      "name": "Files Modified",
      "type": "array"
    }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxSteps": 10,
    "maxTokens": 10000,
    "temperature": 0.7,
    "timeoutMs": 300000,
    "requireApproval": false,
    "tools": ["file-read", "file-write", "shell-execute", "git-status"],
    "systemPrompt": "You are an expert developer. Your task: {{goal}}\n\nAvailable tools:\n- file-read: Read files\n- file-write: Write files\n- shell-execute: Execute commands\n- git-status: Check git status\n\nApproach:\n1. Analyze\n2. Plan\n3. Execute\n4. Validate"
  },

  "children": [],

  "capabilities": ["code-generation", "file-manipulation"],

  "metadata": {
    "category": "development",
    "tags": ["agent", "code", "autonomous"],
    "author": "claude-code"
  }
}
```

### Register the Agent

```bash
maestro agents create \
  --name "My Agent" \
  --block <workflow-block-id> \
  --description "Agent that does X" \
  --version "1.0.0" \
  --category "development" \
  --capabilities "code-generation,file-manipulation" \
  --tools "file-read,file-write,shell-execute" \
  --tags "agent,development"
```

### Key Points for Agents

1. **systemPrompt** defines behavior
2. **tools** lists tools the agent can use
3. **maxSteps** limits number of iterations
4. **temperature** controls creativity (0.0-1.0)

---

## 5. Create a Workflow

### JSON Structure

```json
{
  "id": "my-workflow",
  "name": "My Workflow",
  "blockType": "workflow",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Workflow that orchestrates X",

  "inputs": [
    {
      "id": "input",
      "name": "Input",
      "type": "any",
      "required": true
    }
  ],

  "outputs": [
    {
      "id": "output",
      "name": "Output",
      "type": "any"
    }
  ],

  "config": {
    "type": "workflow",
    "description": "Workflow description",
    "version": "1.0.0",
    "variables": []
  },

  "children": [
    {
      "id": "step-1",
      "blockRef": "tools/file-read",
      "inputs": {
        "path": "{{input.filePath}}"
      }
    },
    {
      "id": "step-2",
      "blockRef": "agents/code-developer",
      "inputs": {
        "goal": "Improve this code",
        "content": "{{step-1.content}}"
      }
    }
  ],

  "metadata": {
    "category": "development",
    "tags": ["workflow", "automation"]
  }
}
```

---

## 6. Atomic Blocks

### Command (Shell Command)

```json
{
  "id": "my-command",
  "blockType": "command",
  "isAtomic": true,
  "config": {
    "type": "command",
    "commandType": "Bash",
    "command": "ls -la {{path}}",
    "arguments": []
  }
}
```

### Inference (LLM Call)

```json
{
  "id": "my-inference",
  "blockType": "inference",
  "isAtomic": true,
  "config": {
    "type": "inference",
    "systemPrompt": "You are a helpful assistant.",
    "userPrompt": "{{userInput}}",
    "temperature": 0.7,
    "maxTokens": 1000,
    "responseFormat": "text"
  }
}
```

### Decision (Branching)

```json
{
  "id": "my-decision",
  "blockType": "decision",
  "isAtomic": true,
  "config": {
    "type": "decision",
    "condition": "{{input.value}} > 10",
    "trueLabel": "High",
    "falseLabel": "Low"
  }
}
```

### Validator (Validation)

```json
{
  "id": "my-validator",
  "blockType": "validator",
  "isAtomic": true,
  "config": {
    "type": "validator",
    "validationType": "Schema",
    "schema": {
      "type": "object",
      "required": ["name", "value"]
    }
  }
}
```

### Prompt (Template)

```json
{
  "id": "my-prompt",
  "blockType": "prompt",
  "isAtomic": true,
  "config": {
    "type": "prompt",
    "template": "You must accomplish this task: {{task}}\n\nContext: {{context}}",
    "variables": ["task", "context"]
  }
}
```

---

## 7. Allowed Parent-Child Relationships

| Parent | Allowed Children |
|--------|------------------|
| `workflow` | All types |
| `agent` | inference, decision, prompt, validator, script, tool |
| `tool` | command, inference, validator, script, prompt |
| `task` | command, validator, decision, inference, script |

**Valid example:**
```
workflow
└── agent
    ├── tool
    │   └── command  ✓
    └── inference    ✓
```

**Invalid example:**
```
agent
└── task           ✗ (task cannot be child of agent)
```

---

## 8. Best Practices

### For Tools

1. **Single responsibility** - One tool = one action
2. **Shell commands** - No backend code
3. **Strict I/O schemas** - Clearly define inputs/outputs
4. **Descriptive names** - `file-read` not `fr`
5. **Documentation** - Clear description

### For Agents

1. **Clear systemPrompt** - Precise instructions
2. **Limited tools** - Only those necessary
3. **Reasonable maxSteps** - Start small (10-20)
4. **Appropriate temperature** - 0.3-0.5 for precision, 0.7-0.9 for creativity

### For Workflows

1. **Clear sequential steps** - Logical order
2. **Error handling** - Validators and decisions
3. **Output referencing** - `{{step-1.output}}`

---

## 9. Verify a Block

```bash
# Check that a block exists
maestro info <block-id>

# Validate the structure
maestro validate <workflow-id>

# Test execution
maestro run <block-id> --input key=value

# View metrics
maestro tools metrics <tool-id>
maestro agents metrics <agent-id>
```

---

## 10. Reference Commands

```bash
# List blocks
maestro blocks
maestro workflows
maestro agents
maestro tools

# Create
maestro tools create --name X --block Y [options]
maestro agents create --name X --block Y [options]

# Information
maestro info <block-id>
maestro agents info <agent-id>
maestro tools info <tool-id>

# Metrics
maestro agents metrics <id>
maestro tools metrics <id>

# Delete
maestro agents delete <id> --force
maestro tools delete <id> --force
```

---

## Related Documents

- `GUIDE-AI-MENTALITY.md` - Philosophy and mentality
- `GUIDE-AI-CLI-REFERENCE.md` - Complete CLI reference
