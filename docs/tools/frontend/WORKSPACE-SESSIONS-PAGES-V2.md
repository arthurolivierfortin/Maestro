# Plan d'Implémentation V2: Pages Workspaces et Sessions

**Date**: 3 février 2026
**Phase**: 7.5 - UI Générique + UI Blocks
**Philosophie**: 100% aligné avec `MAESTRO-PHILOSOPHY-V2.md`

---

## Principes Directeurs

| Principe | Application |
|----------|-------------|
| **9.1 Tout est un Block** | L'UI spécialisée est un block de type `ui` |
| **Généricité** | WorkspacesPage et SessionsPage sont 100% génériques |
| **Isolation** | Chaque workspace peut avoir son propre UI block |
| **Composabilité** | Les UI blocks peuvent être composés et overridés |

---

## Architecture Cible

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAESTRO FRONTEND                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          App Router                                  │    │
│  │                              │                                       │    │
│  │         ┌────────────────────┼────────────────────┐                 │    │
│  │         │                    │                    │                 │    │
│  │         ▼                    ▼                    ▼                 │    │
│  │   /workspaces          /workspaces/:id       /sessions              │    │
│  │         │                    │                    │                 │    │
│  │         ▼                    ▼                    ▼                 │    │
│  │  ┌─────────────┐    ┌───────────────────┐   ┌─────────────┐        │    │
│  │  │ Workspaces  │    │ WorkspaceDetail   │   │ Sessions    │        │    │
│  │  │ Page        │    │ Page              │   │ Page        │        │    │
│  │  │ (Generic)   │    │ (Generic +        │   │ (Generic)   │        │    │
│  │  │             │    │  UI Block Slot)   │   │             │        │    │
│  │  └─────────────┘    └────────┬──────────┘   └─────────────┘        │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │                    ┌───────────────────┐                           │    │
│  │                    │ UIBlockRenderer   │                           │    │
│  │                    │ (loads UI blocks  │                           │    │
│  │                    │  from workspace)  │                           │    │
│  │                    └───────────────────┘                           │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Partie 1: Nouveau Type de Block - `ui`

### 1.1 Définition du Block Type

**Fichier**: `frontend/src/registry/blockTypeDefinitions.ts` (à modifier)

```typescript
{
  type: 'ui',
  name: 'UI Block',
  description: 'Custom UI panel that can be rendered within Maestro',
  icon: '🖼️',
  color: '#9333ea',
  isAtomic: true,
  category: 'presentation',
  allowedChildren: [],
  defaultConfig: {
    entrypoint: '',
    displayMode: 'panel',
    dataBindings: {}
  }
}
```

### 1.2 Structure d'un UI Block

**Exemple**: `blocks/ui/training-dashboard.ui.block.json`

```json
{
  "id": "training-dashboard",
  "name": "Training Dashboard",
  "blockType": "ui",
  "version": "1.0.0",
  "description": "Dashboard pour visualiser les métriques de training",
  "config": {
    "entrypoint": "./ui/training-dashboard/index.html",
    "displayMode": "panel",
    "framework": "vanilla",
    "sandbox": true,
    "permissions": ["read:sessions", "read:metrics"],
    "dataBindings": {
      "sessions": "workspace:sessions",
      "blocks": "workspace:blocks"
    }
  },
  "metadata": {
    "author": "user",
    "tags": ["training", "dashboard", "metrics"]
  }
}
```

### 1.3 Display Modes

| Mode | Description | Usage |
|------|-------------|-------|
| `panel` | Panneau dans la page workspace | Dashboard, métriques |
| `fullpage` | Page complète dans l'app | UI complexe |
| `modal` | Modal overlay | Configuration, détails |
| `sidebar` | Panneau latéral | Navigation, outils |

### 1.4 Types TypeScript pour UI Block

**Fichier**: `frontend/src/types/ui-block.types.ts`

```typescript
/**
 * UI Block Types
 * Defines the structure for custom UI blocks that can be rendered in workspaces
 */

export type UIDisplayMode = 'panel' | 'fullpage' | 'modal' | 'sidebar';
export type UIFramework = 'vanilla' | 'react' | 'vue' | 'iframe';

export interface UIBlockPermission {
  resource: string;
  actions: ('read' | 'write' | 'execute')[];
}

export interface UIBlockDataBinding {
  source: string;
  transform?: string;
  refreshInterval?: number;
}

export interface UIBlockConfig {
  entrypoint: string;
  displayMode: UIDisplayMode;
  framework: UIFramework;
  sandbox: boolean;
  permissions: string[];
  dataBindings: Record<string, string | UIBlockDataBinding>;
  styles?: {
    width?: string;
    height?: string;
    minWidth?: string;
    minHeight?: string;
  };
}

export interface UIBlock {
  id: string;
  name: string;
  blockType: 'ui';
  version: string;
  description: string;
  config: UIBlockConfig;
  metadata?: Record<string, unknown>;
}

export interface UIBlockRenderContext {
  workspaceId: string;
  sessionId?: string;
  data: Record<string, unknown>;
  api: UIBlockAPI;
}

export interface UIBlockAPI {
  getSessions: () => Promise<unknown[]>;
  getBlocks: () => Promise<unknown[]>;
  getMetrics: () => Promise<unknown>;
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  execute: (blockId: string, input: unknown) => Promise<unknown>;
}
```

---

## Partie 2: WorkspacesPage (Générique)

### 2.1 Diagramme de la Page Liste

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACES PAGE (Generic)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📦 Workspaces (8)                     🔍 Search...    [+ New]       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                          │
│  │All (8) │ │Active (4)│ │Paused (2)│ │Archived(2)│                          │
│  └────────┘ └──────────┘ └──────────┘ └──────────┘                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📁 my-training-workspace                                            │    │
│  │    Status: 🟢 Active | Sessions: 3 | Blocks: 12                     │    │
│  │    Created: 2026-02-01 | Last activity: 2 min ago                   │    │
│  │    Tags: training, code, v2                                         │    │
│  │                                              [Open] [⏸️] [🗑️]       │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ 📁 data-pipeline-prod                                               │    │
│  │    Status: 🟢 Active | Sessions: 1 | Blocks: 8                      │    │
│  │    Created: 2026-01-15 | Last activity: 5 min ago                   │    │
│  │    Tags: pipeline, production                                       │    │
│  │                                              [Open] [⏸️] [🗑️]       │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ 📁 api-monitoring                                                   │    │
│  │    Status: 🟡 Paused | Sessions: 0 | Blocks: 5                      │    │
│  │    Created: 2026-01-20 | Last activity: 1 day ago                   │    │
│  │    Tags: monitoring, api                                            │    │
│  │                                              [Open] [▶️] [🗑️]       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Note**: Les métriques affichées sont 100% génériques:
- Status (Active/Paused/Archived)
- Nombre de sessions
- Nombre de blocks
- Date de création
- Dernière activité
- Tags

