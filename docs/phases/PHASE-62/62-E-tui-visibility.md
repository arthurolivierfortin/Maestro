# 62-E : TUI — Visibilite des permissions + FocusProvider

**Statut** : A FAIRE
**Effort** : 1-1.5 jours
**Prerequis** : 62-D COMPLETE (API disponible pour que le TUI puisse consommer les donnees)

---

## Decision architecturale : Ink + FocusProvider (DECIDEE 2026-03-18)

### Contexte

Le developpement du TUI avec Ink est difficile pour les agents (et les humains) a cause de limitations fondamentales :
- **Pas de focus management** : tous les `useInput` hooks tirent simultanement (le scroll bug)
- **Pas d'event propagation** : pas de `stopPropagation()`, pas de systeme de layers
- **Artefacts de rendu** : trailing spaces manuels pour compenser le renderer
- **Testabilite** : vitest ≠ terminal reel, faux sentiment de confiance

### Alternatives evaluees

| Option | Verdict | Raison |
|--------|---------|--------|
| **App React web locale** (browser) | Rejetee | Brise l'aspect terminal — on veut `maestro code` → affichage dans le terminal |
| **Electron / Tauri** | Rejetee | Over-engineering, brise le `npm install -g`, build pipeline lourd |
| **Textual (Python) / Bubbletea (Go)** | Rejetee | Changement de langage, perte des 17K lignes TypeScript existantes |
| **Reduire le scope du TUI** | Rejetee | Le scope actuel (6 pages) est necessaire pour la V1 |
| **Ink + FocusProvider** | **CHOISIE** | Resout 80% des problemes avec ~200-300 lignes, adoption incrementale |

### Pourquoi rester sur Ink

L'aspect terminal est une valeur fondamentale du projet — `maestro code` s'affiche dans le terminal, comme Claude Code. Le probleme n'est pas Ink en soi mais l'absence de primitives de focus. On les construit.

### Ce qui sera construit

Un `FocusProvider` (React Context) avec des layers de priorite :

```
Layer priority (higher blocks lower) :
  1. modal   — quit confirm, help overlay, provider setup
  2. input   — TaskInputBar (quand focused)
  3. panel   — scroll, tree navigation, panel-specific keys
  4. page    — hotkeys h/a/s/f/c/m, navigation globale
```

#### API

```typescript
// Provider (wrap App)
<FocusProvider>
  <App />
</FocusProvider>

// Hook (remplace useInput partout)
useManagedInput('panel', (input, key) => {
  // Ne fire QUE si aucun layer superieur n'est actif
  if (key.upArrow) scrollUp();
});

// Claim/release (quand un composant prend le focus)
const { claim, release } = useFocusLayer();
// TaskInputBar:
useEffect(() => {
  if (focused) claim('input');
  else release('input');
}, [focused]);
// HelpOverlay:
useEffect(() => { claim('modal'); return () => release('modal'); }, []);
```

#### Regles

- **Un seul layer actif a la fois** — le plus haut dans la hierarchie
- `claim('modal')` bloque automatiquement input, panel, page
- `claim('input')` bloque panel et page mais pas modal
- `release()` reactive le layer en dessous
- **Adoption incrementale** : chaque `useInput` existant est remplace un par un par `useManagedInput`
- **Aucun breaking change** : les composants non-migres continuent de fonctionner (mais sans gating)

#### Fichiers a creer

- `packages/maestro-code/hooks/useFocusProvider.ts` — Context + Provider
- `packages/maestro-code/hooks/useManagedInput.ts` — Hook wrapper

#### Migration

Remplacer chaque `useInput(handler)` par `useManagedInput(layer, handler)` dans :
1. **App.ts** — page-level hotkeys → `useManagedInput('page', ...)`
2. **TaskInputBar** — text input → `useManagedInput('input', ...)` + claim/release
3. **HelpOverlay** — modal → `useManagedInput('modal', ...)` + claim on mount
4. **SessionMonitor** — panel navigation → `useManagedInput('panel', ...)`
5. **AgentScreen, SpacesScreen, etc.** — panel keys → `useManagedInput('panel', ...)`

