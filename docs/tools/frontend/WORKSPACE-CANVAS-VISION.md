# Workspace Canvas Vision

## Document de Conception - Vue Canvas Inspirée de Vivado

**Version**: 1.0
**Date**: 2026-02-04
**Status**: Draft pour validation

---

## 1. Vision Globale

### 1.1 Objectif
Transformer la page workspace d'une vue "dashboard statique" vers une **vue canvas dynamique** inspirée de Vivado Block Design, où:
- Les **sessions** sont les unités atomiques visualisées (comme les IP Blocks dans Vivado)
- Les **flux de données** entre sessions sont visibles (comme les wires/signals)
- La **hiérarchie** workspace/sessions est navigable (comme le Hierarchy Browser)
- Un **inspecteur contextuel** affiche les détails (comme le Properties Panel)
- Une **console** montre les événements en temps réel (comme la TCL Console)

### 1.2 Analogie Vivado

| Vivado | Maestro |
|--------|---------|
| Block Design Canvas | Workspace Canvas |
| IP Blocks (PLL, Memory, CPU) | Sessions (Project, Foundry, Training) |
| Wires/Signals | Messages, Data Flow, Promotions |
| Hierarchy Browser | Workspace/Session Tree Panel |
| Properties Panel | Inspector Panel |
| TCL Console | Event Console |

---

## 2. Architecture des Vues

### 2.1 Vue Principale: Live View

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Hierarchy Panel]    │ [Canvas: Live View]                │ [Inspector]      │
│ 200px fixed          │ flexible                           │ 300px fixed      │
├──────────────────────┼────────────────────────────────────┼──────────────────┤
│                      │                                    │                  │
│ 📁 Training-WS       │   ┌──────────────┐                 │ Session: sess-01 │
│  ├─ Sessions         │   │ sess-01      │──────────┐      │ ───────────────  │
│  │  ├─ 🟢 sess-01    │   │ ┌──────────┐ │          │      │ Status: Running  │
│  │  │  └─ (3 blocks) │   │ │ Agent    │ │   data   │      │ Started: 2m ago  │
│  │  └─ ⏸️ sess-02    │   │ └──────────┘ │─────────►│      │ Blocks: 3/5      │
│  │                   │   │ ┌──────────┐ │          │      │                  │
│  ├─ Linked WS        │   │ │ Tool     │ │          ▼      │ ── Logs ──       │
│  │  └─ → Staging     │   │ └──────────┘ │   ┌───────────┐ │ [agent] started  │
│  │                   │   └──────────────┘   │ sess-02   │ │ [tool] eval      │
│  └─ Blocks (12)      │          │           │           │ │ [agent] done     │
│                      │    promote│          └───────────┘ │                  │
│                      │          ▼                         │ ── Config ──     │
│                      │   ┌──────────────┐                 │ maxRetries: 3    │
│                      │   │ Staging WS   │                 │ timeout: 30s     │
│                      │   │ (external)   │                 │                  │
│                      │   └──────────────┘                 │                  │
├──────────────────────┴────────────────────────────────────┴──────────────────┤
│ [Console Panel] height: 150px, collapsible                                    │
│ 🟢 INFO  [sess-01/agent-1] Processing batch 42/100 | Loss: 0.023             │
│ 🟡 WARN  [sess-01/tool-a] Rate limit approaching (85%)                       │
│ 🔵 DEBUG [sess-02/monitor] Checkpoint saved at epoch 15                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Session Node (Unité atomique)

Une session est représentée comme un node rectangulaire contenant:

```
┌─────────────────────────────────────┐
│ 🟢 Session: training-run-001       │  ← Header avec status indicator
├─────────────────────────────────────┤
│ Type: ProjectSession                │  ← Metadata
│ Blocks: 5 active                    │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐│  ← Preview des blocks (icons)
│ │ Agent   │ │ Tool    │ │ Prompt  ││
│ │   🤖    │ │   🔧    │ │   📝    ││
│ └─────────┘ └─────────┘ └─────────┘│
├─────────────────────────────────────┤
│ ▶ Running for 2m 34s               │  ← Status bar
│ █████████░░░░░░░░░░ 45%            │  ← Progress (si applicable)
└─────────────────────────────────────┘
```

### 2.3 Types d'Edges (Connexions)

| Type | Visuel | Description |
|------|--------|-------------|
| Data Flow | `─────►` Bleu solide | Données passées entre sessions |
| Promotion | `═════►` Vert pointillé | Promotion d'agent vers autre workspace |
| Read | `- - -►` Gris | Lecture depuis autre workspace |
| Write | `━━━━►` Orange | Écriture vers autre workspace |
| Message | `~~~~~►` Violet animé | Message en cours de transmission |

### 2.4 Drill-Down (Double-click sur session)

Au double-click sur une session, on zoome pour voir les blocks internes:

