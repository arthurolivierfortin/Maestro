# Phase 8: Enhanced Project Management & Container Integration

## Overview

This phase enhances the Projects feature to provide Docker Desktop-like project management with container lifecycle control, terminal integration, block permissions, and file access rules.

## Goals

1. **File Browser Integration**: Native file picker for selecting project repository folders
2. **Docker Desktop-like UI**: Projects page resembling Docker Desktop containers view
3. **Container Lifecycle Management**: Start/stop buttons with real-time status
4. **Project Detail Pages**: Dedicated pages for each project with editing, monitoring, and configuration
5. **Terminal Integration**: Embedded CLI terminal connected to project containers
6. **Block Permissions**: Configure which blocks/tools are available per project
7. **File Access Rules**: Specify files/folders to hide or restrict in containers

## Architecture

### Backend Additions

```
Maestro.Domain/
├── Entities/
│   └── Project.cs                    # Add ContainerId, Status, FileRules, BlockPermissions
├── ValueObjects/
│   ├── FileAccessRule.cs             # NEW: File/folder access rules
│   └── BlockPermission.cs            # NEW: Block permission configuration

Maestro.Application/
├── Interfaces/
│   ├── IFileSystemBrowser.cs         # NEW: File system browsing
│   └── ITerminalService.cs           # NEW: Terminal session management
├── DTOs/
│   ├── ContainerStateDto.cs          # NEW: Container state response
│   ├── FileAccessRuleDto.cs          # NEW: File rule DTOs
│   └── TerminalSessionDto.cs         # NEW: Terminal session DTOs

Maestro.Infrastructure/
├── Services/
│   ├── FileSystemBrowser.cs          # NEW: Directory browsing service
│   └── TerminalService.cs            # NEW: Terminal session management

Maestro.Api/
├── Controllers/
│   └── ProjectsController.cs         # Extended: container start/stop, file rules
├── Hubs/
│   ├── ProjectHub.cs                 # NEW: Project status updates
│   └── TerminalHub.cs                # NEW: Terminal I/O streaming
```

### Frontend Additions

```
frontend/src/
├── pages/
│   ├── ProjectsPage.tsx              # REWRITE: Docker Desktop-like layout
│   └── ProjectDetailPage.tsx         # NEW: Project detail/edit page
├── components/
│   ├── Projects/
│   │   ├── ProjectList.tsx           # NEW: Container-style project list
│   │   ├── ProjectRow.tsx            # NEW: Individual project row
│   │   ├── ProjectStatusBadge.tsx    # NEW: Status indicator
│   │   ├── ContainerControls.tsx     # NEW: Start/stop/restart buttons
│   │   ├── CreateProjectModal.tsx    # ENHANCED: With file browser
│   │   └── FileBrowser.tsx           # NEW: Directory picker
│   ├── Terminal/
│   │   ├── ProjectTerminal.tsx       # NEW: Embedded terminal
│   │   └── TerminalToolbar.tsx       # NEW: Terminal controls
│   └── ProjectSettings/
│       ├── GeneralSettings.tsx       # NEW: Basic project settings
│       ├── BlockPermissions.tsx      # NEW: Block access control
│       └── FileAccessRules.tsx       # NEW: File visibility/permissions
├── store/
│   ├── projectStore.ts               # ENHANCED: Container state, terminal
│   └── terminalStore.ts              # NEW: Terminal session state
├── services/
│   └── containerService.ts           # NEW: Container API client
└── hooks/
    ├── useContainerStatus.ts         # NEW: Real-time container status
    └── useProjectTerminal.ts         # NEW: Terminal connection hook
```

### CLI Additions

```
tools/maestro-cli/
└── index.js                          # ENHANCED: container commands
    - maestro projects start <id>
    - maestro projects stop <id>
    - maestro projects status <id>
    - maestro projects terminal <id>
```

## API Endpoints

### New Endpoints

```
POST   /api/projects/{id}/start           # Start project container
POST   /api/projects/{id}/stop            # Stop project container
POST   /api/projects/{id}/restart         # Restart container
GET    /api/projects/{id}/status          # Get container status
GET    /api/projects/{id}/logs            # Get container logs

GET    /api/filesystem/browse             # Browse directories
POST   /api/filesystem/browse             # Browse with path

PUT    /api/projects/{id}/file-rules      # Update file access rules
GET    /api/projects/{id}/file-rules      # Get file access rules

PUT    /api/projects/{id}/block-permissions  # Update block permissions
GET    /api/projects/{id}/block-permissions  # Get block permissions
```

