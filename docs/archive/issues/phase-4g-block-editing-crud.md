# Phase 4G: Block Editing, CRUD & UX Refinements

> **Issue Type**: Feature + Bug Fix + UX  
> **Priority**: High  
> **Estimated Duration**: 2-3 weeks  
> **Dependencies**: Phase 4f complete  
> **Assignee**: TBD

---

## 🎯 Overview

Phase 4G completes the Foundry ecosystem by implementing **type-specific block editing pages**, a **Block Creation Wizard**, full **CRUD service layer**, and critical UX improvements. This phase addresses bugs from Phase 4f and prepares the system for self-improving workflows.

---

## 🐛 Bug Fixes

### BUG-001: FoundrySidebar uses emoji icons instead of Lucide icons

**Problem**: The `FoundrySidebar.tsx` component uses emoji characters (`🤖`, `🔧`, `📝`, etc.) for category icons instead of the consistent Lucide-based `BlockIcon` component used elsewhere in the app.

**Location**: [FoundrySidebar.tsx](../../frontend/src/components/Foundry/FoundrySidebar.tsx#L20-L35)

**Current Code**:
```tsx
const CATEGORIES = [
  { id: 'all', label: 'All Blocks', icon: '📦' },
  { id: 'agent', label: 'Agents', icon: '🤖' },
  { id: 'task', label: 'Tasks', icon: '📋' },
  // ... emoji icons
];
```

**Expected**: Use `BlockIcon` component from `../icons/BlockIcons.tsx` which already defines proper Lucide icons for each `BlockType`.

**Solution**:
1. Import `BlockIcon` and `blockColorMap` from icons
2. Replace emoji strings with `BlockIcon` component renders
3. Add an "all" icon (use `Package` from lucide-react)

**Implementation Tasks**:
- [ ] Refactor `FoundrySidebar` to use `BlockIcon` component
- [ ] Add `Package` icon for "All Blocks" category
- [ ] Update SCSS for proper icon sizing/alignment
- [ ] Verify visual consistency with rest of app

---

### BUG-002: BlockExplorer always visible

**Problem**: The `BlockExplorer` component (block hierarchy tree) is always rendered in the layout, even on pages where it's not relevant (HomePage, ModelsPage, etc.). It should only appear when:
1. User is in the Canvas editing a composite block
2. User clicks on a block from Foundry to view its structure

**Current Behavior**: BlockExplorer is rendered in `IDELayout` unconditionally.

**Expected Behavior**:
- **Foundry page**: No BlockExplorer (grid view of all blocks)
- **Canvas page**: BlockExplorer shows hierarchy of currently edited block
- **Block Edit page**: BlockExplorer shows if block is composite, hidden if atomic
- **Other pages**: No BlockExplorer

**Solution**:
1. Make BlockExplorer conditional based on current route/context
2. Add `showExplorer` state to layout or use route-based logic
3. Pass context block ID to BlockExplorer for scoped hierarchy

**Implementation Tasks**:
- [ ] Add conditional rendering logic in `IDELayout`
- [ ] Create `useBlockExplorerVisibility()` hook
- [ ] Pass `contextBlockId` prop to scope BlockExplorer to specific block
- [ ] Update layout SCSS for seamless transitions

---

### BUG-003: Block card click does nothing for edit

**Problem**: Clicking a block card in Foundry navigates to `/foundry/:blockId/edit` but no edit page component exists for this route. The route is defined in `router.tsx` but the actual page/component is not implemented.

**Current Code** in [BlockCard.tsx](../../frontend/src/components/Foundry/BlockCard.tsx#L28-L33):
```tsx
const handleClick = () => {
  if (block.isAtomic) {
    navigate(`/foundry/${block.id}/edit`);  // Route exists, no page
  } else {
    navigate(`/canvas/${block.id}`);         // Works for composite
  }
};
```

**Solution**: Implement `BlockEditPage` with type-specific editors (see section 4g.2).

---

## 🏗️ Architecture Changes

### Block Editing Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FOUNDRY PAGE                                   │
│                    (Grid view of all blocks)                            │
│                                                                         │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│   │ Agent   │  │ Tool    │  │ Prompt  │  │Workflow │  ...              │
│   │  Card   │  │  Card   │  │  Card   │  │  Card   │                   │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                   │
│        │            │            │            │                         │
└────────┼────────────┼────────────┼────────────┼─────────────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                     CLICK ON BLOCK                             │
   └───────────────────────────────────────────────────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  Agent   │ │  Tool    │ │  Prompt  │ │  Canvas  │
   │  Editor  │ │  Editor  │ │  Editor  │ │  Editor  │
   │  Page    │ │  Page    │ │  Page    │ │  Page    │
   │(Atomic)  │ │(Atomic)  │ │(Atomic)  │ │(Composite)│
   └──────────┘ └──────────┘ └──────────┘ └──────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  BlockExplorer   │
                │  (if composite)  │
                └──────────────────┘
```

### Type-Specific Editors

Each block type requires a specialized editor:

| Block Type | Editor Name | Key Fields |
|------------|-------------|------------|
| `agent` | `AgentEditor` | Model selector, system prompt, tools list, temperature |
| `tool` | `ToolEditor` | Script/command, input schema, output schema, permissions |
| `prompt` | `PromptEditor` | Template text, variables, preview with sample data |
| `instruction` | `InstructionEditor` | Markdown content, attachments, scope |
| `task` | `TaskEditor` | Description, inputs, expected outputs, validation rules |
| `trigger` | `TriggerEditor` | Trigger type (cron, webhook, event), configuration |
| `validator` | `ValidatorEditor` | Validation schema, error messages, severity |
| `decision` | `DecisionEditor` | Condition expression, branches, default path |
| `workflow` | → Canvas | Visual editor (redirect to `/canvas/:id`) |

---

## 📋 Implementation Tasks

### 4g.1 Bug Fixes

- [ ] **BUG-001**: Replace emoji icons with `BlockIcon` in FoundrySidebar
- [ ] **BUG-002**: Make BlockExplorer conditional based on route/context
- [ ] **BUG-003**: Implement BlockEditPage routing and component
- [ ] **BUG-004**: Fix any undefined route handlers
- [ ] Add unit tests for fixes

### 4g.2 Block Edit Page & Type-Specific Editors

Create the unified edit page that renders type-specific editors:

```
frontend/src/
├── pages/
│   └── BlockEditPage.tsx              # Route handler, loads correct editor
├── components/
│   └── BlockEditors/
│       ├── index.ts                    # Barrel export
│       ├── BaseBlockEditor.tsx         # Shared layout/header
│       ├── AgentEditor.tsx             # Agent-specific fields
│       ├── ToolEditor.tsx              # Tool-specific fields
│       ├── PromptEditor.tsx            # Prompt-specific fields
│       ├── InstructionEditor.tsx       # Instruction-specific fields
│       ├── TaskEditor.tsx              # Task-specific fields
│       ├── TriggerEditor.tsx           # Trigger-specific fields
│       ├── ValidatorEditor.tsx         # Validator-specific fields
│       ├── DecisionEditor.tsx          # Decision-specific fields
│       └── EditorRegistry.ts           # Map type → editor component
```

**Tasks**:
- [ ] Create `BlockEditPage.tsx` route handler
- [ ] Create `BaseBlockEditor.tsx` with shared layout (header, save/cancel, metadata)
- [ ] Create `AgentEditor.tsx` with:
  - Model selector (reuse `ModelSelector` component)
  - System prompt textarea
  - Tools multi-select
  - Temperature slider
  - Max tokens input
- [ ] Create `ToolEditor.tsx` with:
  - Script/command editor (code editor component)
  - Input schema JSON editor
  - Output schema JSON editor
  - Permissions checkboxes
- [ ] Create `PromptEditor.tsx` with:
  - Template textarea with variable highlighting
  - Variables list (auto-detected or manual)
  - Live preview with sample data
- [ ] Create `InstructionEditor.tsx` with:
  - Markdown editor
  - Scope selector (global, workflow, agent)
- [ ] Create `TaskEditor.tsx` with:
  - Description textarea
  - Input/output fields
  - Validation rules
- [ ] Create `TriggerEditor.tsx` with:
  - Trigger type select (cron, webhook, file-watch, event)
  - Type-specific config (cron expression, webhook URL, etc.)
- [ ] Create `ValidatorEditor.tsx` with:
  - JSON Schema editor
  - Test validation button
- [ ] Create `DecisionEditor.tsx` with:
  - Condition expression editor
  - Branch configuration
- [ ] Create `EditorRegistry.ts` to map BlockType → Editor component
- [ ] Add proper form validation
- [ ] Add unsaved changes warning
- [ ] Add unit tests for each editor

### 4g.3 Block Creation Wizard Modal

Implement the multi-step wizard for creating new blocks:

```
frontend/src/components/
└── Foundry/
    ├── CreateBlockWizard/
    │   ├── index.ts
    │   ├── CreateBlockWizard.tsx       # Main modal container
    │   ├── CreateBlockWizard.scss
    │   ├── WizardStep.tsx              # Step wrapper
    │   ├── StepSelectType.tsx          # Step 1: Type cards
    │   ├── StepBasicInfo.tsx           # Step 2: Name, description, tags
    │   ├── StepConfiguration.tsx       # Step 3: Type-specific config
    │   ├── StepPreview.tsx             # Step 4: JSON preview & confirm
    │   └── wizardTypes.ts              # Wizard state types
```

**Wizard Flow**:
```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Select Block Type                                     │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│ │ 🤖 Agent│ │ 🔧 Tool │ │ 📝Prompt│ │🔀Workflow│  ...        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                         [Next →]                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Basic Information                                     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Name: [___________________]                              │ │
│ │ Description: [____________________________________]      │ │
│ │ Tags: [tag1] [tag2] [+ Add]                              │ │
│ │ Status: ○ Draft ● Active ○ Archived                      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                    [← Back]  [Next →]                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 3: Configuration (type-specific)                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [Agent-specific fields: model, prompt, tools...]         │ │
│ │ OR [Tool-specific fields: script, schema...]             │ │
│ │ OR [Prompt-specific fields: template, variables...]      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                    [← Back]  [Next →]                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 4: Preview & Confirm                                     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ {                                                        │ │
│ │   "type": "agent",                                       │ │
│ │   "name": "Code Reviewer",                               │ │
│ │   "config": { ... }                                      │ │
│ │ }                                                        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                    [← Back]  [Create Block]                   │
└──────────────────────────────────────────────────────────────┘
```

**Tasks**:
- [ ] Create `CreateBlockWizard.tsx` modal with step navigation
- [ ] Create `StepSelectType.tsx` with visual type cards
- [ ] Create `StepBasicInfo.tsx` with form fields
- [ ] Create `StepConfiguration.tsx` loading type-specific forms
- [ ] Create `StepPreview.tsx` with JSON preview and validation summary
- [ ] Implement wizard state management (useReducer)
- [ ] Add keyboard navigation (Tab, Enter, Escape)
- [ ] Add validation at each step
- [ ] Wire up to `blockStore.addBlock()` on completion
- [ ] Add template presets per block type
- [ ] Add unit tests

### 4g.4 CRUD Service Layer

Implement a proper service abstraction for block operations:

```
frontend/src/services/
├── blockService.ts              # Interface + factory
├── mockBlockService.ts          # Frontend-only mock
└── apiBlockService.ts           # Real backend (future)
```

**Interface**:
```typescript
interface IBlockService {
  // CRUD
  getAll(): Promise<Block[]>;
  getById(id: string): Promise<Block | null>;
  create(block: CreateBlockDto): Promise<Block>;
  update(id: string, updates: UpdateBlockDto): Promise<Block>;
  delete(id: string): Promise<void>;
  
  // Queries
  getByType(type: BlockType): Promise<Block[]>;
  getByCapability(capability: string): Promise<Block[]>;
  search(query: string): Promise<Block[]>;
  findUsages(blockId: string): Promise<BlockUsage[]>;
  
  // Actions
  duplicate(id: string): Promise<Block>;
  exportAsJson(id: string): Promise<string>;
  importFromJson(json: string): Promise<Block>;
}
```

**Tasks**:
- [ ] Define `IBlockService` interface in `blockService.ts`
- [ ] Implement `mockBlockService.ts` using `blockStore`
- [ ] Add `findUsages()` to track where blocks are referenced
- [ ] Add proper error handling with typed errors
- [ ] Add loading/error states to components using service
- [ ] Prepare `apiBlockService.ts` stub for backend integration
- [ ] Add unit tests for mock service

### 4g.5 Self-Improvement Discovery API

Create interfaces for workflows to programmatically discover and use blocks:

```
frontend/src/services/
└── discoveryService.ts
```

**Interface**:
```typescript
interface IBlockDiscoveryService {
  // Discovery
  listAvailableBlocks(filter?: BlockFilter): Promise<BlockSummary[]>;
  getBlockCapabilities(blockId: string): Promise<string[]>;
  getBlockSchema(blockId: string): Promise<BlockSchema>;
  
  // Recommendations
  suggestBlocks(context: WorkflowContext): Promise<BlockSuggestion[]>;
  findSimilarBlocks(blockId: string): Promise<Block[]>;
  
  // Execution insights
  getBlockStats(blockId: string): Promise<BlockStats>;
  getRecentExecutions(blockId: string, limit?: number): Promise<Execution[]>;
}
```

**Tasks**:
- [ ] Define `IBlockDiscoveryService` interface
- [ ] Implement `mockDiscoveryService` for frontend
- [ ] Expose discovery methods via stores
- [ ] Document API for agent prompt templates
- [ ] Add unit tests

### 4g.6 Global Search (Cmd+K)

Implement a global search palette for quick navigation:

```
frontend/src/components/
└── common/
    └── CommandPalette/
        ├── index.ts
        ├── CommandPalette.tsx
        ├── CommandPalette.scss
        ├── SearchResults.tsx
        └── useCommandPalette.ts
```

**Features**:
- Trigger with `Cmd+K` (Mac) / `Ctrl+K` (Windows)
- Search across blocks, workflows, models
- Recent items section
- Quick actions (create block, new workflow, etc.)
- Keyboard navigation (arrow keys, enter)

**Tasks**:
- [ ] Create `CommandPalette.tsx` modal component
- [ ] Create `useCommandPalette` hook for keyboard trigger
- [ ] Implement search across all entity types
- [ ] Add recent items tracking (localStorage)
- [ ] Add quick action commands
- [ ] Add keyboard navigation
- [ ] Register global keyboard listener
- [ ] Add unit tests

### 4g.7 Favorites & Keyboard Shortcuts

**Favorites**:
- [ ] Add `isFavorite` field to Block interface
- [ ] Add "Favorites" section in FoundrySidebar
- [ ] Add star/unstar action on BlockCard
- [ ] Persist favorites in localStorage
- [ ] Add keyboard shortcut to toggle favorite (`F` key on selected block)

**Keyboard Shortcuts Panel**:
- [ ] Create `KeyboardShortcutsPanel.tsx` modal (trigger with `?`)
- [ ] Document all available shortcuts
- [ ] Group by context (global, foundry, canvas, editor)
- [ ] Add shortcut customization (future)

**Shortcuts to implement**:
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + N` | Create new block |
| `Cmd/Ctrl + S` | Save current block |
| `Escape` | Close modal / cancel |
| `?` | Show shortcuts panel |
| `F` | Toggle favorite (on selected block) |
| `E` | Edit selected block |
| `D` | Duplicate selected block |
| `Delete` | Delete selected block |
| `↑ ↓ ← →` | Navigate grid/tree |
| `Enter` | Open/confirm selection |

### 4g.8 Unit Tests

Ensure comprehensive test coverage for new features:

- [ ] `FoundrySidebar.test.tsx` - icon rendering, category selection
- [ ] `BlockEditPage.test.tsx` - routing, type dispatch
- [ ] `AgentEditor.test.tsx` - form validation, model selection
- [ ] `ToolEditor.test.tsx` - schema editing
- [ ] `PromptEditor.test.tsx` - variable detection, preview
- [ ] `CreateBlockWizard.test.tsx` - step navigation, validation
- [ ] `blockService.test.ts` - CRUD operations, error handling
- [ ] `discoveryService.test.ts` - discovery queries
- [ ] `CommandPalette.test.tsx` - search, keyboard nav
- [ ] `useBlockExplorerVisibility.test.ts` - conditional logic

**Coverage targets**:
- New components: > 80%
- Services: > 90%
- Hooks: > 85%

### 4g.9 Documentation Updates

- [ ] Update `frontend/README.md` with:
  - Block editing workflow
  - Type-specific editor documentation
  - CRUD service usage
  - Keyboard shortcuts reference
- [ ] Add JSDoc to all new public functions
- [ ] Create `docs/block-editors.md` with detailed editor specs
- [ ] Update `ROADMAP.md` to mark Phase 4g complete

---

## 🎯 Acceptance Criteria

### Bug Fixes
- [ ] FoundrySidebar displays Lucide icons, not emojis
- [ ] BlockExplorer only visible on Canvas and composite block edit pages
- [ ] Clicking block card navigates to proper edit page

### Block Editing
- [ ] Each block type has a dedicated editor with appropriate fields
- [ ] Editors validate input before save
- [ ] Unsaved changes show warning on navigation
- [ ] Composite blocks redirect to Canvas

### Creation Wizard
- [ ] 4-step wizard flows smoothly
- [ ] Type-specific configuration adapts per selection
- [ ] Preview shows accurate JSON representation
- [ ] Created blocks appear immediately in Foundry

### CRUD & Services
- [ ] All CRUD operations work via service layer
- [ ] Mock service provides realistic behavior
- [ ] Error states handled gracefully
- [ ] Loading indicators shown during async operations

### UX Improvements
- [ ] `Cmd/Ctrl+K` opens command palette
- [ ] Favorites section works in sidebar
- [ ] Keyboard shortcuts documented and functional
- [ ] All interactions accessible via keyboard

---

## 📊 Success Metrics

- [ ] All Phase 4g tasks completed and marked in ROADMAP
- [ ] Unit test coverage > 80% for new code
- [ ] No accessibility violations (axe audit)
- [ ] All editors save/load correctly
- [ ] Command palette response time < 100ms

---

## 🔗 Related Issues

- Phase 4b: Block Architecture (type system)
- Phase 4c: IDE Layout (panel system)
- Phase 4d: Canvas Foundation (composite editing)
- Phase 4e: Models Panel (model selection for agents)
- Phase 4f: Foundry Foundation (grid view, search)

---

## 📁 File Changes Summary

### New Files
```
frontend/src/
├── pages/
│   └── BlockEditPage.tsx
├── components/
│   ├── BlockEditors/
│   │   ├── index.ts
│   │   ├── BaseBlockEditor.tsx
│   │   ├── AgentEditor.tsx
│   │   ├── ToolEditor.tsx
│   │   ├── PromptEditor.tsx
│   │   ├── InstructionEditor.tsx
│   │   ├── TaskEditor.tsx
│   │   ├── TriggerEditor.tsx
│   │   ├── ValidatorEditor.tsx
│   │   ├── DecisionEditor.tsx
│   │   └── EditorRegistry.ts
│   ├── Foundry/
│   │   └── CreateBlockWizard/
│   │       ├── index.ts
│   │       ├── CreateBlockWizard.tsx
│   │       ├── StepSelectType.tsx
│   │       ├── StepBasicInfo.tsx
│   │       ├── StepConfiguration.tsx
│   │       ├── StepPreview.tsx
│   │       └── wizardTypes.ts
│   └── common/
│       ├── CommandPalette/
│       │   ├── index.ts
│       │   ├── CommandPalette.tsx
│       │   └── useCommandPalette.ts
│       └── KeyboardShortcutsPanel.tsx
├── services/
│   ├── blockService.ts
│   ├── mockBlockService.ts
│   └── discoveryService.ts
└── hooks/
    └── useBlockExplorerVisibility.ts
```

### Modified Files
```
frontend/src/
├── components/
│   └── Foundry/
│       └── FoundrySidebar.tsx          # Use BlockIcon instead of emoji
├── layouts/
│   └── IDELayout.tsx                   # Conditional BlockExplorer
├── router.tsx                          # Add BlockEditPage route
└── types/
    └── block.types.ts                  # Add isFavorite, update schemas
```

---

## 🗓️ Timeline Estimate

| Task Group | Duration | Depends On |
|------------|----------|------------|
| 4g.1 Bug Fixes | 1-2 days | - |
| 4g.2 Block Editors | 4-5 days | 4g.1 |
| 4g.3 Creation Wizard | 3-4 days | 4g.2 |
| 4g.4 CRUD Service | 2-3 days | - |
| 4g.5 Discovery API | 1-2 days | 4g.4 |
| 4g.6 Global Search | 2-3 days | 4g.4 |
| 4g.7 Favorites/Shortcuts | 1-2 days | 4g.6 |
| 4g.8 Unit Tests | 2-3 days | All |
| 4g.9 Documentation | 1 day | All |

**Total**: ~2-3 weeks with 1-2 frontend developers

---

## ✅ Checklist for Completion

- [ ] All implementation tasks completed
- [ ] All bug fixes verified
- [ ] Unit tests written and passing
- [ ] Manual QA completed for all editors
- [ ] Keyboard navigation tested
- [ ] ROADMAP.md updated to mark Phase 4g complete
- [ ] PR description created
- [ ] Code review completed
- [ ] Documentation updated