### 2.2 Diagramme de la Page Détail (avec UI Block Slot)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKSPACE DETAIL PAGE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ← Back    my-training-workspace                     🟢 Active    [⏸️][🗑️] │
│                                                                              │
│  ┌───────────────────┐ ┌───────────────────────────────────────────────────┐│
│  │ SIDEBAR (Generic) │ │ MAIN CONTENT                                      ││
│  │                   │ │                                                   ││
│  │ Overview        ◄─┼─┼─► ┌─────────────────────────────────────────────┐ ││
│  │ Blocks            │ │   │ OVERVIEW (Generic Maestro Panel)            │ ││
│  │ Sessions          │ │   │                                             │ ││
│  │ Logs              │ │   │ Status: Active      Created: 2026-02-01     │ ││
│  │ Settings          │ │   │ Sessions: 3 active  Blocks: 12 loaded       │ ││
│  │ ───────────────── │ │   │ Last Activity: 2 minutes ago                │ ││
│  │ UI Panels:        │ │   │                                             │ ││
│  │ • 📊 Dashboard  ◄─┼─┼─► │ Tags: training, code, v2                    │ ││
│  │ • 📈 Metrics      │ │   │                                             │ ││
│  │                   │ │   └─────────────────────────────────────────────┘ ││
│  │                   │ │                                                   ││
│  │                   │ │   ┌─────────────────────────────────────────────┐ ││
│  │                   │ │   │ UI BLOCK SLOT (Custom from Workspace)       │ ││
│  │                   │ │   │ ─────────────────────────────────────────── │ ││
│  │                   │ │   │                                             │ ││
│  │                   │ │   │  <UIBlockRenderer                           │ ││
│  │                   │ │   │     blockId="training-dashboard"            │ ││
│  │                   │ │   │     workspaceId={workspaceId}               │ ││
│  │                   │ │   │  />                                         │ ││
│  │                   │ │   │                                             │ ││
│  │                   │ │   │  (Renders custom UI defined by workspace)   │ ││
│  │                   │ │   │                                             │ ││
│  │                   │ │   └─────────────────────────────────────────────┘ ││
│  └───────────────────┘ └───────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Types TypeScript

**Fichier**: `frontend/src/types/workspace.types.ts`

```typescript
/**
 * Workspace Types - Generic container for blocks and sessions
 * No domain-specific fields (training, pipeline, etc.)
 */

export type WorkspaceStatus = 'Active' | 'Paused' | 'Archived';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  status: WorkspaceStatus;

  // Generic counts - no domain specifics
  blockCount: number;
  sessionCount: number;
  activeSessionCount: number;

  // References to blocks (including UI blocks)
  blockIds: string[];
  uiBlockIds: string[];  // UI blocks defined in this workspace

  // Metadata
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;

  // Optional custom config
  config?: Record<string, unknown>;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  tags?: string[];
  config?: Record<string, unknown>;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  status?: WorkspaceStatus;
  tags?: string[];
  config?: Record<string, unknown>;
}

export interface WorkspaceListFilters {
  status?: WorkspaceStatus;
  tags?: string[];
  search?: string;
}
```

### 2.4 Service API

**Fichier**: `frontend/src/services/workspaceService.ts`

```typescript
/**
 * Workspace Service - Generic workspace operations
 */

import { apiClient } from './api';
import type {
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceStatus,
  WorkspaceListFilters
} from '../types/workspace.types';
import type { UIBlock } from '../types/ui-block.types';

class WorkspaceService {
  private baseUrl = '/workspaces';

  // CRUD Operations
  async getWorkspaces(filters?: WorkspaceListFilters): Promise<Workspace[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tags?.length) params.append('tags', filters.tags.join(','));

    const query = params.toString();
    return apiClient.get<Workspace[]>(`${this.baseUrl}${query ? `?${query}` : ''}`);
  }

  async getWorkspace(id: string): Promise<Workspace> {
    return apiClient.get<Workspace>(`${this.baseUrl}/${id}`);
  }

  async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
    return apiClient.post<Workspace>(this.baseUrl, request);
  }

  async updateWorkspace(id: string, request: UpdateWorkspaceRequest): Promise<Workspace> {
    return apiClient.put<Workspace>(`${this.baseUrl}/${id}`, request);
  }

  async deleteWorkspace(id: string): Promise<void> {
    return apiClient.delete(`${this.baseUrl}/${id}`);
  }

  // Status Operations
  async pauseWorkspace(id: string): Promise<Workspace> {
    return apiClient.post<Workspace>(`${this.baseUrl}/${id}/pause`);
  }

  async resumeWorkspace(id: string): Promise<Workspace> {
    return apiClient.post<Workspace>(`${this.baseUrl}/${id}/resume`);
  }

  async archiveWorkspace(id: string): Promise<Workspace> {
    return apiClient.post<Workspace>(`${this.baseUrl}/${id}/archive`);
  }

  // UI Block Operations
  async getUIBlocks(workspaceId: string): Promise<UIBlock[]> {
    return apiClient.get<UIBlock[]>(`${this.baseUrl}/${workspaceId}/ui-blocks`);
  }

  async getUIBlockContent(workspaceId: string, blockId: string): Promise<string> {
    return apiClient.get<string>(`${this.baseUrl}/${workspaceId}/ui-blocks/${blockId}/content`);
  }
}

export const workspaceService = new WorkspaceService();
```

### 2.5 Zustand Store

**Fichier**: `frontend/src/store/workspaceStore.ts`

