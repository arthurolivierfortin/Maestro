# Phase 10: Unified Session System (Foundry + Project)

**Issue**: MAESTRO-10 - Unified Session System Implementation
**Priority**: High
**Estimated Effort**: 5-6 weeks
**Dependencies**: Phase 7 (Projects/Containers), Phase 9 (Training/Metrics)

---

## Overview

Implement a **Unified Session System** where sessions act as **interactive server environments** controlled by an **Authority** (human, AI, or agent). This replaces the simple workflow execution model with a rich command-based interaction model.

### Core Concept: Session as Server

A **Session** is an interactive server environment where:
- An **Authority** (human, AI agent, or external AI like Claude Code) controls the session
- Multiple **Clients** (Monitor, CLI, SDK) can connect and interact
- **Commands** (shell + Maestro) are executed within the session context
- **Events** are streamed in real-time to all connected clients
- **Sub-agents** can be launched with restricted permissions

### Goals

1. **Session Server Architecture** - Sessions as interactive command servers
2. **Authority Types** - Support human, agent, and AI authorities
3. **Client Connectivity** - Monitor (terminal), CLI, SDK/API access
4. **Block Registry** - Per-session registry of available blocks
5. **Permission Hierarchy** - Authority configures sub-agent permissions
6. **Foundry Sessions** - Develop, test, train, and publish blocks
7. **Project Sessions** - Execute on real projects with access control
8. **Full CLI Support** - External AIs can automate the entire workflow

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SESSION SERVER                                  │
│                   (Foundry Session OR Project Session)                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         SESSION STATE                               │ │
│  │                                                                     │ │
│  │  • Authority: Who controls (human, agent, AI)                       │ │
│  │  • Block Registry: Available blocks in this session                 │ │
│  │  • Permissions: What's allowed (paths, commands, blocks)           │ │
│  │  • Executions: Running agents/workflows                            │ │
│  │  • Event History: Full audit log                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Command Queue  │  │  Event Stream   │  │  File System Access     │ │
│  │  (REST API)     │  │  (WebSocket)    │  │  (Isolated/Controlled)  │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────┘ │
│           │                    │                                        │
└───────────┼────────────────────┼────────────────────────────────────────┘
            │                    │
            │    API Layer       │
┌───────────┴────────────────────┴────────────────────────────────────────┐
│                              CLIENTS                                      │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   MONITOR    │    │     CLI      │    │      AGENT / IA          │  │
│  │  (Terminal)  │    │   Maestro    │    │   (Claude Code, etc)     │  │
│  │              │    │              │    │                          │  │
│  │ • View events│    │ • Send cmds  │    │ • Send commands via API  │  │
│  │ • Read-only  │    │ • Connect to │    │ • Subscribe to events    │  │
│  │   or interact│    │   session    │    │ • Autonomous operation   │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Authority Types

| Authority Type | Description | Example |
|---------------|-------------|---------|
| `human` | Interactive human control | Developer using CLI |
| `agent:<id>` | Maestro agent as controller | `orchestrator-agent` managing sub-agents |
| `ai:<name>` | External AI system | `ai:claude-code`, `ai:cursor` |

### Session Types

| Type | Purpose | Environment |
|------|---------|-------------|
| **Project Session** | Execute on real projects | Git repository with access control |
| **Foundry Session** | Develop and train blocks | Isolated sandbox |

---

## Implementation Phases

### Phase 10A: Core Domain Models (Week 1)

**Objective**: Create unified session models with the Session Server architecture.

#### Tasks

- [x] **10A-1**: Create SessionEnums (SessionType, SessionStatus, AccessLevel)
- [x] **10A-2**: Create SessionId value object
- [x] **10A-3**: Create AccessConfig for permission management
- [x] **10A-4**: Create ValidationConfig for tests/linter
- [x] **10A-5**: Create ProjectSessionConfig with full session configuration
- [x] **10A-6**: Create ProjectSession entity with lifecycle management

**Additional Domain Models:**

- [x] **10A-7**: Create AuthorityType enum and Authority class
  ```csharp
  public enum AuthorityType { Human, Agent, AI }
  public class Authority { Type, Identifier, Metadata }
  ```

- [x] **10A-8**: Create SessionCommand model
  ```csharp
  public class SessionCommand { Type, Command, Args, Timestamp }
  ```

