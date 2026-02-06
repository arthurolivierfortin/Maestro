# Phase 4H: Canvas & Node Functionality — Complete Workflow Editing

> **Issue Type**: Feature + Bug Fix  
> **Priority**: 🔴 CRITICAL  
> **Estimated Duration**: 2-3 weeks  
> **Dependencies**: Phase 4g complete  
> **Status**: Not Started  
> **Branch**: `feature/MAESTRO-XXX-canvas-node-functionality`

---

## 🎯 Objective

Make the canvas and node system fully functional. Users must be able to:
1. **Create a new workflow** from scratch
2. **Drag nodes** from a palette onto the canvas
3. **Move nodes** freely on the canvas
4. **Connect nodes** with validated edges
5. **Execute workflows** with mocked node behaviors
6. **Run the example workflow** (Commit Description Generator)

This phase focuses on **fixing what's broken** and **completing missing functionality** to deliver a usable workflow editing experience.

---

## 📋 Current Problems

### Critical Issues

| ID | Problem | Location | Impact |
|----|---------|----------|--------|
| **CANVAS-001** | Cannot add nodes to canvas (drag-drop not working) | `BlockPalette`, `BlockCanvas` | Blocks workflow creation |
| **CANVAS-002** | Nodes cannot be moved on canvas | `useCanvasSync.ts`, `BlockCanvas` | UX broken |
| **CANVAS-003** | Cannot connect nodes (edge creation fails) | `useCanvasSync.ts`, `ConnectionEdge` | Workflow building impossible |
| **CANVAS-004** | No visual block palette for dragging | Missing `BlockPalette` component | No way to add nodes |
| **CANVAS-005** | Context menu actions don't work | `BaseBlockNode.tsx` | No quick actions |
| **CANVAS-006** | No workflow execution capability | Missing `ExecutionService` | Cannot run workflows |
| **CANVAS-007** | Example workflows don't load properly | `mockData/workflows.ts` | Demo broken |

### Secondary Issues

| ID | Problem | Location | Impact |
|----|---------|----------|--------|
| **CANVAS-008** | Node selection state not synced | `useCanvasSync`, `navigationStore` | Confusing UX |
| **CANVAS-009** | Delete key doesn't remove nodes | `BlockCanvas` keyboard handling | Missing expected behavior |
| **CANVAS-010** | Copy/paste not implemented | Missing functionality | Expected feature |
| **CANVAS-011** | Undo/redo not implemented | Missing functionality | Expected feature |

---

## 🏗️ Architecture Overview

### Component Hierarchy

```
CanvasPage
├── BlockPalette (NEW - draggable block types)
│   ├── PaletteCategory
│   │   └── PaletteItem (draggable)
│   └── PaletteSearch
├── BlockCanvas (FIX - make fully functional)
│   ├── ReactFlow
│   │   ├── BaseBlockNode (per block type)
│   │   │   ├── BlockIcon
│   │   │   ├── BlockPorts (handles)
│   │   │   └── BlockActions (menu)
│   │   └── ConnectionEdge
│   ├── CanvasContextMenu
│   └── CanvasControls (zoom, fit, etc.)
└── ExecutionBar (NEW - run/stop/pause controls)
```

### Data Flow

```
┌─────────────┐     drag      ┌──────────────┐
│ BlockPalette│ ───────────▶ │ BlockCanvas   │
└─────────────┘               └──────────────┘
                                     │
                                     ▼ addBlock()
                              ┌──────────────┐
                              │  BlockStore  │
                              └──────────────┘
                                     │
                                     ▼ sync
                              ┌──────────────┐
                              │ React Flow   │
                              │   Nodes      │
                              └──────────────┘
```

---

## ✅ Acceptance Criteria

### 4h.1 Block Palette Component ✅

**Goal**: Create a draggable palette of block types

**Tasks**:
- [ ] Create `BlockPalette.tsx` component
- [ ] Create `PaletteCategory.tsx` for grouped block types
- [ ] Create `PaletteItem.tsx` with drag functionality
- [ ] Implement drag-and-drop using React DnD or native HTML5 DnD
- [ ] Style palette to match design system
- [ ] Add search/filter functionality
- [ ] Add tooltips with block type descriptions

