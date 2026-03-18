# Phase 63 : TUI Chat-First — Refonte navigation + Permissions visuelles

**Statut** : A FAIRE
**Prerequis** : Phase 62 COMPLETE (container isolation, API permissions, ToolSchemaGenerator)
**Objectif** : Transformer le TUI multi-pages en paradigme chat-first (comme Claude Code). La page Agent devient l'ecran principal. Les autres pages deviennent des widgets inline accessibles via slash commands. Le FocusProvider resout le scroll bug. Le PermissionsPanel rend visible le modele container. Toutes les fonctionnalites existantes sont preservees — seule la facon d'y acceder change.
**Duree estimee** : 3-4 jours

---

## Contexte — Pourquoi cette refonte

### Le probleme actuel

Le TUI a 6 pages (Home, Agent, Spaces, Foundry, Catalog, Models) avec des hotkeys de navigation (`h/a/s/f/c/m`). C'est un paradigme d'app desktop, pas un paradigme de coding assistant :

- **Focus management casse** : tous les `useInput` hooks tirent simultanement → scroll bug
- **Confusion utilisateur** : "sur quelle page je suis ?" "ou est-ce que je vois les modeles ?"
- **Complexite code** : page registry, NavBar, detail views, panel cycling
- **Incoherent avec l'identite** : maestro-code devrait ressembler a Claude Code (chat-first), pas a une app GUI

### Le paradigme cible

```
┌─ maestro code ───────────────────────────────────────────┐
│                                                           │
│  Agent: Je vais creer un workspace pour Cantante.         │
│  Voici les sessions actives :                             │
│                                                           │
│  ┌─ Sessions ────────────────────────────────────────┐   │
│  │ ● Dev Session         $0.52  [+2]                  │   │
│  │   ├─ agent-creator    $0.12  Done                  │   │
│  │   └─ test-designer    $0.08  Done                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  Agent: Le workspace est pret. Que voulez-vous faire ?   │
│                                                           │
│  > /models                                                │
│                                                           │
│  ┌─ Models ──────────────────────────────────────────┐   │
│  │ ● claude-sonnet-4-6   Anthropic   $3/$15 MTok     │   │
│  │ ● claude-haiku-4-5    Anthropic   $0.25/$1.25     │   │
│  │ ○ llama-3-70b         Local       free             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│ ─────────────────────────────────────────────────────── │
│ > _                                                       │
└───────────────────────────────────────────────────────────┘
```

L'utilisateur reste TOUJOURS dans le chat. Les slash commands injectent des widgets interactifs. L'agent peut aussi injecter ces widgets quand c'est pertinent.

---

## Decisions architecturales

### 1. La page Agent est l'ecran principal et unique

Plus de NavBar, plus de page switching. Le chat occupe tout l'ecran. Les autres "pages" deviennent des widgets inline.

### 2. Slash commands pour acceder aux fonctionnalites

| Ancien acces | Nouveau acces |
|---|---|
| Touche `h` → Home | `/status` (widget inline avec system health + sessions) |
| Touche `s` → Spaces | `/spaces` (widget inline avec sessions/workspaces/repos) |
| Touche `f` → Foundry | `/foundry` (widget inline avec my blocks) |
| Touche `c` → Catalog | `/catalog` (widget inline avec block catalog) |
| Touche `m` → Models | `/models` (widget inline avec model status) |
| Enter sur session → SessionMonitor | `/session <id>` (widget inline avec monitoring) |

### 3. Widgets interactifs dans le chat

Les widgets sont des composants React rendus inline dans le ConversationLog. Ils peuvent etre :
- **Statiques** : un snapshot de donnees (sessions list, model status)
- **Interactifs** : navigation avec j/k, expand avec Enter (session detail, block detail)
- **Live** : mis a jour en temps reel (session monitoring, cost tracking)

### 4. L'agent peut injecter des widgets

Quand l'agent maestro-assistant repond, il peut inclure des widgets dans sa reponse :
- "Voici vos sessions actives :" + widget sessions
- "Le modele est configure :" + widget model status
- "Le block-forge a produit :" + widget block detail

### 5. FocusProvider resout le scroll bug

Un seul widget interactif a la fois a le focus. Le FocusProvider avec layers de priorite (modal > widget > input > page) garantit que les events clavier vont au bon endroit.

### 6. PermissionsPanel dans les widgets session/workspace

Le diff visuel parent/enfant (○ blanc / · gris / ✗ rouge) est un sous-composant des widgets session et workspace.

