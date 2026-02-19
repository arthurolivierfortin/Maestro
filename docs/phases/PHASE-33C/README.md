# Phase 33-C : @maestro/tui — Design System TUI partage + Monorepo

**Statut** : A faire
**Prerequis** : Phase 33-B COMPLETE (checkpoint.md montre 33-B-A a 33-B-D tous DONE)
**Objectif** : Migrer LLM-Provider dans le repo Maestro, creer un package `@maestro/tui` (design system TUI reutilisable), restructurer en monorepo npm workspaces sous `packages/`. Un fix dans le toolkit = fix partout. La logique metier reste specifique a chaque app.

---

## Vision

**Separation des responsabilites :**

```
@maestro/tui (RENDU — partage, reutilisable, aucune logique metier)
├── Hooks       : useScroll, usePanelFocus, useKeyboard, useTreeNav, useSelectableList
├── Components  : Panel, StatusBar, Header, TabBar, NavBar, DataTable
├── Theme       : palette configurable via createTheme(), icons, tokens, terminal
└── Keybindings : systeme de keybindings + resolver

Apps dans packages/ (LOGIQUE — specifique a chaque app)
├── maestro-monitor   : sessions Maestro, WorkflowTree, PhaseList, useSessionData
├── provider-monitor  : LLM-Provider, MetricsTab, QueueTab, useApiPolling, useLogStream
├── maestro-code      : mode interactif, SessionManager, InkTable, headless
├── maestro-cli       : commandes CLI, output-formatter, shell
└── [future app]      : importe @maestro/tui, ajoute sa logique propre
```

---

## Structure cible du projet

