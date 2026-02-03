# ADR 0005: Composable Docker-Based Session Architecture

**Status**: Proposed
**Date**: 2026-02-02
**Decision Makers**: Architecture Team

---

## Context

### Current State

Maestro currently has three hardcoded session types:

| Type | Entity | Purpose |
|------|--------|---------|
| **ProjectSession** | `ProjectSession.cs` | Interactive work on real repositories |
| **FoundrySession** | `FoundrySession.cs` | Block development and testing |
| **TrainingSession** | `TrainingSession.cs` | Workflow training and evaluation |

Each type has its own:
- Entity class with specific properties
- Configuration class
- Repository implementation
- API controller
- Frontend components

### Problems with Current Approach

1. **Rigidity**: Adding a new session type requires modifying code across 10+ files
2. **Code Duplication**: Similar lifecycle logic repeated in each session type
3. **Limited Customization**: Users cannot create custom session configurations
4. **Inconsistent Isolation**: Some sessions use Docker, some use local processes
5. **Security Variance**: Network access and filesystem permissions vary by type

### User Requirements

Users need to:
- Create custom session configurations for their specific workflows
- Test agents in isolated environments (sandboxes) without affecting real code
- Work on real repositories with proper isolation
- Share and reuse session configurations (templates)

---

## Decision

We refactor to a **unified, composable Session model** where:

1. **All sessions run in Docker containers** (no process/none runtime)
2. **Two environment modes**: Sandbox (ephemeral) vs Repo (persistent)
3. **User-defined sandbox images**: Users create Docker images externally
4. **Session templates**: Reusable presets for common patterns

---

## Architecture

### Unified Session Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SESSION (Unified)                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      SessionConfig                           │    │
│  │                                                              │    │
│  │  mode: EnvironmentMode        ─┬─► Sandbox (ephemeral)      │    │
│  │                                └─► Repo (persistent)         │    │
│  │                                                              │    │
│  │  sandboxImageId: string       ──► "sandbox-git", "my-image" │    │
│  │                                                              │    │
│  │  repoBind?: RepoBind          ──► { hostPath, containerPath }│    │
│  │                                                              │    │
│  │  purpose: SessionPurpose      ─┬─► Interactive              │    │
│  │                                ├─► Project                   │    │
│  │                                ├─► Foundry                   │    │
│  │                                └─► Training                  │    │
│  │                                                              │    │
│  │  templateId?: string          ──► "quick-git-test"          │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│                         ┌─────────────┐                              │
│                         │   DOCKER    │  ◄── Always Docker           │
│                         │  Container  │  ◄── Network: none           │
│                         │             │  ◄── Read-only root          │
│                         └─────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Environment Modes

#### Mode: Sandbox

```
┌─────────────────────────────────────────────────────────────┐
│                       SANDBOX MODE                           │
│                                                              │
│  ┌────────────────┐                                         │
│  │ Docker Image   │  maestro/sandbox-git:latest             │
│  │ (user-defined) │  or custom: myregistry/my-sandbox       │
│  └───────┬────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │              CONTAINER (Ephemeral)                  │     │
│  │                                                     │     │
│  │   /app/  ◄── Working directory                     │     │
│  │   (NO BIND MOUNT - isolated from host)             │     │
│  │                                                     │     │
│  │   Pre-configured by image:                         │     │
│  │   - Git repo with test commits                     │     │
│  │   - Sample project structure                       │     │
│  │   - Mock data for testing                          │     │
│  │                                                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Lifecycle:                                                  │
│  - Created on session start                                  │
│  - Destroyed on session end (ephemeral)                     │
│  - All changes lost when session ends                       │
│                                                              │
│  Use Cases:                                                  │
│  - Test agent's git/commit capabilities                     │
│  - Safe experimentation without risk                        │
│  - Reproducible test environments                           │
└─────────────────────────────────────────────────────────────┘
```

#### Mode: Repo

