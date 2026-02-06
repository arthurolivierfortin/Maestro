# Workspace Canvas - Roadmap d'Implémentation

## Récapitulatif et Planning

**Date**: 2026-02-04
**Documents liés**:
- [WORKSPACE-CANVAS-VISION.md](./WORKSPACE-CANVAS-VISION.md) - Vision et maquettes
- [WORKSPACE-CANVAS-IMPLEMENTATION-PLAN.md](./WORKSPACE-CANVAS-IMPLEMENTATION-PLAN.md) - Spécifications techniques
- [WORKSPACE-CANVAS-DESIGN-CHOICES.md](./WORKSPACE-CANVAS-DESIGN-CHOICES.md) - Décisions architecturales

---

## État Actuel de l'Infrastructure

### Ce qui existe déjà

| Composant | Status | Notes |
|-----------|--------|-------|
| **Backend SignalR** | ✅ Complet | SessionHub, ExecutionHub, BlockHub fonctionnels |
| **API Workspace** | ✅ Complet | CRUD, topology, promotion, permissions |
| **Frontend Store** | ✅ Complet | workspaceStore avec toutes les actions |
| **Types TypeScript** | ✅ Complet | Workspace, Session, Topology types |
| **React Flow** | ✅ Installé | Utilisé dans BlockCanvas existant |

### Ce qui est à créer

| Composant | Priority | Phase |
|-----------|----------|-------|
| **WorkspaceCanvas** | 🔴 High | Phase 1 |
| **SessionNode** | 🔴 High | Phase 1 |
| **ExternalWorkspaceNode** | 🟡 Medium | Phase 1 |
| **useWorkspaceLayout** | 🔴 High | Phase 1 |
| **HierarchyPanel** | 🟡 Medium | Phase 2 |
| **InspectorPanel** | 🟡 Medium | Phase 2 |
| **WorkspaceHub (backend)** | 🔴 High | Phase 3 |
| **useWorkspaceRealtime** | 🔴 High | Phase 3 |
| **ConsolePanel** | 🟡 Medium | Phase 4 |
| **Custom Edges** | 🟢 Low | Phase 5 |
| **View Switcher** | 🟢 Low | Phase 6 |

---

## Phases d'Implémentation

### Phase 1: Canvas Foundation (Priorité: Haute)

**Objectif**: Afficher les sessions d'un workspace sur un canvas React Flow interactif.

**Fichiers à créer**:
```
frontend/src/components/workspace/WorkspaceCanvas/
├── index.ts
├── WorkspaceCanvas.tsx
├── WorkspaceCanvas.scss
├── nodes/
│   ├── SessionNode.tsx
│   ├── SessionNode.scss
│   └── ExternalWorkspaceNode.tsx
├── edges/
│   └── DataFlowEdge.tsx
└── hooks/
    └── useWorkspaceLayout.ts
```

**Tâches**:
1. [ ] Installer dagre: `npm install dagre @types/dagre`
2. [ ] Créer `SessionNode.tsx` avec design Vivado-like
3. [ ] Créer `ExternalWorkspaceNode.tsx` pour workspaces liés
4. [ ] Créer `useWorkspaceLayout.ts` avec auto-layout dagre
5. [ ] Créer `WorkspaceCanvas.tsx` intégrant tout
6. [ ] Créer styles SCSS
7. [ ] Écrire tests pour SessionNode
8. [ ] Intégrer dans `WorkspaceDetailPage.tsx`