```
C:\Meastro\                                         (root — npm workspaces)
├── package.json                                    workspaces: ["packages/*"]
├── node_modules/                                   hoisted: react, ink, typescript, vitest, ...
├── CLAUDE.md
│
├── packages/                                       TOUT LE TYPESCRIPT/NODE
│   │
│   ├── tui/                                        @maestro/tui — DESIGN SYSTEM PARTAGE
│   │   ├── package.json                            name: "@maestro/tui", exports map
│   │   ├── hooks/
│   │   │   ├── index.ts                            export { useScroll, usePanelFocus, ... }
│   │   │   ├── useScroll.ts                        canonique, bugs corriges
│   │   │   ├── usePanelFocus.ts                    canonique
│   │   │   ├── useKeyboard.ts                      action-based (createActionKeyboardHandler)
│   │   │   ├── useTreeNav.ts                       tree expand/collapse
│   │   │   ├── useSelectableList.ts                j/k selection + scroll windowing
│   │   │   └── useMouse.ts                         mouse handler
│   │   ├── components/
│   │   │   ├── index.ts                            export { Panel, StatusBar, Header, ... }
│   │   │   ├── Panel.ts                            bordered container (title, focus, border)
│   │   │   ├── StatusBar.ts                        bottom status line
│   │   │   ├── Header.ts                           top bar
│   │   │   ├── TabBar.ts                           tab navigation (+ TabDef type)
│   │   │   ├── NavBar.ts                           navigation bar
│   │   │   └── DataTable.ts                        columnar data display
│   │   ├── theme/
│   │   │   ├── index.ts                            export { palette, semantic, icons, ... }
│   │   │   ├── create-theme.ts                     createTheme(overrides) — factory
│   │   │   ├── colors.ts                           defaultPalette, semantic
│   │   │   ├── tokens.ts                           icons, layout constants
│   │   │   ├── brand.ts                            branding par defaut
│   │   │   └── terminal.ts                         setTerminalBg, resetTerminalBg
│   │   ├── keybindings/
│   │   │   ├── keybindings.ts                      default key mappings + loader
│   │   │   └── keybinding-resolver.ts              parseBinding, matchInput, resolveAction
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── session.ts, block.ts, workspace.ts, project.ts
│   │   │   ├── llm.ts, api-client.ts
│   │   │   └── widget.ts, page.ts
│   │   └── utils/
│   │       ├── cli-colors.ts, tree.ts, format.ts
│   │       ├── status.ts, progress.ts
│   │       └── index.ts
│   │
│   ├── maestro-cli/                                @maestro/cli — COMMANDES CLI
│   │   ├── package.json                            deps: { "@maestro/tui": "workspace:*" }
│   │   ├── index.js                                CJS entry point
│   │   ├── cli.ts                                  toutes les commandes (~8000 lignes)
│   │   ├── output-formatter.ts                     formatTable, formatDate, suggestCommand
│   │   └── shell.ts                                REPL shell
│   │
│   ├── maestro-monitor/                            @maestro/monitor — MONITOR SESSIONS MAESTRO
│   │   ├── package.json                            deps: { "@maestro/tui": "workspace:*" }
│   │   ├── tui-monitor.ts                          entry point (startMonitor, DI apiClient)
│   │   ├── App.ts                                  composant racine (navigation, pages)
│   │   ├── theme.ts                                createTheme() avec defaults Maestro
│   │   ├── mock-api-client.ts                      mock pour dev/test
│   │   ├── tsconfig.json
│   │   ├── components/                             composants SPECIFIQUES au monitor Maestro
│   │   │   ├── HomeScreen.ts, SpacesScreen.ts, FoundryScreen.ts
│   │   │   ├── CatalogScreen.ts, ModelsScreen.ts, LLMMonitorScreen.ts
│   │   │   ├── SessionMonitor.ts, WorkflowTree.ts, PhaseList.ts
│   │   │   ├── ExecutionLog.ts, LLMActivity.ts, Artifacts.ts
│   │   │   ├── Variables.ts, WidgetsPanel.ts, MetricsPanel.ts
│   │   │   └── GlobalMonitor.ts, Header.ts, NavBar.ts, StatusBar.ts
│   │   │   (imports: @maestro/tui pour Panel, useScroll, theme, etc.)
│   │   └── hooks/                                  hooks SPECIFIQUES au monitor Maestro
│   │       ├── useApiData.ts                       polling API Maestro (port 5000)
│   │       ├── useSessionData.ts                   donnees session
│   │       └── useAnimationTick.ts                 animation timer
│   │
│   ├── maestro-code/                               @maestro/code — MODE INTERACTIF
│   │   ├── package.json                            deps: { "@maestro/tui": "workspace:*" }
│   │   ├── App.ts                                  composant Ink (SessionManager, prompt)
│   │   ├── launcher.ts                             CJS dynamic import wrapper
│   │   ├── headless.ts                             mode CI/pipes
│   │   ├── ink-table.ts                            InkTable (imports: @maestro/tui)
│   │   └── ink-table-launcher.ts                   CJS wrapper InkTable
│   │
│   └── provider-monitor/                           @maestro/provider-monitor — MONITOR LLM-PROVIDER
│       ├── package.json                            deps: { "@maestro/tui": "workspace:*", "tail": "..." }
│       ├── tsconfig.json                           PAS d'alias @shared, clean
│       └── src/
│           ├── index.ts                            entry point
│           ├── cli.ts                              commandes (start, stop, status, stats, models)
│           ├── api-client.ts                       HTTP client vers .NET API (port 5010)
│           ├── process-manager.ts                  lifecycle dotnet run
│           ├── log-streamer.ts                     tail Serilog logs
│           ├── output-formatter.ts                 dual JSON/text output
│           ├── mock-data.ts                        mock pour --mock
│           ├── app.tsx                             composant Ink racine
│           │   (imports: @maestro/tui/components, @maestro/tui/hooks)
│           ├── theme.ts                            createTheme({ palette: { primary: 'cyan', ... } })
│           ├── config/tui.ts                       tabs, shortcuts
│           ├── tabs/                               ecrans SPECIFIQUES
│           │   ├── MetricsTab.tsx, LogsTab.tsx
│           │   ├── QueueTab.tsx, ModelsTab.tsx
│           └── hooks/                              hooks SPECIFIQUES
│               ├── use-api-polling.ts              polling .NET API (port 5010)
│               ├── use-log-stream.ts               file watcher Serilog
│               └── use-process-state.ts            process uptime
│
├── llm-provider/                                   LLM-PROVIDER (MIGRE DANS LE REPO)
│   ├── dotnet/                                     .NET Clean Architecture (port 5010)
│   │   └── src/LLMProvider.{Domain,Application,Infrastructure,Web,...}/
│   └── api/                                        Python FastAPI (GPU inference, port 8000)
│
├── backend/                                        C# .NET MAESTRO (inchange)
│   └── src/Maestro.{Domain,Application,Infrastructure,Api}/
│
├── frontend/                                       React + Vite (inchange)
│   └── src/
│
├── content/                                        blocks, templates, sessions (inchange)
│   └── system/blocks/, templates/
│
├── docs/
│   └── phases/PHASE-33C/
│
├── maestro-mcp/                                    MCP server (mineur, update imports)
└── dev-scripts/                                    scripts de dev (inchange)
```