```
┌─────────────────────────────────────────────────────────────┐
│                        REPO MODE                             │
│                                                              │
│  ┌────────────────┐       ┌────────────────┐                │
│  │ Docker Image   │       │  Real Repo     │                │
│  │ (dev tools)    │       │  C:\Projects\  │                │
│  └───────┬────────┘       └───────┬────────┘                │
│          │                        │                          │
│          ▼                        │ BIND MOUNT               │
│  ┌────────────────────────────────┼───────────────────┐     │
│  │              CONTAINER         │                    │     │
│  │                                ▼                    │     │
│  │   /repo/  ◄────────────────────┘                   │     │
│  │   (Mounted from host - changes persist)            │     │
│  │                                                     │     │
│  │   Tools from image:                                │     │
│  │   - git, node, python, etc.                        │     │
│  │   - Development utilities                          │     │
│  │                                                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Lifecycle:                                                  │
│  - Container created/destroyed per session                  │
│  - Repo files persist on host                               │
│  - Changes visible outside container                        │
│                                                              │
│  Use Cases:                                                  │
│  - Real development work                                    │
│  - Agent working on actual codebase                        │
│  - CI/CD integration                                        │
└─────────────────────────────────────────────────────────────┘
```

### Sandbox Images

Users create Docker images externally and register them in Maestro.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SANDBOX IMAGE REGISTRY                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BUILT-IN (provided by Maestro)                               │    │
│  │                                                              │    │
│  │  sandbox-empty     Alpine minimal         sh                 │    │
│  │  sandbox-git       Git + bash             git, bash, curl    │    │
│  │  sandbox-nodejs    Node.js 20 LTS         node, npm, git     │    │
│  │  sandbox-python    Python 3.11            python, pip, git   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ USER-DEFINED (registered by user)                            │    │
│  │                                                              │    │
│  │  my-monorepo       Custom monorepo        pnpm, turbo, git   │    │
│  │  pr-workflow       PR testing env         gh, git, jq        │    │
│  │  rust-sandbox      Rust development       cargo, rustc, git  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Registration:                                                       │
│  {                                                                   │
│    "id": "my-sandbox",                                              │
│    "name": "My Custom Sandbox",                                     │
│    "dockerImage": "myregistry.io/sandbox:v1",                       │
│    "tools": ["git", "node", "custom-cli"],                          │
│    "description": "Sandbox for testing my workflows"                │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Session Templates

Reusable presets that define common session configurations.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SESSION TEMPLATES                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ quick-git-test                                               │    │
│  │ "Quick Git Test"                                             │    │
│  │                                                              │    │
│  │   mode: Sandbox                                              │    │
│  │   sandboxImageId: sandbox-git                                │    │
│  │   purpose: Interactive                                       │    │
│  │                                                              │    │
│  │   Use: Test git operations in isolated environment          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ foundry-default                                              │    │
│  │ "Foundry Session"                                            │    │
│  │                                                              │    │
│  │   mode: Sandbox                                              │    │
│  │   sandboxImageId: sandbox-nodejs                             │    │
│  │   purpose: Foundry                                           │    │
│  │   foundry: { draftId: null, training: {...} }               │    │
│  │                                                              │    │
│  │   Use: Block development and testing                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ project-default                                              │    │
│  │ "Project Session"                                            │    │
│  │                                                              │    │
│  │   mode: Repo                                                 │    │
│  │   sandboxImageId: sandbox-git                                │    │
│  │   purpose: Project                                           │    │
│  │   repoBind: { hostPath: "{projectPath}" }                   │    │
│  │                                                              │    │
│  │   Use: Work on real project with isolation                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Design Choices

### 1. Docker Only (No Process/None Runtime)

**Choice**: All sessions must run in Docker containers.

**Rationale**:
- **Consistency**: Same isolation guarantees for all sessions
- **Security**: Predictable sandboxing with no filesystem leaks
- **Reproducibility**: Same environment across machines
- **Simplicity**: One runtime to maintain and secure

**Trade-off**: Requires Docker to be installed. Acceptable because:
- Docker is standard in development environments
- Provides critical security guarantees
- Enables advanced features (resource limits, network isolation)

### 2. No Network Access by Default

**Choice**: All containers run with `--network none`.

**Rationale**:
- **Security**: Prevents data exfiltration
- **Determinism**: No external dependencies in tests
- **Control**: All external access goes through Maestro tools

**How users get external data**:
- Maestro provides tools: `web-search`, `web-fetch`, `api-call`
- These tools run on the host and return results to the container
- Full audit trail of all external requests

### 3. User-Defined Sandbox Images

**Choice**: Users create Docker images externally and register them.

**Rationale**:
- **Flexibility**: Any toolchain, any configuration
- **Expertise**: Users know their stack best
- **Maintainability**: Maestro doesn't maintain N images
- **Versioning**: Users control image versions

**Built-in images** for quick start:
- `sandbox-empty`: Bare Alpine
- `sandbox-git`: Git operations
- `sandbox-nodejs`: Node.js development
- `sandbox-python`: Python development

### 4. Sandbox = Ephemeral, Repo = Persistent

**Choice**: Clear separation between throwaway and persistent environments.

**Rationale**:
- **Mental model**: Easy to understand when changes persist
- **Safety**: Sandbox never touches real data
- **Use cases**: Distinct purposes, distinct behaviors

| Aspect | Sandbox | Repo |
|--------|---------|------|
| Changes | Lost on stop | Persist on host |
| Data source | Baked in image | Mounted from host |
| Risk level | Zero | Controlled |
| Use case | Testing | Development |

### 5. Session Templates as First-Class Citizens

**Choice**: Templates are stored entities, not just UI presets.

**Rationale**:
- **Sharing**: Export/import templates between users
- **Versioning**: Track template changes
- **API access**: Create sessions from templates programmatically
- **Customization**: User templates alongside built-in

### 6. Purpose as Hint, Not Hard Constraint

**Choice**: `SessionPurpose` enables features but doesn't restrict.

**Rationale**:
- **Flexibility**: Users can combine purposes
- **Simplicity**: One session entity handles all cases
- **Evolution**: New purposes without new entities

```typescript
// Purpose enables optional features
if (config.purpose === 'Foundry') {
  enableFoundryFeatures(session);  // Draft loading, training, etc.
}
if (config.purpose === 'Training') {
  enableTrainingFeatures(session);  // Iterations, evaluation, etc.
}
// But any session can use any feature if configured
```

---

## Data Model

### Session Entity

```csharp
public class Session
{
    // Identity
    public required SessionId Id { get; init; }
    public required string Name { get; set; }

    // State
    public SessionStatus Status { get; private set; }
    public required Authority Authority { get; set; }

    // Configuration (composable)
    public required SessionConfig Config { get; init; }

    // Container
    public string? ContainerId { get; private set; }

    // Timestamps
    public DateTime CreatedAt { get; init; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    // History
    public IReadOnlyList<SessionCommand> CommandHistory { get; }
    public IReadOnlyList<SessionEvent> EventHistory { get; }
}
```

### Session Configuration

```csharp
public class SessionConfig
{
    // Environment (required)
    public EnvironmentMode Mode { get; set; }
    public required string SandboxImageId { get; set; }

    // Repo binding (required if Mode == Repo)
    public RepoBind? RepoBind { get; set; }

    // Purpose (determines available features)
    public SessionPurpose Purpose { get; set; }

    // Optional feature configs
    public ProjectConfig? Project { get; set; }
    public FoundryConfig? Foundry { get; set; }
    public TrainingConfig? Training { get; set; }

    // Template reference
    public string? TemplateId { get; set; }

    // Resources
    public ResourceLimits Resources { get; set; }

    // Access control
    public AccessConfig Access { get; set; }
}

public enum EnvironmentMode
{
    Sandbox,  // No bind mount, ephemeral
    Repo      // Bind mount to host, persistent
}

public enum SessionPurpose
{
    Interactive,  // General use
    Project,      // Project development
    Foundry,      // Block development
    Training      // Training/evaluation
}
```

### Sandbox Image

```csharp
public class SandboxImage
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    // Docker reference
    public required string DockerImage { get; set; }

    // Metadata
    public ImageSource Source { get; set; }
    public IReadOnlyList<string> Tags { get; set; }
    public IReadOnlyList<string> Tools { get; set; }

    // Defaults
    public string DefaultWorkDir { get; set; } = "/app";
}

public enum ImageSource
{
    BuiltIn,  // Provided by Maestro
    User,     // Registered by user
    Project   // Project-specific
}
```

### Session Template

```csharp
public class SessionTemplate
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    // Template configuration
    public required SessionConfig DefaultConfig { get; init; }

    // Metadata
    public TemplateSource Source { get; set; }
    public IReadOnlyList<string> Tags { get; set; }

    // UI hints
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
}
```

---

## API Design

### Sessions API

```
POST   /api/sessions
       Create new session
       Body: { name, config: SessionConfig }

POST   /api/sessions/from-template/{templateId}
       Create from template with optional overrides
       Body: { name?, configOverrides? }

GET    /api/sessions
       List sessions with filters
       Query: ?status=Running&purpose=Foundry

GET    /api/sessions/{id}
       Get session details

DELETE /api/sessions/{id}
       Delete session (stops container if running)

POST   /api/sessions/{id}/start
       Start session (creates and starts container)

POST   /api/sessions/{id}/stop
       Stop session (stops and removes container)

POST   /api/sessions/{id}/exec
       Execute command in container
       Body: { command, workDir?, env? }

GET    /api/sessions/{id}/events
       Get session events with pagination
       Query: ?limit=50&offset=0&type=Command
```

### Sandbox Images API

```
GET    /api/sandbox-images
       List all images (built-in + user)
       Query: ?source=User&tags=git

GET    /api/sandbox-images/{id}
       Get image details

POST   /api/sandbox-images
       Register new image
       Body: { id, name, dockerImage, tools[], description? }

DELETE /api/sandbox-images/{id}
       Unregister user image (cannot delete built-in)

GET    /api/sandbox-images/{id}/verify
       Verify image exists in Docker
       Response: { exists: boolean, size?: string }
```

### Session Templates API

```
GET    /api/session-templates
       List all templates
       Query: ?source=BuiltIn&purpose=Foundry

GET    /api/session-templates/{id}
       Get template details

POST   /api/session-templates
       Create user template
       Body: { id, name, defaultConfig, description?, tags[] }

PUT    /api/session-templates/{id}
       Update user template

DELETE /api/session-templates/{id}
       Delete user template (cannot delete built-in)
```

---

## Migration Path

### Phase 1: Add New System (Non-Breaking)

1. Create new entities alongside existing ones
2. New API endpoints at `/api/v2/sessions`
3. Existing sessions continue to work

### Phase 2: Internal Migration

1. `ProjectSessionServer` uses new `Session` internally
2. Adapters translate old format to new
3. All new sessions use unified model

### Phase 3: Frontend Migration

1. New session UI components
2. Gradual replacement of old components
3. Feature flags for rollout

### Phase 4: Deprecation

1. Mark old endpoints as deprecated
2. Migration guide for users
3. 6-month deprecation period

### Phase 5: Removal

1. Remove old entities
2. Remove old endpoints
3. Remove adapters

---

## Consequences

### Positive

- **Flexibility**: Users can create any session configuration
- **Consistency**: All sessions have same isolation guarantees
- **Simplicity**: One session model to understand
- **Extensibility**: New purposes without code changes
- **Reusability**: Templates shared across users/projects

### Negative

- **Docker Dependency**: Requires Docker on host machine
- **Migration Effort**: Existing sessions need migration
- **Image Management**: Users must manage their sandbox images
- **Learning Curve**: New concepts (modes, images, templates)

### Neutral

- **Storage**: Slightly different file structure
- **API**: New endpoints, old ones deprecated

---

## Related Documents

- [ADR-0004: System Blocks and Documentation Architecture](0004-system-blocks-and-documentation-architecture.md)
- [GUIDE-SESSION-TYPES.md](../guides/GUIDE-SESSION-TYPES.md) (to be updated)
- [Docker Container Runtime](../../backend/src/Maestro.Infrastructure/Containers/DockerContainerRuntime.cs)

---

## Status History

- 2026-02-02: Proposed
