# Guide: Maestro Session Types

## Overview

A **Session** in Maestro is a **composable, Docker-based environment** where work is executed. The architecture has evolved from hardcoded session types to a unified, flexible system.

## Key Concepts

### Unified Session Model

All sessions share a single `Session` entity with composable configuration:

| Component | Description |
|-----------|-------------|
| **Environment Mode** | `Sandbox` (ephemeral) or `Repo` (bind-mounted) |
| **Sandbox Image** | Docker image providing the runtime environment |
| **Category** | User-defined organizational grouping |
| **Template** | Reusable preset for quick session creation |

### Environment Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Sandbox** | Ephemeral container, no persistence | Testing, experiments, training |
| **Repo** | Bind-mounted to host repository | Real project work, development |

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION (Unified)                         │
│                                                              │
│  Config:                                                     │
│  ├── mode: "sandbox" | "repo"                               │
│  ├── sandboxImageId: "sandbox-git"                          │
│  ├── categoryId?: "projects" (user-defined)                 │
│  ├── repoBind?: { hostPath, containerPath }                 │
│  └── templateId?: "quick-git-test"                          │
│                                                              │
│                    ┌─────────────┐                           │
│                    │   DOCKER    │                           │
│                    │  Container  │                           │
│                    │  (always)   │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## User-Defined Categories

Categories are **user-defined** organizational groups for sessions. Unlike the previous hardcoded "purpose" enum, users can create their own categories to organize sessions however they prefer.

### Built-in Categories

Maestro provides several built-in categories as starting points:

| Category ID | Name | Description | Deletable |
|-------------|------|-------------|-----------|
| `system` | System | System workflows and maintenance | **No** |
| `projects` | Projects | Repository-based work | Yes |
| `foundry` | Foundry | Block development and testing | Yes |
| `testing` | Testing | Tests and experiments | Yes |
| `training` | Training | Model training and fine-tuning | Yes |

### Creating Custom Categories

Users can create their own categories:

```typescript
// API: POST /api/session-categories
{
  "id": "documentation",
  "name": "Documentation",
  "description": "Sessions for generating and maintaining docs",
  "icon": "book",
  "color": "#8B5CF6",
  "displayOrder": 50
}
```

### Category Properties

| Property | Description |
|----------|-------------|
| `id` | Unique slug identifier |
| `name` | Display name |
| `description` | Optional description |
| `icon` | Icon name for UI |
| `color` | Color for UI styling |
| `source` | `built-in` or `user-defined` |
| `isSystem` | If true, cannot be deleted |
| `displayOrder` | Sorting order in UI |

---

## Sandbox Images

Sandbox images are Docker images registered with Maestro for use in sessions.

### Built-in Images

| Image ID | Docker Image | Tools |
|----------|--------------|-------|
| `sandbox-empty` | `maestro/sandbox-empty:latest` | sh |
| `sandbox-git` | `maestro/sandbox-git:latest` | git, bash |
| `sandbox-nodejs` | `maestro/sandbox-nodejs:latest` | node, npm, git |
| `sandbox-python` | `maestro/sandbox-python:latest` | python, pip, git |

### Registering Custom Images

Users create Docker images externally and register them with Maestro:

```typescript
// API: POST /api/sandbox-images
{
  "id": "my-custom-image",
  "name": "My Custom Environment",
  "dockerImage": "myregistry/custom-env:latest",
  "tags": ["custom", "specialized"],
  "tools": ["custom-tool", "another-tool"]
}
```

### Image Verification

Verify an image exists and is accessible:

```
GET /api/sandbox-images/{id}/verify
```

---

## Session Templates

Templates are reusable presets that combine environment mode, sandbox image, and category.

### Built-in Templates

| Template ID | Name | Mode | Image | Category |
|-------------|------|------|-------|----------|
| `quick-git-test` | Quick Git Test | Sandbox | sandbox-git | testing |
| `project-default` | Project Session | Repo | sandbox-git | projects |
| `foundry-default` | Foundry Session | Sandbox | sandbox-nodejs | foundry |
| `training-default` | Training Session | Sandbox | sandbox-nodejs | training |
| `nodejs-sandbox` | Node.js Sandbox | Sandbox | sandbox-nodejs | testing |
| `python-sandbox` | Python Sandbox | Sandbox | sandbox-python | testing |

### Creating Sessions from Templates

```typescript
// API: POST /api/sessions/from-template/{templateId}
{
  "name": "My Test Session",
  "authority": "human",
  // For Repo mode templates:
  "repoBind": {
    "hostPath": "/path/to/repo",
    "containerPath": "/workspace"
  }
}
```

---

## Session Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ CREATED │────►│ RUNNING │────►│ PAUSED  │────►│ STOPPED │
└─────────┘     └────┬────┘     └────┬────┘     └─────────┘
                     │               │
                     │◄──────────────┘
                     │         (Resume)
                     ▼
               ┌──────────┐
               │COMPLETED │
               │ or ERROR │
               └──────────┘
