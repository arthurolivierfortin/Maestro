# Phase 4b: Block Architecture & Types

## 📋 Issue Summary

**Phase**: 4b  
**Title**: Implement Block Architecture & Recursive Type System  
**Priority**: 🔴 Critical  
**Estimated Effort**: Large (1-2 weeks)  
**Dependencies**: Phase 4a (Frontend Foundation) ✅ Complete  
**Blocks**: Phase 4c (IDE Layout), Phase 4d (Canvas Foundation)

---

## 🎯 Objective

Implement the recursive block type system that enables composable, reusable blocks with drill-down navigation. This is the **architectural foundation** for the entire visual editor - all subsequent UI work depends on this type system.

---

## 📖 Context

### Current State (Phase 4a)
- Basic `Node` and `Workflow` types exist but are **flat** (no nesting)
- Node types are hardcoded enum: `Agent | Tool | Decision | Validator | Trigger`
- No concept of composite blocks or drill-down navigation
- Sidebar shows static navigation, not block hierarchy

### Target State (Phase 4b)
- **Recursive block system**: Blocks can contain other blocks
- **Type registry**: Extensible type definitions with validation rules
- **Drill-down navigation**: Double-click composite block → enter its canvas
- **Block explorer**: Sidebar shows hierarchical block tree
- **Breadcrumb**: Shows current navigation path with clickable segments

---

## 🏗️ Architecture

### Block Interface

```typescript
/**
 * Base Block interface - supports recursive composition
 */
interface Block {
  // Identity
  id: string;
  name: string;
  blockType: BlockType;
  
  // Composition
  isAtomic: boolean;           // true = leaf node, false = can contain children
  children?: Block[];          // Child blocks (if composite)
  parentId?: string;           // Parent block ID (null for root)
  
  // Configuration
  config: BlockConfig;         // Type-specific configuration
  inputs: Port[];              // Input ports for connections
  outputs: Port[];             // Output ports for connections
  
  // Visual
  position: Position;          // Position on canvas
  
  // Metadata
  metadata: BlockMetadata;
}

interface Port {
  id: string;
  name: string;
  dataType: string;            // e.g., "string", "object", "any"
  required: boolean;
  multiple: boolean;           // Can accept multiple connections
}

interface Position {
  x: number;
  y: number;
}

interface BlockMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  description?: string;
  tags?: string[];
  version?: string;
}
```

### Block Types

```typescript
/**
 * Core block types - hardcoded for MVP
 */
type BlockType = 
  | 'workflow'      // Top-level container
  | 'agent'         // AI agent (can contain prompts, instructions, sub-agents)
  | 'task'          // Task with validation (contains agents, validators)
  | 'prompt'        // Reusable prompt template (atomic)
  | 'instruction'   // Instruction file reference (atomic)
  | 'tool'          // Executable tool (atomic)
  | 'decision'      // Conditional branching (atomic)
  | 'validator'     // Output validation (atomic)
  | 'trigger';      // Workflow trigger (atomic)
```

### Type-Specific Configs

```typescript
interface AgentBlockConfig {
  agentType: 'Planner' | 'Coder' | 'Tester' | 'Reviewer' | 'Debugger' | 'Custom';
  model?: string;              // e.g., "gpt-4", "claude-3"
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];            // Tool IDs this agent can use
}

interface TaskBlockConfig {
  description: string;
  successCriteria?: string[];
  maxRetries?: number;
  timeout?: number;            // seconds
}

interface ToolBlockConfig {
  toolType: 'Bash' | 'Git' | 'FileSystem' | 'HTTP' | 'Custom';
  command?: string;
  script?: string;
  arguments?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
}

interface PromptBlockConfig {
  template: string;            // Prompt template with {{variables}}
  variables?: PromptVariable[];
}

interface DecisionBlockConfig {
  condition: string;           // JavaScript expression
  trueLabel?: string;
  falseLabel?: string;
}

interface ValidatorBlockConfig {
  validationType: 'Schema' | 'Regex' | 'LLM' | 'Custom';
  schema?: object;             // JSON Schema
  pattern?: string;            // Regex pattern
  llmPrompt?: string;          // LLM-based validation prompt
  customScript?: string;
}

interface TriggerBlockConfig {
  triggerType: 'Manual' | 'Webhook' | 'Schedule' | 'FileWatch' | 'Event';
  webhookPath?: string;
  cronExpression?: string;
  watchPath?: string;
  eventName?: string;
}
```

### Block Type Registry

```typescript
interface BlockTypeInfo {
  type: BlockType;
  label: string;
  description: string;
  icon: string;                // Icon component or path
  color: string;               // Theme color for this type
  isAtomic: boolean;
  allowedChildren: BlockType[]; // Which types can be nested inside
  allowedParents: BlockType[];  // Which types can contain this
  defaultConfig: BlockConfig;
  configSchema: JSONSchema;     // For validation and form generation
  defaultInputs: Port[];
  defaultOutputs: Port[];
}

// Registry singleton
const BlockTypeRegistry = {
  types: Map<BlockType, BlockTypeInfo>,
  
  register(info: BlockTypeInfo): void,
  get(type: BlockType): BlockTypeInfo | undefined,
  getAll(): BlockTypeInfo[],
  canContain(parentType: BlockType, childType: BlockType): boolean,
  getDefaultBlock(type: BlockType): Block,
  validateConfig(type: BlockType, config: unknown): ValidationResult,
};
```