- [x] **10A-9**: Create SessionEvent model for event streaming
  ```csharp
  public class SessionEvent { Type, Source, Message, Data, Timestamp }
  ```

- [x] **10A-10**: Create BlockRegistry per-session model
  ```csharp
  public class SessionBlockRegistry { Available, Restricted, Add(), Remove() }
  ```

- [x] **10A-11**: Create FoundrySession entity
  ```csharp
  public class FoundrySession : BaseSession { DraftId, TrainingConfig, Iterations }
  ```

- [x] **10A-12**: Create repositories interfaces
  ```csharp
  ISessionRepository<T>
  IProjectSessionRepository
  IFoundrySessionRepository
  ```

**Files Created:**
```
backend/src/Maestro.Domain/
├── Entities/
│   ├── ProjectSession.cs          [DONE]
│   ├── FoundrySession.cs          [DONE]
│   └── SessionBlockRegistry.cs    [DONE]
├── Configuration/
│   ├── AccessConfig.cs            [DONE]
│   ├── ValidationConfig.cs        [DONE]
│   ├── ProjectSessionConfig.cs    [DONE]
│   └── FoundrySessionConfig.cs    [DONE]
├── ValueObjects/
│   ├── SessionId.cs               [DONE]
│   ├── Authority.cs               [DONE]
│   ├── SessionCommand.cs          [DONE]
│   └── SessionEvent.cs            [DONE]
└── Enums/
    └── SessionEnums.cs            [DONE]
```

---

### Phase 10B: Session Server Infrastructure (Week 2) ✅ COMPLETED

**Objective**: Implement the core session server with command execution.

#### Tasks

- [x] **10B-1**: Create ISessionServer interface
  ```csharp
  interface IProjectSessionServer
  {
      Task<ProjectSession> CreateAsync(name, authority, config);
      Task<ProjectSession> StartAsync(sessionId);
      Task<CommandResult> ExecuteCommandAsync(sessionId, command);
      IAsyncEnumerable<SessionEvent> SubscribeAsync(sessionId);
      Task<ProjectSession> PauseAsync(sessionId);
      Task<ProjectSession> ResumeAsync(sessionId);
      Task<ProjectSession> StopAsync(sessionId);
      Task<ProjectSession> TakeControlAsync(sessionId, authority);
  }
  ```

- [x] **10B-2**: Create CommandExecutor abstraction
  ```csharp
  interface ICommandExecutor
  {
      bool CanHandle(command);
      Task<CommandResult> ExecuteAsync(command, context);
  }
  ```

- [x] **10B-3**: Implement ShellCommandExecutor
  - Execute shell commands (ls, cd, cat, git, etc.)
  - Respect session permissions
  - Handle working directory state

- [x] **10B-4**: Implement MaestroCommandExecutor
  - Handle blocks/agents/monitor/permissions commands
  - Dispatch to appropriate services

- [x] **10B-5**: Implement ControlCommandExecutor
  - Handle /pause, /resume, /exit, /stop, /status, /help

- [x] **10B-6**: Create ProjectSessionServer implementation
- [ ] **10B-7**: Create FoundrySessionServer implementation (deferred)

**Files Created:**
```
backend/src/Maestro.Application/Interfaces/
├── ISessionServer.cs              [DONE]

backend/src/Maestro.Infrastructure/Sessions/
├── ProjectSessionServer.cs        [DONE]
├── FileSystemProjectSessionRepository.cs [DONE]
└── CommandExecutors/
    ├── ShellCommandExecutor.cs    [DONE]
    ├── MaestroCommandExecutor.cs  [DONE]
    └── ControlCommandExecutor.cs  [DONE]
```

---

### Phase 10C: Project Session Commands (Week 2-3) ✅ COMPLETED

**Objective**: Implement all Project Session commands.

#### Shell Commands
- [x] **10C-1**: `ls`, `cd`, `pwd`, `cat`, `head`, `tail`
- [x] **10C-2**: `find`, `grep` (with permission checks)
- [x] **10C-3**: `git status`, `git diff`, `git log`, `git branch`

#### Maestro Commands
- [x] **10C-4**: `blocks list|info` (add/remove basic)
- [x] **10C-5**: `agents list|run|stop|status` (basic)
- [x] **10C-6**: `monitor [--agent <id>]`
- [x] **10C-7**: `permissions show`
- [x] **10C-8**: `diff [file]`
- [x] **10C-9**: `test [--command]`, `lint [--command]`
- [x] **10C-10**: `commit --message "..." [--push]`

