# Frontend Development Guide

> **Purpose**: This guide defines how to build the B-One Maestro frontend, including UI philosophy, architectural rules, TypeScript conventions, and component boundaries.

---

## 🎯 Frontend Philosophy

### Core Principles

1. **Purely Presentational**: The frontend has **ZERO business logic**
2. **Workflow Visualization**: Focus on intuitive, n8n-style workflow editing
3. **Real-Time First**: Built around live execution monitoring
4. **Type-Safe**: Strict TypeScript with no `any` types
5. **Component-Based**: Reusable, testable components
6. **Desktop-Optimized**: Native desktop patterns (not web patterns)

### What Frontend IS

- ✅ **Visual workflow editor** with drag-and-drop
- ✅ **Configuration UI** for nodes and workflows
- ✅ **Real-time monitoring** of execution state
- ✅ **Terminal output display** with live streaming
- ✅ **API consumer** that delegates all logic to backend

### What Frontend is NOT

- ❌ **Not a business logic layer** - all validation happens in backend
- ❌ **Not an offline tool** - requires backend connection
- ❌ **Not a code editor** - editing happens in external tools
- ❌ **Not model-aware** - never talks directly to AI models

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│              (Presentational, No Logic)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Custom Hooks                              │
│        (State Management, API Calls, SignalR)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Services Layer                           │
│         (API Client, SignalR, Local Storage)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          Backend REST API + SignalR
```

### Layer Responsibilities

#### Components (`src/components/`)
- **Purpose**: Render UI, handle user interactions
- **Rules**:
  - No API calls directly (use hooks)
  - No business logic
  - Props are read-only
  - Use TypeScript interfaces for props
- **Examples**: `WorkflowEditor`, `NodePalette`, `TerminalOutput`

#### Hooks (`src/hooks/`)
- **Purpose**: Encapsulate stateful logic, API calls
- **Rules**:
  - Follow React hook rules
  - One hook per concern
  - Return stable API (avoid object spread)
- **Examples**: `useWorkflow`, `useExecution`, `useSignalR`

#### Services (`src/services/`)
- **Purpose**: API communication, external integrations
- **Rules**:
  - Pure functions or classes
  - No React dependencies
  - Testable in isolation
- **Examples**: `api.ts`, `workflowService.ts`, `signalRService.ts`

#### Types (`src/types/`)
- **Purpose**: TypeScript type definitions
- **Rules**:
  - Mirror backend DTOs
  - Use interfaces for objects, types for unions/primitives
  - Export from index file
- **Examples**: `workflow.types.ts`, `node.types.ts`

#### Store (`src/store/`)
- **Purpose**: Global state management (Zustand or Redux)
- **Rules**:
  - Keep state minimal
  - Derive computed values
  - Use selectors for performance
- **Examples**: `workflowStore.ts`, `executionStore.ts`

---

## 📝 TypeScript Conventions

### Naming Conventions

```typescript
// Components: PascalCase
export function WorkflowEditor() { }
export function NodeConfigPanel() { }

// Hooks: use + PascalCase
export function useWorkflow(id: string) { }
export function useExecution() { }

// Services: camelCase
export const workflowService = { }
export const apiClient = { }

// Types/Interfaces: PascalCase
export interface Workflow { }
export type NodeType = 'agent' | 'tool' | 'decision';

// Constants: UPPER_SNAKE_CASE
export const MAX_NODES = 100;
export const API_BASE_URL = 'http://localhost:5000';

// Variables/Functions: camelCase
const workflowId = '123';
function executeWorkflow() { }

// Event Handlers: handle + PascalCase
function handleNodeClick() { }
function handleSaveWorkflow() { }
```

### Type Definitions

```typescript
// ✅ GOOD: Use interfaces for objects
export interface Workflow {
  id: string;
  name: string;
  nodes: Node[];
  connections: Connection[];
}

// ✅ GOOD: Use types for unions and primitives
export type NodeType = 'agent' | 'tool' | 'decision' | 'validator' | 'trigger';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

// ✅ GOOD: Props interfaces with Component + 'Props' suffix
export interface WorkflowEditorProps {
  workflow: Workflow;
  onSave: (workflow: Workflow) => Promise<void>;
  readOnly?: boolean;
}

// ❌ BAD: Using 'any' type
function processData(data: any) { } // Never use 'any'!

// ✅ GOOD: Use 'unknown' if type is truly unknown
function processData(data: unknown) {
  if (typeof data === 'string') {
    // Type narrowing
  }
}
```

### Async Patterns

```typescript
// ✅ GOOD: Async functions return Promise
async function saveWorkflow(workflow: Workflow): Promise<void> {
  await workflowService.save(workflow);
}

