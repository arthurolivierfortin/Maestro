# Phase 4f: Frontend Refactor & Foundry Page

> **Issue Type**: Feature + Refactor + Bug Fix  
> **Priority**: High  
> **Estimated Duration**: 2-3 weeks  
> **Dependencies**: Phase 4e complete  
> **Assignee**: TBD

---

## 🎯 Overview

Phase 4f consolidates the frontend architecture by introducing the **Foundry Page** — a unified interface for creating, managing, and discovering all block types (agents, tools, prompts, workflows, etc.). This phase also addresses bugs, completes missing CRUD functionality, and prepares the UI for self-improving workflows.

---

## 🐛 Bug Fixes

### BUG-001: Copilot agents don't update ROADMAP

**Problem**: When Copilot agents complete tasks, they don't update the ROADMAP.md to mark tasks as complete.

**Root Cause Analysis**:
1. The instructions files (`.github/instructions/`) don't explicitly instruct agents to update ROADMAP after completing tasks
2. There's no automated mechanism to sync task completion with ROADMAP checkboxes
3. Agents may not be aware of which ROADMAP section corresponds to their current work

**Solution Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Instruction Update | Add explicit instruction in `code-conventions.instructions.md` to update ROADMAP when finishing a phase task | Simple, immediate | Relies on agent compliance |
| B. Task Tracking File | Create `current-task.md` that agents read/write to track progress, with script to sync to ROADMAP | Structured tracking | Additional file to maintain |
| C. ROADMAP Markers | Add special markers in ROADMAP (`<!-- TASK:4e.1 -->`) that agents can search and update | Parseable, scriptable | Requires ROADMAP restructure |

**Recommended**: Option A + C hybrid
1. Add instruction to update ROADMAP in `code-conventions.instructions.md`
2. Add task markers in ROADMAP for agent reference
3. Add a prompt file `.github/prompts/complete-task.prompt.md` for standardized task completion

**Implementation Tasks**:
- [ ] Add section in `code-conventions.instructions.md` about updating ROADMAP on task completion
- [ ] Create `.github/prompts/complete-task.prompt.md` with instructions for marking tasks done
- [ ] Add task ID markers to ROADMAP.md for easier agent reference
- [ ] Document workflow in CONTRIBUTING.md

---

## 🏗️ Foundry Page Architecture

### Vision

The **Foundry** is the unified creation and management interface for all block types in Maestro. It replaces the need for separate pages per block type by providing:

- **Single source of truth** for all reusable components
- **Unified search and filter** across all block types  
- **Consistent creation workflow** regardless of block type
- **Visual block library** with previews and metadata

### Design Principles

1. **Everything is a Block**: Agents, tools, prompts, workflows — all are blocks with inputs/outputs
2. **Composability**: Any block can be reused inside other blocks
3. **Discoverability**: Easy to find blocks by type, capability, name, or tags
4. **Self-Improvement Ready**: Workflows can discover and use blocks programmatically

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOP BAR                                        │
├────────────┬────────────────────────────────────────────────────────────────┤
│            │  ┌─────────────────────────────────────────────────────────┐   │
│  FOUNDRY   │  │  [🔍 Search blocks...]  [Type ▼] [Capability ▼] [Tags]  │   │
│  SIDEBAR   │  ├─────────────────────────────────────────────────────────┤   │
│            │  │                                                         │   │
│ CATEGORIES │  │                   BLOCK GRID / LIST                     │   │
│ ┌────────┐ │  │                                                         │   │
│ │📦 All  │ │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│ │🤖 Agents│ │  │  │ 🤖      │  │ 🔧      │  │ 📝      │  │ 🔀      │    │   │
│ │📋 Tasks │ │  │  │ Coder   │  │ Bash    │  │ System  │  │ Feature │    │   │
│ │🔧 Tools │ │  │  │ Agent   │  │ Tool    │  │ Prompt  │  │Workflow │    │   │
│ │📝 Prompts│ │  │ └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│ │📜 Scripts│ │  │                                                         │   │
│ │⚡ Triggers│ │ │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│ │🔀 Workflows││  │  │ 🤖      │  │ ❓      │  │ ✅      │  │ ⚡      │    │   │
│ │✅ Validators││ │  │Reviewer │  │Decision │  │Validator│  │ Cron    │    │   │
│ └────────┘ │  │  │ Agent   │  │ Node    │  │ Schema  │  │ Trigger │    │   │
│            │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│ ┌────────┐ │  │                                                         │   │
│ │+ Create │ │  │                                                         │   │
│ │  Block  │ │  │                                                         │   │
│ └────────┘ │  └─────────────────────────────────────────────────────────┘   │
├────────────┴────────────────────────────────────────────────────────────────┤
│                         BOTTOM PANEL (Terminal/Logs)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sidebar Categories