**Files**:
```
frontend/src/components/BlockPalette/
├── BlockPalette.tsx
├── BlockPalette.scss
├── PaletteCategory.tsx
├── PaletteItem.tsx
├── PaletteItem.scss
└── index.ts
```

**Validation Tests**:
- [ ] Palette renders all 9 block types (agent, task, tool, prompt, instruction, decision, validator, trigger, workflow)
- [ ] Each block type shows correct icon from `BlockIcon`
- [ ] Palette items are draggable
- [ ] Search filters block types correctly
- [ ] Categories collapse/expand

---

### 4h.2 Drag-and-Drop to Canvas ✅

**Goal**: Enable dragging blocks from palette onto canvas

**Tasks**:
- [ ] Implement drop zone on `BlockCanvas`
- [ ] Calculate drop position relative to canvas viewport
- [ ] Create new block with correct position via `blockStore.addBlock()`
- [ ] Generate unique block IDs on drop
- [ ] Create default configuration based on block type
- [ ] Auto-select newly added block

**Implementation**:
```typescript
// In BlockCanvas.tsx
const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  const blockType = event.dataTransfer?.getData('application/maestro-block-type');
  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const position = {
    x: event.clientX - (canvasRect?.left || 0),
    y: event.clientY - (canvasRect?.top || 0),
  };
  
  // Apply viewport transform (zoom/pan)
  const flowPosition = project(position);
  
  addBlock(parentId, createDefaultBlock(blockType, flowPosition));
};
```

**Validation Tests**:
- [ ] Drag block type from palette → drop on canvas → block appears at drop position
- [ ] Block has correct type and default configuration
- [ ] Block is auto-selected after drop
- [ ] Multiple blocks can be added sequentially
- [ ] Undo removes the added block

---

### 4h.3 Node Movement ✅

**Goal**: Allow free movement of nodes on canvas

**Tasks**:
- [ ] Fix `onNodesChange` handler in `useCanvasSync.ts`
- [ ] Update block position in store after drag ends
- [ ] Ensure position persists (store → localStorage/backend)
- [ ] Add grid snapping option
- [ ] Support multi-node selection and movement

**Current Bug Analysis**:
```typescript
// useCanvasSync.ts - Current code doesn't update positions correctly
case 'position':
  if (change.position && change.dragging === false) {
    updateBlock(change.id, { position: change.position });
  }
  break;
```

**Fix**:
- Verify `updateBlock` correctly updates the block in store
- Ensure React Flow nodes are derived from store (not duplicated state)
- Check that `position` in Block type matches React Flow expectations

**Validation Tests**:
- [ ] Drag node to new position → position saved
- [ ] Reload page → node still at saved position
- [ ] Select multiple nodes → drag → all move together
- [ ] Grid snapping works when enabled

---

### 4h.4 Node Connections ✅

**Goal**: Enable connecting nodes via ports

**Tasks**:
- [ ] Fix `onConnect` handler in `useCanvasSync.ts`
- [ ] Implement port validation (input-to-output only)
- [ ] Add visual feedback during connection drag
- [ ] Create connection edge with proper styling
- [ ] Store connections in parent block's `connections` array
- [ ] Prevent duplicate connections
- [ ] Allow connection deletion

**Connection Validation Rules**:
```typescript
const isValidConnection = (source: Block, sourcePort: Port, target: Block, targetPort: Port): boolean => {
  // Rule 1: Cannot connect to self
  if (source.id === target.id) return false;
  
  // Rule 2: Must be output → input
  if (sourcePort.direction !== 'output' || targetPort.direction !== 'input') return false;
  
  // Rule 3: Type compatibility (future)
  // if (sourcePort.dataType !== targetPort.dataType) return false;
  
  return true;
};
```

**Visual Feedback**:
- Valid target: Green glow on port
- Invalid target: Red glow on port
- Connection preview line follows cursor

