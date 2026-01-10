# Phase 4d: Canvas Foundation (React Flow)

## 📋 Issue Summary

**Phase**: 4d  
**Title**: Implement Visual Block Canvas with React Flow  
**Priority**: 🔴 Critical  
**Estimated Effort**: Large (2 weeks)  
**Dependencies**: Phase 4b (Block Architecture) ✅, Phase 4c (IDE Layout) ✅  
**Blocks**: Phase 5 (Workflow Engine), Phase 6 (Agent Implementations)

---

## 🎯 Objective

Implement the visual canvas for block editing using React Flow, enabling users to:
- Drag and drop blocks from a palette onto the canvas
- Connect blocks via ports with validation
- Double-click composite blocks to drill into their internal canvas
- Select, move, duplicate, and delete blocks visually

---

## 📖 Context

### Current State (Phase 4c)
- IDE Layout with resizable panels exists
- Block Explorer sidebar shows hierarchical tree
- Breadcrumb navigation for drill-down exists
- No visual canvas for block arrangement

### Target State (Phase 4d)
- **React Flow canvas** integrated in main panel
- **Custom block nodes** rendered per block type with icons and status
- **Block palette** with drag-to-add functionality
- **Connection system** with port validation
- **Context menus** for quick actions
- **Canvas-Store sync** for real-time state updates

---

## 🏗️ Architecture

### Canvas Structure

```typescript
/**
 * Canvas wrapper component
 */
interface BlockCanvasProps {
  /** Current parent block ID (null for root workflow) */
  parentId: string | null;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when block is selected */
  onBlockSelect?: (blockId: string | null) => void;
  /** Callback when drill-down is requested */
  onDrillDown?: (blockId: string) => void;
}

/**
 * React Flow node data for blocks
 */
interface BlockNodeData {
  block: Block;
  isSelected: boolean;
  isExecuting: boolean;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
  onDrillDown: (blockId: string) => void;
}

/**
 * React Flow edge data for connections
 */
interface ConnectionEdgeData {
  sourcePortId: string;
  targetPortId: string;
  dataType: string;
  label?: string;
}
```

### Block Node Components

```typescript
/**
 * Base block node rendered on canvas
 */
interface BaseBlockNodeProps {
  data: BlockNodeData;
  selected: boolean;
}

// Type-specific node components
const AgentBlockNode: React.FC<BaseBlockNodeProps>;
const TaskBlockNode: React.FC<BaseBlockNodeProps>;
const ToolBlockNode: React.FC<BaseBlockNodeProps>;
const PromptBlockNode: React.FC<BaseBlockNodeProps>;
const DecisionBlockNode: React.FC<BaseBlockNodeProps>;
const ValidatorBlockNode: React.FC<BaseBlockNodeProps>;
const TriggerBlockNode: React.FC<BaseBlockNodeProps>;
```

### Block Palette

```typescript
interface BlockPaletteProps {
  /** Filter by category */
  category?: 'all' | 'agents' | 'tools' | 'flow' | 'data';
  /** Search filter */
  searchQuery?: string;
  /** Callback when drag starts */
  onDragStart?: (blockType: BlockType) => void;
}

interface PaletteCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  blockTypes: BlockType[];
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
  { id: 'agents', label: 'Agents', icon: <Bot />, blockTypes: ['agent'] },
  { id: 'tasks', label: 'Tasks', icon: <ListChecks />, blockTypes: ['task'] },
  { id: 'tools', label: 'Tools', icon: <Terminal />, blockTypes: ['tool', 'prompt', 'instruction'] },
  { id: 'flow', label: 'Flow Control', icon: <GitBranch />, blockTypes: ['decision', 'validator', 'trigger'] },
];
```

---

## ✅ Acceptance Criteria

### 4d.1 React Flow Setup
- [ ] `reactflow` package installed and configured
- [ ] `BlockCanvas` component wrapper created
- [ ] Canvas controls configured (zoom, pan, fit-view, minimap)
- [ ] Custom node types registered for each `BlockType`
- [ ] Custom edge type for connections
- [ ] Canvas background with grid pattern
- [ ] Unit tests for canvas setup