```typescript
/**
 * Workspace Store - Generic state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceStatus
} from '../types/workspace.types';
import type { UIBlock } from '../types/ui-block.types';
import { workspaceService } from '../services/workspaceService';

interface WorkspaceState {
  // Data
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  uiBlocks: UIBlock[];

  // Filters
  statusFilter: WorkspaceStatus | 'All';
  searchQuery: string;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadWorkspace: (id: string) => Promise<void>;
  loadUIBlocks: (workspaceId: string) => Promise<void>;
  createWorkspace: (request: CreateWorkspaceRequest) => Promise<Workspace>;
  updateWorkspace: (id: string, request: UpdateWorkspaceRequest) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  pauseWorkspace: (id: string) => Promise<void>;
  resumeWorkspace: (id: string) => Promise<void>;
  archiveWorkspace: (id: string) => Promise<void>;
  setStatusFilter: (filter: WorkspaceStatus | 'All') => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;

  // Computed (call as functions)
  filteredWorkspaces: () => Workspace[];
  countByStatus: () => Record<WorkspaceStatus | 'All', number>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    (set, get) => ({
      workspaces: [],
      selectedWorkspace: null,
      uiBlocks: [],
      statusFilter: 'All',
      searchQuery: '',
      isLoading: false,
      error: null,

      loadWorkspaces: async () => {
        set({ isLoading: true, error: null });
        try {
          const workspaces = await workspaceService.getWorkspaces();
          set({ workspaces, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspaces',
            isLoading: false
          });
        }
      },

      loadWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const workspace = await workspaceService.getWorkspace(id);
          set({ selectedWorkspace: workspace, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspace',
            isLoading: false
          });
        }
      },

      loadUIBlocks: async (workspaceId: string) => {
        try {
          const uiBlocks = await workspaceService.getUIBlocks(workspaceId);
          set({ uiBlocks });
        } catch (error) {
          console.error('Failed to load UI blocks:', error);
        }
      },

      createWorkspace: async (request: CreateWorkspaceRequest) => {
        set({ isLoading: true, error: null });
        try {
          const workspace = await workspaceService.createWorkspace(request);
          set(state => ({
            workspaces: [workspace, ...state.workspaces],
            isLoading: false
          }));
          return workspace;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create workspace',
            isLoading: false
          });
          throw error;
        }
      },

      updateWorkspace: async (id: string, request: UpdateWorkspaceRequest) => {
        try {
          const updated = await workspaceService.updateWorkspace(id, request);
          set(state => ({
            workspaces: state.workspaces.map(ws => ws.id === id ? updated : ws),
            selectedWorkspace: state.selectedWorkspace?.id === id ? updated : state.selectedWorkspace
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to update workspace' });
        }
      },

      deleteWorkspace: async (id: string) => {
        try {
          await workspaceService.deleteWorkspace(id);
          set(state => ({
            workspaces: state.workspaces.filter(ws => ws.id !== id),
            selectedWorkspace: state.selectedWorkspace?.id === id ? null : state.selectedWorkspace
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete workspace' });
        }
      },

      pauseWorkspace: async (id: string) => {
        try {
          const updated = await workspaceService.pauseWorkspace(id);
          set(state => ({
            workspaces: state.workspaces.map(ws => ws.id === id ? updated : ws),
            selectedWorkspace: state.selectedWorkspace?.id === id ? updated : state.selectedWorkspace
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to pause workspace' });
        }
      },

      resumeWorkspace: async (id: string) => {
        try {
          const updated = await workspaceService.resumeWorkspace(id);
          set(state => ({
            workspaces: state.workspaces.map(ws => ws.id === id ? updated : ws),
            selectedWorkspace: state.selectedWorkspace?.id === id ? updated : state.selectedWorkspace
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to resume workspace' });
        }
      },

      archiveWorkspace: async (id: string) => {
        try {
          const updated = await workspaceService.archiveWorkspace(id);
          set(state => ({
            workspaces: state.workspaces.map(ws => ws.id === id ? updated : ws),
            selectedWorkspace: state.selectedWorkspace?.id === id ? updated : state.selectedWorkspace
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to archive workspace' });
        }
      },

      setStatusFilter: (filter) => set({ statusFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearError: () => set({ error: null }),

      filteredWorkspaces: () => {
        const { workspaces, statusFilter, searchQuery } = get();
        return workspaces.filter(ws => {
          const matchesStatus = statusFilter === 'All' || ws.status === statusFilter;
          const matchesSearch = searchQuery === '' ||
            ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ws.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchesStatus && matchesSearch;
        });
      },

      countByStatus: () => {
        const { workspaces } = get();
        const counts: Record<WorkspaceStatus | 'All', number> = {
          All: workspaces.length,
          Active: 0,
          Paused: 0,
          Archived: 0
        };
        workspaces.forEach(ws => counts[ws.status]++);
        return counts;
      }
    }),
    { name: 'workspace-store' }
  )
);
```

---

## Partie 3: SessionsPage (Générique)

### 3.1 Diagramme de la Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SESSIONS PAGE (Generic)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔄 Sessions (15)                      🔍 Search...                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐          │
│  │All (15)│ │Running (3)│ │Pending(2)│ │Completed(8)│ │Failed (2)│          │
│  └────────┘ └───────────┘ └──────────┘ └───────────┘ └──────────┘          │
│                                                                              │
│  Workspace: [▼ All Workspaces        ]                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔄 session-a1b2c3d4                                                 │    │
│  │    Status: 🟢 Running | Started: 12 min ago                         │    │
│  │    Workspace: my-training-workspace                                 │    │
│  │    Blocks executed: 45 | Current block: inference-runner            │    │
│  │                                              [View] [⏹️] [📋]       │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ 🔄 session-e5f6g7h8                                                 │    │
│  │    Status: ⏳ Pending | Created: 5 min ago                          │    │
│  │    Workspace: data-pipeline-prod                                    │    │
│  │    Waiting to start...                                              │    │
│  │                                              [View] [▶️] [🗑️]       │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ 🔄 session-i9j0k1l2                                                 │    │
│  │    Status: ✅ Completed | Duration: 1h 23m                          │    │
│  │    Workspace: my-training-workspace                                 │    │
│  │    Blocks executed: 150 | Output available                          │    │
│  │                                              [View] [📥] [🗑️]       │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ 🔄 session-m3n4o5p6                                                 │    │
│  │    Status: ❌ Failed | Duration: 5m 12s                             │    │
│  │    Workspace: api-monitoring                                        │    │
│  │    Error: Block 'validator-check' failed with timeout               │    │
│  │                                              [View] [🔄] [🗑️]       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Note**: Les métriques sont 100% génériques:
- Status (Running/Pending/Completed/Failed/Cancelled)
- Durée/Temps écoulé
- Nombre de blocks exécutés
- Block courant (si running)
- Workspace associé
- Message d'erreur (si failed)