---

## Inventaire des fonctionnalites a preserver

Chaque fonctionnalite du TUI actuel DOIT etre accessible dans le nouveau paradigme. Rien n'est supprime — seulement le moyen d'acces change.

### Page Home → `/status`
- System health (backend + LLM)
- Active sessions list (scrollable, 10 per page)
- Session selection + open
- Quick actions

### Page Agent → Ecran principal (toujours visible)
- Conversation log (auto-scroll, j/k manual scroll)
- Agent status (idle/working/completed/error)
- Repository path, session ID, model name
- TaskInputBar avec slash commands
- All existing slash commands preserves

### Page Spaces → `/spaces`
- 3 tabs : Repos, Workspaces, Sessions
- Session list avec status, cost, duration, child badge
- Session expanded detail (ID, children, fitness, phases, workflow, entry points)
- Workspace list
- Repo list
- Filter running/all
- Delete session
- Open session detail

### Page Foundry → `/foundry`
- Block list avec type badge
- Block expanded detail (description, metadata)
- Open block detail

### Page Catalog → `/catalog`
- Type filter (All/Workflows/Agents/Tools)
- Block list avec fitness, capabilities
- Block expanded detail
- Contract test execution (T key)
- Open block detail

### Page Models → `/models`
- Model health status
- Usage metrics (requests, tokens, latency)
- Queue status
- Model list avec provider badge
- Playground launch (P key)

### Detail: Session Monitor → `/session <id>`
- Mode-aware panel layout (descriptor/execution/idle)
- PhaseWorkflow, WorkflowTree, AgentPanel, ExecutionLog
- LLMActivity, Filesystem, Variables, Metrics
- Panel cycling (Tab), zoom (z)
- Cost tracking
- **NEW: PermissionsPanel** (diff visuel parent/enfant)

### Detail: Block Detail → `/block <id>`
- INFO panel (type, version, capabilities, contract)
- FITNESS panel (score, dimensions)
- SESSIONS panel (linked sessions)
- **NEW: TOOLS REQUIS panel** (tools utilises par le block)

### Detail: Workspace Detail → `/workspace <id>`
- Sessions list
- Settings (max concurrent, auto-promote, min fitness)
- **NEW: Permissions panel** (ceiling)

### Detail: Model Detail → `/model <id>`
- Health, usage, performance panels
- Playground

### Detail: Repo Detail → `/repo <id>`
- Info (.maestro stats)
- Sessions list

### System-wide
- StatusBar (connection, shortcuts, time, daily cost)
- HelpOverlay (? key)
- Quit confirmation
- Provider setup screen
- Assistant selector
- Demo mode

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 63-A | FocusProvider + useManagedInput | 0.5 jour |
| 63-B | Widgets inline dans le ConversationLog | 1-1.5 jours |
| 63-C | Migration slash commands (6 pages → widgets) | 1-1.5 jours |
| 63-D | PermissionsPanel + integration dans widgets session/workspace/block | 0.5 jour |
| 63-T | Tests + validation (real-demo-check, test:visual) | 0.5 jour |

---

## 63-A : FocusProvider + useManagedInput

### Creer

- `packages/maestro-code/hooks/useFocusProvider.ts` — Context + Provider
- `packages/maestro-code/hooks/useManagedInput.ts` — Hook wrapper

### Layers de priorite

```
1. modal   — quit confirm, help overlay, provider setup
2. widget  — widget interactif dans le chat (session monitor, catalog)
3. input   — TaskInputBar (quand focused)
4. page    — scroll du chat
```

### Migration

Remplacer chaque `useInput(handler)` par `useManagedInput(layer, handler)`. Adoption incrementale.

---

## 63-B : Widgets inline dans le ConversationLog

### Architecture

Un widget est un composant React rendu dans le flow de conversation :

```typescript
interface ChatWidget {
  type: 'sessions' | 'models' | 'catalog' | 'foundry' | 'session-detail' | 'block-detail' | ...;
  props: Record<string, any>;
  interactive: boolean;  // si true, peut recevoir le focus via FocusProvider
}
```

Le ConversationLog rend les widgets entre les messages :

```typescript
// Dans ConversationLog
{entries.map(entry => {
  if (entry.type === 'widget') {
    return h(InlineWidget, { widget: entry.widget, focused: isFocused(entry.id) });
  }
  return h(MessageLine, { ...entry });
})}
```

### Widgets a creer

Chaque ancien ecran devient un widget reutilisable :

