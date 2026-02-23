# Phase 40-PRE : Maestro Code — L'App Unifiee

**Statut** : En cours
**Prerequis** : Phase 39 COMPLETE (adapt/optimize fonctionnels)
**Objectif** : Transformer `maestro code` d'un task runner mono-ecran en L'application Maestro complete — agent-first, multi-ecran, identite visuelle unique.

---

## Context

Phases 35-39 ont ajoute ~5000 lignes de features. Phase 40 = distribution aux beta testeurs. Avant de distribuer, `maestro code` doit devenir **L'application Maestro** — l'interface complete ou l'utilisateur ET l'agent coexistent.

**Vision Flipper Zero** : On boot dans l'ecran agent (comme le dauphin du Flipper Zero). C'est l'agent Maestro principal — on peut lui parler directement. Depuis la, on accede a tous les panels. Quand l'agent travaille, il "emmene" visuellement l'utilisateur dans les memes ecrans. Le pattern est reutilisable pour Cantante (Jarvis navigue l'app musique).

**Strategie de partage** : On ne migre PAS depuis maestro-monitor. On ne brise rien. A la place :
- Les composants reutilisables du monitor vont dans `@maestro/tui` (le shared)
- Le monitor met a jour ses imports pour utiliser `@maestro/tui`
- `maestro code` construit ses propres ecrans en utilisant les composants shared de `@maestro/tui`
- Les deux apps coexistent, consomment le meme design system

---

## Architecture : Agent-in-the-Cockpit

### Concept cle : Deux positions independantes

L'agent et l'utilisateur ont chacun une **position independante** dans l'app. L'agent est une entite qui se deplace entre les ecrans, exactement comme l'utilisateur. Ils peuvent etre sur le meme ecran ou sur des ecrans differents.

```
ETAT DU SYSTEME A TOUT MOMENT :
  userScreen:  Screen    — ou l'utilisateur regarde
  agentScreen: Screen    — ou l'agent travaille
  agentState:  idle | working | waiting-input
```

### Les 3 interactions agent ↔ utilisateur

**1. REJOINDRE l'agent** (`[J]oin` ou `[A]gent`)
L'utilisateur est quelque part (ex: Catalog). Il veut voir ce que l'agent fait.
→ L'ecran change pour afficher ou l'agent travaille (ex: Workspace).
→ Le mini-panel overlay de l'agent est visible.

**2. APPELER l'agent**
L'utilisateur est quelque part (ex: Catalog). Il veut l'aide de l'agent ici.
→ Le mini-panel agent apparait EN OVERLAY dans l'ecran courant.
→ L'agent "arrive" dans le Catalog pour assister.

**3. QUITTER la vue de l'agent** (`[Esc]`)
L'utilisateur est avec l'agent. Il veut naviguer librement.
→ L'ecran revient a la navigation normale.
→ L'agent continue de travailler en arriere-plan.
→ La StatusBar montre un resume de l'activite agent.

### Le mini-panel agent (overlay)

Quand l'utilisateur est sur le MEME ecran que l'agent, un petit panel flottant apparait.
Ce panel n'existe PAS quand l'utilisateur est seul sur un ecran.

```
┌─────────────────────────────────────────────────────────┐
│  WORKSPACE: my-project                                   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Sessions (3)    Blocks (12)    Files (24)        │   │
│  │  ...                                              │   │
│  │                                                   │   │
│  │                     ┌─────────────────────────┐   │   │
│  │                     │ ● Agent working...      │   │   │
│  │                     │ Node: implement         │   │   │
│  │                     │ Files: 2 modified       │   │   │
│  │                     │ [Esc]detach [Enter]focus │   │   │
│  │                     └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  [J]oin agent  [C]atalog  [S]essions  [M]odels           │
└─────────────────────────────────────────────────────────┘
```

### Scenarios complets

**Scenario A : L'agent travaille, l'utilisateur observe**
```
1. Utilisateur donne une tache → agent commence (agentState = working)
2. L'agent navigue vers le workspace → agentScreen = workspace
3. L'utilisateur est automatiquement amene sur l'ecran workspace (rejoint l'agent)
4. Le mini-panel overlay montre l'activite en temps reel
5. L'utilisateur voit l'agent travailler dans le meme ecran qu'il utiliserait
```