### 3.2 Diagramme Session Detail (Modal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SESSION DETAIL (Modal)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                         [X] │
│  Session: session-a1b2c3d4                                                  │
│  Workspace: my-training-workspace                           Status: Running │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ TIMELINE                                                            │    │
│  │                                                                      │    │
│  │  ● Started           ● Block 1         ● Block 2         ○ Block 3  │    │
│  │  12:00:00            12:00:05          12:05:30          (running)  │    │
│  │  ────────────────────────────────────────────────────────►          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ EXECUTION LOG                                                       │    │
│  │                                                                      │    │
│  │  12:00:00  Session started                                          │    │
│  │  12:00:05  Block 'data-loader' started                              │    │
│  │  12:05:28  Block 'data-loader' completed (5m 23s)                   │    │
│  │  12:05:30  Block 'inference-runner' started                         │    │
│  │  12:12:45  Block 'inference-runner' running... (7m 15s)             │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────────────────────────┐ ┌───────────────────────────────────┐    │
│  │ GENERIC METRICS               │ │ CURRENT BLOCK                     │    │
│  │                               │ │                                   │    │
│  │ Duration: 12m 45s             │ │ Name: inference-runner            │    │
│  │ Blocks Executed: 2/5          │ │ Type: workflow                    │    │
│  │ Retries: 0                    │ │ Started: 7m 15s ago               │    │
│  │ Status: Running               │ │ Status: Running                   │    │
│  └───────────────────────────────┘ └───────────────────────────────────┘    │
│                                                                              │
│                                              [Stop Session]  [View Logs]    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Types TypeScript

**Fichier**: `frontend/src/types/session.types.ts`

```typescript
/**
 * Session Types - Generic execution unit
 * No domain-specific fields
 */

export type SessionStatus =
  | 'Pending'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface BlockExecution {
  blockId: string;
  blockName: string;
  blockType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  retryCount: number;
}

export interface SessionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  blockId?: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  workspaceId: string;
  workspaceName: string;
  status: SessionStatus;

  // Generic execution info
  blocksTotal: number;
  blocksCompleted: number;
  currentBlockId?: string;
  currentBlockName?: string;

  // Block executions
  executions: BlockExecution[];

  // Timing
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;

  // Error info (if failed)
  error?: string;

  // Logs
  recentLogs: SessionLog[];
}

export interface SessionListFilters {
  workspaceId?: string;
  status?: SessionStatus;
  search?: string;
}

export interface CreateSessionRequest {
  workspaceId: string;
  entryBlockId?: string;
  config?: Record<string, unknown>;
}
```

### 3.4 Service API

**Fichier**: `frontend/src/services/sessionService.ts`

```typescript
/**
 * Session Service - Generic session operations
 */

import { apiClient } from './api';
import type {
  Session,
  SessionStatus,
  SessionListFilters,
  CreateSessionRequest,
  SessionLog
} from '../types/session.types';

class SessionService {
  private baseUrl = '/sessions';

  // CRUD Operations
  async getSessions(filters?: SessionListFilters): Promise<Session[]> {
    const params = new URLSearchParams();
    if (filters?.workspaceId) params.append('workspaceId', filters.workspaceId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return apiClient.get<Session[]>(`${this.baseUrl}${query ? `?${query}` : ''}`);
  }

  async getSession(id: string): Promise<Session> {
    return apiClient.get<Session>(`${this.baseUrl}/${id}`);
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    return apiClient.post<Session>(this.baseUrl, request);
  }

  async deleteSession(id: string): Promise<void> {
    return apiClient.delete(`${this.baseUrl}/${id}`);
  }

  // Control Operations
  async startSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${id}/start`);
  }

  async pauseSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${id}/pause`);
  }

  async resumeSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${id}/resume`);
  }

  async stopSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${id}/stop`);
  }

  async retrySession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${id}/retry`);
  }

  // Logs
  async getLogs(id: string, limit?: number): Promise<SessionLog[]> {
    const query = limit ? `?limit=${limit}` : '';
    return apiClient.get<SessionLog[]>(`${this.baseUrl}/${id}/logs${query}`);
  }

  // Export
  async exportResults(id: string): Promise<Blob> {
    return apiClient.get<Blob>(`${this.baseUrl}/${id}/export`, {
      responseType: 'blob'
    });
  }
}