// ✅ GOOD: Error handling with try-catch
async function loadWorkflow(id: string): Promise<Workflow | null> {
  try {
    return await workflowService.getById(id);
  } catch (error) {
    console.error('Failed to load workflow:', error);
    return null;
  }
}
```

---

## 🧩 Component Patterns

### Functional Components

```typescript
// ✅ GOOD: Function declaration (not arrow function)
export function WorkflowEditor({ workflow, onSave, readOnly }: WorkflowEditorProps) {
  // Hooks at the top
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Derived state
  const nodeCount = workflow.nodes.length;
  const canSave = nodeCount > 0 && !readOnly;
  
  // Event handlers
  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
  };
  
  const handleSave = async () => {
    if (!canSave) return;
    await onSave(workflow);
  };
  
  // Render
  return (
    <div className="workflow-editor">
      <WorkflowCanvas nodes={workflow.nodes} onNodeClick={handleNodeClick} />
      {selectedNode && (
        <NodeConfigPanel node={selectedNode} onChange={handleNodeUpdate} />
      )}
      <button onClick={handleSave} disabled={!canSave}>
        Save
      </button>
    </div>
  );
}

// ❌ BAD: Arrow function component
export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow }) => {
  // ...
};
```

### Props Validation

```typescript
// ✅ GOOD: Required props first, optional props last
export interface NodeConfigPanelProps {
  node: Node;              // Required
  onChange: (node: Node) => void;  // Required
  readOnly?: boolean;      // Optional
  className?: string;      // Optional
}

// ✅ GOOD: Default values in destructuring
export function NodeConfigPanel({ 
  node, 
  onChange, 
  readOnly = false,
  className = ''
}: NodeConfigPanelProps) {
  // ...
}
```

### Conditional Rendering

```typescript
// ✅ GOOD: Early return for loading/error states
export function WorkflowList() {
  const { workflows, isLoading, error } = useWorkflows();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!workflows || workflows.length === 0) return <EmptyState />;
  
  return (
    <div className="workflow-list">
      {workflows.map(workflow => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
    </div>
  );
}

// ❌ BAD: Nested ternaries
return (
  <div>
    {isLoading ? <Spinner /> : error ? <Error /> : workflows ? <List /> : <Empty />}
  </div>
);
```

---

## 🪝 Custom Hooks Patterns

### Basic Hook Structure

```typescript
export function useWorkflow(workflowId: string) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadWorkflow();
  }, [workflowId]);
  
  const loadWorkflow = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workflowService.getById(workflowId);
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveWorkflow = async (updatedWorkflow: Workflow) => {
    await workflowService.update(updatedWorkflow);
    setWorkflow(updatedWorkflow);
  };
  
  return {
    workflow,
    isLoading,
    error,
    reload: loadWorkflow,
    save: saveWorkflow,
  };
}
```

### SignalR Hook

```typescript
export function useSignalR(executionId: string) {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const connection = signalRService.connect();
    
    connection.on('NodeStarted', (event: NodeStartedEvent) => {
      setEvents(prev => [...prev, event]);
    });
    
    connection.on('NodeCompleted', (event: NodeCompletedEvent) => {
      setEvents(prev => [...prev, event]);
    });
    
    connection.on('TerminalOutput', (output: string) => {
      // Handle terminal output
    });
    
    connection.start().then(() => {
      setIsConnected(true);
      connection.invoke('JoinExecution', executionId);
    });
    
    return () => {
      connection.stop();
    };
  }, [executionId]);
  
  return { events, isConnected };
}
```

---

## 🔌 Services Layer

### API Client Base

```typescript
// src/services/api.ts
import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  
  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }
  
  async post<T>(url: string, data: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }
  
  async put<T>(url: string, data: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }
  
  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const apiClient = new ApiClient(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
);
```

### Workflow Service

```typescript
// src/services/workflowService.ts
import { apiClient } from './api';
import { Workflow, WorkflowDto } from '../types/workflow.types';