### Nesting Rules Matrix

| Parent Type | Allowed Children |
|-------------|------------------|
| `workflow` | `agent`, `task`, `tool`, `decision`, `validator`, `trigger` |
| `task` | `agent`, `tool`, `validator`, `decision` |
| `agent` | `prompt`, `instruction`, `tool` |
| `prompt` | *(atomic - no children)* |
| `instruction` | *(atomic - no children)* |
| `tool` | *(atomic - no children)* |
| `decision` | *(atomic - no children)* |
| `validator` | *(atomic - no children)* |
| `trigger` | *(atomic - no children)* |

---

## ✅ Acceptance Criteria

### 4b.1 Block Type System
- [ ] `Block` interface defined with all properties
- [ ] `BlockType` enum with 9 core types
- [ ] Type-specific config interfaces for each block type
- [ ] `Port` interface for inputs/outputs
- [ ] `Position` and `BlockMetadata` interfaces
- [ ] Unit tests for type guards and type utilities

### 4b.2 Block Type Registry
- [ ] `BlockTypeRegistry` singleton implemented
- [ ] All 9 block types registered with metadata
- [ ] `getBlockTypeInfo(type)` returns full type info
- [ ] `canContain(parent, child)` validates nesting rules
- [ ] `getDefaultBlock(type)` creates new block with defaults
- [ ] `validateConfig(type, config)` validates type-specific config
- [ ] Icons defined for each block type (SVG or emoji initially)
- [ ] Color scheme defined for each block type
- [ ] Unit tests with 90%+ coverage

### 4b.3 Block Store (Zustand)
- [ ] `useBlockStore` hook created
- [ ] State structure: `{ blocks: Map<string, Block>, rootId: string | null }`
- [ ] `addBlock(parentId, block)` - adds to parent's children
- [ ] `removeBlock(id)` - removes block and all descendants
- [ ] `updateBlock(id, updates)` - partial update with merge
- [ ] `moveBlock(id, newParentId)` - moves block between containers
- [ ] `duplicateBlock(id)` - deep clone with new IDs
- [ ] `getBlock(id)` - retrieve single block
- [ ] `getBlockPath(id)` - returns array of ancestor IDs
- [ ] `getBlockChildren(id)` - returns direct children
- [ ] `getRootBlock()` - returns top-level workflow
- [ ] Undo/redo with history stack (last 50 actions)
- [ ] Persist to localStorage on change
- [ ] Unit tests with 90%+ coverage

### 4b.4 Navigation Context
- [ ] `useNavigationContext` hook created
- [ ] State: `{ currentPath: string[], selectedBlockId: string | null }`
- [ ] `navigateInto(blockId)` - push to path, show children on canvas
- [ ] `navigateUp()` - pop from path, show parent level
- [ ] `navigateTo(path)` - direct navigation to path
- [ ] `selectBlock(id)` - select block for properties panel
- [ ] `clearSelection()` - deselect all
- [ ] URL sync (optional): query param `?path=block1.block2.block3`
- [ ] Unit tests

### 4b.5 Block Explorer (Sidebar)
- [ ] Refactor `Sidebar.tsx` to show block tree
- [ ] Recursive tree component with expand/collapse
- [ ] Block type icon displayed per item
- [ ] Current navigation path highlighted
- [ ] Double-click to drill into composite block
- [ ] Right-click context menu:
  - [ ] Rename
  - [ ] Duplicate
  - [ ] Delete
  - [ ] Cut / Copy / Paste
- [ ] Drag-and-drop to reorder blocks
- [ ] Fix arrow icons (replace `▸` Unicode with proper SVG chevron)
- [ ] Visual indicator for composite vs atomic blocks
- [ ] Loading state for large trees
- [ ] Unit tests

### 4b.6 Breadcrumb Navigation
- [ ] `Breadcrumb` component created
- [ ] Displays: `Home > Workflow Name > Task Name > Agent Name`
- [ ] Each segment shows block type icon
- [ ] Each segment is clickable → navigates to that level
- [ ] Root segment always visible
- [ ] Responsive: truncate middle segments on overflow with "..."
- [ ] Keyboard navigation (arrow keys)
- [ ] Unit tests

---

## 📁 Files to Create/Modify