export const sessionService = new SessionService();
```

### 3.5 Zustand Store

**Fichier**: `frontend/src/store/sessionStore.ts`

```typescript
/**
 * Session Store - Generic state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Session,
  SessionStatus,
  SessionListFilters,
  CreateSessionRequest
} from '../types/session.types';
import { sessionService } from '../services/sessionService';

interface SessionState {
  // Data
  sessions: Session[];
  selectedSession: Session | null;

  // Filters
  statusFilter: SessionStatus | 'All';
  workspaceFilter: string | null;
  searchQuery: string;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSessions: (filters?: SessionListFilters) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (request: CreateSessionRequest) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  startSession: (id: string) => Promise<void>;
  pauseSession: (id: string) => Promise<void>;
  resumeSession: (id: string) => Promise<void>;
  stopSession: (id: string) => Promise<void>;
  retrySession: (id: string) => Promise<void>;
  setStatusFilter: (filter: SessionStatus | 'All') => void;
  setWorkspaceFilter: (workspaceId: string | null) => void;
  setSearchQuery: (query: string) => void;
  selectSession: (id: string | null) => void;
  clearError: () => void;

  // Computed
  filteredSessions: () => Session[];
  countByStatus: () => Record<SessionStatus | 'All', number>;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      sessions: [],
      selectedSession: null,
      statusFilter: 'All',
      workspaceFilter: null,
      searchQuery: '',
      isLoading: false,
      error: null,

      loadSessions: async (filters?: SessionListFilters) => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await sessionService.getSessions(filters);
          set({ sessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sessions',
            isLoading: false
          });
        }
      },

      loadSession: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.getSession(id);
          set({ selectedSession: session, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load session',
            isLoading: false
          });
        }
      },

      createSession: async (request: CreateSessionRequest) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionService.createSession(request);
          set(state => ({
            sessions: [session, ...state.sessions],
            isLoading: false
          }));
          return session;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session',
            isLoading: false
          });
          throw error;
        }
      },

      deleteSession: async (id: string) => {
        try {
          await sessionService.deleteSession(id);
          set(state => ({
            sessions: state.sessions.filter(s => s.id !== id),
            selectedSession: state.selectedSession?.id === id ? null : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete session' });
        }
      },

      startSession: async (id: string) => {
        try {
          const updated = await sessionService.startSession(id);
          set(state => ({
            sessions: state.sessions.map(s => s.id === id ? updated : s),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to start session' });
        }
      },

      pauseSession: async (id: string) => {
        try {
          const updated = await sessionService.pauseSession(id);
          set(state => ({
            sessions: state.sessions.map(s => s.id === id ? updated : s),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to pause session' });
        }
      },

      resumeSession: async (id: string) => {
        try {
          const updated = await sessionService.resumeSession(id);
          set(state => ({
            sessions: state.sessions.map(s => s.id === id ? updated : s),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to resume session' });
        }
      },

      stopSession: async (id: string) => {
        try {
          const updated = await sessionService.stopSession(id);
          set(state => ({
            sessions: state.sessions.map(s => s.id === id ? updated : s),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to stop session' });
        }
      },

      retrySession: async (id: string) => {
        try {
          const updated = await sessionService.retrySession(id);
          set(state => ({
            sessions: state.sessions.map(s => s.id === id ? updated : s),
            selectedSession: state.selectedSession?.id === id ? updated : state.selectedSession
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to retry session' });
        }
      },

      setStatusFilter: (filter) => set({ statusFilter: filter }),
      setWorkspaceFilter: (workspaceId) => set({ workspaceFilter: workspaceId }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      selectSession: (id) => {
        if (id === null) {
          set({ selectedSession: null });
        } else {
          get().loadSession(id);
        }
      },

      clearError: () => set({ error: null }),

      filteredSessions: () => {
        const { sessions, statusFilter, workspaceFilter, searchQuery } = get();
        return sessions.filter(s => {
          const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
          const matchesWorkspace = !workspaceFilter || s.workspaceId === workspaceFilter;
          const matchesSearch = !searchQuery ||
            s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.workspaceName.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesStatus && matchesWorkspace && matchesSearch;
        });
      },

      countByStatus: () => {
        const { sessions } = get();
        const counts: Record<SessionStatus | 'All', number> = {
          All: sessions.length,
          Pending: 0,
          Running: 0,
          Paused: 0,
          Completed: 0,
          Failed: 0,
          Cancelled: 0
        };
        sessions.forEach(s => counts[s.status]++);
        return counts;
      }
    }),
    { name: 'session-store' }
  )
);
```

---

## Partie 4: UIBlockRenderer Component

### 4.1 Architecture du Renderer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          UI BLOCK RENDERER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ UIBlockRenderer                                                      │    │
│  │                                                                      │    │
│  │   Props:                                                             │    │
│  │   - blockId: string                                                  │    │
│  │   - workspaceId: string                                              │    │
│  │   - displayMode?: 'panel' | 'fullpage' | 'modal'                    │    │
│  │                                                                      │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │ 1. Load UI Block definition from workspace                   │   │    │
│  │   │ 2. Fetch UI content (HTML/JS/CSS)                           │   │    │
│  │   │ 3. Create sandboxed iframe or web component                 │   │    │
│  │   │ 4. Inject data bindings via postMessage API                 │   │    │
│  │   │ 5. Handle events from UI block                              │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │   Renders:                                                           │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │ <iframe                                                      │   │    │
│  │   │   sandbox="allow-scripts"                                    │   │    │
│  │   │   srcdoc={uiContent}                                         │   │    │
│  │   │ />                                                           │   │    │
│  │   │                                                              │   │    │
│  │   │ OR (for trusted blocks)                                      │   │    │
│  │   │                                                              │   │    │
│  │   │ <div dangerouslySetInnerHTML={uiContent} />                 │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 UIBlockRenderer Component

**Fichier**: `frontend/src/components/ui-block/UIBlockRenderer.tsx`

```typescript
/**
 * UIBlockRenderer - Renders custom UI blocks from workspaces
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { UIBlock, UIDisplayMode, UIBlockRenderContext } from '../../types/ui-block.types';
import { workspaceService } from '../../services/workspaceService';
import { sessionService } from '../../services/sessionService';
import './UIBlockRenderer.scss';

interface UIBlockRendererProps {
  blockId: string;
  workspaceId: string;
  displayMode?: UIDisplayMode;
  className?: string;
}

interface MessageEvent {
  type: string;
  payload: unknown;
}

export function UIBlockRenderer({
  blockId,
  workspaceId,
  displayMode = 'panel',
  className = ''
}: UIBlockRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [block, setBlock] = useState<UIBlock | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load UI block definition and content
  useEffect(() => {
    async function loadBlock() {
      setIsLoading(true);
      setError(null);

      try {
        // Get UI blocks for workspace
        const uiBlocks = await workspaceService.getUIBlocks(workspaceId);
        const uiBlock = uiBlocks.find(b => b.id === blockId);

        if (!uiBlock) {
          throw new Error(`UI block '${blockId}' not found in workspace`);
        }

        setBlock(uiBlock);

        // Fetch content
        const blockContent = await workspaceService.getUIBlockContent(workspaceId, blockId);
        setContent(blockContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load UI block');
      } finally {
        setIsLoading(false);
      }
    }

    loadBlock();
  }, [blockId, workspaceId]);

  // Handle messages from iframe
  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (!iframeRef.current) return;

    const { type, payload } = event.data as MessageEvent;

    switch (type) {
      case 'maestro:getSessions':
        const sessions = await sessionService.getSessions({ workspaceId });
        iframeRef.current.contentWindow?.postMessage({
          type: 'maestro:sessions',
          payload: sessions
        }, '*');
        break;

      case 'maestro:getBlocks':
        // Implement block fetching
        break;

      case 'maestro:subscribe':
        // Implement real-time subscriptions
        break;
    }
  }, [workspaceId]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Inject API into iframe once loaded
  const handleIframeLoad = useCallback(() => {
    if (!iframeRef.current || !block) return;

    // Send initial context to iframe
    iframeRef.current.contentWindow?.postMessage({
      type: 'maestro:init',
      payload: {
        workspaceId,
        blockId,
        config: block.config
      }
    }, '*');
  }, [workspaceId, blockId, block]);

  if (isLoading) {
    return (
      <div className={`ui-block-renderer ui-block-renderer--loading ${className}`}>
        <div className="ui-block-renderer__spinner" />
        <span>Loading UI...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`ui-block-renderer ui-block-renderer--error ${className}`}>
        <span className="ui-block-renderer__error-icon">⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!content) {
    return (
      <div className={`ui-block-renderer ui-block-renderer--empty ${className}`}>
        <span>No UI content available</span>
      </div>
    );
  }

  const sandboxPermissions = block?.config.sandbox
    ? 'allow-scripts'
    : 'allow-scripts allow-same-origin';

  return (
    <div className={`ui-block-renderer ui-block-renderer--${displayMode} ${className}`}>
      <iframe
        ref={iframeRef}
        srcDoc={content}
        sandbox={sandboxPermissions}
        onLoad={handleIframeLoad}
        title={block?.name || 'UI Block'}
        className="ui-block-renderer__iframe"
      />
    </div>
  );
}
```

### 4.3 UIBlockRenderer Styles

**Fichier**: `frontend/src/components/ui-block/UIBlockRenderer.scss`

```scss
.ui-block-renderer {
  position: relative;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;

  &--panel {
    min-height: 300px;
  }

  &--fullpage {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    border-radius: 0;
  }

  &--modal {
    min-height: 400px;
    max-height: 80vh;
  }

  &--loading,
  &--error,
  &--empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    gap: 12px;
    color: var(--text-secondary);
  }

  &--error {
    color: var(--error);
  }

  &__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  &__error-icon {
    font-size: 24px;
  }

  &__iframe {
    width: 100%;
    height: 100%;
    min-height: 300px;
    border: none;
    background: var(--background);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### 4.4 API JavaScript pour UI Blocks

**Fichier**: `frontend/public/ui-block-api.js` (injecté dans les UI blocks)

```javascript
/**
 * Maestro UI Block API
 * This script is injected into UI blocks to provide communication with Maestro
 */