export const workflowService = {
  async getAll(): Promise<Workflow[]> {
    return apiClient.get<Workflow[]>('/api/workflows');
  },
  
  async getById(id: string): Promise<Workflow> {
    return apiClient.get<Workflow>(`/api/workflows/${id}`);
  },
  
  async create(workflow: WorkflowDto): Promise<Workflow> {
    return apiClient.post<Workflow>('/api/workflows', workflow);
  },
  
  async update(id: string, workflow: WorkflowDto): Promise<Workflow> {
    return apiClient.put<Workflow>(`/api/workflows/${id}`, workflow);
  },
  
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/workflows/${id}`);
  },
  
  async execute(id: string): Promise<ExecutionResult> {
    return apiClient.post<ExecutionResult>(`/api/workflows/${id}/execute`, {});
  },
  
  async pause(executionId: string): Promise<void> {
    return apiClient.post<void>(`/api/executions/${executionId}/pause`, {});
  },
  
  async resume(executionId: string): Promise<void> {
    return apiClient.post<void>(`/api/executions/${executionId}/resume`, {});
  },
  
  async cancel(executionId: string): Promise<void> {
    return apiClient.post<void>(`/api/executions/${executionId}/cancel`, {});
  },
};
```

---

## 🧪 Testing Guidelines

### Component Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowEditor } from './WorkflowEditor';

describe('WorkflowEditor', () => {
  const mockWorkflow: Workflow = {
    id: '123',
    name: 'Test Workflow',
    nodes: [],
    connections: [],
  };
  
  const mockOnSave = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should render workflow name', () => {
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} />);
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
  });
  
  it('should call onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} />);
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(mockWorkflow);
    });
  });
  
  it('should disable save button when readOnly', () => {
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} readOnly />);
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });
});
```

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflow } from './useWorkflow';
import { workflowService } from '../services/workflowService';

jest.mock('../services/workflowService');

describe('useWorkflow', () => {
  const mockWorkflow: Workflow = {
    id: '123',
    name: 'Test',
    nodes: [],
    connections: [],
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should load workflow on mount', async () => {
    (workflowService.getById as jest.Mock).mockResolvedValue(mockWorkflow);
    
    const { result } = renderHook(() => useWorkflow('123'));
    
    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.workflow).toEqual(mockWorkflow);
    });
  });
  
  it('should set error on load failure', async () => {
    const error = new Error('Load failed');
    (workflowService.getById as jest.Mock).mockRejectedValue(error);
    
    const { result } = renderHook(() => useWorkflow('123'));
    
    await waitFor(() => {
      expect(result.current.error).toBe('Load failed');
    });
  });
});
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Business Logic in Frontend

```typescript
// ❌ BAD: Validation logic in frontend
export function WorkflowEditor() {
  const validateWorkflow = (workflow: Workflow) => {
    if (workflow.nodes.length === 0) return false;
    
    // Check for cycles
    const visited = new Set<string>();
    const hasCycle = (nodeId: string): boolean => {
      // Complex graph traversal logic...
    };
    
    return !workflow.nodes.some(n => hasCycle(n.id));
  };
}

// ✅ GOOD: Delegate validation to backend
export function WorkflowEditor() {
  const handleSave = async () => {
    const result = await workflowService.validate(workflow);
    if (!result.isValid) {
      showError(result.errors);
    }
  };
}
```

### ❌ Direct Model Communication

```typescript
// ❌ BAD: Frontend talks directly to OpenAI
import OpenAI from 'openai';

export function PlannerPanel() {
  const client = new OpenAI({ apiKey: 'xxx' });
  
  const generatePlan = async () => {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Plan this task' }],
    });
  };
}

// ✅ GOOD: Frontend calls backend API only
export function PlannerPanel() {
  const executePlannerAgent = async () => {
    const result = await workflowService.executeNode(nodeId);
    // Backend handles all LLM communication
  };
}
```

### ❌ State Management Chaos

```typescript
// ❌ BAD: Multiple sources of truth
export function WorkflowEditor() {
  const [workflow, setWorkflow] = useState<Workflow>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  
  // workflow.nodes !== nodes (out of sync!)
}

// ✅ GOOD: Single source of truth
export function WorkflowEditor() {
  const [workflow, setWorkflow] = useState<Workflow>();
  
  // Derive everything from workflow
  const nodes = workflow?.nodes || [];
  const connections = workflow?.connections || [];
}
```

---

## 📚 Required Libraries

### Core Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@microsoft/signalr": "^8.0.0",
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "reactflow": "^11.10.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/user-event": "^14.5.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

---

## 🎨 UI/UX Guidelines

### n8n-Style Workflow Editor

- **Canvas**: Infinite pannable/zoomable canvas
- **Nodes**: Draggable boxes with input/output ports
- **Connections**: Bezier curves between ports
- **Palette**: Sidebar with available node types
- **Config Panel**: Right sidebar for selected node configuration

### Visual Feedback

- **Loading States**: Skeleton loaders, not spinners
- **Error States**: Clear error messages with retry actions
- **Success States**: Brief success notifications
- **Progress**: Step-by-step progress indicators

### Accessibility

- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Reader**: ARIA labels and roles
- **Color Contrast**: WCAG AA compliance
- **Focus Management**: Clear focus indicators

---

## 🔗 Related Documentation

- [README.md](../README.md) - Project overview
- [Backend Guide](./backend-guide.md) - Backend development guide
- [ROADMAP.md](../ROADMAP.md) - Development roadmap
- [Testing Guide](../.github/instructions/testing.instructions.md) - Testing guidelines

---

**Last Updated**: 2026-01-10  
**Maintained by**: Frontend Team