**Legende :**
- Tout ce qui est dans `packages/` est un workspace npm
- `@maestro/tui` = le design system partage, importe par TOUTES les apps
- Chaque app a ses composants/hooks **SPECIFIQUES** + importe les primitives depuis `@maestro/tui`
- `llm-provider/` contient le backend .NET + Python (pas dans packages/ — c'est du .NET/Python, pas du Node)
- `packages/provider-monitor/` contient le monitor TUI du LLM-Provider (Node/TypeScript, dans packages/)

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-33C/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier le backend C#** — cette phase est 100% TypeScript/Node (sauf migration LLM-Provider)
5. **Ne PAS casser les tests existants** — 32 tests passent en pre-requis (25 App + 4 headless + 3 ink-table)
6. **Le toolkit doit etre consommable par un projet externe** — uniquement `@maestro/tui/...`, pas d'imports relatifs
7. **La theme doit etre configurable** — chaque app override les couleurs via `createTheme()`

---

## Etat actuel apres analyse profonde

### Maestro monitor (maestro-cli/monitor/ink/)
- 26 composants, 8 hooks
- **Les hooks sont des re-exports** de shared/tui (useScroll, usePanelFocus, useKeyboard, useTreeNav, useMouse)
- useKeyboard ajoute un wrapper legacy en plus du re-export de `createActionKeyboardHandler`
- Utilise shared/theme (palette, tokens, terminal), shared/types, shared/utils (tree, format, status)
- **0 tests** pour le monitor

### LLM-Provider monitor (C:\LLM-Provider\monitor/)
- 32 fichiers source, 95% autonome actuellement
- **Copies independantes** de : useScroll, usePanelFocus, useActionKeyboard, keybinding-resolver, Panel, StatusBar, TabBar, Header
- Theme propre (palette cyan/violet, icons, borders, layout) — 6 fichiers
- Seulement **2 type imports** de @shared (TabDef, ShortcutProps)
- **0 tests**

### CLI interactive (maestro-cli/interactive/)
- 4 fichiers, utilise `useSelectableList` de shared/tui
- 32 tests (App, headless, ink-table)

### shared/tui — etat reel
- **Hooks (7)** : TOUS utilises par le monitor via re-exports
- **Components (14)** : 1 seul utilise (Panel par LLMMonitorScreen)
- **Widgets (12)** : 0 utilises — 100% mort
- **Keybindings (2)** : utilises par useKeyboard
- **Total code mort** : ~25 fichiers (13 composants + 12 widgets)
- **Total code vivant** : ~14 fichiers (7 hooks + 2 keybindings + Panel + index files)

### shared/ hors tui — etat reel
- **theme/ (5)** : TOUS utilises (monitor + CLI)
- **types/ (8)** : utilises (monitor, frontend)
- **utils/ (7)** : ~5 utilises (tree, cli-colors, format, status, progress)
- **app/ (8)** : ~5 utilises (usePolling par monitor, hooks/transforms par frontend)
- **data/, registry/, ui/** : 0 imports — MORT

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 33-C-A | Migration LLM-Provider + restructuration packages/ | 2-3 jours |
| 33-C-B | Construire @maestro/tui (audit, nettoyage, merge hooks/components, theme configurable) | 2-3 jours |
| 33-C-C | Migrer les consommateurs (maestro-monitor, provider-monitor, maestro-code, maestro-cli) | 2-3 jours |
| 33-C-D | Fix bugs, tests du toolkit, validation E2E | 2-3 jours |

---

## 33-C-A : Migration LLM-Provider + restructuration packages/

### Lecture obligatoire [OBLIGATOIRE]
- `C:\Meastro\package.json` — root package actuel
- `C:\Meastro\maestro-cli\package.json` — deps CLI
- `C:\LLM-Provider\monitor\package.json` — deps LLM-Provider monitor
- `C:\Meastro\maestro-cli\monitor\tui-monitor.ts` — entry point du monitor Maestro
- `C:\Meastro\maestro-cli\interactive\launcher.ts` — entry point du mode interactif
- `C:\Meastro\maestro-cli\cli.ts` — comprendre comment le CLI lance le monitor et l'interactive (lignes ~5945-6085)

### Ce que cette sous-phase fait [OBLIGATOIRE]

**1. Migrer LLM-Provider dans le repo :**
- Copier `C:\LLM-Provider\` vers `C:\Meastro\llm-provider\`
- Exclure `node_modules/` du LLM-Provider monitor (sera reinstalle via workspaces)
- Ajouter `llm-provider/` au `.gitignore` pour les builds .NET (`bin/`, `obj/`) si pas deja fait
- Verifier que le backend .NET compile toujours depuis son nouvel emplacement

**2. Creer la structure packages/ :**

| Source | Destination |
|--------|-------------|
| `shared/` | `packages/tui/` |
| `maestro-cli/` (cli.ts, output-formatter.ts, shell.ts, index.js) | `packages/maestro-cli/` |
| `maestro-cli/monitor/ink/` + `maestro-cli/monitor/tui-monitor.ts` | `packages/maestro-monitor/` |
| `maestro-cli/interactive/` | `packages/maestro-code/` |
| `llm-provider/monitor/` (apres migration) | `packages/provider-monitor/` |

**3. Configurer npm workspaces :**

Root `package.json` :
```json
{
  "private": true,
  "name": "maestro-root",
  "workspaces": ["packages/*"]
}
```

**4. Creer un package.json pour chaque package :**

| Package | name | deps |
|---------|------|------|
| `packages/tui` | `@maestro/tui` | peerDeps: react, ink |
| `packages/maestro-cli` | `@maestro/cli` | `@maestro/tui`, `@maestro/monitor` (pour le lancer), `@maestro/code` |
| `packages/maestro-monitor` | `@maestro/monitor` | `@maestro/tui` |
| `packages/maestro-code` | `@maestro/code` | `@maestro/tui` |
| `packages/provider-monitor` | `@maestro/provider-monitor` | `@maestro/tui`, tail, chalk |

**5. Mettre a jour les imports dans le CLI :**

Le CLI (`packages/maestro-cli/cli.ts`) lance le monitor et le code via dynamic import. Ces chemins doivent etre mis a jour :
- `require('./monitor/tui-monitor.ts')` → `require('@maestro/monitor/tui-monitor.ts')` ou chemin relatif adapte
- `require('./interactive/launcher.ts')` → `require('@maestro/code/launcher.ts')`
- `require('./interactive/headless.ts')` → `require('@maestro/code/headless.ts')`

**6. npm install depuis le root** — verifier que tous les workspaces sont resolus

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `C:\LLM-Provider\*` | Copier vers `C:\Meastro\llm-provider\` (exclure node_modules) |
| `C:\Meastro\package.json` | Reecrire — workspaces: ["packages/*"] |
| `packages/tui/package.json` | Creer — @maestro/tui |
| `packages/maestro-cli/package.json` | Creer/adapter — @maestro/cli |
| `packages/maestro-monitor/package.json` | Creer — @maestro/monitor |
| `packages/maestro-code/package.json` | Creer — @maestro/code |
| `packages/provider-monitor/package.json` | Adapter — @maestro/provider-monitor |
| `packages/maestro-cli/cli.ts` | Modifier — imports monitor/interactive |
| `.gitignore` | Modifier — ajouter llm-provider/dotnet/*/bin/, obj/ |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : npm install resout les workspaces
powershell.exe -Command "cd C:\Meastro; npm install"
# Resultat attendu : 5 workspaces detectes, pas d'erreur

# Commande 2 : LLM-Provider .NET compile depuis le nouveau chemin
powershell.exe -Command "cd C:\Meastro\llm-provider\dotnet; dotnet build"
# Resultat attendu : build success

# Commande 3 : les tests CLI passent (chemins adaptes)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run tests/interactive/"
# Resultat attendu : 32/32 (ou adaptation necessaire pour les chemins)

# Commande 4 : structure packages/ correcte
ls C:\Meastro\packages\
# Resultat attendu : tui, maestro-cli, maestro-monitor, maestro-code, provider-monitor
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS faire un `git mv` du depot LLM-Provider — c'est une COPIE. L'historique Git de LLM-Provider reste dans son repo d'origine. On commence un historique frais dans Maestro.
- Ne PAS modifier le code des composants dans cette sous-phase — 33-C-A est UNIQUEMENT structure (deplacer, renommer, package.json, imports de lancement)
- Ne PAS supprimer `C:\LLM-Provider\` original — le garder jusqu'a validation complete
- Ne PAS oublier de mettre a jour les tests qui ont des chemins relatifs (`../../shared/` etc.)

### Checkpoint [OBLIGATOIRE]
```markdown
## 33-C-A : Migration + restructuration
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**LLM-Provider copie** : OUI/NON
**LLM-Provider .NET compile** : OUI/NON
**packages/ crees** : X (lister)
**npm install clean** : OUI/NON
**Tests CLI** : X/32 passent
**Imports CLI mis a jour** : OUI/NON
```

---

## 33-C-B : Construire @maestro/tui

### Lecture obligatoire [OBLIGATOIRE]
- `packages/tui/` (ex shared/) — tout le contenu actuel
- `packages/maestro-monitor/hooks/useScroll.ts` — le re-export actuel
- `packages/maestro-monitor/hooks/useKeyboard.ts` — wrapper + re-export
- `packages/provider-monitor/src/tui/hooks/use-scroll.ts` — copie LLM-Provider
- `packages/provider-monitor/src/tui/components/Panel.tsx` — copie LLM-Provider
- `packages/provider-monitor/src/theme/` — 6 fichiers theme LLM-Provider

### Ce que cette sous-phase fait [OBLIGATOIRE]

**1. Nettoyage code mort dans packages/tui/ :**
- Supprimer `tui/widgets/` (12 fichiers, 0 imports)
- Supprimer 13 composants inutilises dans `tui/components/` (garder Panel)
- Supprimer `data/`, `registry/`, `ui/` (0 imports)
- Scanner et documenter chaque suppression

**2. Creer le package.json @maestro/tui avec exports map :**
```json
{
  "name": "@maestro/tui",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.ts",
    "./hooks": "./hooks/index.ts",
    "./components": "./components/index.ts",
    "./theme": "./theme/index.ts",
    "./theme/create": "./theme/create-theme.ts",
    "./keybindings": "./keybindings/index.ts",
    "./types": "./types/index.ts",
    "./utils": "./utils/index.ts",
    "./app": "./app/index.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "ink": "^6.0.0"
  }
}
```

**3. Reorganiser la structure interne de packages/tui/ :**
- Deplacer `tui/hooks/` → `hooks/` (plus de sous-dossier tui/)
- Deplacer `tui/components/` → `components/`
- Deplacer `tui/keybindings.ts` + `tui/keybinding-resolver.ts` → `keybindings/`
- Garder `theme/`, `types/`, `utils/`, `app/` a la racine du package
- Supprimer le dossier `tui/` (son contenu est monte d'un niveau)

**4. Implementer la theme configurable :**

Creer `packages/tui/theme/create-theme.ts` :
```typescript
import { defaultPalette } from './colors.ts';
import { icons, layout } from './tokens.ts';