```
┌─────────────────────────────────────────────────────────────┐
│ ◀ Back to Workspace │ Session: training-run-001            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐         ┌─────────────┐                  │
│   │   Trigger   │────────►│   Agent     │                  │
│   │   (cron)    │         │  (trainer)  │                  │
│   └─────────────┘         └──────┬──────┘                  │
│                                  │                          │
│                    ┌─────────────┼─────────────┐           │
│                    ▼             ▼             ▼           │
│              ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│              │  Tool    │ │  Tool    │ │ Validator│        │
│              │ (loader) │ │ (saver)  │ │ (check)  │        │
│              └──────────┘ └──────────┘ └──────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Composants React

### 3.1 Structure des fichiers

```
frontend/src/components/workspace/
├── WorkspaceCanvas/
│   ├── index.ts                     # Re-exports
│   ├── WorkspaceCanvas.tsx          # Conteneur principal React Flow
│   ├── WorkspaceCanvas.scss         # Styles
│   ├── nodes/
│   │   ├── SessionNode.tsx          # Node représentant une session
│   │   ├── SessionNode.scss
│   │   ├── ExternalWorkspaceNode.tsx # Node pour workspace lié
│   │   └── BlockPreviewNode.tsx     # Mini-node pour blocks dans drill-down
│   ├── edges/
│   │   ├── DataFlowEdge.tsx         # Edge pour flux de données
│   │   ├── PromotionEdge.tsx        # Edge pour promotions
│   │   └── MessageEdge.tsx          # Edge animé pour messages
│   └── hooks/
│       ├── useWorkspaceLayout.ts    # Auto-layout avec dagre
│       ├── useSessionSubscription.ts # SignalR subscription pour session
│       └── useCanvasSync.ts         # Sync état canvas avec store
│
├── HierarchyPanel/
│   ├── index.ts
│   ├── HierarchyPanel.tsx           # Panneau arborescent
│   ├── HierarchyPanel.scss
│   ├── SessionTreeItem.tsx          # Item de session
│   ├── LinkedWorkspaceItem.tsx      # Item workspace externe
│   └── BlockListItem.tsx            # Item de block
│
├── InspectorPanel/
│   ├── index.ts
│   ├── InspectorPanel.tsx           # Conteneur inspecteur
│   ├── InspectorPanel.scss
│   ├── SessionInspector.tsx         # Détails session
│   ├── BlockInspector.tsx           # Détails block
│   └── WorkspaceInspector.tsx       # Détails workspace lié
│
├── ConsolePanel/
│   ├── index.ts
│   ├── ConsolePanel.tsx             # Console de logs
│   ├── ConsolePanel.scss
│   ├── LogEntry.tsx                 # Entrée de log formatée
│   └── LogFilters.tsx               # Filtres par source/niveau
│
└── WorkspaceLiveView.tsx            # Layout assemblé (3 colonnes + console)
```

### 3.2 Types TypeScript

```typescript
// types/workspace-canvas.types.ts

export interface SessionNodeData {
  sessionId: string;
  name: string;
  type: 'ProjectSession' | 'FoundrySession';
  status: SessionStatus;
  blockCount: number;
  activeBlockCount: number;
  startedAt?: string;
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  metrics?: {
    messagesProcessed: number;
    errorsCount: number;
    lastActivity: string;
  };
}

export interface ExternalWorkspaceNodeData {
  workspaceId: string;
  name: string;
  type: WorkspaceType;
  relationshipType: 'promotion' | 'read' | 'write';
  isOnline: boolean;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: 'dataFlow' | 'promotion' | 'read' | 'write' | 'message';
  animated?: boolean;
  label?: string;
  data?: {
    lastTransfer?: string;
    transferCount?: number;
  };
}

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: {
    sessionId: string;
    sessionName: string;
    blockId?: string;
    blockName?: string;
  };
  message: string;
  data?: Record<string, unknown>;
}

export type ViewMode = 'live' | 'design' | 'topology' | 'timeline';
```

---

## 4. Intégration SignalR

### 4.1 Nouveau Service: WorkspaceHubService

```typescript
// services/signalr/workspaceHub.ts

import * as signalR from '@microsoft/signalr';

export interface WorkspaceEventHandlers {
  onSessionStateChange: (event: SessionStateChangeEvent) => void;
  onSessionEvent: (event: SessionEvent) => void;
  onAgentEvent: (event: AgentEvent) => void;
  onPromotionEvent: (event: PromotionEvent) => void;
  onMetricsUpdate: (event: MetricsUpdateEvent) => void;
}

class WorkspaceHubService {
  private connection: signalR.HubConnection | null = null;
  private subscribedWorkspaces: Set<string> = new Set();

  async connect(): Promise<void> {
    // Utiliser SessionHub existant + nouveau WorkspaceHub
  }

  async subscribeToWorkspace(workspaceId: string, handlers: WorkspaceEventHandlers): Promise<void> {
    // S'abonner à tous les sessions du workspace
    // Écouter les événements de topologie
  }

  async unsubscribeFromWorkspace(workspaceId: string): Promise<void> {
    // Se désabonner
  }
}

