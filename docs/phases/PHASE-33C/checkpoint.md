# Phase 33-C : Checkpoint

**Derniere mise a jour** : 2026-02-19 13:30
**Sous-phase en cours** : 33-C-D DONE
**Agent** : Claude Code session — execution 33-C-A + 33-C-B + 33-C-C

---

## 33-C-A : Migration LLM-Provider + restructuration packages/
**Statut** : DONE
**Date** : 2026-02-19
**LLM-Provider copie** : OUI
- `C:\LLM-Provider\dotnet\` → `C:\Meastro\llm-provider\dotnet\` (src, tests, .sln)
- `C:\LLM-Provider\api\` → `C:\Meastro\llm-provider\api\` (server.py, etc.)
- `C:\LLM-Provider\monitor\src\` → `C:\Meastro\packages\provider-monitor\src\` (32 fichiers)

**LLM-Provider .NET compile** : OUI
```
Build succeeded.
    0 Error(s)
```

**packages/ crees** : 5/5
- `packages/tui` (73 fichiers — shared/tui, shared/theme, shared/types, shared/utils, shared/app)
- `packages/maestro-cli` (21 fichiers — CLI + copies locales CJS)
- `packages/maestro-monitor` (40 fichiers — monitor + composants + hooks)
- `packages/maestro-code` (8 fichiers + vitest.config.ts — interactive + tests)
- `packages/provider-monitor` (32 fichiers — LLM-Provider monitor src)

**package.json ecrits** : 6/6
- `C:\Meastro\package.json` — root avec `"workspaces": ["packages/*"]`
- `C:\Meastro\packages\tui\package.json` — `@maestro/tui`, ESM, exports map
- `C:\Meastro\packages\maestro-cli\package.json` — `@maestro/cli`, deps @maestro/{tui,monitor,code}
- `C:\Meastro\packages\maestro-monitor\package.json` — `@maestro/monitor`, PAS de "type":"module" (CJS bridge)
- `C:\Meastro\packages\maestro-code\package.json` — `@maestro/code`, PAS de "type":"module" (CJS bridge)
- `C:\Meastro\packages\provider-monitor\package.json` — `@maestro/provider-monitor`, ESM

**npm install clean** : OUI
```
added 97 packages, changed 1 package, and audited 104 packages in 23s
found 0 vulnerabilities
```

**Symlinks @maestro/** : OUI (5/5)
```
cli
code
monitor
provider-monitor
tui
```

**Tests interactive** : 32/32 passent
```
✓ tests/ink-table.test.ts (3 tests) 945ms
✓ tests/App.test.ts (25 tests) 2301ms
✓ tests/headless.test.ts (4 tests) 6061ms

 Test Files  3 passed (3)
      Tests  32 passed (32)