interface ThemeOverrides {
  palette?: Partial<typeof defaultPalette>;
  icons?: Partial<typeof icons>;
}

export function createTheme(overrides: ThemeOverrides = {}) {
  return {
    palette: { ...defaultPalette, ...overrides.palette },
    icons: { ...icons, ...overrides.icons },
    layout,
  };
}
```

**5. Merger les meilleures versions de chaque hook :**

| Hook | Source elue | Modifications |
|------|------------|---------------|
| useScroll | shared (la plus complete) | Supprimer max=100, ajouter scrollToTop/scrollToBottom |
| usePanelFocus | shared | Ajouter sauvegarde offset par panel |
| useKeyboard | shared (createActionKeyboardHandler) | Nettoyer, garder l'API action-based |
| useTreeNav | shared | Aucune |
| useSelectableList | shared | Aucune |
| useMouse | shared | Aucune |

**6. Merger les composants :**

Comparer les versions shared vs monitor vs provider-monitor pour chaque composant :
- `Panel` — prendre la version la plus flexible (border configurable, title, focus indicator)
- `StatusBar` — comparer, creer la version canonique
- `Header` — comparer, creer la version canonique
- `TabBar` — comparer, exporter aussi le type TabDef
- `DataTable` — garder ou creer

**7. Barrel exports propres :**
```typescript
// packages/tui/index.ts
export * from './hooks/index.ts';
export * from './components/index.ts';
```

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/tui/package.json` | Reecrire — exports map complete |
| `packages/tui/index.ts` | Creer — barrel export |
| `packages/tui/hooks/` | Reorganiser (ex tui/hooks/ → hooks/), merger best-of |
| `packages/tui/hooks/useScroll.ts` | Modifier — merger, corriger max=100 |
| `packages/tui/hooks/usePanelFocus.ts` | Modifier — merger |
| `packages/tui/hooks/useKeyboard.ts` | Modifier — nettoyer |
| `packages/tui/components/` | Reorganiser, merger best-of des 3 versions |
| `packages/tui/components/Panel.ts` | Modifier — version canonique |
| `packages/tui/components/StatusBar.ts` | Creer/garder — version canonique |
| `packages/tui/components/Header.ts` | Creer/garder — version canonique |
| `packages/tui/components/TabBar.ts` | Creer/garder — version canonique |
| `packages/tui/components/DataTable.ts` | Garder ou creer |
| `packages/tui/theme/create-theme.ts` | Creer — factory configurable |
| `packages/tui/keybindings/` | Creer dossier, deplacer keybindings.ts + resolver |
| Anciens dossiers morts | Supprimer (widgets/, data/, registry/, ui/, tui/) |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : import @maestro/tui fonctionne
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node -e ""import('@maestro/tui').then(m => console.log(Object.keys(m)))"""
# Resultat attendu : liste des exports

# Commande 2 : createTheme fonctionne
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node -e ""import('@maestro/tui/theme/create').then(m => console.log(m.createTheme()))"""
# Resultat attendu : objet theme