window.MaestroAPI = {
  _callbacks: {},
  _subscriptions: {},

  // Initialize API with context
  init(context) {
    this.context = context;
    window.addEventListener('message', this._handleMessage.bind(this));
  },

  _handleMessage(event) {
    const { type, payload } = event.data;

    if (type.startsWith('maestro:')) {
      const eventType = type.replace('maestro:', '');

      // Handle callbacks
      if (this._callbacks[eventType]) {
        this._callbacks[eventType].forEach(cb => cb(payload));
        delete this._callbacks[eventType];
      }

      // Handle subscriptions
      if (this._subscriptions[eventType]) {
        this._subscriptions[eventType].forEach(cb => cb(payload));
      }
    }
  },

  // Request data from Maestro
  async getSessions() {
    return this._request('getSessions');
  },

  async getBlocks() {
    return this._request('getBlocks');
  },

  async getMetrics() {
    return this._request('getMetrics');
  },

  // Subscribe to real-time updates
  subscribe(event, callback) {
    if (!this._subscriptions[event]) {
      this._subscriptions[event] = [];
    }
    this._subscriptions[event].push(callback);

    window.parent.postMessage({
      type: 'maestro:subscribe',
      payload: { event }
    }, '*');

    // Return unsubscribe function
    return () => {
      this._subscriptions[event] = this._subscriptions[event].filter(cb => cb !== callback);
    };
  },

  // Execute a block
  async execute(blockId, input) {
    return this._request('execute', { blockId, input });
  },

  // Internal request helper
  _request(type, payload = {}) {
    return new Promise((resolve) => {
      if (!this._callbacks[type]) {
        this._callbacks[type] = [];
      }
      this._callbacks[type].push(resolve);

      window.parent.postMessage({
        type: `maestro:${type}`,
        payload
      }, '*');
    });
  }
};