**Scenario B : L'utilisateur se detache pendant que l'agent travaille**
```
1. L'agent travaille dans le workspace (agentScreen = workspace)
2. L'utilisateur appuie [C] → va dans Catalog (userScreen = catalog)
3. Le Catalog s'affiche normalement, SANS mini-panel (l'agent n'est pas la)
4. La StatusBar montre : "● Agent working in workspace — [J]oin"
5. L'utilisateur appuie [J] → revient au workspace ou l'agent travaille
6. Le mini-panel overlay reapparait
```

**Scenario C : L'utilisateur appelle l'agent**
```
1. L'utilisateur est dans le Catalog (userScreen = catalog)
2. L'agent est idle (agentScreen = agent-home, agentState = idle)
3. L'utilisateur appelle l'agent (raccourci ou tape du texte)
4. Le mini-panel agent apparait dans le Catalog
5. L'utilisateur peut donner une instruction contextuelle
   ("Trouve-moi un bloc de validation JSON")
6. L'agent travaille DANS le Catalog — le mini-panel montre la progression
```

**Scenario D : L'agent navigue seul**
```
1. L'agent travaille dans le workspace
2. L'agent a besoin d'un bloc → il navigue vers le Catalog
3. agentScreen change : workspace → catalog
4. Si l'utilisateur est "joint" a l'agent, son ecran change aussi
5. Si l'utilisateur est detache, rien ne change pour lui
   (la StatusBar update : "● Agent browsing catalog")
```

### Schema d'etat

```typescript
// Positions independantes
const [userScreen, setUserScreen] = useState<Screen>({ type: 'agent-home' });
const [agentScreen, setAgentScreen] = useState<Screen>({ type: 'agent-home' });

// Est-ce que l'utilisateur "suit" l'agent ?
const [followingAgent, setFollowingAgent] = useState<boolean>(true);

// Quand l'agent navigue ET que l'utilisateur le suit :
const onAgentNavigate = (screen: Screen) => {
  setAgentScreen(screen);
  if (followingAgent) {
    setUserScreen(screen); // l'utilisateur est emmene
  }
};

// Join = suivre l'agent
const joinAgent = () => {
  setFollowingAgent(true);
  setUserScreen(agentScreen); // teleporte vers l'agent
};

// Detach = naviguer librement
const detachFromAgent = () => {
  setFollowingAgent(false);
};

// L'agent est-il sur le meme ecran que l'utilisateur ?
const agentIsHere = screenEquals(userScreen, agentScreen);
// → si oui, afficher le mini-panel overlay
```

### Principe fondamental