**Validation Tests**:
- [ ] Drag from output port → connect to input port → connection created
- [ ] Cannot connect output → output
- [ ] Cannot connect input → input
- [ ] Cannot connect node to itself
- [ ] Connection appears with proper styling
- [ ] Click connection → delete it
- [ ] Connections persist after reload

---

### 4h.5 Node Context Menu & Actions ✅

**Goal**: Restore node action buttons functionality

**Tasks**:
- [ ] Fix `handleMenuClick` in `BaseBlockNode.tsx`
- [ ] Create `NodeContextMenu.tsx` dropdown component
- [ ] Implement actions:
  - Edit (open properties panel in edit mode)
  - Duplicate (create copy at offset position)
  - Delete (remove with confirmation)
  - Drill into (for composite blocks)
- [ ] Add keyboard shortcut hints in menu

**Current Bug Analysis**:
```typescript
// BaseBlockNode.tsx - Menu click does nothing useful
const handleMenuClick = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  console.log('Menu clicked for block:', block.id); // Only logs!
}, [block.id]);
```

**Fix**:
```typescript
const handleMenuClick = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  setMenuOpen(!menuOpen);
}, [menuOpen]);

// Render dropdown menu
{menuOpen && (
  <NodeContextMenu
    block={block}
    onEdit={() => openPropertiesPanel(block.id)}
    onDuplicate={() => duplicateBlock(block.id)}
    onDelete={() => removeBlock(block.id)}
    onDrillInto={() => navigateInto(block.id)}
    onClose={() => setMenuOpen(false)}
  />
)}
```

**Validation Tests**:
- [ ] Click menu button → dropdown opens
- [ ] Click Edit → properties panel opens with block selected
- [ ] Click Duplicate → new block created at offset
- [ ] Click Delete → confirmation → block removed
- [ ] Click Drill Into (composite only) → navigates into block
- [ ] Click outside menu → menu closes
- [ ] Escape key → menu closes

---

### 4h.6 Keyboard Shortcuts ✅

**Goal**: Implement standard canvas keyboard shortcuts

**Shortcuts**:
| Key | Action |
|-----|--------|
| `Delete` / `Backspace` | Delete selected nodes |
| `Ctrl+A` | Select all nodes |
| `Ctrl+C` | Copy selected nodes |
| `Ctrl+V` | Paste nodes |
| `Ctrl+X` | Cut selected nodes |
| `Ctrl+D` | Duplicate selected nodes |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Escape` | Clear selection |
| `Enter` | Drill into selected composite block |
| `Arrow keys` | Nudge selected nodes |

**Tasks**:
- [ ] Create `useCanvasShortcuts.ts` hook
- [ ] Implement clipboard operations (copy/paste)
- [ ] Implement undo/redo with history stack
- [ ] Integrate with React Flow's built-in handling
- [ ] Add visual feedback for operations

**Validation Tests**:
- [ ] Select node → Delete → node removed
- [ ] Ctrl+A → all nodes selected
- [ ] Ctrl+C, Ctrl+V → copy and paste works
- [ ] Ctrl+Z → undo last action
- [ ] Ctrl+Shift+Z → redo action

---

### 4h.7 Workflow Execution (Mock) ✅

**Goal**: Enable running workflows with mocked node execution

**Tasks**:
- [ ] Create `IExecutionService` interface
- [ ] Create `mockExecutionService.ts` with simulated execution
- [ ] Create `ExecutionBar.tsx` component (Run/Stop/Pause buttons)
- [ ] Implement execution state management
- [ ] Show execution status on nodes (pending → running → completed/failed)
- [ ] Animate connections during execution
- [ ] Display execution logs in bottom panel

**Execution Flow**:
```typescript
interface IExecutionService {
  startExecution(workflowId: string): Promise<ExecutionRun>;
  pauseExecution(runId: string): Promise<void>;
  resumeExecution(runId: string): Promise<void>;
  cancelExecution(runId: string): Promise<void>;
  getExecutionStatus(runId: string): Promise<ExecutionStatus>;
}

