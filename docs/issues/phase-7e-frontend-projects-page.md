# Phase 7E: Frontend Projects Page - UI for Project Management

**Phase**: 7E
**Priority**: High
**Duration**: 3-4 days
**Team**: Frontend
**Dependencies**: Phase 7B, 7C complete (partial dependency on 7D)
**Blocks**: None
**Status**: Not Started

---

## Overview

Create a comprehensive Projects management interface in the frontend. Users should be able to create, open, switch between, and manage projects. The UI should integrate with the existing IDE layout and provide a seamless experience for working with isolated project contexts.

## Goals

1. Create ProjectsPage for listing and managing projects
2. Add project context to navigation and state
3. Enable project switching
4. Show project-specific blocks and workflows
5. Integrate container status (when 7D is complete)

---

## UI Design

### Projects Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Projects                                      [+ New Project]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ 📁 Project A     │  │ 📁 Project B     │  │ 📁 Project C   │ │
│  │                  │  │                  │  │                │ │
│  │ 5 blocks         │  │ 3 blocks         │  │ 8 blocks       │ │
│  │ 2 workflows      │  │ 1 workflow       │  │ 4 workflows    │ │
│  │                  │  │                  │  │                │ │
│  │ 🟢 Running       │  │ ⚫ Stopped       │  │ 🔴 Error       │ │
│  │                  │  │                  │  │                │ │
│  │ [Open] [⚙️]      │  │ [Open] [⚙️]      │  │ [Open] [⚙️]    │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Project Sidebar Integration