**L'agent est une entite qui se deplace dans l'app.** Il utilise les MEMES ecrans que l'utilisateur. Quand l'utilisateur le rejoint, il voit l'agent travailler dans l'ecran. Quand il se detache, l'agent continue en arriere-plan. C'est le pattern "AI-in-the-cockpit" — reutilisable pour Cantante (Jarvis navigue l'app musique) et toute app Maestro.

---

## Strategie : Shared Components dans @maestro/tui

### Ce qui bouge vers `@maestro/tui`

**Composants a promouvoir dans @maestro/tui/components/** :
- `Panel.ts` — panel avec bordures, scrollbars, focus state (~200L)
- `Header.ts` — en-tete session (nom, statut, duree) (~150L)
- `NavBar.ts` — barre navigation pages (~100L)
- `StatusBar.ts` — barre statut (connexion, latence, shortcuts) (~120L)

**Hooks a promouvoir dans @maestro/tui/hooks/** :
- `useKeyboard.ts` — legacy + action-based keyboard handling (~80L)
- `useAnimationTick.ts` — animations frame counter (~30L)
- `useSessionData.ts` — polling API pour sessions (~100L)

**Theme a promouvoir dans @maestro/tui/theme/** :
- `theme.ts` du monitor — colors, icons, formatters, helpers (~500L)

### Ce qui reste specifique au monitor
- Les 6 screens (HomeScreen, SpacesScreen, etc.)
- SessionMonitor.ts (850L)
- Les 12+ panels (ExecutionLog, WorkflowTree, etc.)

### Ce qui est cree dans maestro-code
- `AgentScreen.ts` — ecran agent principal (HOME)
- `CatalogBrowser.ts` — ecran catalog
- `SessionBrowser.ts` — ecran sessions
- `ModelsBrowser.ts` — ecran modeles
- Ses propres screens, utilisant les composants shared

### Le monitor met a jour ses imports
```typescript
// AVANT (monitor)
import { Panel } from './Panel.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';

// APRES (monitor)
import { Panel } from '@maestro/tui/components/Panel';
import { useKeyboard } from '@maestro/tui/hooks/useKeyboard';
```

**Rien ne casse.** Le monitor fonctionne pareil, imports shared.

---

## Feature Checklist v1

### MUST HAVE (distribution bloquee sans ca)

| # | Feature | Etat | Action |
|---|---------|------|--------|
| M1 | `maestro init` initialise un projet | OK | Verifier |
| M2 | `maestro code` lance l'app agent-first | BASIQUE | Architecture agent-first |
| M3 | `maestro code --headless` pour CI | OK | Verifier |
| M4 | Health check au demarrage | ABSENT | Check backend+LLM avant prompt |
| M5 | Ecran Agent (HOME) avec conversation | ABSENT | Creer AgentScreen |
| M6 | Navigation vers panels (Catalog, Sessions, Models) | ABSENT | Creer screens shared |
| M7 | Session lifecycle dans l'app | OK | Integrer dans AgentScreen |
| M8 | Agent execution visible (logs, status) | BASIQUE | Ameliorer avec panels shared |
| M9 | Catalog browsing | ABSENT dans code | Creer CatalogBrowser |
| M10 | Block detail view | ABSENT dans code | Creer BlockDetailView |
| M11 | Models listing | ABSENT dans code | Creer ModelsBrowser |
| M12 | Erreurs visibles | OK | Verifier |
| M13 | First-run experience | ABSENT | WelcomeScreen + auto-init |
| M14 | Session cleanup a la sortie | ABSENT | Prompt "Stop session?" sur Ctrl+C |
| M15 | Input history (fleche haut) | ABSENT | Hook useInputHistory |
| M16 | Error recovery (backend down) | ABSENT | Message clair |
| M17 | StatusBar infos utiles | BASIQUE | Modele, agent state, shortcuts |
| M18 | `maestro --version` coherent | A VERIFIER | Sync package.json + brand.ts |
| M19 | Tous les tests passent (138+) | A VERIFIER | Corriger regressions |

### SHOULD HAVE (premiere impression)

| # | Feature | Etat | Action |
|---|---------|------|--------|
| S1 | Agent mascotte/animation (etat visuel) | ABSENT | Indicateur anime dans AgentActivity |
| S2 | Agent navigation (join/call/detach + mini-panel overlay) | ABSENT | Deux positions independantes, overlay contextuel |
| S3 | Identite visuelle Command Center | BASIQUE | Cyan/violet/amber, double borders, splash |
| S4 | Help overlay (?) | ABSENT | Keybindings par contexte |
| S5 | Animations inference | PARTIEL | Activity bars, breathing dots |
| S6 | Shortcut hints contextuels | PARTIEL | StatusBar adaptative par ecran |
| S7 | Sessions list/resume | ABSENT | SessionBrowser |
| S8 | Splash screen | ABSENT | ASCII logo 1.5s |
| S9 | Block documentation viewer | CLI only | Integrer dans BlockDetailView |
| S10 | Metrics display | monitor only | MetricsPanel dans agent screen |

### NICE TO HAVE (beta feedback Phase 40-D)

| # | Feature | Etat |
|---|---------|------|
| N1 | Voice mode reel (audio) | Placeholder |
| N2 | Agent controle le curseur dans les panels | Complexe |
| N3 | Theme customization | Basique |
| N4 | Block creation wizard | Absent |
| N5 | Provider Monitor integre | Outil separe |

---

## Sous-phases

### 40-PRE-C : Bug Fixing & Verification (en premier)
**Effort** : 2-3 jours

1. **Tester chaque commande CLI** et documenter :
   - `maestro init`, `maestro health`, `maestro blocks`, `maestro sessions`
   - `maestro code` (tache reelle), `maestro code --headless --task "..."`
   - `maestro monitor` (Home, session detail)
   - `maestro models`, `maestro adapt --dry-run`, `maestro sandbox list`

2. **Corriger les bugs connus** :
   - `LLMMonitorScreen.ts` : theme refs inexistantes → crash
   - `OutputPanel` : memoire non bornee → FIFO cap 500
   - `InputPrompt` : pas de curseur gauche/droite
   - `BlockDetail` : actions "coming soon" → cacher

3. **Lancer tous les tests** (138+) + backend build

**Verification** : 138+ tests, aucun crash CLI.

---

### 40-PRE-A : Shared Components + Architecture Agent-First (5-7 jours)
**Effort** : 5-7 jours

**Etape 1 : Promouvoir composants dans @maestro/tui** (1-2 jours)

Extraire du monitor vers le shared :
```
packages/tui/
  components/
    Panel.ts           ← depuis maestro-monitor/components/Panel.ts
    Header.ts          ← depuis maestro-monitor/components/Header.ts
    NavBar.ts          ← depuis maestro-monitor/components/NavBar.ts
    StatusBar.ts       ← depuis maestro-monitor/components/StatusBar.ts
  hooks/
    useKeyboard.ts     ← depuis maestro-monitor/hooks/useKeyboard.ts
    useAnimationTick.ts ← depuis maestro-monitor/hooks/useAnimationTick.ts
    useSessionData.ts  ← depuis maestro-monitor/hooks/useSessionData.ts
  theme/
    monitor-theme.ts   ← depuis maestro-monitor/theme.ts (couleurs, icones, helpers)
```

Mettre a jour les imports du monitor pour utiliser `@maestro/tui`.
Verifier que les 4 tests monitor passent toujours.

**Etape 2 : Creer l'architecture Agent-First dans maestro-code** (2-3 jours)

```typescript
// Navigation
type Screen =
  | { type: 'agent' }                          // HOME
  | { type: 'catalog' }                        // Browse blocks
  | { type: 'sessions' }                       // Sessions list
  | { type: 'models' }                         // Modeles
  | { type: 'block-detail', id: string }       // Detail bloc
  | { type: 'session-detail', id: string }     // Detail session
  | { type: 'welcome' }                        // First-run

// Agent state
type AgentState = 'idle' | 'working' | 'navigating' | 'waiting-input';
```

Ecrans a creer dans maestro-code :
```
packages/maestro-code/
  screens/
    AgentScreen.ts       — HOME : conversation + activity panel
    CatalogBrowser.ts    — browse blocks avec Panel, filtrage
    SessionBrowser.ts    — sessions recentes avec Panel
    ModelsBrowser.ts     — modeles disponibles avec Panel
    BlockDetailView.ts   — detail d'un bloc
    WelcomeScreen.ts     — first-run
    HelpOverlay.ts       — aide
  panels/
    AgentActivity.ts     — mascotte + etat + stats agent
  hooks/
    useInputHistory.ts   — historique inputs
    useAgentNavigation.ts — bridge agent events → screen changes
```

**Etape 3 : Rearchitecturer App.ts** (1 jour)
- NavStack avec push/pop
- Navigation clavier : `[C]atalog [S]essions [M]odels [?]help [Esc]back`
- Quand input vide : raccourcis navigation actifs
- Quand l'utilisateur tape → mode Agent

**Etape 4 : useInputHistory + ameliorations** (0.5 jour)
- 50 derniers inputs, Up/Down
- Curseur gauche/droite
- Commandes slash : `/health`, `/blocks`, `/quit`

**Etape 5 : Tests** (1 jour)
- Tests navigation, agent state, regression

**Fichiers a modifier** :
- `packages/maestro-code/App.ts` — rearchitecture complete
- `packages/tui/hooks/index.ts` — exports nouveaux hooks
- `packages/tui/components/index.ts` — exports nouveaux composants
- `packages/maestro-monitor/` — imports vers @maestro/tui (non-breaking)

---

### 40-PRE-B : Identite Visuelle Command Center (2-3 jours)
**Effort** : 2-3 jours

1. Palette : `agentAccent: '#a78bfa'` (violet), `warning: '#f5a623'` (amber)
2. Bordures double-focus : single (gris) → double (cyan) quand focuse
3. Splash screen : ASCII logo 1.5s, `--no-splash` pour CI
4. Agent mascotte : ASCII art 3-4 lignes, etats visuels
5. Animations : breathing dots, activity bars, spinner braille
6. NavBar agent-first : lettres semantiques, badge agent

---

### 40-PRE-D : First-Run Experience (1-2 jours)
**Effort** : 1-2 jours

1. First-run detection (`.maestro/` absent → WelcomeScreen)
2. WelcomeScreen avec mascotte
3. Help overlay contextuel
4. `maestro --version` coherent

---

### 40-PRE-E : Test E2E & Polish Final (1-2 jours)
**Effort** : 1-2 jours

1. Test E2E sur projet propre
2. Polish crashes/glitches
3. Test suite finale
4. Version bump v0.2.0-alpha + checkpoint

---

## Ordre d'execution

```
PRE-C (bugs/verification)
  → PRE-A (shared components + architecture agent-first)
    → PRE-B (identite visuelle)
      → PRE-D (first-run)
        → PRE-E (E2E + polish)
```

**Effort total** : 11-17 jours

---

## Pattern reutilisable : Agent-in-the-Cockpit

### Le pattern

```
Toute app Maestro a :
  1. Un agent principal avec sa propre position (screen)
  2. Des ecrans fonctionnels navigables par l'utilisateur ET l'agent
  3. Un mini-panel overlay qui apparait quand l'agent est present sur un ecran
  4. Join (rejoindre l'agent) / Call (appeler l'agent) / Detach (naviguer seul)
  5. StatusBar avec resume quand l'utilisateur est detache
```

### Applications

```
MAESTRO CODE :
  Agent = Maestro agent system
  Screens = Catalog, Sessions, Models, Workspace
  Join/Call/Detach pour suivre ou detacher l'agent

CANTANTE (Phase 41) :
  Agent = Jarvis (specialise musique)
  Screens = Library, Playlists, Player, Settings
  Meme pattern : Jarvis navigue, l'utilisateur suit ou se detache
```

### Ce qui est generique (extractible dans @maestro/tui)

```typescript
// Hook reutilisable
useAgentCockpit({
  screens: Screen[],
  agent: { screen, state },
  user: { screen, followingAgent },
  onJoin, onDetach, onCall
})

// Composant reutilisable
<AgentOverlay agent={agentState} visible={agentIsHere} />
```

---

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Extraction casse le monitor | Modifier imports seulement, verifier 4 tests |
| Conflits clavier nav vs input | Focus system : raccourcis quand input vide |
| Performance | FIFO cap 500 lignes, lazy rendering |
| Agent navigation complexe | V1 = navigation manuelle, agent nav en S2 |

---

## Fichiers critiques

| Fichier | Role | Phase |
|---------|------|-------|
| `packages/maestro-code/App.ts` | Root — rearchitecture agent-first | PRE-A |
| `packages/tui/components/Panel.ts` | Panel shared (promu depuis monitor) | PRE-A |
| `packages/tui/hooks/useKeyboard.ts` | Keyboard handling shared | PRE-A |
| `packages/tui/theme/colors.ts` | Palette couleurs | PRE-B |
| `packages/maestro-code/screens/AgentScreen.ts` | HOME — ecran agent | PRE-A |
| `packages/maestro-code/panels/AgentActivity.ts` | Mascotte + etat | PRE-B |