// Mock execution simulates each node with delays
const mockExecuteNode = async (node: Block): Promise<NodeResult> => {
  // Simulate processing time (500ms - 2000ms)
  await delay(randomBetween(500, 2000));
  
  // Return mock result based on node type
  return {
    nodeId: node.id,
    status: 'completed',
    output: generateMockOutput(node),
    duration: performance.now() - startTime,
  };
};
```

**Validation Tests**:
- [ ] Click Run → execution starts
- [ ] Nodes show running/completed status
- [ ] Edges animate during execution
- [ ] Logs appear in bottom panel
- [ ] Pause stops execution at current node
- [ ] Resume continues execution
- [ ] Cancel aborts execution

---

### 4h.8 Example Workflow: Commit Description Generator ✅

**Goal**: Create a working example workflow demonstrating all features

**Workflow Description**:
```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Trigger │───▶│  Tool   │───▶│  Agent  │───▶│Validator│
│ (Manual)│    │(git diff)│    │(Describe)│    │(Format) │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

**Blocks**:
1. **Trigger**: Manual trigger to start workflow
2. **Tool - Git Diff**: Runs `git diff --staged` to get changes
3. **Agent - Commit Describer**: Uses LLM to generate commit message from diff
4. **Validator - Format Check**: Validates message follows conventional commits

**Mock Data**:
```typescript
// mockData/workflows.ts
export const EXAMPLE_COMMIT_WORKFLOW: Block = {
  id: 'workflow-commit-desc',
  name: 'Commit Description Generator',
  blockType: 'workflow',
  isAtomic: false,
  metadata: {
    description: 'Generates commit descriptions from staged changes',
    status: 'active',
    tags: ['git', 'commit', 'automation'],
  },
  children: [
    {
      id: 'trigger-manual',
      name: 'Manual Trigger',
      blockType: 'trigger',
      config: { triggerType: 'manual' },
      position: { x: 50, y: 200 },
      // ...
    },
    {
      id: 'tool-git-diff',
      name: 'Get Staged Changes',
      blockType: 'tool',
      config: {
        toolType: 'bash',
        command: 'git diff --staged',
      },
      position: { x: 250, y: 200 },
      // ...
    },
    {
      id: 'agent-describer',
      name: 'Generate Description',
      blockType: 'agent',
      config: {
        agentType: 'coder',
        model: 'gpt-4o',
        systemPrompt: 'You are a helpful assistant that writes clear, concise git commit messages following conventional commits format.',
      },
      position: { x: 450, y: 200 },
      // ...
    },
    {
      id: 'validator-format',
      name: 'Validate Format',
      blockType: 'validator',
      config: {
        validationType: 'regex',
        pattern: '^(feat|fix|docs|style|refactor|test|chore)(\\(.+\\))?: .+$',
      },
      position: { x: 650, y: 200 },
      // ...
    },
  ],
  connections: [
    { id: 'c1', sourceBlockId: 'trigger-manual', sourcePortId: 'output', targetBlockId: 'tool-git-diff', targetPortId: 'input' },
    { id: 'c2', sourceBlockId: 'tool-git-diff', sourcePortId: 'output', targetBlockId: 'agent-describer', targetPortId: 'input' },
    { id: 'c3', sourceBlockId: 'agent-describer', sourcePortId: 'output', targetBlockId: 'validator-format', targetPortId: 'input' },
  ],
};
```

**Tasks**:
- [ ] Create `EXAMPLE_COMMIT_WORKFLOW` in mock data
- [ ] Add to Foundry examples section
- [ ] Ensure workflow loads correctly on canvas
- [ ] Implement mock execution for each node type
- [ ] Show realistic mock outputs (sample git diff, generated message)

**Validation Tests**:
- [ ] Open example workflow → all 4 blocks visible
- [ ] All connections rendered correctly
- [ ] Click Run → execution flows through all nodes
- [ ] Each node shows appropriate mock output
- [ ] Final result shows formatted commit message

---

### 4h.9 Foundry → Canvas Navigation ✅

**Goal**: Ensure seamless navigation from Foundry to Canvas