---

## Visibilite des permissions : diff visuel parent/enfant

### Principe

Un panel `PermissionsPanel` reutilisable qui affiche la liste complete des tools du parent avec les tools disponibles en blanc et les tools filtres en gris. L'utilisateur voit instantanement ce qui est disponible et ce qui a ete retire.

```
Legende :
  ○ blanc   = disponible dans cette session
  · gris    = existe dans le parent mais filtre pour cette session
  ✗ rouge   = explicitement deny par une BlockPermission rule
```

### Composant : PermissionsPanel (~50-80 lignes TSX)

**Props** :
- `effectiveBlocks: string[]` — AllowedBlocks effectifs de la session (apres intersection)
- `parentBlocks: string[]` — AllowedBlocks du parent (le ceiling)
- `blockRules?: BlockPermission[]` — regles explicites (deny/allow)

**Logique** :
1. Affiche tous les blocks du parent
2. Ceux dans `effectiveBlocks` → `○` blanc
3. Ceux dans `parentBlocks` mais PAS dans `effectiveBlocks` → `·` gris
4. Ceux avec un rule `Deny` → `✗` rouge avec la raison

---

### Sketch 1 : Session Detail (SessionMonitor)

Le panel Permissions s'ajoute a droite du panel Execution existant :

```
┌─ SESSION: agent-creator (c-789) ─────────────────────────────────────────────┐
│                                                                               │
│ ┌─ EXECUTION ─────────────────────────┐ ┌─◆ PERMISSIONS ─────────────────┐   │
│ │ [✓] file-read contract.json         │ │                                │   │
│ │ [✓] file-write agent.block.json     │ │ Parent: Dev Session (s-456)    │   │
│ │ [→] file-write system-prompt.md...  │ │                                │   │
│ │                                     │ │ ○ file-read                    │   │
│ │ Iteration: 3/12  Cost: $0.04       │ │ ○ file-write                   │   │
│ │                                     │ │ ○ step-complete                │   │
│ └─────────────────────────────────────┘ │ · file-edit                    │   │
│                                         │ · shell-execute                │   │
│                                         │ · directory-list               │   │
│                                         │ · json-validator               │   │
│                                         │                                │   │
│                                         │ Rules:                         │   │
│                                         │ ✗ shell-execute (security)     │   │
│                                         └────────────────────────────────┘   │
│                                                                               │
│ ● connected  12ms  10:42  $0.52          [Tab] panels  [Esc] back             │
└───────────────────────────────────────────────────────────────────────────────┘
```

L'utilisateur voit en un coup d'oeil :
- L'agent a acces a `file-read`, `file-write`, `step-complete` (blanc)
- Le parent avait aussi `file-edit`, `shell-execute`, `directory-list`, `json-validator` mais ils sont filtres (gris)
- `shell-execute` est explicitement deny avec une raison (rouge)

---

### Sketch 2 : Workspace Detail

Le panel droit montre les permissions du workspace (le ceiling) :

```
┌─ WORKSPACE: Cantante Dev (ws-123) ───────────────────────────────────────────┐
│                                                                               │
│ ┌─ SESSIONS ──────────────────────────┐ ┌─ PERMISSIONS (ceiling) ────────┐   │
│ │ ● Dev Session         $0.52  [+2]   │ │                                │   │
│ │   ├─ agent-creator    $0.12  Done   │ │ ○ file-read                    │   │
│ │   └─ test-designer    $0.08  Done   │ │ ○ file-write                   │   │
│ │ ● Foundry Session     $0.31         │ │ ○ file-edit                    │   │
│ │                                     │ │ ○ shell-execute                │   │
│ │                                     │ │ ○ directory-list               │   │
│ │                                     │ │ ○ step-complete                │   │
│ │                                     │ │ ○ json-validator               │   │
│ │                                     │ │                                │   │
│ │                                     │ │ AllowedBlocks: *               │   │
│ └─────────────────────────────────────┘ └────────────────────────────────┘   │
│                                                                               │
│ ● connected  12ms  10:42  $0.52          [Tab] panels  [Enter] select         │
└───────────────────────────────────────────────────────────────────────────────┘
```