### SignalR Hubs

```
/hubs/projects
  - ProjectStatusChanged(projectId, status)
  - ContainerStarted(projectId, containerId)
  - ContainerStopped(projectId)

/hubs/terminal/{projectId}
  - Output(data)
  - Error(data)
  - Disconnected(reason)
```

## Data Models

### FileAccessRule

```typescript
interface FileAccessRule {
  path: string;          // Relative path from project root
  type: 'file' | 'directory';
  rule: 'hidden' | 'readonly' | 'excluded';
  reason?: string;       // Optional explanation
}
```

### BlockPermission

```typescript
interface BlockPermission {
  blockId: string;       // Block ID or pattern (e.g., "tools/*")
  permission: 'allowed' | 'denied' | 'requires_approval';
  reason?: string;
}
```

### ContainerState

```typescript
interface ContainerState {
  projectId: string;
  containerId?: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  startedAt?: string;
  error?: string;
  resourceUsage?: {
    cpuPercent: number;
    memoryMb: number;
  };
}
```

## UI Design

### Projects Page (Docker Desktop-style)

```
┌──────────────────────────────────────────────────────────────────┐
│  Projects                                           [+ New]      │
├──────────────────────────────────────────────────────────────────┤
│  🔍 Search projects...        [All] [Running] [Stopped]          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ● my-web-app                           🐳 Running    [▶][⏹]│  │
│  │   /home/user/projects/my-web-app       Started 2h ago      │  │
│  │   CPU: 2.3%  Memory: 128MB                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ○ api-service                          ⚡ Stopped    [▶][⏹]│  │
│  │   /home/user/projects/api-service      Stopped 1d ago      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ○ data-pipeline                        📁 No Runtime [▶][⏹]│  │
│  │   /home/user/projects/data-pipeline    Local only          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Project Detail Page

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    my-web-app                    [▶ Start] [⚙ Settings]  │
├──────────────────────────────────────────────────────────────────┤
│  [Overview] [Terminal] [Blocks] [Files] [Logs]                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OVERVIEW TAB:                                                   │
│  ┌─────────────────────────────────┬─────────────────────────┐  │
│  │ Status: ● Running               │ Runtime: Docker         │  │
│  │ Container: maestro-abc123       │ Image: node:18-alpine   │  │
│  │ Started: 2 hours ago            │ Memory: 512MB limit     │  │
│  │ CPU: 2.3%  Memory: 128MB        │ Network: bridge         │  │
│  └─────────────────────────────────┴─────────────────────────┘  │
│                                                                  │
│  TERMINAL TAB:                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ $ maestro> help                                            │  │
│  │ Available commands:                                        │  │
│  │   blocks     - List available blocks                       │  │
│  │   execute    - Execute a workflow                          │  │
│  │   status     - Show project status                         │  │
│  │ $ maestro> _                                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  BLOCKS TAB:                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☑ tools/git-diff           Allowed                         │  │
│  │ ☑ tools/file-search        Allowed                         │  │
│  │ ☐ tools/shell-exec         Requires Approval               │  │
│  │ ☐ inference/code-gen       Denied                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  FILES TAB:                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ + Add Rule                                                 │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ .env                    Hidden      [Edit] [Delete]  │   │  │
│  │ │ node_modules/           Excluded    [Edit] [Delete]  │   │  │
│  │ │ config/secrets.json     Read-only   [Edit] [Delete]  │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Phase 8A: Backend Container State Management ✅
- [x] Add ContainerId and Status to Project entity
- [x] Create container state tracking service (ProjectContainerService)
- [x] Add start/stop/restart endpoints
- [x] Implement ProjectHub for real-time status

### Phase 8B: File System Browser ✅
- [x] Create IFileSystemBrowser interface
- [x] Implement directory browsing service (FileSystemBrowser)
- [x] Add browse API endpoint (FileSystemController)
- [x] Handle permissions and security

### Phase 8C: Block Permissions & File Rules ✅
- [x] Add FileAccessRule value object
- [x] Add BlockPermission value object
- [x] Update Project entity with rules
- [x] Add CRUD endpoints for rules

### Phase 8D: Frontend Projects Page Redesign ✅
- [x] Create Docker Desktop-style ProjectList
- [x] Implement ProjectRow with status indicators
- [x] Add container control buttons (ContainerControls)
- [x] Implement status filters

### Phase 8E: Frontend File Browser ✅
- [x] Create FileBrowser component
- [x] Integrate with CreateProjectModal
- [x] Support project folder detection

### Phase 8F: Frontend Project Detail Page ✅
- [x] Create ProjectDetailPage with tabs
- [x] Implement Overview tab
- [x] Implement Terminal tab (placeholder for xterm.js)
- [x] Implement Blocks tab
- [x] Implement Files tab
- [x] Implement Logs tab

### Phase 8G: CLI Container Commands ✅
- [x] Add `projects start` command
- [x] Add `projects stop` command
- [x] Add `projects restart` command
- [x] Add `projects status` command
- [x] Add `projects logs` command
- [x] Update MCP server with container tools

### Phase 8H: Testing & Cleanup ✅
- [x] Backend builds successfully
- [x] Frontend builds successfully
- [x] Fixed type naming conflicts (ProjectContainerState, CommonDirectoryInfo)
- [x] API documentation in DTOs

## Dependencies

- xterm.js (terminal emulator for frontend)
- @xterm/addon-fit (terminal sizing)
- @xterm/addon-web-links (clickable links)

## Security Considerations

1. **File Access**: Only allow browsing within user-accessible directories
2. **Container Isolation**: Maintain existing security constraints
3. **Terminal Sessions**: Authenticate and authorize terminal access
4. **File Rules**: Enforce rules at container creation time

## Migration Notes

- Existing projects will have empty file rules (all allowed)
- Existing projects will have empty block permissions (all allowed)
- Container state is transient (not persisted)

## Success Criteria

1. Users can create projects by selecting folders via file browser ✅
2. Projects page shows all projects with real-time container status ✅
3. Start/stop buttons control container lifecycle ✅
4. Project detail page provides editing and monitoring ✅
5. Terminal connects to running containers (placeholder ready for xterm.js)
6. Block permissions control tool availability ✅
7. File rules hide/restrict sensitive files ✅
8. CLI supports all project container operations ✅

---

## Completion Summary (Phase 8)

### Date Completed
January 2026

### Implemented Features

#### Backend
- **ProjectContainerService**: In-memory container state tracking with start/stop/restart operations
- **ProjectHub (SignalR)**: Real-time container state broadcasting to connected clients
- **FileSystemBrowser**: Directory listing with git/Maestro project detection
- **FileSystemController**: REST API for file system browsing
- **ProjectsController Extensions**: Container lifecycle endpoints (start, stop, restart, logs)
- **Domain Value Objects**: ProjectContainerState, ProjectContainerStatus, FileAccessRule, BlockPermission, CommonDirectoryInfo

#### Frontend
- **ProjectsPage**: Docker Desktop-style layout with status filters, search, and container count
- **ProjectRow**: Individual project display with status badge and control buttons
- **ProjectStatusBadge**: Animated status indicator (running, stopped, starting, stopping, error)
- **ContainerControls**: Start/stop/restart buttons with loading states
- **FileBrowser**: Directory navigation with common directories, git detection, and Maestro project detection
- **ProjectDetailPage**: Tabbed interface with Overview, Terminal, Blocks, Files, and Logs tabs
- **projectStore**: Zustand store with container state management

#### CLI
- `projects` - List all projects with container status
- `projects start <id>` - Start project container
- `projects stop <id>` - Stop project container
- `projects restart <id>` - Restart project container
- `projects status <id>` - Show container status
- `projects logs <id>` - View container logs

#### MCP Server
- `get-container-status` - Get container status for a project
- `start-container` - Start a project container
- `stop-container` - Stop a project container
- `restart-container` - Restart a project container
- `get-container-logs` - Get container logs
- `list-directory` - Browse file system
- `get-common-directories` - Get common directories
- `get-file-access-rules` / `update-file-access-rules` - Manage file rules
- `get-block-permissions` / `update-block-permissions` - Manage block permissions

### Remaining Work Completed (January 25, 2026)
1. **Terminal Integration**: ✅ xterm.js implemented with ProjectTerminal component and TerminalHub
2. **Real Docker Integration**: ✅ Volume mounting added, projects mount rootPath automatically
3. **Resource Monitoring**: ✅ GetResourceStatsAsync implemented with Docker stats parsing
4. **Unit Tests**: ⚠️ Deferred to future phase (infrastructure in place)

See `PHASE-8-COMPLETION-SUMMARY.md` for detailed implementation notes.