### 4d.2 Custom Block Nodes
- [ ] `BaseBlockNode` component with common UI
  - [ ] Block type icon (from Phase 4b)
  - [ ] Block name label
  - [ ] Status indicator (idle, running, completed, failed)
  - [ ] Composite indicator badge (shows child count)
  - [ ] Input/output port handles
- [ ] Type-specific node renderers:
  - [ ] `AgentBlockNode` - shows agent type, model info preview
  - [ ] `TaskBlockNode` - shows task status, progress bar
  - [ ] `ToolBlockNode` - shows tool type icon
  - [ ] `PromptBlockNode` - shows template preview (truncated)
  - [ ] `DecisionBlockNode` - shows condition preview, true/false branches
  - [ ] `ValidatorBlockNode` - shows validation type
  - [ ] `TriggerBlockNode` - shows trigger type icon
- [ ] Double-click handler to drill into composite blocks
- [ ] Selection styling (outline, shadow)
- [ ] Hover state with quick actions tooltip
- [ ] Unit tests for each node type

### 4d.3 Block Palette
- [ ] `BlockPalette` component in left panel or floating
- [ ] Grouped by category (Agents, Tasks, Tools, Flow Control)
- [ ] Collapsible category sections
- [ ] Drag-from-palette to canvas
- [ ] Block type info tooltip on hover
- [ ] Search/filter input
- [ ] Disabled state for invalid block types (based on current parent)
- [ ] Unit tests

### 4d.4 Connection System
- [ ] Port handles on block nodes (inputs left, outputs right)
- [ ] Connection validation based on port types
  - [ ] Data type compatibility check
  - [ ] Required port validation
  - [ ] Multiple connection handling
- [ ] Visual feedback during connection drag
  - [ ] Valid target highlight (green)
  - [ ] Invalid target highlight (red)
  - [ ] Connection preview line
- [ ] Connection labels (optional, editable)
- [ ] Animated connections during execution
- [ ] Delete connection on click or via context menu
- [ ] Unit tests for validation logic

### 4d.5 Canvas-Store Sync
- [ ] Sync React Flow nodes ↔ BlockStore state
- [ ] Handle node position updates → `updateBlock(id, { position })`
- [ ] Handle node add (from palette) → `addBlock(parentId, block)`
- [ ] Handle node delete → `removeBlock(id)`
- [ ] Handle connection add → update block ports/connections
- [ ] Handle connection remove → update block ports/connections
- [ ] Handle node selection → update `selectedBlockId` in navigation store
- [ ] Bulk operations:
  - [ ] Select all (Ctrl+A)
  - [ ] Delete selected (Delete/Backspace)
  - [ ] Duplicate selected (Ctrl+D)
  - [ ] Copy/Paste (Ctrl+C/Ctrl+V)
- [ ] Performance optimization for large canvases (>50 blocks)
- [ ] Unit tests

### 4d.6 Context Menus
- [ ] Canvas context menu (right-click empty area):
  - [ ] Add block (submenu with types)
  - [ ] Paste (if clipboard has block)
  - [ ] Select all
  - [ ] Fit view
- [ ] Block context menu (right-click block):
  - [ ] Edit (open properties panel)
  - [ ] Drill into (if composite)
  - [ ] Duplicate
  - [ ] Copy
  - [ ] Cut
  - [ ] Delete
  - [ ] Rename (inline edit)
- [ ] Connection context menu (right-click edge):
  - [ ] Add/Edit label
  - [ ] Delete connection
- [ ] Unit tests