**Critères de succès**:
- [ ] Les sessions du workspace s'affichent comme nodes
- [ ] Les workspaces liés s'affichent comme nodes externes
- [ ] Le layout automatique positionne les nodes logiquement
- [ ] Click sélectionne un node (console.log pour l'instant)
- [ ] Double-click trigger callback drill-down

**Dépendances**: Aucune

---

### Phase 2: Hierarchy & Inspector (Priorité: Moyenne)

**Objectif**: Ajouter les panneaux latéraux de navigation et d'inspection.

**Fichiers à créer**:
```
frontend/src/components/workspace/
├── HierarchyPanel/
│   ├── index.ts
│   ├── HierarchyPanel.tsx
│   ├── HierarchyPanel.scss
│   └── SessionTreeItem.tsx
├── InspectorPanel/
│   ├── index.ts
│   ├── InspectorPanel.tsx
│   ├── InspectorPanel.scss
│   ├── SessionInspector.tsx
│   └── WorkspaceInspector.tsx
└── WorkspaceLiveView.tsx  (layout 3 colonnes)
```

**Tâches**:
1. [ ] Créer `HierarchyPanel.tsx` avec arbre expandable
2. [ ] Créer `SessionTreeItem.tsx` avec icônes de status
3. [ ] Créer `InspectorPanel.tsx` container
4. [ ] Créer `SessionInspector.tsx` pour détails session
5. [ ] Créer `WorkspaceInspector.tsx` pour détails workspace lié
6. [ ] Créer `WorkspaceLiveView.tsx` assemblant le layout
7. [ ] Synchroniser sélection: canvas ↔ hierarchy ↔ inspector
8. [ ] Implémenter drill-down view pour blocks d'une session

**Critères de succès**:
- [ ] Hierarchy montre l'arbre workspace/sessions
- [ ] Click dans hierarchy sélectionne sur canvas
- [ ] Click sur canvas met à jour l'inspector
- [ ] Double-click navigue vers vue drill-down
- [ ] Bouton "Back" revient à la vue workspace

**Dépendances**: Phase 1

---

### Phase 3: Real-time Integration (Priorité: Haute)

**Objectif**: Connecter le canvas aux événements temps réel via SignalR.

**Fichiers Backend**:
```
backend/src/Maestro.Api/Hubs/
├── WorkspaceHub.cs
└── IWorkspaceClient.cs (messages)
```

**Fichiers Frontend**:
```
frontend/src/
├── services/signalr/workspaceHub.ts
└── hooks/useWorkspaceRealtime.ts
```

**Tâches Backend**:
1. [ ] Créer `WorkspaceHub.cs` avec JoinWorkspace/LeaveWorkspace
2. [ ] Définir `IWorkspaceClient` avec tous les message types
3. [ ] Enregistrer hub dans `Program.cs`
4. [ ] Propager événements SessionHub → WorkspaceHub
5. [ ] Ajouter endpoint `GET /api/workspaces/{id}/metrics`

**Tâches Frontend**:
1. [ ] Créer `workspaceHub.ts` service
2. [ ] Créer `useWorkspaceRealtime.ts` hook
3. [ ] Intégrer dans WorkspaceCanvas pour updates live
4. [ ] Ajouter indicateurs visuels de status en temps réel
5. [ ] Gérer reconnexion automatique

**Critères de succès**:
- [ ] Connexion SignalR établie au chargement de la page
- [ ] Status des sessions mis à jour en temps réel
- [ ] Nouveaux événements apparaissent (prêt pour Phase 4)
- [ ] Indicateur de connexion visible
- [ ] Reconnexion automatique fonctionne

**Dépendances**: Phase 1, Phase 2 (partiel)

---

### Phase 4: Console Panel (Priorité: Moyenne)

**Objectif**: Ajouter la console de logs temps réel.

**Fichiers à créer**:
```
frontend/src/components/workspace/ConsolePanel/
├── index.ts
├── ConsolePanel.tsx
├── ConsolePanel.scss
├── LogEntry.tsx
└── LogFilters.tsx
```

**Tâches**:
1. [ ] Créer `LogEntry.tsx` avec formatage par niveau
2. [ ] Créer `LogFilters.tsx` pour filtres niveau/session
3. [ ] Créer `ConsolePanel.tsx` avec scroll, recherche, export
4. [ ] Intégrer dans WorkspaceLiveView (bottom)
5. [ ] Connecter aux événements SignalR
6. [ ] Implémenter collapse/expand
7. [ ] Ajouter limite 500 logs avec warning

**Critères de succès**:
- [ ] Console affiche les événements en temps réel
- [ ] Filtres par niveau (debug/info/warn/error) fonctionnent
- [ ] Recherche textuelle fonctionne
- [ ] Export en fichier texte fonctionne
- [ ] Auto-scroll avec toggle

**Dépendances**: Phase 3

---

### Phase 5: Edges & Data Flow (Priorité: Basse)

**Objectif**: Améliorer la visualisation des connexions.

**Fichiers à créer**:
```
frontend/src/components/workspace/WorkspaceCanvas/edges/
├── PromotionEdge.tsx
├── MessageEdge.tsx
└── edges.scss
```

**Tâches**:
1. [ ] Créer `PromotionEdge.tsx` (vert, pointillé, animé)
2. [ ] Créer `MessageEdge.tsx` (violet, ondulé, animé)
3. [ ] Améliorer `DataFlowEdge.tsx` avec labels
4. [ ] Détecter et afficher les messages en cours de transmission
5. [ ] Ajouter légende des types d'edges

**Critères de succès**:
- [ ] Chaque type d'edge est visuellement distinct
- [ ] Animations pour edges actifs
- [ ] Labels sur les edges importants
- [ ] Légende visible

**Dépendances**: Phase 1

---

### Phase 6: Polish & Views (Priorité: Basse)

**Objectif**: Finaliser l'UX et ajouter les vues alternatives.

**Tâches**:
1. [ ] Ajouter sélecteur de vue (Live/Design/Topology)
2. [ ] Implémenter vue Topology (zoom out, tous workspaces)
3. [ ] Améliorer MiniMap avec couleurs
4. [ ] Ajouter keyboard shortcuts (Escape=deselect, etc.)
5. [ ] Persister préférences utilisateur (localStorage)
6. [ ] Optimiser performance pour grands graphes
7. [ ] Ajouter animations de transition

**Critères de succès**:
- [ ] Toutes les vues fonctionnent
- [ ] Shortcuts documentés
- [ ] Performance acceptable avec 50+ sessions
- [ ] Préférences persistées

**Dépendances**: Phases 1-5

---

## Diagramme de Dépendances

```
Phase 1 (Canvas Foundation)
    │
    ├──────────────────────┐
    │                      │
    ▼                      ▼
Phase 2 (Panels)     Phase 5 (Edges)
    │                      │
    ▼                      │
Phase 3 (Real-time)        │
    │                      │
    ▼                      │
Phase 4 (Console)          │
    │                      │
    └──────────┬───────────┘
               │
               ▼
         Phase 6 (Polish)
```

---

## Estimation par Phase

| Phase | Effort | Risques |
|-------|--------|---------|
| Phase 1 | Moyen | Faible - React Flow déjà utilisé |
| Phase 2 | Moyen | Faible - Composants UI standards |
| Phase 3 | Élevé | Moyen - Intégration backend/frontend |
| Phase 4 | Faible | Faible - Pattern établi |
| Phase 5 | Faible | Faible - Amélioration incrémentale |
| Phase 6 | Moyen | Faible - Finitions |

---

## Métriques de Succès du Projet

### Objectifs Fonctionnels
- [ ] Visualiser l'état d'un workspace en un coup d'œil
- [ ] Naviguer entre les niveaux (workspace → session → blocks)
- [ ] Voir les événements en temps réel
- [ ] Comprendre les relations entre workspaces

### Objectifs Techniques
- [ ] Temps de chargement initial < 2s
- [ ] Mise à jour temps réel < 500ms
- [ ] Support de 50+ sessions sans lag
- [ ] Tests couvrent 70%+ du code

### Objectifs UX
- [ ] Utilisateur trouve les informations en < 3 clicks
- [ ] Apprentissage de l'interface < 5 minutes
- [ ] Ressemble à un outil professionnel (Vivado, IDE)

---

## Prochaines Étapes Immédiates

1. **Valider ce document** avec les stakeholders
2. **Répondre aux questions ouvertes** dans DESIGN-CHOICES.md
3. **Commencer Phase 1** avec la création de SessionNode.tsx
4. **Établir les tests** dès le premier composant

---

## Annexe: Commandes utiles

```bash
# Installer les dépendances
cd frontend && npm install dagre @types/dagre

# Lancer les tests
cd frontend && npm test -- --run

# Démarrer le dev server
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# Vérifier les types
cd frontend && npm run typecheck

# Build de validation
cd frontend && npm run build
```