| Category | Block Types | Icon |
|----------|-------------|------|
| All | All blocks | 📦 |
| Agents | `agent` | 🤖 |
| Tasks | `task` | 📋 |
| Tools | `tool`, `script` | 🔧 |
| Prompts | `prompt`, `instruction` | 📝 |
| Triggers | `trigger` | ⚡ |
| Workflows | `workflow` | 🔀 |
| Validators | `validator` | ✅ |
| Decisions | `decision` | ❓ |

### Block Card Component

Each block in the grid displays:
- **Icon**: Type-specific icon
- **Name**: Display name
- **Type badge**: e.g., "Agent", "Tool"
- **Capability tags**: e.g., "code-generation", "file-ops"
- **Atomic indicator**: Dot for atomic, nested icon for composite
- **Status**: Available/Draft/Archived
- **Quick actions**: Edit, Duplicate, Delete (on hover)

### Interactions

| Action | Behavior |
|--------|----------|
| Click block | Open detail view / editor |
| Double-click composite | Navigate into (drill-down to internal canvas) |
| Drag block | Start drag for use in canvas |
| Right-click | Context menu (edit, duplicate, delete, export) |
| + Create Block | Open creation wizard |

---

## 📋 Implementation Tasks

### 4f.1 Bug Fixes & Technical Debt

- [ ] **BUG-001**: Add ROADMAP update instructions to code conventions
- [ ] **BUG-002**: Fix expand/collapse arrows in BlockExplorer (use SVG icons)
- [ ] **TECH-001**: Consolidate duplicate type definitions across files
- [ ] **TECH-002**: Add proper error boundaries to all pages
- [ ] **TECH-003**: Implement loading skeletons for async components
- [ ] **TECH-004**: Add accessibility audit and fixes (ARIA labels, keyboard nav)

### 4f.2 Foundry Page Foundation

- [ ] Create `FoundryPage.tsx` with layout structure
- [ ] Create `FoundrySidebar.tsx` with category filters
- [ ] Create `FoundrySearchBar.tsx` with type/capability filters
- [ ] Create `BlockGrid.tsx` for displaying blocks
- [ ] Create `BlockCard.tsx` component with hover actions
- [ ] Implement responsive grid (CSS Grid with auto-fit)
- [ ] Add keyboard navigation (arrow keys, enter to select)
- [ ] Add unit tests

### 4f.3 Block Store Enhancements

- [ ] Add `getAllBlocks()` method to blockStore
- [ ] Add `getBlocksByType(type: BlockType)` filter
- [ ] Add `getBlocksByCapability(cap: string)` filter  
- [ ] Add `searchBlocks(query: string)` with fuzzy matching
- [ ] Add `tags: string[]` field to Block interface
- [ ] Add `status: 'draft' | 'active' | 'archived'` field
- [ ] Implement `duplicateBlock(id)` action
- [ ] Implement `exportBlock(id)` as JSON
- [ ] Implement `importBlock(json)` with validation
- [ ] Add unit tests for all new methods

### 4f.4 Block Creation Wizard

- [ ] Create `CreateBlockWizard.tsx` modal component
- [ ] Step 1: Select block type (visual cards)
- [ ] Step 2: Basic info (name, description, tags)
- [ ] Step 3: Type-specific configuration
- [ ] Step 4: Preview and confirm
- [ ] Implement template presets per type
- [ ] Add validation at each step
- [ ] Add unit tests

### 4f.5 Block Detail/Edit Views

- [ ] Create `BlockDetailView.tsx` for viewing block info
- [ ] Implement inline editing for atomic blocks
- [ ] Navigate to Canvas for composite blocks on "Edit Contents"
- [ ] Show block usage (where is this block referenced?)
- [ ] Show block history/versions (future)
- [ ] Add unit tests

### 4f.6 Missing CRUD Functionality

Currently, blocks can only be created via demo button. Add full CRUD:

- [ ] **Create**: Via Foundry wizard OR drag template to canvas
- [ ] **Read**: Block detail view, block card hover info
- [ ] **Update**: Inline edit for atomics, Canvas for composites
- [ ] **Delete**: With confirmation, check for usages first
- [ ] Implement `blockService` interface with mock backend
- [ ] Add real backend endpoints (if backend ready)
- [ ] Add unit tests

### 4f.7 Routing Refactor

Current pages:
- `/` - HomePage
- `/workflows` - WorkflowsPage
- `/workflow/:id` - WorkflowEditorPage
- `/models` - ModelsPage
- `/history` - HistoryPage
- `/blocks` - BlockDemoPage
- `/canvas` - CanvasPage

Proposed new structure:
- `/` - HomePage (dashboard)
- `/foundry` - FoundryPage (all blocks)
- `/foundry/:blockType` - FoundryPage filtered by type
- `/foundry/:blockId/edit` - Block edit (atomics) or redirect to canvas (composites)
- `/canvas/:blockId` - Canvas view for editing composite block internals
- `/execute/:workflowId` - Execution monitor
- `/history` - Execution history
- `/models` - ModelsPage (keep separate for now)
- `/settings` - Settings (future)

- [ ] Update `router.tsx` with new routes
- [ ] Add redirects from old routes
- [ ] Update navigation links in Sidebar
- [ ] Update TopBar navigation
- [ ] Add breadcrumbs for deep navigation
- [ ] Add unit tests