// Auto-initialize when receiving init message
window.addEventListener('message', (event) => {
  if (event.data.type === 'maestro:init') {
    window.MaestroAPI.init(event.data.payload);

    // Dispatch ready event for UI block code
    window.dispatchEvent(new CustomEvent('maestro:ready', {
      detail: event.data.payload
    }));
  }
});
```

---

## Partie 5: Pages Components

### 5.1 WorkspacesPage

**Fichier**: `frontend/src/pages/WorkspacesPage.tsx`

```tsx
/**
 * WorkspacesPage - Generic workspace list
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { WorkspaceStatus, CreateWorkspaceRequest } from '../types/workspace.types';
import { WorkspaceRow } from '../components/workspace/WorkspaceRow';
import { CreateWorkspaceModal } from '../components/workspace/CreateWorkspaceModal';
import './WorkspacesPage.scss';

const STATUS_FILTERS: (WorkspaceStatus | 'All')[] = ['All', 'Active', 'Paused', 'Archived'];

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    isLoading,
    error,
    statusFilter,
    searchQuery,
    loadWorkspaces,
    createWorkspace,
    deleteWorkspace,
    pauseWorkspace,
    resumeWorkspace,
    archiveWorkspace,
    setStatusFilter,
    setSearchQuery,
    filteredWorkspaces,
    countByStatus
  } = useWorkspaceStore();

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const filtered = useMemo(() => filteredWorkspaces(), [filteredWorkspaces]);
  const counts = useMemo(() => countByStatus(), [countByStatus]);

  const handleCreate = async (request: CreateWorkspaceRequest) => {
    const workspace = await createWorkspace(request);
    setShowCreateModal(false);
    navigate(`/workspaces/${workspace.id}`);
  };

  return (
    <div className="workspaces-page">
      <header className="workspaces-page__header">
        <div className="workspaces-page__title">
          <h1>Workspaces</h1>
          <span className="workspaces-page__count">({counts.All})</span>
        </div>

        <div className="workspaces-page__search">
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          className="workspaces-page__new-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + New
        </button>
      </header>

      <div className="workspaces-page__filters">
        {STATUS_FILTERS.map(status => (
          <button
            key={status}
            className={`workspaces-page__filter-btn ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status} ({counts[status]})
          </button>
        ))}
      </div>

      {error && (
        <div className="workspaces-page__error">{error}</div>
      )}

      <div className="workspaces-list">
        {isLoading ? (
          <div className="workspaces-list__loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="workspaces-list__empty">
            <div className="workspaces-list__empty-icon">📦</div>
            <p>No workspaces found</p>
            <button onClick={() => setShowCreateModal(true)}>
              Create your first workspace
            </button>
          </div>
        ) : (
          filtered.map(workspace => (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              onOpen={() => navigate(`/workspaces/${workspace.id}`)}
              onPause={() => pauseWorkspace(workspace.id)}
              onResume={() => resumeWorkspace(workspace.id)}
              onArchive={() => archiveWorkspace(workspace.id)}
              onDelete={() => deleteWorkspace(workspace.id)}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
```

### 5.2 WorkspaceDetailPage

**Fichier**: `frontend/src/pages/WorkspaceDetailPage.tsx`

```tsx
/**
 * WorkspaceDetailPage - Generic workspace detail with UI block slot
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../store/workspaceStore';
import { UIBlockRenderer } from '../components/ui-block/UIBlockRenderer';
import { WorkspaceOverview } from '../components/workspace/WorkspaceOverview';
import { WorkspaceBlocks } from '../components/workspace/WorkspaceBlocks';
import { WorkspaceSessions } from '../components/workspace/WorkspaceSessions';
import { WorkspaceLogs } from '../components/workspace/WorkspaceLogs';
import './WorkspaceDetailPage.scss';

type TabId = 'overview' | 'blocks' | 'sessions' | 'logs' | string;

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const {
    selectedWorkspace,
    uiBlocks,
    isLoading,
    error,
    loadWorkspace,
    loadUIBlocks,
    pauseWorkspace,
    resumeWorkspace,
    deleteWorkspace
  } = useWorkspaceStore();

  useEffect(() => {
    if (id) {
      loadWorkspace(id);
      loadUIBlocks(id);
    }
  }, [id, loadWorkspace, loadUIBlocks]);

  if (isLoading) {
    return <div className="workspace-detail-page workspace-detail-page--loading">Loading...</div>;
  }

  if (error || !selectedWorkspace) {
    return (
      <div className="workspace-detail-page workspace-detail-page--error">
        <p>{error || 'Workspace not found'}</p>
        <button onClick={() => navigate('/workspaces')}>Back to Workspaces</button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this workspace?')) {
      await deleteWorkspace(selectedWorkspace.id);
      navigate('/workspaces');
    }
  };

  // Built-in tabs
  const builtInTabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'blocks', label: 'Blocks', icon: '🧱' },
    { id: 'sessions', label: 'Sessions', icon: '🔄' },
    { id: 'logs', label: 'Logs', icon: '📜' }
  ];

  // UI block tabs (custom panels from workspace)
  const uiBlockTabs = uiBlocks
    .filter(b => b.config.displayMode === 'panel')
    .map(b => ({
      id: `ui:${b.id}`,
      label: b.name,
      icon: '🖼️',
      blockId: b.id
    }));

  const allTabs = [...builtInTabs, ...uiBlockTabs];

  const renderContent = () => {
    if (activeTab === 'overview') {
      return <WorkspaceOverview workspace={selectedWorkspace} />;
    }
    if (activeTab === 'blocks') {
      return <WorkspaceBlocks workspaceId={selectedWorkspace.id} />;
    }
    if (activeTab === 'sessions') {
      return <WorkspaceSessions workspaceId={selectedWorkspace.id} />;
    }
    if (activeTab === 'logs') {
      return <WorkspaceLogs workspaceId={selectedWorkspace.id} />;
    }

    // UI Block tabs
    if (activeTab.startsWith('ui:')) {
      const blockId = activeTab.replace('ui:', '');
      return (
        <UIBlockRenderer
          blockId={blockId}
          workspaceId={selectedWorkspace.id}
          displayMode="panel"
        />
      );
    }

    return null;
  };

  return (
    <div className="workspace-detail-page">
      <header className="workspace-detail-page__header">
        <button
          className="workspace-detail-page__back"
          onClick={() => navigate('/workspaces')}
        >
          ← Back
        </button>

        <h1 className="workspace-detail-page__title">
          {selectedWorkspace.name}
        </h1>

        <div className="workspace-detail-page__status">
          {selectedWorkspace.status === 'Active' && '🟢'}
          {selectedWorkspace.status === 'Paused' && '🟡'}
          {selectedWorkspace.status === 'Archived' && '🔵'}
          {selectedWorkspace.status}
        </div>

        <div className="workspace-detail-page__actions">
          {selectedWorkspace.status === 'Active' && (
            <button onClick={() => pauseWorkspace(selectedWorkspace.id)}>⏸️ Pause</button>
          )}
          {selectedWorkspace.status === 'Paused' && (
            <button onClick={() => resumeWorkspace(selectedWorkspace.id)}>▶️ Resume</button>
          )}
          <button onClick={handleDelete}>🗑️ Delete</button>
        </div>
      </header>

      <div className="workspace-detail-page__content">
        <nav className="workspace-detail-page__sidebar">
          {allTabs.map(tab => (
            <button
              key={tab.id}
              className={`workspace-detail-page__tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="workspace-detail-page__tab-icon">{tab.icon}</span>
              <span className="workspace-detail-page__tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <main className="workspace-detail-page__main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
```

### 5.3 SessionsPage

**Fichier**: `frontend/src/pages/SessionsPage.tsx`

```tsx
/**
 * SessionsPage - Generic session list
 */