### 4d.7 Keyboard Shortcuts
- [ ] `Delete` / `Backspace` - Delete selected blocks
- [ ] `Ctrl+A` - Select all blocks
- [ ] `Ctrl+C` - Copy selected blocks
- [ ] `Ctrl+V` - Paste blocks
- [ ] `Ctrl+X` - Cut selected blocks
- [ ] `Ctrl+D` - Duplicate selected blocks
- [ ] `Ctrl+Z` - Undo
- [ ] `Ctrl+Shift+Z` / `Ctrl+Y` - Redo
- [ ] `Escape` - Clear selection
- [ ] `Enter` - Drill into selected composite block
- [ ] Arrow keys - Nudge selected blocks
- [ ] Keyboard shortcuts help modal (`?` key)
- [ ] Unit tests

### 4d.8 Minimap & Controls
- [ ] Minimap in corner showing canvas overview
- [ ] Zoom controls (+/- buttons)
- [ ] Fit-to-view button
- [ ] Lock/unlock button (toggle read-only)
- [ ] Fullscreen toggle
- [ ] Unit tests

---

## 📁 Files to Create/Modify

### New Files
```
frontend/src/components/
├── BlockCanvas/
│   ├── BlockCanvas.tsx           # Main canvas wrapper
│   ├── BlockCanvas.scss
│   ├── BlockCanvas.test.tsx
│   ├── useCanvasSync.ts          # Hook for store sync
│   ├── canvasUtils.ts            # Helper functions
│   └── index.ts
├── BlockNodes/
│   ├── BaseBlockNode.tsx         # Common node UI
│   ├── BaseBlockNode.scss
│   ├── AgentBlockNode.tsx
│   ├── TaskBlockNode.tsx
│   ├── ToolBlockNode.tsx
│   ├── PromptBlockNode.tsx
│   ├── DecisionBlockNode.tsx
│   ├── ValidatorBlockNode.tsx
│   ├── TriggerBlockNode.tsx
│   ├── BlockNodePorts.tsx        # Port handles component
│   ├── BlockNodeStatus.tsx       # Status indicator
│   └── index.ts
├── BlockPalette/
│   ├── BlockPalette.tsx
│   ├── BlockPalette.scss
│   ├── BlockPalette.test.tsx
│   ├── PaletteCategory.tsx
│   ├── PaletteItem.tsx
│   └── index.ts
├── ConnectionEdge/
│   ├── ConnectionEdge.tsx        # Custom edge component
│   ├── ConnectionEdge.scss
│   └── index.ts
├── CanvasContextMenu/
│   ├── CanvasContextMenu.tsx
│   ├── BlockContextMenu.tsx
│   ├── ConnectionContextMenu.tsx
│   ├── ContextMenu.scss
│   └── index.ts
└── CanvasControls/
    ├── CanvasControls.tsx
    ├── CanvasControls.scss
    ├── Minimap.tsx
    └── index.ts

frontend/src/hooks/
├── useCanvasShortcuts.ts         # Keyboard shortcuts
├── useBlockDragDrop.ts           # DnD logic
└── useConnectionValidation.ts    # Port validation
```

### Modified Files
```
frontend/src/layouts/IDELayout.tsx       # Integrate BlockCanvas
frontend/src/store/blockStore.ts         # Add connection management
frontend/src/types/block.types.ts        # Add connection types
frontend/package.json                     # Add reactflow dependency
```

---

## 🎨 Design Specifications

### Block Node Dimensions
| Type | Width | Min Height | Max Height |
|------|-------|------------|------------|
| All types | 200px | 60px | 120px |

### Block Node Layout
```
┌──────────────────────────────────┐
│ [Icon] Block Name         [⋮]   │  ← Header with type icon, name, menu
├──────────────────────────────────┤
│                                  │
│   Type-specific preview          │  ← Content area
│   (truncated, 2 lines max)       │
│                                  │
├──────────────────────────────────┤
│ ○ input1    output1 ○            │  ← Port handles
│ ○ input2                         │
└──────────────────────────────────┘
     ↑ Composite badge (if has children): "3 blocks"
```