Tout en blanc — le workspace est le ceiling, rien n'est filtre.

---

### Sketch 3 : Block Detail (Catalog)

Le panel INFO existant est enrichi avec un panel TOOLS REQUIS :

```
┌─ BLOCK: agent-creator ───────────────────────────────────────────────────────┐
│                                                                               │
│ ┌─ INFO ──────────────────────────────┐ ┌─ TOOLS REQUIS ─────────────────┐   │
│ │ Type: agent  Atomic: no             │ │                                │   │
│ │ Version: 1.0.0                      │ │ Ce block utilise :             │   │
│ │ Contract: agent-creator             │ │ ○ file-read                    │   │
│ │ Capabilities:                       │ │ ○ file-write                   │   │
│ │   [structured-output] [tool-calling]│ │ ○ step-complete                │   │
│ │                                     │ │                                │   │
│ │ Model: claude-sonnet-4-6            │ │ La session doit autoriser      │   │
│ │ Max iterations: 12                  │ │ ces tools pour que ce block    │   │
│ │                                     │ │ fonctionne correctement.       │   │
│ └─────────────────────────────────────┘ └────────────────────────────────┘   │
│                                                                               │
│ ┌─ FITNESS ───────────────┐ ┌─ SESSIONS ─────────────────────────────────┐   │
│ │ Score: 68% ██████░░░░   │ │ Used in 3 sessions                        │   │
│ │ Perf:  75% ███████░░    │ │ ● Dev Session        $0.12                 │   │
│ │ Spec:  62% ██████░░░    │ │ ● Foundry Session    $0.08                 │   │
│ └─────────────────────────┘ └────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

Pour le block detail, pas de diff parent/enfant — on montre juste les tools que le block utilise. L'information "est-ce que ma session autorise ces tools" est dans le SessionMonitor.

---

### Le diff visuel en action

Quand l'utilisateur drill-down dans l'arbre, le diff est immediat :

```
Parent (Dev Session):       →    Child (agent-creator):
┌─ PERMISSIONS ────────┐        ┌─ PERMISSIONS ────────┐
│ ○ file-read          │        │ ○ file-read          │  ← blanc
│ ○ file-write         │        │ ○ file-write         │  ← blanc
│ ○ file-edit          │        │ · file-edit          │  ← gris (filtre)
│ ○ shell-execute      │        │ · shell-execute      │  ← gris (filtre)
│ ○ directory-list     │        │ · directory-list     │  ← gris (filtre)
│ ○ step-complete      │        │ ○ step-complete      │  ← blanc
│ ○ json-validator     │        │ · json-validator     │  ← gris (filtre)
│                      │        │                      │
│ AllowedBlocks: *     │        │ Rules:               │
│                      │        │ ✗ shell-execute      │  ← rouge
└──────────────────────┘        └──────────────────────┘
```

La question "pourquoi cet agent ne peut pas faire X ?" se repond visuellement — X est en gris ou en rouge.

---

### Interaction : Lecture seule pour V1

- Affichage des permissions effectives (apres intersection)
- Affichage des couts par niveau
- Pas de modification depuis le TUI en V1 (utiliser CLI : `maestro session restrict`)

---

## Verification 62-E

- [ ] FocusProvider implemente avec 4 layers (modal > input > panel > page)
- [ ] useManagedInput hook fonctionne et gate les events
- [ ] App.ts migre vers useManagedInput('page', ...)
- [ ] TaskInputBar migre (claim/release 'input')
- [ ] HelpOverlay migre (claim 'modal')
- [ ] Le scroll bug est resolu (taper dans le panel ne pollue pas le TaskInputBar)
- [ ] PermissionsPanel composant cree (~50-80 lignes)
- [ ] SessionMonitor : panel Permissions avec diff parent/enfant
- [ ] WorkspaceDetail : panel Permissions (ceiling)
- [ ] BlockDetail : panel Tools Requis
- [ ] Tests unitaires pour FocusProvider
- [ ] real-demo-check.cjs passe
- [ ] test:visual passe
