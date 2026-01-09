# ADR 0002: Workflow Persistence in Git

**Status**: Accepted  
**Date**: 2024-01-09  
**Decision Makers**: Architecture Team

---

## Context

Workflows are the core artifacts in Maestro. They define multi-step automation processes that orchestrate agents and tools. We need to decide how to store, version, and share workflows.

### The Problem

- Workflows need to be persistent and retrievable
- Users should be able to share workflows with teams
- Workflow changes should be tracked over time
- Workflows should be portable across environments
- Need to support workflow reuse and templates

### Requirements

1. Version control for workflows
2. Human-readable format
3. Collaboration support (share, fork, modify)
4. Portable across machines and environments
5. Integrate with existing development tools
6. Support workflow templates and examples

---

## Decision

**Workflows will be stored as JSON files in the Git repository, versioned alongside code.**

### Structure

```
Meastro/
├── workflows/
│   ├── examples/                    # Provided examples
│   │   ├── simple-coder.json
│   │   ├── full-feature-pipeline.json
│   │   └── pr-review-workflow.json
│   ├── my-custom-workflow.json     # User workflows
│   └── team-workflow.json          # Shared workflows
```

### Workflow File Format

Workflows are stored as JSON with this structure:

```json
{
  "$schema": "../docs/schemas/workflow-schema.json",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Feature Development Pipeline",
  "description": "Complete feature development from planning to PR creation",
  "version": "1.2.0",
  "author": "team@example.com",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-09T00:00:00Z",
  "nodes": [
    {
      "id": "node-1",
      "type": "AgentNode",
      "agentType": "Planner",
      "name": "Plan Feature",
      "position": { "x": 100, "y": 100 },
      "config": {
        "task": "Create detailed implementation plan",
        "outputFormat": "markdown"
      }
    },
    {
      "id": "node-2",
      "type": "AgentNode",
      "agentType": "Coder",
      "name": "Implement Feature",
      "position": { "x": 300, "y": 100 },
      "config": {
        "language": "csharp",
        "useTests": true
      }
    },
    {
      "id": "node-3",
      "type": "ToolNode",
      "toolType": "Git",
      "name": "Create PR",
      "position": { "x": 500, "y": 100 },
      "config": {
        "command": "create-pr",
        "branch": "feature/auto-generated"
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "from": "node-1",
      "to": "node-2",
      "fromOutput": "plan",
      "toInput": "requirements"
    },
    {
      "id": "conn-2",
      "from": "node-2",
      "to": "node-3",
      "fromOutput": "code",
      "toInput": "changes"
    }
  ],
  "metadata": {
    "tags": ["feature", "full-pipeline"],
    "estimatedDuration": "PT30M",
    "requiredTools": ["git", "dotnet"]
  }
}
```

### Schema Validation

JSON Schema provides validation:

```
docs/
└── schemas/
    ├── workflow-schema.json        # Main workflow schema
    ├── node-schema.json            # Node definition schema
    └── connection-schema.json      # Connection schema
```

---

## Consequences

### Positive

1. **Version Control**: Full Git history for all workflow changes
2. **Collaboration**: Share workflows via pull requests and branches
3. **Human-Readable**: JSON is easily readable and editable
4. **Portable**: Copy workflows between machines, no database needed
5. **Diff-Friendly**: Git diffs show exactly what changed in workflows
6. **CI/CD Integration**: Workflows can be validated in pipelines
7. **Backup**: Git provides built-in backup and recovery
8. **Templates**: Example workflows serve as starting points
9. **Discoverability**: Browse workflows in repository
10. **No Database**: Simplifies deployment and reduces dependencies

### Negative

1. **Merge Conflicts**: Complex workflows may have merge conflicts
2. **No Central Registry**: No single place to discover all workflows (yet)
3. **Manual Sync**: Users must pull/push to share workflows
4. **Limited Querying**: Can't query workflows like a database
5. **File System Limits**: Large number of workflows = many files

### Mitigations

- **Merge conflicts**: Provide clear guidelines on workflow structure
- **Discovery**: Add `workflows/README.md` with index of available workflows
- **Sync**: Future: optional cloud sync feature
- **Querying**: Application layer can index workflows on startup
- **Organization**: Support subdirectories: `workflows/ci/`, `workflows/features/`

---

## Implementation Details

### Loading Workflows

Backend reads workflows from file system:

```csharp
public class JsonWorkflowRepository : IWorkflowRepository
{
    private readonly string _workflowsPath;
    
    public async Task<Workflow?> GetByIdAsync(WorkflowId id)
    {
        var files = Directory.GetFiles(_workflowsPath, "*.json", SearchOption.AllDirectories);
        
        foreach (var file in files)
        {
            var json = await File.ReadAllTextAsync(file);
            var dto = JsonSerializer.Deserialize<WorkflowDto>(json);
            
            if (dto?.Id == id.Value)
                return MapToDomain(dto);
        }
        
        return null;
    }
}
```

### Saving Workflows

```csharp
public async Task SaveAsync(Workflow workflow)
{
    var dto = MapToDto(workflow);
    var json = JsonSerializer.Serialize(dto, new JsonSerializerOptions 
    { 
        WriteIndented = true  // Pretty-print for readability
    });
    
    var filePath = Path.Combine(_workflowsPath, $"{workflow.Name}.json");
    await File.WriteAllTextAsync(filePath, json);
    
    // Git operations handled separately (optional auto-commit)
}
```

### Validation

Workflows are validated against JSON Schema before execution:

```csharp
public class WorkflowValidator
{
    private readonly JsonSchema _schema;
    
    public ValidationResult Validate(WorkflowDto workflow)
    {
        var result = _schema.Validate(workflow);
        
        if (!result.IsValid)
            return ValidationResult.Failure(result.Errors);
        
        // Additional business rules
        ValidateCycles(workflow);
        ValidateNodeConnections(workflow);
        
        return ValidationResult.Success();
    }
}
```

---

## Alternatives Considered

### Alternative 1: Database Storage

Store workflows in SQLite/PostgreSQL database.

**Rejected because**:
- Requires database setup and management
- Not easily shareable (need export/import)
- Harder to version control
- Additional infrastructure dependency
- Backup and recovery more complex

### Alternative 2: Binary Format

Store workflows in binary format (protobuf, MessagePack).

**Rejected because**:
- Not human-readable
- Difficult to diff and review
- Requires special tools to inspect
- JSON is sufficient for workflow size

### Alternative 3: YAML Format

Use YAML instead of JSON.

**Considered but deferred**:
- YAML is more human-friendly (less quotes, cleaner)
- However: JSON has better tooling and schema support
- May add YAML support in future as alternative format

### Alternative 4: Cloud Storage

Store workflows in cloud (S3, Azure Blob).

**Rejected for v1**:
- Adds complexity and external dependency
- Desktop-first approach favors local storage
- May add as optional feature later
- Git still needed for versioning

---

## Future Enhancements

### Phase 2: Workflow Marketplace
- Central repository of community workflows
- Download/upload workflows from UI
- Ratings and comments

### Phase 3: Advanced Features
- Workflow inheritance (extend base workflows)
- Workflow composition (include other workflows as sub-workflows)
- Parameterized workflows (templates with variables)

### Phase 4: Cloud Sync
- Optional cloud backup
- Sync across devices
- Team workspace for shared workflows

---

## References

- [JSON Schema](https://json-schema.org/)
- [Git for Version Control](https://git-scm.com/)
- [n8n Workflow Storage](https://docs.n8n.io/) (similar approach)

---

## Status History

- 2024-01-09: Accepted