### 4f.8 Self-Improvement Preparation

For workflows to improve themselves, they need programmatic access to:

- [ ] **Block Discovery API**: List available blocks by type/capability
- [ ] **Block Metadata**: Read block configs, inputs/outputs
- [ ] **Block Instantiation**: Create new block instances in workflow
- [ ] **Execution History**: Access past runs, success rates, timings
- [ ] **Model Registry**: Query available models and their capabilities

Implementation:
- [ ] Create `IBlockDiscoveryService` interface
- [ ] Create `mockBlockDiscoveryService` for frontend use
- [ ] Expose discovery methods in stores
- [ ] Document API for agent prompt usage
- [ ] Add unit tests

### 4f.9 Navigation & UX Improvements

- [ ] Add global search (Cmd+K / Ctrl+K) for blocks, workflows, models
- [ ] Add recent items list in sidebar
- [ ] Add favorites/pinned blocks
- [ ] Add "Create New" quick action menu in TopBar
- [ ] Improve breadcrumb navigation component
- [ ] Add keyboard shortcuts panel (? key)
- [ ] Add onboarding tour for new users
- [ ] Add unit tests

### 4f.10 Documentation & Examples

- [ ] Update frontend/README.md with Foundry documentation
- [ ] Add example blocks for each type (agents, tools, prompts)
- [ ] Create "Getting Started" workflow example
- [ ] Document block schema and configuration options
- [ ] Add inline help tooltips in UI

---

## 🎯 Acceptance Criteria

### Foundry Page
- [ ] User can view all blocks in a filterable grid
- [ ] User can filter by type via sidebar categories
- [ ] User can search by name, tags, capabilities
- [ ] User can create new blocks via wizard
- [ ] User can edit atomic blocks inline
- [ ] User can navigate into composite blocks (canvas)
- [ ] User can duplicate and delete blocks
- [ ] User can export/import blocks as JSON

### Block CRUD
- [ ] All CRUD operations work with mock backend
- [ ] Operations show loading states
- [ ] Errors are handled gracefully
- [ ] Optimistic updates where appropriate
- [ ] Undo available for destructive actions

### Self-Improvement Ready
- [ ] Block discovery API is documented
- [ ] Workflows can programmatically list blocks
- [ ] Execution history is queryable
- [ ] Model selection is programmatic

---

## 📊 Success Metrics

- [ ] All Phase 4f tasks completed and marked in ROADMAP
- [ ] Unit test coverage > 80% for new components
- [ ] No accessibility violations (axe audit)
- [ ] Page load time < 2s
- [ ] All interactions have proper loading/error states

---

## 🔗 Related Issues

- Phase 4b: Block Architecture (provides type system)
- Phase 4c: IDE Layout (provides panel system)
- Phase 4d: Canvas Foundation (provides block editing)
- Phase 4e: Models Panel (provides model selection)

---

## 📝 Notes

### Why Unify in Foundry?

The ROADMAP describes a recursive block system where "blocks are composable" and "blocks are reusable." Separating agents, tools, and workflows into different pages creates artificial boundaries that contradict this philosophy.

A unified Foundry:
1. **Reflects the architecture**: Everything is a block
2. **Enables discovery**: Find any reusable component in one place
3. **Supports self-improvement**: Workflows can query the Foundry for blocks
4. **Scales gracefully**: New block types don't need new pages

### Relationship with Existing Pages

| Current Page | Becomes |
|--------------|---------|
| BlockDemoPage | Remove (replaced by Foundry) |
| CanvasPage | Keep (editing composite block internals) |
| WorkflowsPage | Shortcut to `/foundry?type=workflow` OR merged into Foundry |
| WorkflowEditorPage | Redirect to Canvas with workflow ID |
| ModelsPage | Keep separate (not a block type) |

---

## 🗓️ Timeline Estimate

| Task Group | Duration | Depends On |
|------------|----------|------------|
| 4f.1 Bug Fixes | 2-3 days | - |
| 4f.2 Foundry Foundation | 3-4 days | - |
| 4f.3 Block Store | 2-3 days | - |
| 4f.4 Creation Wizard | 3-4 days | 4f.2, 4f.3 |
| 4f.5 Detail/Edit Views | 2-3 days | 4f.2 |
| 4f.6 Missing CRUD | 2-3 days | 4f.3 |
| 4f.7 Routing Refactor | 1-2 days | 4f.2 |
| 4f.8 Self-Improvement | 2-3 days | 4f.3, 4f.6 |
| 4f.9 Navigation/UX | 2-3 days | 4f.7 |
| 4f.10 Documentation | 1-2 days | All |

**Total**: ~2-3 weeks with 1-2 frontend developers

---

## ✅ Checklist for Completion

- [ ] All implementation tasks completed
- [ ] Unit tests written and passing
- [ ] ROADMAP.md updated to mark Phase 4f complete
- [ ] PR description created
- [ ] Code review completed
- [ ] Documentation updated