### New Files
```
frontend/src/types/
├── block.types.ts              # Block, Port, Position interfaces
├── block-config.types.ts       # Type-specific config interfaces
└── block-registry.types.ts     # Registry types

frontend/src/registry/
├── BlockTypeRegistry.ts        # Registry singleton
├── blockTypeDefinitions.ts     # Type metadata definitions
└── index.ts

frontend/src/store/
├── blockStore.ts               # Zustand block store
└── navigationStore.ts          # Navigation context store

frontend/src/hooks/
├── useBlockStore.ts            # Re-export with selectors
├── useNavigation.ts            # Navigation hook
└── useBlockActions.ts          # Block CRUD actions

frontend/src/components/
├── BlockExplorer/
│   ├── BlockExplorer.tsx       # Main sidebar component
│   ├── BlockExplorer.scss
│   ├── BlockTreeItem.tsx       # Recursive tree item
│   ├── BlockTreeItem.scss
│   ├── BlockContextMenu.tsx    # Right-click menu
│   └── index.ts
├── Breadcrumb/
│   ├── Breadcrumb.tsx
│   ├── Breadcrumb.scss
│   └── index.ts
└── icons/
    ├── BlockIcons.tsx          # SVG icons for block types
    └── ChevronIcon.tsx         # Expand/collapse icon
```

### Modified Files
```
frontend/src/types/index.ts           # Export new types
frontend/src/components/layout/Sidebar.tsx  # Replace with BlockExplorer
frontend/src/layouts/RootLayout.tsx   # Add Breadcrumb
```

---

## 🎨 Design Specifications

### Block Type Colors
| Type | Color | Hex |
|------|-------|-----|
| workflow | Blue | `#2563eb` |
| agent | Purple | `#7c3aed` |
| task | Green | `#10b981` |
| prompt | Yellow | `#f59e0b` |
| instruction | Orange | `#f97316` |
| tool | Gray | `#6b7280` |
| decision | Cyan | `#06b6d4` |
| validator | Pink | `#ec4899` |
| trigger | Red | `#ef4444` |

### Block Type Icons (use Lucide React or similar)
| Type | Icon |
|------|------|
| workflow | `Workflow` |
| agent | `Bot` |
| task | `ListChecks` |
| prompt | `MessageSquare` |
| instruction | `FileText` |
| tool | `Terminal` |
| decision | `GitBranch` |
| validator | `ShieldCheck` |
| trigger | `Zap` |

---

## 🧪 Testing Requirements

### Unit Tests
- Block type utilities (type guards, factory functions)
- BlockTypeRegistry methods
- Block store actions (add, remove, update, move)
- Navigation store actions
- BlockExplorer component
- Breadcrumb component

### Integration Tests
- Create workflow → add blocks → navigate → verify state
- Undo/redo flow
- LocalStorage persistence

---

## 📝 Implementation Notes

### Migration from Current Types
The current `Node` and `Workflow` types in `node.types.ts` and `workflow.types.ts` should be kept temporarily for backwards compatibility during Phase 4b, then deprecated in Phase 4c.

### Performance Considerations
- Use `Map<string, Block>` for O(1) lookups
- Memoize `getBlockPath` and `getBlockChildren` with selectors
- Virtualize tree rendering for large hierarchies (>100 blocks)

### Accessibility
- Keyboard navigation in tree (arrow keys, Enter, Space)
- Screen reader labels for block types
- Focus management on navigation

---

## 🔗 Related Documentation

- [ROADMAP.md](../../ROADMAP.md) - Phase 4b section
- [Frontend Guide](../frontend-guide.md)
- [Workflow Schema](../schemas/workflow-schema.json) - Update to match new Block structure

---

## 📎 Attachments

### Example Block Structure

```json
{
  "id": "workflow-1",
  "name": "Feature Development Pipeline",
  "blockType": "workflow",
  "isAtomic": false,
  "children": [
    {
      "id": "trigger-1",
      "name": "Manual Start",
      "blockType": "trigger",
      "isAtomic": true,
      "config": { "triggerType": "Manual" },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "task-1",
      "name": "Implement Feature",
      "blockType": "task",
      "isAtomic": false,
      "children": [
        {
          "id": "agent-1",
          "name": "Planner Agent",
          "blockType": "agent",
          "isAtomic": false,
          "config": { "agentType": "Planner" },
          "children": [
            {
              "id": "prompt-1",
              "name": "Planning Prompt",
              "blockType": "prompt",
              "isAtomic": true,
              "config": { "template": "Analyze the following task..." }
            }
          ]
        },
        {
          "id": "agent-2",
          "name": "Coder Agent",
          "blockType": "agent",
          "isAtomic": false,
          "config": { "agentType": "Coder" }
        },
        {
          "id": "validator-1",
          "name": "Code Validator",
          "blockType": "validator",
          "isAtomic": true,
          "config": { "validationType": "LLM" }
        }
      ],
      "position": { "x": 300, "y": 100 }
    }
  ],
  "position": { "x": 0, "y": 0 },
  "metadata": {
    "createdAt": "2026-01-10T08:00:00Z",
    "updatedAt": "2026-01-10T08:00:00Z",
    "createdBy": "user@example.com"
  }
}
```

---

## 🏷️ Labels

- `frontend`
- `phase-4b`
- `priority: critical`
- `architecture`
- `types`

---

**Created**: 2026-01-10  
**Assignee**: TBD  
**Milestone**: MVP - Frontend Core