import { useEffect, useMemo, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { SessionStatus } from '../types/session.types';
import { SessionRow } from '../components/session/SessionRow';
import { SessionDetailModal } from '../components/session/SessionDetailModal';
import './SessionsPage.scss';

const STATUS_FILTERS: (SessionStatus | 'All')[] = [
  'All', 'Running', 'Pending', 'Completed', 'Failed'
];

export function SessionsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const {
    isLoading,
    error,
    statusFilter,
    workspaceFilter,
    searchQuery,
    loadSessions,
    startSession,
    pauseSession,
    stopSession,
    retrySession,
    deleteSession,
    setStatusFilter,
    setWorkspaceFilter,
    setSearchQuery,
    filteredSessions,
    countByStatus
  } = useSessionStore();

  const { workspaces, loadWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    loadSessions();
    loadWorkspaces();
  }, [loadSessions, loadWorkspaces]);

  const filtered = useMemo(() => filteredSessions(), [filteredSessions]);
  const counts = useMemo(() => countByStatus(), [countByStatus]);

  return (
    <div className="sessions-page">
      <header className="sessions-page__header">
        <div className="sessions-page__title">
          <h1>Sessions</h1>
          <span className="sessions-page__count">({counts.All})</span>
        </div>

        <div className="sessions-page__search">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="sessions-page__filters">
        {STATUS_FILTERS.map(status => (
          <button
            key={status}
            className={`sessions-page__filter-btn ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status} ({counts[status] || 0})
          </button>
        ))}
      </div>

      <div className="sessions-page__workspace-filter">
        <label>Workspace:</label>
        <select
          value={workspaceFilter || ''}
          onChange={(e) => setWorkspaceFilter(e.target.value || null)}
        >
          <option value="">All Workspaces</option>
          {workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="sessions-page__error">{error}</div>
      )}

      <div className="sessions-list">
        {isLoading ? (
          <div className="sessions-list__loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="sessions-list__empty">
            <div className="sessions-list__empty-icon">🔄</div>
            <p>No sessions found</p>
            <p className="sessions-list__empty-hint">
              Sessions are created when workflows are executed in workspaces
            </p>
          </div>
        ) : (
          filtered.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              onView={() => setSelectedSessionId(session.id)}
              onStart={() => startSession(session.id)}
              onPause={() => pauseSession(session.id)}
              onStop={() => stopSession(session.id)}
              onRetry={() => retrySession(session.id)}
              onDelete={() => deleteSession(session.id)}
            />
          ))
        )}
      </div>

      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}
```

---

## Résumé des Fichiers

### Nouveaux Fichiers (18)

**Types (2):**
```
frontend/src/types/
├── workspace.types.ts      # Generic workspace types
├── session.types.ts        # Generic session types
└── ui-block.types.ts       # UI block types (new block type)
```

**Services (2):**
```
frontend/src/services/
├── workspaceService.ts     # Generic workspace API
└── sessionService.ts       # Generic session API
```

**Stores (2):**
```
frontend/src/store/
├── workspaceStore.ts       # Generic workspace state
└── sessionStore.ts         # Generic session state
```

**Pages (4 + SCSS):**
```
frontend/src/pages/
├── WorkspacesPage.tsx      # List page
├── WorkspacesPage.scss
├── WorkspaceDetailPage.tsx # Detail page with UI block slot
├── WorkspaceDetailPage.scss
├── SessionsPage.tsx        # List page
└── SessionsPage.scss
```

**Components - UI Block (2):**
```
frontend/src/components/ui-block/
├── UIBlockRenderer.tsx     # Renders custom UI blocks
└── UIBlockRenderer.scss
```

**Components - Workspace (4):**
```
frontend/src/components/workspace/
├── WorkspaceRow.tsx
├── WorkspaceOverview.tsx
├── WorkspaceSessions.tsx
└── CreateWorkspaceModal.tsx
```

**Components - Session (3):**
```
frontend/src/components/session/
├── SessionRow.tsx
├── SessionDetailModal.tsx
└── SessionTimeline.tsx
```

**Public Assets (1):**
```
frontend/public/
└── ui-block-api.js         # API for UI blocks
```

### Fichiers Modifiés (3)

```
frontend/src/types/index.ts       # Export new types
frontend/src/services/index.ts    # Export new services
frontend/src/store/index.ts       # Export new stores
frontend/src/App.tsx              # Add routes
frontend/src/registry/blockTypeDefinitions.ts  # Add 'ui' block type
```

---

## Exemple: Training Dashboard UI Block

Un workspace de training pourrait définir son propre dashboard:

**Fichier**: `workspaces/my-training/blocks/training-dashboard.ui.block.json`

```json
{
  "id": "training-dashboard",
  "name": "Training Dashboard",
  "blockType": "ui",
  "version": "1.0.0",
  "config": {
    "entrypoint": "./ui/dashboard/index.html",
    "displayMode": "panel",
    "framework": "vanilla",
    "sandbox": true,
    "permissions": ["read:sessions", "read:metrics"],
    "dataBindings": {
      "sessions": "workspace:sessions"
    }
  }
}
```

**Fichier**: `workspaces/my-training/ui/dashboard/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 16px; }
    .metric { display: inline-block; padding: 12px; margin: 8px; background: #f0f0f0; border-radius: 8px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h2>Training Metrics</h2>
  <div id="metrics"></div>

  <script>
    window.addEventListener('maestro:ready', async () => {
      const sessions = await MaestroAPI.getSessions();

      // Calculate training-specific metrics
      const running = sessions.filter(s => s.status === 'Running').length;
      const completed = sessions.filter(s => s.status === 'Completed').length;

      document.getElementById('metrics').innerHTML = `
        <div class="metric">
          <div class="metric-value">${running}</div>
          <div class="metric-label">Running</div>
        </div>
        <div class="metric">
          <div class="metric-value">${completed}</div>
          <div class="metric-label">Completed</div>
        </div>
      `;

      // Subscribe to updates
      MaestroAPI.subscribe('sessions', (sessions) => {
        // Update UI when sessions change
      });
    });
  </script>
</body>
</html>
```

---

## Vérification

### Build
```bash
cd frontend && npm run build
```

### Tests
```bash
cd frontend && npm test -- --run
```

### Manual Testing
1. Start services
2. Create a workspace
3. Add a UI block to the workspace
4. Navigate to workspace detail
5. Verify custom UI panel appears in sidebar
6. Click on custom panel, verify it loads and receives data