# Commande 3 : tests passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run tests/interactive/"
# Resultat attendu : 32/32

# Commande 4 : compter les fichiers du toolkit
find packages/tui -name "*.ts" -not -path "*/node_modules/*" | wc -l
# Resultat attendu : ~30 fichiers (vs ~80 avant nettoyage)
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS forcer une seule palette — createTheme() DOIT supporter les overrides
- Ne PAS inclure de logique metier — pas de useSessionData, pas de useApiPolling
- Ne PAS casser l'API existante des hooks — les re-exports du monitor doivent continuer a fonctionner jusqu'a 33-C-C
- Ne PAS creer de composants "god" — chaque composant = une responsabilite

### Checkpoint [OBLIGATOIRE]
```markdown
## 33-C-B : Package @maestro/tui
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Code mort supprime** : X fichiers (lister)
**Hooks dans le toolkit** : X (lister)
**Components dans le toolkit** : X (lister)
**Theme configurable** : OUI/NON
**createTheme() fonctionne** : OUI/NON
**Exports map complete** : OUI/NON
**Tests** : X/32 passent
```

---

## 33-C-C : Migrer les consommateurs

### Lecture obligatoire [OBLIGATOIRE]
- `packages/tui/index.ts` — exports du toolkit (apres 33-C-B)
- `packages/maestro-monitor/hooks/` — re-exports actuels (a supprimer)
- `packages/maestro-monitor/components/*.ts` — imports actuels (../../../../shared/...)
- `packages/provider-monitor/src/tui/` — copies locales (a supprimer)
- `packages/provider-monitor/src/theme/` — 6 fichiers (a remplacer par createTheme())

