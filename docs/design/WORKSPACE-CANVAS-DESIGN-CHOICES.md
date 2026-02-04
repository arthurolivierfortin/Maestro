# Workspace Canvas - Choix de Conception

## Document des Décisions Architecturales (ADR)

**Version**: 1.0
**Date**: 2026-02-04

---

## ADR-001: Sessions comme unités atomiques sur le canvas

### Contexte
Le canvas doit visualiser l'activité d'un workspace. Deux options principales:
1. Afficher les **blocks individuels** de toutes les sessions
2. Afficher les **sessions** comme unités atomiques avec drill-down

### Décision
**Sessions comme unités atomiques avec drill-down au double-click.**

### Justification
- **Scalabilité visuelle**: Un workspace peut avoir des centaines de blocks, mais rarement plus de 10-20 sessions actives
- **Cohérence sémantique**: Une session est l'unité d'exécution (comme un process), les blocks sont ses composants internes
- **Analogie Vivado**: Les IP Blocks sont des unités complètes, pas leurs sous-circuits
- **Performance**: Moins de nodes = meilleur rendering React Flow
- **UX**: Double-click pour drill-down est un pattern établi (file explorers, IDE)

### Conséquences
- Implémentation de la vue drill-down pour voir les blocks d'une session
- Bouton "Back" pour revenir à la vue workspace
- Métriques agrégées au niveau session (pas block-par-block sur le canvas principal)

### Alternatives rejetées
- **Blocks individuels**: Trop dense visuellement, confusion entre sessions
- **Groupes de blocks**: Complexité d'implémentation sans bénéfice clair

---

## ADR-002: React Flow comme moteur de canvas

### Contexte
Plusieurs options pour le canvas interactif:
1. **React Flow** - Bibliothèque spécialisée node-based
2. **D3.js** - Bibliothèque de visualisation générale
3. **Cytoscape.js** - Bibliothèque de graphes
4. **Custom Canvas** - Implémentation sur <canvas> HTML5

### Décision
**React Flow**

### Justification
- **Déjà utilisé**: Le projet utilise déjà React Flow pour le BlockCanvas (CanvasPage.tsx)
- **React natif**: Nodes sont des composants React, pas de wrapper
- **Features intégrées**: MiniMap, Controls, Background, zoom/pan
- **Personnalisation**: Custom nodes/edges avec full control
- **Performance**: Virtualization intégrée pour grands graphes
- **Communauté**: Bien maintenu, documentation extensive

### Conséquences
- Réutilisation des patterns du BlockCanvas existant
- Cohérence visuelle entre les différents canvas de l'app
- Dépendance maintenue sur une seule bibliothèque de graphes

### Alternatives rejetées
- **D3.js**: Plus bas niveau, plus de code custom nécessaire
- **Cytoscape**: Moins React-friendly, plus orienté analyse de graphes
- **Custom**: Effort énorme pour réinventer React Flow

---

## ADR-003: SignalR pour le temps réel (WorkspaceHub dédié)

### Contexte
Le temps réel peut être géré via:
1. Hub SignalR dédié au workspace
2. Réutilisation du SessionHub existant avec subscription multiple
3. Server-Sent Events (SSE)
4. WebSocket raw

### Décision
**Nouveau WorkspaceHub dédié + réutilisation partielle du SessionHub**

### Justification
- **Séparation des responsabilités**: WorkspaceHub agrège, SessionHub détaille
- **Scalabilité**: Un client workspace s'abonne à un groupe, pas N sessions individuelles
- **Infrastructure existante**: SignalR déjà configuré dans le projet
- **Diffusion efficace**: Un événement workspace broadcast à tous les abonnés
- **Cohérence**: Pattern identique aux autres hubs (ExecutionHub, BlockHub)

### Conséquences
- Nouveau fichier `WorkspaceHub.cs` à créer
- Enregistrement dans `Program.cs`: `app.MapHub<WorkspaceHub>("/hubs/workspace")`
- Le backend doit propager les événements session vers le WorkspaceHub
- Frontend: nouveau service `workspaceHubService.ts`

### Alternatives rejetées
- **SessionHub multiple**: Overhead de N connexions, complexité de sync
- **SSE**: Moins flexible que SignalR pour bidirectionnel
- **WebSocket raw**: Réinventer le wheel SignalR

---

## ADR-004: Layout automatique avec Dagre

### Contexte
Les nodes doivent être positionnés automatiquement. Options:
1. **Dagre** - Algorithme de layout dirigé (DAG)
2. **ELK** - Layout extensible (plus puissant, plus complexe)
3. **Force-directed** (D3-force) - Layout physique
4. **Manual only** - Positions sauvegardées uniquement