### Connection Styles
| State | Color | Style |
|-------|-------|-------|
| Default | `#94a3b8` | Solid, 2px |
| Selected | `#3b82f6` | Solid, 3px |
| Executing | `#10b981` | Animated dash |
| Error | `#ef4444` | Solid, 2px |
| Dragging (valid) | `#10b981` | Dashed, 2px |
| Dragging (invalid) | `#ef4444` | Dashed, 2px |

### Canvas Theme
```scss
.block-canvas {
  --canvas-bg: var(--bg-primary);
  --canvas-grid: var(--border-subtle);
  --canvas-grid-size: 20px;
  
  // Dark theme overrides
  &.theme-dark {
    --canvas-bg: #0f172a;
    --canvas-grid: #1e293b;
  }
}
```

---

## 🧪 Testing Requirements

### Unit Tests
- BlockCanvas rendering and initialization
- Each BlockNode type component
- BlockPalette drag functionality
- Connection validation logic
- Canvas-store synchronization
- Keyboard shortcut handlers
- Context menu actions

### Integration Tests
- Add block from palette → verify in store
- Connect two blocks → verify connection state
- Delete block → verify removal and connection cleanup
- Drill-down navigation → verify canvas updates
- Undo/redo → verify state restoration
- Copy/paste blocks → verify new IDs generated

### E2E Tests (optional)
- Complete workflow creation flow
- Drag-drop-connect-execute flow

---

## 📝 Implementation Notes

### React Flow Configuration
```typescript
// Recommended React Flow setup
const nodeTypes = {
  agent: AgentBlockNode,
  task: TaskBlockNode,
  tool: ToolBlockNode,
  prompt: PromptBlockNode,
  decision: DecisionBlockNode,
  validator: ValidatorBlockNode,
  trigger: TriggerBlockNode,
  workflow: WorkflowBlockNode,
  instruction: InstructionBlockNode,
};

const edgeTypes = {
  connection: ConnectionEdge,
};

const defaultEdgeOptions = {
  type: 'connection',
  animated: false,
  style: { strokeWidth: 2 },
};
```

### Performance Considerations
- Use `React.memo` for all node components
- Virtualize node rendering for large canvases
- Debounce position updates to store (100ms)
- Use `useCallback` for all event handlers
- Lazy load node content (expand on hover/select)

### Accessibility
- Keyboard navigation between nodes (Tab, Arrow keys)
- Screen reader announcements for actions
- Focus indicators on nodes and controls
- ARIA labels for all interactive elements

---

## 🔗 Related Documentation

- [ROADMAP.md](../../ROADMAP.md) - Phase 4d section
- [Phase 4b Issue](./phase-4b-block-architecture.md) - Block types and store
- [Phase 4c Issue](./phase-4c-ide-layout-panel-system.md) - IDE Layout
- [React Flow Documentation](https://reactflow.dev/docs/introduction/)

---

## 📎 Example Canvas State

```typescript
// React Flow nodes derived from BlockStore
const nodes: Node<BlockNodeData>[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      block: { id: 'trigger-1', name: 'Manual Start', blockType: 'trigger', ... },
      isSelected: false,
      isExecuting: false,
    },
  },
  {
    id: 'task-1',
    type: 'task',
    position: { x: 300, y: 100 },
    data: {
      block: { id: 'task-1', name: 'Implement Feature', blockType: 'task', ... },
      isSelected: true,
      isExecuting: false,
    },
  },
];

// React Flow edges derived from connections
const edges: Edge<ConnectionEdgeData>[] = [
  {
    id: 'e-trigger1-task1',
    source: 'trigger-1',
    target: 'task-1',
    sourceHandle: 'output-default',
    targetHandle: 'input-default',
    type: 'connection',
    data: {
      sourcePortId: 'output-default',
      targetPortId: 'input-default',
      dataType: 'trigger',
    },
  },
];
```

---

## 🏷️ Labels

- `frontend`
- `phase-4d`
- `priority: critical`
- `react-flow`
- `canvas`
- `visual-editor`

---

**Created**: 2026-01-10  
**Assignee**: TBD  
**Milestone**: MVP - Frontend Core