### Ce que cette sous-phase fait [OBLIGATOIRE]

**Ordre de migration : Maestro monitor d'abord (plus safe), puis provider-monitor, puis CLI/code.**

**1. Migrer maestro-monitor :**
- Supprimer les re-exports dans `hooks/` : useScroll.ts, usePanelFocus.ts, useTreeNav.ts, useMouse.ts
- Simplifier useKeyboard.ts — garder uniquement useActionKeyboard, importer depuis @maestro/tui
- Changer tous les imports dans les 26 composants :
  - `../../../../shared/tui/hooks/useScroll.ts` → `@maestro/tui/hooks`
  - `../../../../shared/theme/colors.ts` → `@maestro/tui/theme`
  - `../../../../shared/utils/tree.ts` → `@maestro/tui/utils`
  - etc.
- Remplacer `theme.ts` pour utiliser `createTheme()` avec defaults Maestro

**2. Migrer provider-monitor :**
- Supprimer `src/tui/hooks/` (3 fichiers — copies locales remplacees par @maestro/tui)
- Supprimer `src/tui/keybinding-resolver.ts` et `src/tui/keybindings.ts`
- Migrer les composants `src/tui/components/` — supprimer si @maestro/tui suffit, garder si specifique
- Supprimer `src/theme/` (6 fichiers) — remplacer par un seul `src/theme.ts` :
  ```typescript
  import { createTheme } from '@maestro/tui/theme/create';
  export const theme = createTheme({ palette: { primary: 'cyan', accent: 'magenta' } });
  ```
- Mettre a jour tsconfig.json — supprimer alias @shared et includes Meastro
- Mettre a jour tous les imports dans app.tsx, tabs/, config/

**3. Migrer maestro-code :**
- Changer l'import dans ink-table.ts : `../../shared/tui/hooks/useSelectableList` → `@maestro/tui/hooks`

**4. Migrer maestro-cli :**
- Changer les imports dans cli.ts, output-formatter.ts, shell.ts :
  - `../shared/utils/cli-colors` → `@maestro/tui/utils`
  - `../shared/theme/` → `@maestro/tui/theme`

**5. Migrer frontend (mineur) :**
- Changer `@shared/app/` → `@maestro/tui/app` dans HomePage.tsx
- Mettre a jour vite.config.ts alias si necessaire

### Fichiers a modifier/creer [OBLIGATOIRE]