**Tasks**:
- [ ] Clicking composite block in Foundry → opens Canvas with block
- [ ] Breadcrumb updates correctly when entering Canvas
- [ ] Back button returns to Foundry
- [ ] Block hierarchy (BlockExplorer) shows correct context
- [ ] Creating workflow in Foundry → navigate to Canvas for editing

**Validation Tests**:
- [ ] Go to Foundry → click workflow block → Canvas opens with workflow
- [ ] Breadcrumb shows: Home > Foundry > [Workflow Name]
- [ ] BlockExplorer shows workflow's children
- [ ] Click back → returns to Foundry
- [ ] Create new workflow → redirected to Canvas

---

## 📁 Files to Create/Modify

### New Files

```
frontend/src/components/
├── BlockPalette/
│   ├── BlockPalette.tsx
│   ├── BlockPalette.scss
│   ├── BlockPalette.test.tsx
│   ├── PaletteCategory.tsx
│   ├── PaletteItem.tsx
│   └── index.ts
├── ExecutionBar/
│   ├── ExecutionBar.tsx
│   ├── ExecutionBar.scss
│   └── index.ts
├── NodeContextMenu/
│   ├── NodeContextMenu.tsx
│   ├── NodeContextMenu.scss
│   └── index.ts
└── CanvasContextMenu/
    ├── CanvasContextMenu.tsx
    └── index.ts

frontend/src/services/
├── executionService.ts
├── mock/
│   └── mockExecutionService.ts
└── interfaces/
    └── IExecutionService.ts

frontend/src/hooks/
├── useCanvasShortcuts.ts
├── useCanvasDragDrop.ts
└── useExecutionState.ts

frontend/src/data/
└── exampleWorkflows.ts
```

### Modified Files

```
frontend/src/components/BlockCanvas/BlockCanvas.tsx
frontend/src/components/BlockCanvas/useCanvasSync.ts
frontend/src/components/BlockNodes/BaseBlockNode.tsx
frontend/src/store/blockStore.ts
frontend/src/store/executionStore.ts (create if needed)
frontend/src/pages/CanvasPage.tsx
frontend/src/services/mock/mockData/workflows.ts
```

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] BlockPalette renders all block types
- [ ] PaletteItem drag behavior
- [ ] useCanvasSync node/edge synchronization
- [ ] Connection validation logic
- [ ] Execution state machine
- [ ] Keyboard shortcut handlers

### Integration Tests
- [ ] Add block via drag-drop → appears on canvas
- [ ] Connect two blocks → connection persists
- [ ] Delete block → connections cleaned up
- [ ] Run workflow → all nodes execute in order
- [ ] Copy/paste blocks → new IDs generated

### E2E Tests (Recommended)
- [ ] Complete workflow creation: drag 3 blocks → connect → run
- [ ] Example workflow: load → run → verify output

---

## 📏 Definition of Done

- [ ] All 9 block types can be dragged from palette to canvas
- [ ] Nodes can be moved and positions persist
- [ ] Nodes can be connected with validated edges
- [ ] Context menu works on all nodes
- [ ] Keyboard shortcuts work (delete, copy, paste, undo)
- [ ] Workflows can be executed with mock results
- [ ] Example workflow (Commit Description) works end-to-end
- [ ] Foundry → Canvas navigation is seamless
- [ ] All unit tests pass (>80% coverage)
- [ ] No console errors during normal operation
- [ ] Performance: canvas handles 50+ nodes smoothly

---

## 📅 Implementation Order

1. **Day 1-2**: Fix node movement (`useCanvasSync.ts`)
2. **Day 3-4**: Create `BlockPalette` component
3. **Day 5-6**: Implement drag-and-drop to canvas
4. **Day 7-8**: Fix node connections
5. **Day 9-10**: Node context menu and actions
6. **Day 11-12**: Keyboard shortcuts and undo/redo
7. **Day 13-14**: Mock execution service
8. **Day 15**: Example workflow
9. **Day 16**: Integration tests
10. **Day 17**: Polish and bug fixes

---

*Last Updated: 2026-01-12*