```
┌──────────────────────────────────────────────────────────────────┐
│ ▾ Project: My Project                           [Switch Project] │
├──────────────────────────────────────────────────────────────────┤
│ 📁 Blocks                                                        │
│   ├─ my-agent (agent)                                            │
│   ├─ my-tool (tool)                                              │
│   └─ my-workflow (workflow)                                      │
│                                                                  │
│ 📊 Executions                                                    │
│ ⚙️ Settings                                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### 7E.1 Create Project Store
- [ ] Create `projectStore.ts` in `frontend/src/store/`
- [ ] Implement state:
  - `projects: Project[]`
  - `currentProjectId: string | null`
  - `loading: boolean`
  - `error: string | null`
- [ ] Implement actions:
  - `fetchProjects()`
  - `setCurrentProject(id)`
  - `createProject(data)`
  - `updateProject(id, data)`
  - `deleteProject(id)`
  - `openProject(path)`
- [ ] Persist current project in localStorage

### 7E.2 Create Project Types
- [ ] Create `types/project.types.ts`
- [ ] Define interfaces:
  - `Project`
  - `ProjectSummary`
  - `CreateProjectRequest`
  - `UpdateProjectRequest`
  - `ContainerStatus`
  - `RuntimeConfig`

### 7E.3 Create Project API Service
- [ ] Create `services/projectService.ts`
- [ ] Implement API calls:
  - `getProjects()`
  - `getProject(id)`
  - `createProject(data)`
  - `updateProject(id, data)`
  - `deleteProject(id)`
  - `openProject(path)`
  - `getContainerStatus(id)`
  - `startContainer(id)`
  - `stopContainer(id)`

### 7E.4 Create ProjectsPage Component
- [ ] Create `pages/ProjectsPage.tsx`
- [ ] Implement project grid/list view
- [ ] Add "New Project" button
- [ ] Add project cards with summary info
- [ ] Show container status indicator
- [ ] Add search/filter functionality
- [ ] Add sorting options (name, date, status)
- [ ] Create `pages/ProjectsPage.scss`

### 7E.5 Create Project Card Component
- [ ] Create `components/ProjectCard/ProjectCard.tsx`
- [ ] Show project name, description
- [ ] Show block/workflow counts
- [ ] Show container status badge
- [ ] Add "Open" and "Settings" buttons
- [ ] Add context menu (delete, duplicate, etc.)

### 7E.6 Create New Project Dialog
- [ ] Create `components/NewProjectDialog/NewProjectDialog.tsx`
- [ ] Form fields:
  - Project name
  - Path (folder picker)
  - Description
  - Runtime type (node, python, dotnet)
- [ ] Validation
- [ ] Submit to API
- [ ] Handle success/error

### 7E.7 Create Project Settings Panel
- [ ] Create `components/ProjectSettings/ProjectSettings.tsx`
- [ ] Tabs:
  - General (name, description)
  - Runtime (container config)
  - Blocks (search paths)
  - Models (default model, overrides)
- [ ] Save functionality
- [ ] Delete project option

### 7E.8 Update Router for Projects
- [ ] Add routes:
  - `/projects` - Projects list
  - `/projects/:id` - Project dashboard
  - `/projects/:id/settings` - Project settings
  - `/projects/:id/blocks` - Project blocks
  - `/projects/:id/workflows` - Project workflows
- [ ] Update navigation links
- [ ] Add breadcrumb support

### 7E.9 Add Project Context to Existing Pages
- [ ] Update `FoundryPage` to show project-filtered blocks
- [ ] Update `AtomicBlockEditorPage` to include project context
- [ ] Update `MultiNodeEditorPage` for project workflows
- [ ] Update breadcrumbs to show current project

### 7E.10 Create Project Switcher Component
- [ ] Create `components/ProjectSwitcher/ProjectSwitcher.tsx`
- [ ] Dropdown in header or sidebar
- [ ] Show current project
- [ ] Quick switch to recent projects
- [ ] Link to "All Projects"

### 7E.11 Add Container Status UI
- [ ] Create `components/ContainerStatus/ContainerStatus.tsx`
- [ ] Status indicators: Running, Stopped, Starting, Error
- [ ] Start/Stop buttons
- [ ] View logs button
- [ ] Resource usage (optional, if available)

### 7E.12 Update Block Store for Project Context
- [ ] Modify `blockStore.ts` to support project filtering
- [ ] Add `fetchBlocksByProject(projectId)` action
- [ ] Update existing actions to include `projectId`
- [ ] Clear blocks when switching projects

### 7E.13 Add SignalR Integration for Projects
- [ ] Connect to project hub
- [ ] Handle events:
  - `ProjectAdded`
  - `ProjectUpdated`
  - `ProjectDeleted`
  - `ContainerStatusChanged`
- [ ] Update store on events

### 7E.14 Update Tests
- [ ] Create `projectStore.test.ts`
- [ ] Create `ProjectsPage.test.tsx`
- [ ] Create `ProjectCard.test.tsx`
- [ ] Update existing tests for project context

---

## Acceptance Criteria

1. [ ] ProjectsPage displays all discovered projects
2. [ ] Users can create new projects via dialog
3. [ ] Users can switch between projects
4. [ ] Project context persists across page navigation
5. [ ] Blocks/workflows are filtered by current project
6. [ ] Container status is visible and actionable
7. [ ] Project settings can be edited
8. [ ] Projects can be deleted with confirmation
9. [ ] Real-time updates via SignalR
10. [ ] All new components have tests

---

## Files to Create

### Store
- `frontend/src/store/projectStore.ts`
- `frontend/src/store/projectStore.test.ts`

### Types
- `frontend/src/types/project.types.ts`

### Services
- `frontend/src/services/projectService.ts`

### Pages
- `frontend/src/pages/ProjectsPage.tsx`
- `frontend/src/pages/ProjectsPage.scss`
- `frontend/src/pages/ProjectsPage.test.tsx`

### Components
- `frontend/src/components/ProjectCard/ProjectCard.tsx`
- `frontend/src/components/ProjectCard/ProjectCard.scss`
- `frontend/src/components/ProjectCard/index.ts`
- `frontend/src/components/NewProjectDialog/NewProjectDialog.tsx`
- `frontend/src/components/NewProjectDialog/NewProjectDialog.scss`
- `frontend/src/components/NewProjectDialog/index.ts`
- `frontend/src/components/ProjectSettings/ProjectSettings.tsx`
- `frontend/src/components/ProjectSettings/ProjectSettings.scss`
- `frontend/src/components/ProjectSwitcher/ProjectSwitcher.tsx`
- `frontend/src/components/ContainerStatus/ContainerStatus.tsx`

---

## Design Tokens

Use existing design system tokens:
```scss
// Project card
.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  
  &:hover {
    border-color: var(--accent-primary);
  }
}

// Status badges
.status-running { color: var(--color-success); }
.status-stopped { color: var(--color-muted); }
.status-error { color: var(--color-error); }
```

---

## State Management

### Project Store Interface
```typescript
interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  loading: boolean;
  error: string | null;
}

interface ProjectActions {
  fetchProjects: () => Promise<void>;
  setCurrentProject: (id: string | null) => void;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectRequest) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (path: string) => Promise<Project>;
}
```

### Local Storage
```typescript
// Persist current project
localStorage.setItem('maestro:currentProjectId', projectId);

// Restore on load
const savedProjectId = localStorage.getItem('maestro:currentProjectId');
```

---

## Related Issues

- Phase 7B: Project Model (provides API)
- Phase 7C: Unified Filesystem (API integration)
- Phase 7D: Container Runtime (container status)
- Phase 4F: Frontend Refactor Foundry (existing patterns)