**Files Created:**
```
backend/src/Maestro.Infrastructure/Sessions/CommandExecutors/
├── ShellCommandExecutor.cs      [DONE] - All shell commands
├── MaestroCommandExecutor.cs    [DONE] - blocks, agents, monitor, permissions, diff, test, lint, commit
└── ControlCommandExecutor.cs    [DONE] - /status, /help, /pause, /resume, /exit
```

---

### Phase 10D: Foundry Session Commands (Week 3)

**Objective**: Implement all Foundry Session commands.

#### Draft Commands
- [ ] **10D-1**: `draft load|list|edit|test|save`

#### Training Commands
- [ ] **10D-2**: `train start|status|pause|resume|stop`

#### Evaluation Commands
- [ ] **10D-3**: `eval pending|show|submit|auto`

#### Improvement Commands
- [ ] **10D-4**: `improve suggest|show|apply|apply-all`
- [ ] **10D-5**: `metrics [compare <session>]`

#### Publication Commands
- [ ] **10D-6**: `publish [--version] [--dry-run]`

**Files to Create:**
```
backend/src/Maestro.Infrastructure/Sessions/Commands/
├── Foundry/
│   ├── DraftCommands.cs
│   ├── TrainingCommands.cs
│   ├── EvaluationCommands.cs
│   ├── ImprovementCommands.cs
│   └── PublishCommands.cs
```

---

### Phase 10E: REST API & WebSocket (Week 3-4) ✅ COMPLETED

**Objective**: Expose session server via REST API and WebSocket.

#### Tasks

- [x] **10E-1**: Create unified SessionController
  ```
  POST   /api/sessions                    Create session
  GET    /api/sessions                    List sessions (with filters)
  GET    /api/sessions/{id}               Get session details
  DELETE /api/sessions/{id}               Delete session
  ```

- [x] **10E-2**: Create session command endpoint
  ```
  POST   /api/sessions/{id}/exec          Execute command
  {
    "command": "blocks list",
    "args": {}
  }
  ```

- [x] **10E-3**: Create session control endpoints
  ```
  POST   /api/sessions/{id}/start         Start session
  POST   /api/sessions/{id}/pause         Pause session
  POST   /api/sessions/{id}/resume        Resume session
  POST   /api/sessions/{id}/stop          Stop session
  POST   /api/sessions/{id}/take-control  Take control from AI
  ```

- [x] **10E-4**: Create WebSocket hub for events
  ```csharp
  SessionHub
  - JoinSession(sessionId)
  - LeaveSession(sessionId)
  - ExecuteCommand(sessionId, command)
  - OnEvent(sessionId, event)
  - OnStateChange(sessionId, state)
  - OnCommandOutput(sessionId, output)
  - OnAgentEvent(sessionId, event)
  ```

- [x] **10E-5**: Register services in Program.cs

**Files Created:**
```
backend/src/Maestro.Api/
├── Controllers/
│   └── SessionsController.cs       [DONE]
└── Hubs/
    ├── SessionHub.cs               [DONE]
    └── ISessionClient.cs           [DONE]
```

---

### Phase 10F: CLI Implementation (Week 4) ✅ COMPLETED

**Objective**: Full CLI support for session management.

#### Tasks

- [x] **10F-1**: Session management commands
  ```bash
  maestro session create --project <id> --authority <type>
  maestro session list [--status <status>] [--project <id>]
  maestro session info <id>
  maestro session delete <id>
  ```

- [x] **10F-2**: Session execution commands
  ```bash
  maestro session exec <id> "<cmd>"   # Single command execution
  maestro session events <id>         # View event history
  ```

- [x] **10F-3**: Session control commands
  ```bash
  maestro session start <id>
  maestro session pause <id>
  maestro session resume <id>
  maestro session stop <id>
  maestro session take-control <id> [--authority <type>]
  ```

- [x] **10F-4**: Update api-client.js with session methods
  - listSessions(), getSession(), createSession(), deleteSession()
  - startSession(), pauseSession(), resumeSession(), stopSession()
  - takeControlSession(), executeSessionCommand(), getSessionEvents()