```

### States

| State | Description |
|-------|-------------|
| `created` | Session configured but not started |
| `running` | Session active, accepting commands |
| `paused` | Temporarily suspended |
| `completed` | Finished successfully |
| `failed` | Terminated with error |
| `stopped` | Manually stopped |
| `cancelled` | Cancelled before completion |

---

## API Reference

### Sessions

```
GET    /api/sessions                              # List all sessions
GET    /api/sessions?categoryId=projects          # Filter by category
GET    /api/sessions?mode=sandbox                 # Filter by mode
GET    /api/sessions?status=running               # Filter by status
GET    /api/sessions/active                       # Get active sessions
POST   /api/sessions                              # Create session
POST   /api/sessions/from-template/{templateId}   # Create from template
GET    /api/sessions/{id}                         # Get session details
DELETE /api/sessions/{id}                         # Delete session
POST   /api/sessions/{id}/start                   # Start session
POST   /api/sessions/{id}/stop                    # Stop session
POST   /api/sessions/{id}/pause                   # Pause session
POST   /api/sessions/{id}/resume                  # Resume session
POST   /api/sessions/{id}/exec                    # Execute command
```

### Session Categories

```
GET    /api/session-categories                    # List all categories
GET    /api/session-categories/builtin            # Built-in only
GET    /api/session-categories/user-defined       # User-defined only
POST   /api/session-categories                    # Create category
GET    /api/session-categories/{id}               # Get category
PUT    /api/session-categories/{id}               # Update category
DELETE /api/session-categories/{id}               # Delete category
```

### Sandbox Images

```
GET    /api/sandbox-images                        # List all images
GET    /api/sandbox-images/builtin                # Built-in only
GET    /api/sandbox-images/user-defined           # User-defined only
POST   /api/sandbox-images                        # Register image
GET    /api/sandbox-images/{id}                   # Get image
PUT    /api/sandbox-images/{id}                   # Update image
DELETE /api/sandbox-images/{id}                   # Delete image
GET    /api/sandbox-images/{id}/verify            # Verify image
```

### Session Templates

```
GET    /api/session-templates                     # List all templates
GET    /api/session-templates/builtin             # Built-in only
GET    /api/session-templates/user-defined        # User-defined only
POST   /api/session-templates                     # Create template
GET    /api/session-templates/{id}                # Get template
PUT    /api/session-templates/{id}                # Update template
DELETE /api/session-templates/{id}                # Delete template
```

---

## Example Workflows

### 1. Quick Sandbox Test

```typescript
// Create a quick sandbox session for testing
const session = await sessionService.createFromTemplate('quick-git-test', {
  name: 'Git Experiment'
});

await sessionService.start(session.id);
await sessionService.exec(session.id, 'git init');
await sessionService.exec(session.id, 'git branch -a');
await sessionService.stop(session.id);
```

### 2. Project Development Session

```typescript
// Create a session bound to a real repository
const session = await sessionService.create({
  name: 'Feature Development',
  mode: 'repo',
  sandboxImageId: 'sandbox-nodejs',
  categoryId: 'projects',
  repoBind: {
    hostPath: '/home/user/my-project',
    containerPath: '/workspace'
  }
});

await sessionService.start(session.id);
// Changes to /workspace persist to /home/user/my-project
```

### 3. Custom Category for Documentation

```typescript
// Create a custom category
const category = await sessionCategoryService.create({
  id: 'documentation',
  name: 'Documentation',
  description: 'Sessions for documentation work',
  icon: 'book',
  color: '#8B5CF6'
});

// Create a session in the new category
const session = await sessionService.create({
  name: 'Docs Update',
  mode: 'repo',
  sandboxImageId: 'sandbox-nodejs',
  categoryId: 'documentation',
  repoBind: {
    hostPath: '/home/user/docs-repo',
    containerPath: '/workspace'
  }
});
```

---

## Migration from Legacy Session Types

The composable session architecture replaces the previous hardcoded session types:

| Legacy Type | New Equivalent |
|-------------|----------------|
| ProjectSession | Session with `mode: repo`, `categoryId: projects` |
| FoundrySession | Session with `mode: sandbox`, `categoryId: foundry` |
| TrainingSession | Session with `mode: sandbox`, `categoryId: training` |

Key differences:
- **Categories are user-defined**: Instead of a fixed `SessionPurpose` enum, categories are flexible
- **Docker-only**: All sessions run in Docker containers (no process/none runtime)
- **Templates for presets**: Common patterns are captured in reusable templates
- **Network isolation**: Containers run with `--network none` by default

---

## Related Documents

- [ADR-0005: Composable Docker Session Architecture](../adr/0005-composable-docker-session-architecture.md)
- [PLAN-composable-session-implementation.md](../plans/PLAN-composable-session-implementation.md)