### Décision
**Dagre pour le layout initial, positions manuelles persistées optionnellement**

### Justification
- **Direction naturelle**: Flux de données va généralement gauche→droite ou haut→bas
- **Simplicité**: Dagre est léger (~20KB) et bien intégré avec React Flow
- **Prévisibilité**: Contrairement au force-directed, le layout est déterministe
- **Déjà testé**: Utilisé dans de nombreux projets React Flow

### Conséquences
- `npm install dagre @types/dagre`
- Hook `useWorkspaceLayout` qui calcule les positions
- Option future: sauvegarder les positions modifiées par l'utilisateur

### Alternatives rejetées
- **ELK**: Overkill pour notre use case, bundle size important
- **Force-directed**: Instable visuellement, animations non désirées
- **Manual only**: Mauvaise UX pour nouveaux workspaces

---

## ADR-005: Layout 3 colonnes avec console collapsible

### Contexte
L'interface doit montrer: hiérarchie, canvas, inspecteur, et console. Options:
1. **3 colonnes fixes + console en bas**
2. **Panneaux flottants repositionnables**
3. **Tabs pour changer de vue**
4. **Layout responsive qui change selon la taille**

### Décision
**3 colonnes fixes (200px | flex | 300px) + console collapsible en bas (150px)**

### Justification
- **Analogie IDE/Vivado**: Layout familier pour développeurs
- **Information visible**: Pas besoin de switcher entre tabs
- **Predictabilité**: L'utilisateur sait où trouver chaque information
- **Responsive simple**: Console collapse, colonnes latérales peuvent se cacher sur mobile

```
┌─────────┬──────────────────────────┬──────────┐
│ Hierarc │       Canvas             │ Inspect  │
│  200px  │       flex-1             │  300px   │
│         │                          │          │
├─────────┴──────────────────────────┴──────────┤
│ Console (150px, collapsible)                  │
└───────────────────────────────────────────────┘
```

### Conséquences
- Utiliser CSS Grid ou Flexbox pour le layout
- State pour `isConsoleCollapsed`
- Persister les préférences utilisateur (localStorage)

### Alternatives rejetées
- **Panneaux flottants**: Trop complexe, confusion UX
- **Tabs**: Cache information importante, plus de clicks
- **Full responsive**: Pas prioritaire pour outil desktop-first

---

## ADR-006: Types d'edges visuellement distincts

### Contexte
Plusieurs types de relations entre nodes:
- Data flow (données entre sessions)
- Promotion (block promu vers autre workspace)
- Read/Write (permissions cross-workspace)
- Messages (communication en cours)

### Décision
**Chaque type d'edge a un style visuel unique**

