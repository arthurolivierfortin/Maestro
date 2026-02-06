# Phase 7D: Container Runtime - Project Isolation & Sandbox Execution

**Phase**: 7D
**Priority**: High
**Duration**: 4-5 days
**Team**: Backend + DevOps
**Dependencies**: Phase 7B, 7C complete
**Blocks**: Phase 7E (partial)
**Status**: Not Started

---

## Overview

Implement container-based isolation for project execution. Each project can have its own container runtime environment, enabling secure execution of tools, scripts, and agents without affecting the host system or other projects.

## Goals

1. Associate each project with a container configuration
2. Execute tools/scripts inside project containers
3. Implement security boundaries between projects
4. Support hot-reload of container configurations
5. Enable resource limits (CPU, memory, network)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Backend API                                │
│                    ExecutionOrchestrator                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │   ContainerRuntimeService  │
              └─────────────┬─────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Project A   │      │ Project B   │      │ Project C   │
│ Container   │      │ Container   │      │ Container   │
│ (node:20)   │      │ (python:3)  │      │ (dotnet:8)  │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Tasks

### 7D.1 Create Container Runtime Abstraction
- [ ] Create `IContainerRuntime` interface in `Maestro.Application/Interfaces/`
  - `StartContainerAsync(ProjectId, ContainerConfig)`
  - `StopContainerAsync(ProjectId)`
  - `ExecuteInContainerAsync(ProjectId, Command)`
  - `GetContainerStatusAsync(ProjectId)`
  - `GetContainerLogsAsync(ProjectId, since)`
- [ ] Create `ContainerConfig` value object
- [ ] Create `ContainerStatus` enum (Starting, Running, Stopped, Error)
- [ ] Create `ExecutionResult` type for command output

### 7D.2 Implement Docker Runtime
- [ ] Create `DockerContainerRuntime` in `Maestro.Infrastructure/Containers/`
- [ ] Use Docker.DotNet library for Docker API
- [ ] Implement container lifecycle management
- [ ] Implement volume mounting for project files
- [ ] Implement network isolation
- [ ] Add resource limits configuration

### 7D.3 Create Container Configuration Schema
- [ ] Extend `project.json` with container settings:
```json
{
  "runtime": {
    "type": "docker",
    "image": "node:20-alpine",
    "workDir": "/app",
    "mounts": [
      { "source": "./", "target": "/app", "readonly": false }
    ],
    "env": {
      "NODE_ENV": "development"
    },
    "resources": {
      "cpuLimit": "1.0",
      "memoryLimit": "512m"
    },
    "network": "none"
  }
}
```
- [ ] Add schema validation
- [ ] Support default configurations per project type

### 7D.4 Implement Execution Orchestrator
- [ ] Create `ExecutionOrchestrator` service
- [ ] Route execution requests to appropriate container
- [ ] Handle container startup if not running
- [ ] Stream output back to caller
- [ ] Handle timeouts and cancellation
- [ ] Implement retry logic

### 7D.5 Add Container Management API
- [ ] Create `ContainersController` in `Maestro.Api/Controllers/`
- [ ] Implement endpoints:
  - `POST /api/projects/{id}/container/start`
  - `POST /api/projects/{id}/container/stop`
  - `GET /api/projects/{id}/container/status`
  - `GET /api/projects/{id}/container/logs`
  - `POST /api/projects/{id}/container/exec`
- [ ] Add SignalR hub for container events

### 7D.6 Implement Tool Execution in Container
- [ ] Update `ToolBlockHandler` to use container runtime
- [ ] Execute tool scripts inside project container
- [ ] Pass block config as environment/stdin
- [ ] Capture stdout/stderr
- [ ] Handle exit codes

### 7D.7 Add Security Boundaries
- [ ] Implement filesystem sandboxing (only project folder mounted)
- [ ] Implement network isolation (no network by default)
- [ ] Implement resource quotas
- [ ] Add execution timeouts
- [ ] Log all container operations for audit

### 7D.8 Create Default Container Images
- [ ] Create `maestro-runtime-node` image
- [ ] Create `maestro-runtime-python` image
- [ ] Create `maestro-runtime-dotnet` image
- [ ] Publish to container registry
- [ ] Document image customization

### 7D.9 Add Container Health Monitoring
- [ ] Implement health checks
- [ ] Auto-restart on failure
- [ ] Resource usage metrics
- [ ] Integrate with execution monitoring UI

### 7D.10 Update Tests
- [ ] Add unit tests for `DockerContainerRuntime`
- [ ] Add integration tests with Docker
- [ ] Add tests for security boundaries
- [ ] Add tests for resource limits

---

## Acceptance Criteria

1. [ ] Tools execute inside project containers, not on host
2. [ ] Each project can have different container configuration
3. [ ] Container lifecycle is managed automatically
4. [ ] Output is streamed in real-time
5. [ ] Security boundaries prevent cross-project access
6. [ ] Resource limits are enforced
7. [ ] Containers can be started/stopped via API
8. [ ] Container logs are accessible
9. [ ] Default container images work out of the box

---

## Files to Create

### Application Layer
- `backend/src/Maestro.Application/Interfaces/IContainerRuntime.cs`
- `backend/src/Maestro.Application/Services/ExecutionOrchestrator.cs`

### Infrastructure Layer
- `backend/src/Maestro.Infrastructure/Containers/DockerContainerRuntime.cs`
- `backend/src/Maestro.Infrastructure/Containers/ContainerConfig.cs`

### API Layer
- `backend/src/Maestro.Api/Controllers/ContainersController.cs`
- `backend/src/Maestro.Api/Hubs/ContainerHub.cs`

### Docker
- `docker/runtime-node/Dockerfile`
- `docker/runtime-python/Dockerfile`
- `docker/runtime-dotnet/Dockerfile`

---

## Technical Notes

### Docker.DotNet Usage
```csharp
using Docker.DotNet;

var client = new DockerClientConfiguration().CreateClient();

// Create container
var response = await client.Containers.CreateContainerAsync(new CreateContainerParameters
{
    Image = "node:20-alpine",
    Name = $"maestro-project-{projectId}",
    HostConfig = new HostConfig
    {
        Mounts = new List<Mount>
        {
            new Mount
            {
                Type = "bind",
                Source = projectPath,
                Target = "/app",
                ReadOnly = false
            }
        },
        Memory = 512 * 1024 * 1024, // 512MB
        NanoCPUs = 1_000_000_000,   // 1 CPU
        NetworkMode = "none"
    }
});

// Execute command
var exec = await client.Exec.ExecCreateContainerAsync(containerId, new ContainerExecCreateParameters
{
    Cmd = new[] { "node", "script.js" },
    AttachStdout = true,
    AttachStderr = true
});
```

### Security Considerations
1. **No root**: Containers run as non-root user
2. **Read-only filesystem**: Only `/app` is writable
3. **No network**: Default to `none`, explicit allow-list
4. **Resource limits**: Prevent DoS
5. **Timeouts**: Kill long-running processes

### Fallback Mode
If Docker is not available:
1. Log warning
2. Execute in sandboxed subprocess
3. Apply OS-level restrictions (on supported platforms)

---

## Dependencies

### NuGet Packages
```xml
<PackageReference Include="Docker.DotNet" Version="3.125.15" />
```

### System Requirements
- Docker Engine or Docker Desktop
- Docker socket accessible (`/var/run/docker.sock` or npipe)
- Sufficient disk space for container images

---

## Related Issues

- Phase 7B: Project Model (provides project context)
- Phase 7C: Unified Filesystem (execution via API)
- Phase 5B: Block Execution Engine (existing execution infrastructure)