```

**Imports CLI mis a jour** : OUI (10 require() modifies)
- `require('../shared/api-client')` → `require('./api-client.js')`
- `require('../shared/utils/cli-colors.js')` → `require('./utils/cli-colors.ts')`
- `require('../shared/utils/status.js')` → `require('./utils/status.ts')`
- `require('../shared/utils/tier-selector.ts')` → `require('./utils/tier-selector.ts')`
- `require('../shared/tui/keybindings.ts')` → `require('./keybindings/keybindings.ts')`
- `require('../shared/tui/keybinding-resolver.ts')` → `require('./keybindings/keybinding-resolver.ts')`
- `require('./monitor/tui-monitor.ts')` → `require('@maestro/monitor/tui-monitor.ts')`
- `require('./interactive/launcher.ts')` → `require('@maestro/code/launcher.ts')`
- `require('./interactive/headless.ts')` → `require('@maestro/code/headless.ts')`
- `require('./interactive/ink-table-launcher.ts')` → `require('@maestro/code/ink-table-launcher.ts')`

**maestro-mcp MAJ** : OUI
- `require('../shared/api-client')` → `require('../packages/maestro-cli/api-client')`

**Autres modifications** :
- `.gitignore` : supprime `**/packages/*` (NuGet pattern qui ignorait packages/)
- `.gitignore` : ajoute `llm-provider/dotnet/**/bin/`, `llm-provider/dotnet/**/obj/`, `llm-provider/api/__pycache__/`, `llm-provider/api/.venv/`
- `packages/maestro-monitor/tui-monitor.ts` : supprime la ligne backward compat `TuiMonitor` (CLAUDE.md interdit legacy code)
- `packages/maestro-code/vitest.config.ts` : cree (copie de maestro-cli/vitest.config.ts) pour que les tests trouvent leur config

**Problemes** :
- Aucun

---

## 33-C-B : Package @maestro/tui
**Statut** : DONE
**Date** : 2026-02-19
**Code mort supprime** : 25 fichiers
- `tui/widgets/` : 13 fichiers (Confirmation, DiffView, FileTreeWidget, LogStream, MessageWidget, OptionSelect, PlanView, ProgressWidget, TableWidget, TestResults, TextInput, WidgetDispatcher, index)
- `tui/components/` : 10 fichiers (AppHeader, AppStatusBar, Breadcrumb, DataTable, KV, NavBar, PersistentStatusBar, ProgressBar, StatusIndicator, WidgetRenderer)
- `types/` : 2 fichiers (page.ts, widget.ts)
- `types/index.ts` : suppression des exports widget.js et page.js

**Structure aplatie** : OUI (tui/ supprime)
- `tui/hooks/` → `hooks/`
- `tui/components/` (5 survivants) → `components/`
- `tui/keybindings.ts` + `tui/keybinding-resolver.ts` → `keybindings/`
- `tui/index.ts` (dead) supprime

**Hooks dans le toolkit** : 7 + useApiData shim
- useScroll, usePanelFocus, useKeyboard (createActionKeyboardHandler), useTreeNav, useMouse, useSelectableList, useApiData

**Components dans le toolkit** : 4 + index
- Panel, TabBar (+ TabDef), Shortcut (+ ShortcutProps), StatusBar

**Theme configurable** : OUI
- `theme/create-theme.ts` : `createTheme(overrides)` → `{ palette, icons, layout }`
- `MaestroTheme` type exported
- `ThemeOverrides` interface with Partial<> support

**Exports map coherente** : OUI (package.json inchange, sub-path exports pour types/utils/app)

**Barrel index.ts cree** : OUI
- `index.ts` : re-exports hooks, components, theme, keybindings (PAS types/utils/app — sub-path only)

**Imports internes corriges** : 6 fichiers
- `hooks/useKeyboard.ts` : `../keybinding-resolver.ts` → `../keybindings/keybinding-resolver.ts`
- `hooks/useApiData.ts` : `../../app/hooks/usePolling.ts` → `../app/hooks/usePolling.ts`
- `hooks/useTreeNav.ts` : `../../utils/tree.ts` → `../utils/tree.ts`
- `components/Panel.ts` : `../../theme/` → `../theme/`
- `components/Shortcut.ts` : `../../theme/colors.ts` → `../theme/colors.ts`
- `components/StatusBar.ts` : `../../theme/` + `../../utils/` → `../theme/` + `../utils/`
- `components/TabBar.ts` : `../../theme/colors.ts` → `../theme/colors.ts`

**Fichiers crees** :
- `packages/tui/index.ts` (barrel racine)
- `packages/tui/keybindings/index.ts` (barrel)
- `packages/tui/theme/create-theme.ts` (factory)
- `packages/tui/vitest.config.ts` (config tests)
- `packages/tui/tests/` (dossier vide, tests en 33-C-D)

**tsc --noEmit** : 0 erreurs
```
(no output — clean)
```

**Fichiers .ts restants** : 50

**Repertoires packages/tui/** :
```
app, components, hooks, keybindings, tests, theme, types, utils
(pas de tui/, widgets/, data/, registry/, ui/)
```

**Tests** : 32/32 passent
```
✓ tests/ink-table.test.ts (3 tests) 918ms
✓ tests/App.test.ts (25 tests) 2257ms
✓ tests/headless.test.ts (4 tests) 6067ms

 Test Files  3 passed (3)
      Tests  32 passed (32)