| Widget | Source | Interactif |
|--------|--------|------------|
| `SessionsWidget` | SpacesScreen sessions tab | Oui (j/k, Enter, expand) |
| `WorkspacesWidget` | SpacesScreen workspaces tab | Oui |
| `ReposWidget` | SpacesScreen repos tab | Oui |
| `CatalogWidget` | CatalogScreen | Oui (filter, expand, T test) |
| `FoundryWidget` | FoundryScreen | Oui (expand) |
| `ModelsWidget` | ModelsScreen | Oui (P playground) |
| `StatusWidget` | HomeScreen | Non (snapshot) |
| `SessionMonitorWidget` | SessionMonitor | Oui (full monitor) |
| `BlockDetailWidget` | BlockDetail | Oui |
| `ModelDetailWidget` | ModelDetail | Oui |
| `PermissionsWidget` | Nouveau (Phase 62) | Non (lecture seule V1) |

---

## 63-C : Migration slash commands

### Nouveaux slash commands

```
/status              — Injecte StatusWidget (system health + sessions)
/spaces              — Injecte SessionsWidget (default tab)
/spaces repos        — Injecte ReposWidget
/spaces workspaces   — Injecte WorkspacesWidget
/foundry             — Injecte FoundryWidget
/catalog             — Injecte CatalogWidget
/catalog agents      — Filtre agents
/catalog tools       — Filtre tools
/models              — Injecte ModelsWidget
/session <id>        — Injecte SessionMonitorWidget
/block <id>          — Injecte BlockDetailWidget
/model <id>          — Injecte ModelDetailWidget
/workspace <id>      — Injecte WorkspaceDetailWidget
/repo <id>           — Injecte RepoDetailWidget
/permissions <id>    — Injecte PermissionsWidget pour une session
```

### Suppression

- NavBar : supprime (plus de pages)
- Page registry : simplifie (1 seul ecran)
- Hotkeys h/a/s/f/c/m : supprimes (remplaces par slash commands)
- Detail view routing dans App.ts : simplifie

### Conservation

- StatusBar : reste (connection, shortcuts, time, cost)
- HelpOverlay : reste (? key, contenu mis a jour)
- TaskInputBar : reste (meme position, meme comportement)
- Quit confirmation : reste
- Provider setup : reste
- Assistant selector : reste
- Toutes les interactions dans les widgets : preservees (j/k, Enter, Tab, expand, etc.)

---

## 63-D : PermissionsPanel + integration

### PermissionsPanel (~50-80 lignes TSX)

```
Props:
  effectiveBlocks: string[]
  parentBlocks: string[]
  blockRules?: BlockPermission[]

Rendu:
  ○ file-read          ← blanc (disponible)
  ○ file-write         ← blanc (disponible)
  · file-edit          ← gris (filtre par le parent)
  ✗ shell-execute      ← rouge (deny explicite + raison)
```

### Integration

- `SessionMonitorWidget` : panel Permissions a droite
- `WorkspaceDetailWidget` : panel Permissions (ceiling)
- `BlockDetailWidget` : panel Tools Requis
- `/permissions <id>` : widget standalone

---

## Definition of Done

- [ ] FocusProvider fonctionne avec 4 layers
- [ ] useManagedInput remplace tous les useInput
- [ ] Le scroll bug est resolu
- [ ] La page Agent est l'ecran principal et unique
- [ ] Plus de NavBar ni de page switching
- [ ] 6 slash commands remplacent les 6 pages (/status, /spaces, /foundry, /catalog, /models, /session)
- [ ] Widgets interactifs fonctionnent dans le chat (j/k, Enter, expand, etc.)
- [ ] TOUTES les fonctionnalites de l'inventaire sont accessibles
- [ ] PermissionsPanel avec diff visuel (blanc/gris/rouge)
- [ ] SessionMonitor a le panel Permissions
- [ ] WorkspaceDetail a le panel Permissions (ceiling)
- [ ] BlockDetail a le panel Tools Requis
- [ ] StatusBar reste et fonctionne
- [ ] HelpOverlay mis a jour avec les nouvelles commandes
- [ ] real-demo-check.cjs passe
- [ ] test:visual passe
- [ ] `npx tsc --noEmit` : 0 erreurs

### NOT in scope
- Modification des permissions depuis le TUI (lecture seule V1, CLI pour modifier)
- Agent qui injecte des widgets automatiquement (Phase suivante — maestro-assistant)
- Nouveaux agents (Phase 64)
- /adapt workflow (Phase 65)