**maestro-monitor :**
| Fichier | Action |
|---------|--------|
| `hooks/useScroll.ts` | Supprimer (re-export) |
| `hooks/usePanelFocus.ts` | Supprimer (re-export) |
| `hooks/useTreeNav.ts` | Supprimer (re-export) |
| `hooks/useMouse.ts` | Supprimer (re-export) |
| `hooks/useKeyboard.ts` | Simplifier (importer @maestro/tui) |
| `theme.ts` | Modifier — createTheme() |
| `components/*.ts` (26 fichiers) | Modifier — tous les imports |
| `App.ts` | Modifier — imports |

**provider-monitor :**
| Fichier | Action |
|---------|--------|
| `src/tui/hooks/` (3 fichiers) | Supprimer |
| `src/tui/keybinding-resolver.ts` | Supprimer |
| `src/tui/keybindings.ts` | Supprimer |
| `src/theme/` (6 fichiers) | Supprimer |
| `src/theme.ts` | Creer — createTheme() avec overrides LLM-Provider |
| `src/tui/components/*.tsx` | Evaluer — supprimer si @maestro/tui suffit |
| `src/app.tsx`, `src/tabs/*.tsx`, `src/config/tui.ts` | Modifier — imports |
| `tsconfig.json` | Modifier — supprimer @shared alias |

**maestro-code :**
| Fichier | Action |
|---------|--------|
| `ink-table.ts` | Modifier — import @maestro/tui/hooks |

**maestro-cli :**
| Fichier | Action |
|---------|--------|
| `cli.ts` | Modifier — imports shared/ → @maestro/tui |
| `output-formatter.ts` | Modifier — import cli-colors |
| `shell.ts` | Modifier — imports theme |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : tests CLI passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run tests/interactive/"
# Resultat attendu : 32/32

# Commande 2 : maestro-monitor compile
powershell.exe -Command "cd C:\Meastro\packages\maestro-monitor; npx tsc --noEmit"
# Resultat attendu : 0 erreur

# Commande 3 : provider-monitor demarre
powershell.exe -Command "cd C:\Meastro\packages\provider-monitor; npx tsx src/index.ts status"
# Resultat attendu : pas d'erreur d'import

# Commande 4 : plus d'imports relatifs ../../../../shared
grep -r "../../../../shared" packages/ --include="*.ts" --include="*.tsx"
# Resultat attendu : 0 resultats

# Commande 5 : plus de copies locales dans provider-monitor
ls packages/provider-monitor/src/tui/hooks/
# Resultat attendu : dossier vide ou supprime
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS migrer mecaniquement sans tester apres chaque app — Maestro d'abord, valider, PUIS provider
- Ne PAS supprimer un composant LLM-Provider si @maestro/tui ne couvre pas ses features — garder temporairement
- Ne PAS oublier de migrer le frontend — il utilise aussi @shared
- Ne PAS supprimer le legacy useKeyboard d'un coup si des composants l'utilisent — migrer progressivement

### Checkpoint [OBLIGATOIRE]
```markdown
## 33-C-C : Migration consommateurs
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**maestro-monitor migre** : OUI/NON (X fichiers modifies, X supprimes)
**provider-monitor migre** : OUI/NON (X fichiers supprimes, X modifies)
**maestro-code migre** : OUI/NON
**maestro-cli migre** : OUI/NON
**frontend migre** : OUI/NON
**Imports ../../../../shared restants** : 0 / X
**Copies locales provider restantes** : 0 / X
**Tests** : X/32 passent
```

---

## 33-C-D : Fix bugs, tests du toolkit, validation E2E

### Lecture obligatoire [OBLIGATOIRE]
- `packages/tui/hooks/useScroll.ts` — version canonique
- `packages/maestro-monitor/components/WorkflowTree.ts` — bugs connus
- `packages/maestro-monitor/App.ts` — hauteurs hardcodees
- `packages/maestro-cli/tests/interactive/App.test.ts` — pattern de test existant

### Ce que cette sous-phase fait [OBLIGATOIRE]

**Corrections bugs (dans @maestro/tui — affecte TOUS les consommateurs) :**

1. **useScroll max=100** : max = contentHeight - panelHeight, pas de limite hardcodee
2. **Scroll reset au changement de panel** : Map<panelName, offset> au lieu d'un seul offset
3. **Home/End manquants** : scrollToTop (g/Home) et scrollToBottom (G/End)
4. **Hauteurs hardcodees** : useStdout().rows dans maestro-monitor (specifique monitor, pas toolkit)
5. **Nodes collapses cachent running children** : indicateur dans WorkflowTree (specifique monitor)

**Tests du toolkit :**

6. Creer `packages/maestro-cli/tests/tui/` (ou `packages/tui/tests/`) :
   - `useScroll.test.ts` — scroll up/down, top/bottom, limites, pas de max hardcode
   - `usePanelFocus.test.ts` — next/prev, wrap, isActive, offset par panel
   - `useKeyboard.test.ts` — action resolution
   - `useTreeNav.test.ts` — expand/collapse, running child
   - `useSelectableList.test.ts` — selection, page, wrap