export const workspaceHubService = new WorkspaceHubService();
```

### 4.2 Hook React pour subscription

```typescript
// hooks/useWorkspaceRealtime.ts

export function useWorkspaceRealtime(workspaceId: string) {
  const [sessions, setSessions] = useState<SessionNodeData[]>([]);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);

  useEffect(() => {
    const handlers: WorkspaceEventHandlers = {
      onSessionStateChange: (event) => {
        setSessions(prev => updateSession(prev, event));
      },
      onSessionEvent: (event) => {
        setLogs(prev => addLog(prev, event));
      },
      // ...
    };

    workspaceHubService.subscribeToWorkspace(workspaceId, handlers);

    return () => {
      workspaceHubService.unsubscribeFromWorkspace(workspaceId);
    };
  }, [workspaceId]);

  return { sessions, logs, edges };
}
```

---

## 5. Backend - Nouvelles API nécessaires

### 5.1 Endpoints à ajouter

| Endpoint | Description |
|----------|-------------|
| `GET /api/workspaces/{id}/live-state` | État temps réel des sessions |
| `GET /api/workspaces/{id}/metrics` | Métriques agrégées du workspace |
| `GET /api/workspaces/{id}/event-log` | Historique des événements récents |
| `GET /api/sessions/{id}/blocks` | Liste des blocks d'une session |

### 5.2 Nouveau Hub SignalR: WorkspaceHub

```csharp
// Hubs/WorkspaceHub.cs

public class WorkspaceHub : Hub<IWorkspaceClient>
{
    // S'abonner à un workspace (toutes ses sessions)
    public async Task JoinWorkspace(string workspaceId);

    // Se désabonner
    public async Task LeaveWorkspace(string workspaceId);

    // Diffuser un événement de session
    public static async Task BroadcastSessionEvent(
        IHubContext<WorkspaceHub> context,
        string workspaceId,
        SessionEvent evt);

    // Diffuser une mise à jour de métriques
    public static async Task BroadcastMetricsUpdate(
        IHubContext<WorkspaceHub> context,
        string workspaceId,
        WorkspaceMetrics metrics);
}

public interface IWorkspaceClient
{
    Task OnSessionStateChange(SessionStateChangeMessage msg);
    Task OnSessionEvent(SessionEventMessage msg);
    Task OnAgentEvent(AgentEventMessage msg);
    Task OnPromotionEvent(PromotionEventMessage msg);
    Task OnMetricsUpdate(MetricsUpdateMessage msg);
}
```

---

## 6. Phases d'Implémentation

### Phase 1: Foundation (Canvas statique)
- [ ] Créer `WorkspaceCanvas.tsx` avec React Flow
- [ ] Implémenter `SessionNode.tsx` (design de base)
- [ ] Implémenter `ExternalWorkspaceNode.tsx`
- [ ] Layout automatique avec dagre
- [ ] Afficher les sessions depuis l'API existante

### Phase 2: Hierarchy & Inspector
- [ ] Créer `HierarchyPanel.tsx` avec arbre navigable
- [ ] Créer `InspectorPanel.tsx` contextuel
- [ ] Synchroniser sélection canvas ↔ hiérarchie ↔ inspector
- [ ] Implémenter drill-down (double-click)

### Phase 3: Real-time Integration
- [ ] Créer `WorkspaceHub.cs` backend
- [ ] Créer `workspaceHubService.ts` frontend
- [ ] Implémenter `useWorkspaceRealtime` hook
- [ ] Ajouter indicateurs de status live sur les nodes

### Phase 4: Console & Events
- [ ] Créer `ConsolePanel.tsx`
- [ ] Implémenter filtres par session/level
- [ ] Connecter aux événements SignalR
- [ ] Ajouter auto-scroll et recherche

### Phase 5: Edges & Data Flow
- [ ] Implémenter `DataFlowEdge.tsx` avec animation
- [ ] Implémenter `PromotionEdge.tsx`
- [ ] Détecter les flux depuis les événements
- [ ] Afficher transferts en cours

### Phase 6: Polish & Views
- [ ] Ajouter sélecteur de vue (Live/Design/Topology)
- [ ] Implémenter vue Topology (zoom out inter-workspaces)
- [ ] Minimap
- [ ] Export/Import de layouts
- [ ] Keyboard shortcuts

---

## 7. Questions Ouvertes

1. **Persistance du layout**: Doit-on sauvegarder les positions des nodes?
2. **Limite de sessions**: Combien de sessions afficher avant de regrouper?
3. **Vue Topology**: Inclure tous les workspaces ou seulement les liés?
4. **Historique de console**: Combien d'entrées garder en mémoire?

---

## 8. Références

- [Vivado Block Design](https://docs.xilinx.com/r/en-US/ug994-vivado-ip-subsystems/Block-Design-View)
- [React Flow Documentation](https://reactflow.dev/docs/introduction/)
- [SignalR Documentation](https://docs.microsoft.com/en-us/aspnet/core/signalr/)