| Type | Couleur | Style | Animation |
|------|---------|-------|-----------|
| Data Flow | Bleu (#3b82f6) | Solide | Non |
| Promotion | Vert (#10b981) | Pointillé | Oui |
| Read | Gris (#6b7280) | Tirets | Non |
| Write | Orange (#f59e0b) | Épais | Non |
| Message | Violet (#8b5cf6) | Ondulé | Oui |

### Justification
- **Distinction rapide**: L'utilisateur identifie le type sans lire de labels
- **Conventions**: Vert=succès/promotion, Orange=attention/write, Gris=passif
- **Animation**: Attire l'attention sur les opérations actives

### Conséquences
- Custom edge components pour chaque type
- CSS animations pour edges animés
- Légende optionnelle dans le coin

---

## ADR-007: Console avec limite de logs en mémoire

### Contexte
La console peut recevoir des milliers de logs. Options:
1. Garder tous les logs en mémoire
2. Limiter à N derniers logs
3. Virtualisation (react-window)
4. Pagination

### Décision
**Limite à 500 logs en mémoire, les nouveaux logs remplacent les anciens (FIFO inversé)**

### Justification
- **Mémoire**: 500 logs ~50KB, acceptable
- **Pertinence**: Les logs récents sont les plus utiles
- **Simplicité**: Pas besoin de virtualisation complexe
- **Export**: Possibilité d'exporter avant que les logs soient perdus

### Conséquences
- State `logs` limité avec `slice(0, 500)` après chaque ajout
- Bouton "Export" pour sauvegarder l'historique
- Warning optionnel quand la limite est atteinte

### Alternatives rejetées
- **Tous les logs**: Risque de memory leak
- **Virtualisation**: Complexité pour un gain marginal
- **Pagination**: UX moins fluide pour le monitoring temps réel

---

## ADR-008: État canvas dans le store vs local

### Contexte
L'état du canvas (nodes, edges, sélection) peut être géré:
1. Dans le workspaceStore global (Zustand)
2. Localement dans le composant avec useState/useReducer
3. Mix: données de base globales, état UI local

### Décision
**Mix: données métier dans workspaceStore, état UI du canvas local**

### Justification
```
workspaceStore (global):
  - workspace: Workspace
  - sessions: Session[]
  - topology: WorkspaceTopology

WorkspaceCanvas (local):
  - nodes: Node[] (positions calculées)
  - edges: Edge[]
  - selectedId: string
  - viewMode: 'live' | 'design' | ...
```

- **Séparation claire**: Données API vs état de rendu
- **Performance**: Les changements de position ne trigger pas le store global
- **Réutilisabilité**: Le store reste clean, utilisable ailleurs

### Conséquences
- `useWorkspaceLayout` hook transforme store → nodes/edges
- Sélection peut être syncée via callback ou contexte partagé
- Le store expose les actions CRUD, le canvas gère le rendu

---

## ADR-009: Gestion des workspaces externes/liés

### Contexte
Un workspace peut avoir des relations avec d'autres (promotion, read, write).
Comment les afficher?

### Décision
**Nodes "fantômes" représentant les workspaces externes, avec edges de relation**

### Justification
- **Visibilité des dépendances**: On voit immédiatement les workspaces liés
- **Interaction**: Click pour naviguer vers ce workspace
- **Style différencié**: Background plus clair, icône de lien
- **Pas de surcharge**: Un seul node par workspace externe, pas ses sessions

### Conséquences
- Type de node `ExternalWorkspaceNode`
- Les edges `promotion`/`read`/`write` connectent aux nodes externes
- Navigation cross-workspace au click

---

## ADR-010: Granularité des métriques temps réel

### Contexte
Quelles métriques afficher en temps réel? Options:
1. Métriques détaillées par block
2. Métriques agrégées par session
3. Métriques agrégées par workspace
4. Combinaison avec drill-down

### Décision
**Métriques workspace sur le canvas principal, métriques session dans l'inspecteur, métriques block en drill-down**

### Justification
- **Hiérarchie d'information**: Du plus général au plus spécifique
- **Évite la surcharge**: Trop de chiffres = rien n'est lisible
- **Performance**: Moins de données à transférer/render

### Métriques par niveau
| Niveau | Métriques affichées |
|--------|---------------------|
| Workspace | Sessions actives, Erreurs totales, Latence moyenne |
| Session | Status, Durée, Progress %, Blocks actifs |
| Block (drill-down) | Exécutions, Succès/Échecs, Dernière activité |

### Conséquences
- API endpoint `GET /api/workspaces/{id}/metrics` pour agrégat
- Session metrics dans la réponse session
- Block metrics chargés uniquement en drill-down

---

## Résumé des décisions clés

| # | Décision | Choix |
|---|----------|-------|
| 001 | Unité atomique | Session avec drill-down |
| 002 | Moteur canvas | React Flow |
| 003 | Temps réel | SignalR WorkspaceHub |
| 004 | Auto-layout | Dagre |
| 005 | Layout UI | 3 colonnes + console bottom |
| 006 | Style edges | Couleur/style unique par type |
| 007 | Limite logs | 500 en mémoire |
| 008 | État canvas | Mix store global + local |
| 009 | Workspaces liés | Nodes fantômes externes |
| 010 | Métriques | Hiérarchie workspace→session→block |

---

## Questions ouvertes (à décider plus tard)

1. **Persistance du layout manuel**: Sauvegarder les positions modifiées par l'utilisateur?
   - Option A: localStorage par workspace
   - Option B: API backend
   - Option C: Pas de persistance, toujours auto-layout

2. **Limite de sessions affichées**: Au-delà de X sessions, que faire?
   - Option A: Grouper en clusters
   - Option B: Pagination/scroll
   - Option C: Pas de limite (perf React Flow)

3. **Notifications push**: Alerter l'utilisateur hors du workspace?
   - Option A: Notifications browser
   - Option B: Badge dans la sidebar
   - Option C: Rien, l'utilisateur doit être sur la page

4. **Vue Timeline**: Implémenter une vue historique des sessions?
   - Option A: Timeline horizontale avec sessions passées
   - Option B: Liste simple filtrable
   - Option C: Reporter à une phase ultérieure