7. Creer `packages/maestro-cli/tests/monitor/` :
   - `WorkflowTree.test.ts` — rendu arbre, collapsed, running indicator
   - `Panel.test.ts` — rendu avec titre, border, focus

**Validation E2E :**

8. Maestro monitor — lancer sur une session, verifier scroll/keybindings/tree
9. Provider monitor — lancer, verifier theme custom, tabs, scroll

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/tui/hooks/useScroll.ts` | Modifier — fix max=100, ajouter top/bottom |
| `packages/tui/hooks/usePanelFocus.ts` | Modifier — offset par panel |
| `packages/tui/keybindings/keybindings.ts` | Modifier — ajouter scrollToTop, scrollToBottom |
| `packages/maestro-monitor/components/WorkflowTree.ts` | Modifier — running child indicator |
| `packages/maestro-monitor/App.ts` | Modifier — hauteurs dynamiques |
| `packages/maestro-cli/tests/tui/useScroll.test.ts` | Creer |
| `packages/maestro-cli/tests/tui/usePanelFocus.test.ts` | Creer |
| `packages/maestro-cli/tests/tui/useKeyboard.test.ts` | Creer |
| `packages/maestro-cli/tests/tui/useTreeNav.test.ts` | Creer |
| `packages/maestro-cli/tests/tui/useSelectableList.test.ts` | Creer |
| `packages/maestro-cli/tests/monitor/WorkflowTree.test.ts` | Creer |
| `packages/maestro-cli/tests/monitor/Panel.test.ts` | Creer |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : tests existants passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run tests/interactive/"
# Resultat attendu : 32/32

# Commande 2 : tests toolkit passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run tests/tui/"
# Resultat attendu : minimum 15 tests verts

# Commande 3 : tests monitor passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run tests/monitor/"
# Resultat attendu : minimum 5 tests verts

# Commande 4 : tous les tests
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; npx vitest run"
# Resultat attendu : ~52 tests verts
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS tester les hooks sans React — utiliser renderHook
- Ne PAS hardcoder des tailles de terminal — mocker useStdout()
- Ne PAS corriger un bug specifique au monitor dans le toolkit — separer les responsabilites
- Ne PAS ignorer les tests de regression — chaque bug fix = un test qui le reproduisait

### Checkpoint [OBLIGATOIRE]
```markdown
## 33-C-D : Bugs + tests + validation
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Bugs corriges** : X/5
**Tests toolkit** : X nouveaux
**Tests monitor** : X nouveaux
**Tests totaux** : X (32 + X)
**Scroll max=100** : CORRIGE/NON
**Scroll per-panel** : CORRIGE/NON
**Home/End** : AJOUTE/NON
**Hauteurs dynamiques** : OUI/NON
**Running child indicator** : OUI/NON
**E2E Maestro monitor** : OUI/NON
**E2E Provider monitor** : OUI/NON
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-33C/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 33-C COMPLETE — @maestro/tui design system, monorepo packages/, LLM-Provider migre, X tests"
- Ajouter : "Structure: packages/{tui, maestro-cli, maestro-monitor, maestro-code, provider-monitor}"
- Ajouter : "LLM-Provider: migre dans llm-provider/ (dotnet + api), monitor dans packages/provider-monitor/"
- Mettre a jour tous les chemins dans Key File Paths
- Retirer : "shared/tui 95% code mort", "LLM-Provider a C:\LLM-Provider"

---

## Risques techniques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Migration LLM-Provider casse les paths .NET | Backend LLM-Provider ne compile plus | Verifier `dotnet build` immediatement apres copie. Les paths .NET sont relatifs au .sln. |
| npm workspaces hoisting casse yoga-layout | Ink ne demarre plus | Dynamic import chain (launcher.ts) isole le probleme. Tester tot. |
| Deplacer monitor hors de maestro-cli casse les imports | Monitor ne compile plus | Faire le move + update imports dans un seul commit. Tester immediatement. |
| CLI ne trouve plus le monitor/code apres restructuration | Commandes `monitor` et `code` cassees | Mettre a jour les require() dans cli.ts pour pointer vers les nouveaux packages. |
| LLM-Provider repo original desynchronise | Confusion entre 2 copies | Archiver le repo original, travailler uniquement dans Maestro apres validation. |
| Trop de fichiers a modifier dans 33-C-C | Risque de regression | Migrer un package a la fois, valider entre chaque migration. |