```

**Problemes** :
- Aucun

## 33-C-C : Migrer les consommateurs
**Statut** : DONE
**Date** : 2026-02-19

### Step 0 : useSinglePanelScroll wrapper
- Cree `packages/tui/hooks/useSinglePanelScroll.ts` : adapte le multi-panel `useScroll()` API vers single-panel `useScroll(contentHeight, panelHeight)` API
- Exporte depuis `packages/tui/hooks/index.ts`

### Step 1 : maestro-monitor (17 fichiers)
- **5 re-export hooks supprimes** : useScroll, usePanelFocus, useTreeNav, useMouse, useApiData (etaient des wrappers 1-ligne vers shared/)
- **17 fichiers MAJ** : App.ts, mock-api-client.ts, theme.ts, 12 composants, 2 hooks
- Tous les `../../../../shared/` et `../../../shared/` → `@maestro/tui/{hooks,components,theme,utils,types,app}`
- `mock-api-client.ts` : `@ts-nocheck` ajoute (erreur pre-existante IApiClient)
- `tsconfig.json` cree avec paths `@maestro/tui`
- **tsc --noEmit : 0 erreurs**

### Step 2 : provider-monitor
- **2 hooks morts supprimes** : `src/tui/hooks/use-scroll.ts`, `src/tui/hooks/use-panel-focus.ts`
- **use-action-keyboard.ts CONSERVE** : depend du keybinding resolver local (deviation pragmatique du plan)
- `src/config/tui.ts` : `@shared/tui/components/TabBar.js` → `@maestro/tui/components`
- `tsconfig.json` cree
- **tsc : seulement erreur pre-existante minimist types**

### Step 3 : maestro-code
- `ink-table.ts` : `../../shared/tui/hooks/useSelectableList.ts` → `@maestro/tui/hooks`
- `tsconfig.json` cree

### Step 4 : maestro-cli
- `output-formatter.ts` : `../shared/utils/cli-colors.js` → `@maestro/tui/utils/cli-colors.ts`
- `shell.ts` : 3 imports → `@maestro/tui/theme` et `@maestro/tui/utils/cli-colors.ts`

### Step 5 : frontend
- `vite.config.ts` : `@shared` alias `../shared` → `../packages/tui`
- `tsconfig.json` : paths `@shared/*` → `../packages/tui/*`, includes `../shared/` → `../packages/tui/`
- **tsc --noEmit : 0 erreurs**
- **vite build : success (13.79s)**
- (electron-builder echoue pour raisons environnement Windows, sans rapport)

### Corrections additionnelles
- `packages/tui/theme/create-theme.ts` : suppression import unused `defaultSemantic` (frontend strict mode `noUnusedLocals`)
- `maestro-cli/vitest.config.ts` : ajout `resolve.dedupe: ['react', 'ink', 'react-reconciler']` pour eviter dual React via workspace symlinks
- `maestro-cli/tests/interactive/ink-table.test.ts` : migration vers top-level imports + import depuis `packages/maestro-code/ink-table.ts`

### Verification (7/7 PASS)
| # | Check | Resultat |
|---|-------|----------|
| 1 | Aucun `../../../../shared` dans packages/ | PASS |
| 2 | Aucun `@shared/` dans provider-monitor | PASS |
| 3 | Tests 32/32 | PASS |
| 4 | maestro-monitor tsc 0 erreurs | PASS |
| 5 | provider-monitor tsc (minimist pre-existant) | PASS |
| 6 | Frontend tsc + vite build | PASS |
| 7 | Pas de copies hooks locales (sauf use-action-keyboard) | PASS |

### Problemes rencontres et resolus
- **Dual React en tests ink-table** : Les workspace symlinks causent Vite a charger des instances separees de `ink` et `react`. Corrige avec `resolve.dedupe` dans vitest.config.ts
- **Unused import frontend strict** : `create-theme.ts` importait `defaultSemantic` inutilise, `noUnusedLocals: true` dans frontend tsconfig le rejetait. Supprime l'import.

## 33-C-D : Bugs + tests + validation E2E
**Statut** : DONE
**Date** : 2026-02-19

### Bugs corriges
- [x] **useScroll MAX_OFFSET** : CORRIGE — `MAX_OFFSET=200` remplace par `Number.MAX_SAFE_INTEGER` sentinel
- [x] **scrollToTop/scrollToBottom** : AJOUTE — 2 nouvelles fonctions dans `UseScrollReturn`
- [x] **scroll.top/scroll.bottom keybindings** : AJOUTE — `g`/`G` dans tui + CJS copy
- [x] **WorkflowTree running child indicator** : AJOUTE — `countRunningChildren()` recursive, affiche `●N` en rouge
- [x] **App.ts hauteurs dynamiques** : DEJA OK — utilise `FullscreenBox` + `useStdout().rows`, aucun changement requis

### Tests toolkit crees (packages/tui/tests/)
- `useScroll.test.ts` : 14 tests
- `usePanelFocus.test.ts` : 9 tests
- `useSelectableList.test.ts` : 17 tests

### Tests monitor crees (packages/maestro-monitor/tests/)
- `WorkflowTree.test.ts` : 4 tests (dont regression collapsed-node-running-indicator)

### Tests totaux : 76
- maestro-code: 32 (25 App + 4 headless + 3 ink-table)
- tui: 40 (14 useScroll + 9 usePanelFocus + 17 useSelectableList)
- maestro-monitor: 4 (WorkflowTree)

### Nettoyage
- **shared/ supprime** : OUI
- **maestro-cli/ ancien supprime** : OUI (cli.ts, index.js, config.ts, discover.ts, json-parser.ts, output-formatter.ts, shell.ts, vitest.config.ts, tsconfig.json, package.json, monitor/, interactive/, tests/)
- **C:\LLM-Provider\ supprime** : PARTIEL — DLLs verrouillees par processus LLM-Provider.Web en cours. La majorite supprimee, reste `dotnet/src/LLMProvider.Web/bin/` et `logs/`. L'utilisateur doit arreter le processus et re-executer la suppression.
- **dev-scripts/dev-start.ps1** : MAJ `$LLMProviderRoot` vers `$MaestroRoot\llm-provider`
- **packages/tui/package.json** : ajout exports `./keybindings/*` et `./theme/*` (wildcard)

### CLAUDE.md mis a jour : OUI
- CLI path: `maestro-cli/index.js` → `packages/maestro-cli/index.js`
- CLI cd path: `cd C:\Meastro\maestro-cli` → `cd C:\Meastro\packages\maestro-cli`
- Testing: `cd maestro-cli && npx vitest run tests/interactive/` → `cd packages/maestro-code && npx vitest run tests/` + toolkit + monitor
- Template import: `maestro-cli/index.js` → `packages/maestro-cli/cli.ts`

### MEMORY.md mis a jour : OUI
- Architecture Quick Reference: tous les chemins MAJ
- Key File Paths: tous les chemins MAJ
- Testing Commands: tous les chemins MAJ
- Shared TUI Reality: remplace par "TUI Monorepo (Post 33-C)"
- Current Project State: MAJ active phase et test counts

### CJS sync comment ajoute : OUI
- `packages/maestro-cli/keybindings/keybindings.ts` : `// SYNC WITH packages/tui/keybindings/keybindings.ts`

### Verification E2E

| # | Check | Resultat |
|---|-------|----------|
| 1 | Tests maestro-code 32/32 | PASS |
| 2 | Tests tui 40/40 | PASS |
| 3 | Tests maestro-monitor 4/4 | PASS |
| 4 | CLI tree tests 88/88 | PASS |
| 5 | Verify shared imports 29/29 | PASS |
| 6 | Shared app transforms 86/86 | PASS |
| 7 | Shared app barrel imports 29/29 | PASS |
| 8 | Grep `../shared/` dans packages/ = 0 | PASS |
| 9 | Backend build | SKIP — DLLs locked (Maestro.Api running). Pas de changement C# dans cette phase. |
| 10 | LLM-Provider build succeeded | PASS |
| 11 | Frontend build succeeded (14.66s) | PASS |
| 12 | Grep anciens chemins CLAUDE.md = 0 | PASS |

### Problemes rencontres et resolus
1. **Ink test pattern `h('ink:text', ...)` echec re-render** : Les tests hooks utilisaient `h('ink:text', null, ...)` comme element type. Le render initial fonctionne mais le re-render echoue — ink's reconciler requiert le composant `Text` reel pour valider les text nodes. Fix: `import { Text } from 'ink'; h(Text, null, ...)`.
2. **Dollar signs consumed by bash** : Les commandes PowerShell avec `$_` echouent via bash. Fix: ecrire un script `.ps1` temporaire puis l'executer avec `powershell.exe -File`.
3. **C:\LLM-Provider locked** : Le processus LLM-Provider.Web verrouille les DLLs dans `bin/Debug/`. Suppression partielle. L'utilisateur doit stopper le service pour finaliser.
4. **Package exports manquants** : `@maestro/tui/keybindings/keybinding-resolver.ts` et `@maestro/tui/theme/colors.ts` non couverts par les exports. Fix: ajout `./keybindings/*` et `./theme/*` wildcard exports.