- [ ] **10F-5**: Implement interactive terminal mode (deferred - exec provides same functionality)

**Files Modified:**
```
tools/maestro-cli/
└── index.js                    [UPDATED]

tools/shared/
└── api-client.js               [UPDATED]
```

---

### Phase 10G: Frontend Integration (Week 5)

**Objective**: UI for session management and monitoring.

#### Tasks

- [ ] **10G-1**: Create Sessions list page
- [ ] **10G-2**: Create Session detail/monitor view
- [ ] **10G-3**: Create command terminal component
- [ ] **10G-4**: Create event stream component
- [ ] **10G-5**: WebSocket integration for real-time updates
- [ ] **10G-6**: Create agent execution monitor

**Files to Create:**
```
frontend/src/pages/
├── Sessions.tsx
└── SessionDetail.tsx

frontend/src/components/sessions/
├── SessionList.tsx
├── SessionTerminal.tsx
├── EventStream.tsx
└── AgentMonitor.tsx

frontend/src/services/
└── sessionService.ts

frontend/src/store/
└── sessionStore.ts
```

---

### Phase 10H: Migration & Cleanup (Week 5-6)

**Objective**: Migrate existing data and update documentation.

#### Tasks

- [ ] **10H-1**: Migrate TrainingConfiguration → FoundrySession drafts
- [ ] **10H-2**: Migrate TrainingRun → FoundrySession iterations
- [ ] **10H-3**: Update CLAUDE.md with session documentation
- [ ] **10H-4**: Update all guides
- [ ] **10H-5**: Deprecate old Training/Testing APIs

---

## Command Reference

### Project Session Commands

```bash
# Shell (within permissions)
ls, cd, pwd, cat, head, tail
find, grep
git status|diff|log|branch

# Maestro
blocks list|info|add|remove
agents list|run|stop|status
monitor [--agent <id>]
permissions show|set
diff [file]
test [--command]
lint [--command]
commit --message "..." [--push]
pause|resume|exit
```

### Foundry Session Commands

```bash
# Draft
draft load|list|edit|test|save

# Training
train start|status|pause|resume|stop

# Evaluation
eval pending|show|submit|auto

# Improvements
improve suggest|show|apply|apply-all
metrics [compare]

# Publication
publish [--version] [--dry-run]
pause|resume|exit
```

---

## Success Metrics

1. **Session Server** - Both session types work as interactive servers
2. **Authority Support** - Human, agent, and AI authorities work correctly
3. **Command Execution** - All commands work within permissions
4. **Event Streaming** - WebSocket delivers real-time events
5. **CLI Coverage** - Full automation possible via CLI
6. **Monitoring** - Human can always monitor and take control

---

## Timeline Summary

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | 10A | Domain models, session entities |
| 2 | 10B | Session server infrastructure |
| 2-3 | 10C | Project session commands |
| 3 | 10D | Foundry session commands |
| 3-4 | 10E | REST API & WebSocket |
| 4 | 10F | CLI implementation |
| 5 | 10G | Frontend integration |
| 5-6 | 10H | Migration & cleanup |

---

## Checklist

- [x] Phase 10A complete (all session models) ✅
- [x] Phase 10B complete (session server for Project Sessions) ✅
- [x] Phase 10C complete (project commands) ✅
- [ ] Phase 10D pending (foundry commands - lower priority)
- [x] Phase 10E complete (API & WebSocket) ✅
- [x] Phase 10F complete (CLI) ✅
- [ ] Phase 10G pending (frontend integration)
- [ ] Phase 10H pending (migration)

## Completion Status

**Project Session Pipeline is COMPLETE** (both CLI and API):

1. **Create Session**: `POST /api/sessions` or `maestro session create --project <id> --authority human`
2. **Start Session**: `POST /api/sessions/{id}/start` or `maestro session start <id>`
3. **Execute Commands**: `POST /api/sessions/{id}/exec` or `maestro session exec <id> "<cmd>"`
4. **Monitor Events**: `GET /api/sessions/{id}/events` or `maestro session events <id>`
5. **Control Session**: pause, resume, stop, take-control via API or CLI
6. **Delete Session**: `DELETE /api/sessions/{id}` or `maestro session delete <id>`

**WebSocket Support**: Connect to `/hubs/sessions` for real-time events.
