# Phase 33-C : @maestro/tui — Design System TUI partage + Monorepo

**Statut** : A faire
**Prerequis** : Phase 33-B COMPLETE (checkpoint.md montre 33-B-A a 33-B-D tous DONE)
**Objectif** : Migrer LLM-Provider dans le repo Maestro, creer un package `@maestro/tui` (design system TUI reutilisable), restructurer en monorepo npm workspaces sous `packages/`. Un fix dans le toolkit = fix partout. La logique metier reste specifique a chaque app.

---

## Decision architecturale critique : CJS/ESM boundary

`cli.ts` tourne en CJS via tsx et utilise `require()`. `@maestro/tui` sera ESM (`"type": "module"`). On ne peut pas `require()` un package ESM.

**Solution** : Les fichiers que `cli.ts` require directement sont **copies localement** dans `packages/maestro-cli/` (CJS-safe). Les consommateurs ESM (provider-monitor, shell.ts, output-formatter.ts) importent depuis `@maestro/tui`.

**CJS bridge packages** : `@maestro/monitor` et `@maestro/code` sont des packages **CJS** (sans `"type": "module"`) car `cli.ts` les charge via `require()`. Leurs fichiers d'entree (`tui-monitor.ts`, `launcher.ts`) utilisent `exports.xxx = async function() { await import(...) }` — du CJS qui fait un dynamic import ESM en interne. Si on met `"type": "module"`, la syntaxe `exports.xxx` devient invalide et `require()` depuis cli.ts echoue avec ERR_REQUIRE_ESM.

### Fichiers a garder locaux dans packages/maestro-cli/

| Fichier source | Require dans cli.ts | Destination locale |
|----------------|--------------------|--------------------|
| `shared/api-client.js` | ligne 6 : `require('../shared/api-client')` | `packages/maestro-cli/api-client.js` |
| `shared/utils/cli-colors.ts` | ligne 9 : `require('../shared/utils/cli-colors.js')` | `packages/maestro-cli/utils/cli-colors.ts` |
| `shared/utils/status.ts` | ligne 426 : `require('../shared/utils/status.js')` | `packages/maestro-cli/utils/status.ts` |
| `shared/utils/tier-selector.ts` | ligne 6015 : `require('../shared/utils/tier-selector.ts')` | `packages/maestro-cli/utils/tier-selector.ts` |
| `shared/tui/keybindings.ts` | ligne 7739 : `require('../shared/tui/keybindings.ts')` | `packages/maestro-cli/keybindings/keybindings.ts` |
| `shared/tui/keybinding-resolver.ts` | ligne 7740 : `require('../shared/tui/keybinding-resolver.ts')` | `packages/maestro-cli/keybindings/keybinding-resolver.ts` |

Les fichiers ESM (`output-formatter.ts`, `shell.ts`) qui utilisent `import` de shared/ seront migres vers `@maestro/tui` dans 33-C-C.

---

## Vision

**Separation des responsabilites :**

```
@maestro/tui (RENDU — partage, reutilisable, aucune logique metier)
+-- Hooks       : useScroll, usePanelFocus, useKeyboard, useTreeNav, useSelectableList
+-- Components  : Panel, StatusBar, Header, TabBar, NavBar, DataTable
+-- Theme       : palette configurable via createTheme(), icons, tokens, terminal
+-- Keybindings : systeme de keybindings + resolver

Apps dans packages/ (LOGIQUE — specifique a chaque app)
+-- maestro-monitor   : sessions Maestro, WorkflowTree, PhaseList, useSessionData
+-- provider-monitor  : LLM-Provider, MetricsTab, QueueTab, useApiPolling, useLogStream
+-- maestro-code      : mode interactif, SessionManager, InkTable, headless
+-- maestro-cli       : commandes CLI, output-formatter, shell
+-- [future app]      : importe @maestro/tui, ajoute sa logique propre
```

---

## Structure cible du projet

```
C:\Meastro\                                         (root — npm workspaces)
+-- package.json                                    workspaces: ["packages/*"]
+-- node_modules/                                   hoisted: react, ink, typescript, vitest, ...
+-- CLAUDE.md
|
+-- packages/                                       TOUT LE TYPESCRIPT/NODE
|   |
|   +-- tui/                                        @maestro/tui — DESIGN SYSTEM PARTAGE
|   |   +-- package.json                            name: "@maestro/tui", exports map
|   |   +-- hooks/
|   |   |   +-- index.ts                            export { useScroll, usePanelFocus, ... }
|   |   |   +-- useScroll.ts                        canonique, bugs corriges
|   |   |   +-- usePanelFocus.ts                    canonique
|   |   |   +-- useKeyboard.ts                      action-based (createActionKeyboardHandler)
|   |   |   +-- useTreeNav.ts                       tree expand/collapse
|   |   |   +-- useSelectableList.ts                j/k selection + scroll windowing
|   |   |   +-- useMouse.ts                         mouse handler
|   |   |   +-- useApiData.ts                       re-export de usePolling
|   |   +-- components/
|   |   |   +-- index.ts                            export { Panel, StatusBar, Header, ... }
|   |   |   +-- Panel.ts                            bordered container (title, focus, border)
|   |   |   +-- StatusBar.ts                        bottom status line
|   |   |   +-- Header.ts                           top bar
|   |   |   +-- TabBar.ts                           tab navigation (+ TabDef type)
|   |   |   +-- Shortcut.ts                         shortcut display (+ ShortcutProps type)
|   |   +-- theme/
|   |   |   +-- index.ts                            export { palette, semantic, icons, ... }
|   |   |   +-- create-theme.ts                     createTheme(overrides) — factory
|   |   |   +-- colors.ts                           defaultPalette, semantic
|   |   |   +-- tokens.ts                           icons, layout constants
|   |   |   +-- brand.ts                            branding par defaut
|   |   |   +-- terminal.ts                         setTerminalBg, resetTerminalBg
|   |   +-- keybindings/
|   |   |   +-- index.ts                            barrel export
|   |   |   +-- keybindings.ts                      default key mappings + loader
|   |   |   +-- keybinding-resolver.ts              parseBinding, matchInput, resolveAction
|   |   +-- types/
|   |   |   +-- index.ts
|   |   |   +-- session.ts, block.ts, workspace.ts, project.ts
|   |   |   +-- llm.ts, api-client.ts
|   |   +-- utils/
|   |   |   +-- cli-colors.ts, tree.ts, format.ts
|   |   |   +-- status.ts, progress.ts, resolve.ts
|   |   |   +-- index.ts
|   |   +-- app/
|   |       +-- index.ts, hooks/, transforms/
|   |
|   +-- maestro-cli/                                @maestro/cli — COMMANDES CLI
|   |   +-- package.json                            deps: { "@maestro/tui": "*" }
|   |   +-- index.js                                CJS entry point
|   |   +-- cli.ts                                  toutes les commandes (~8000 lignes)
|   |   +-- output-formatter.ts                     formatTable, formatDate, suggestCommand
|   |   +-- shell.ts                                REPL shell
|   |   +-- config.ts                               getBackendUrl, getApiKey, readConfig
|   |   +-- discover.ts                             block discovery
|   |   +-- json-parser.ts                          JSON parsing
|   |   +-- api-client.js                           CJS HTTP client (copie locale)
|   |   +-- utils/                                  cli-colors.ts, status.ts, tier-selector.ts (copies locales CJS)
|   |   +-- keybindings/                            keybindings.ts, keybinding-resolver.ts (copies locales CJS)
|   |   +-- tests/                                  validator, execute-integration, phase-workflow-tree, shared-*
|   |
|   +-- maestro-monitor/                            @maestro/monitor — MONITOR SESSIONS MAESTRO (CJS bridge)
|   |   +-- package.json                            deps: { "@maestro/tui": "*" }, PAS de "type":"module"
|   |   +-- tui-monitor.ts                          entry point (startMonitor, DI apiClient)
|   |   +-- App.ts                                  composant racine (navigation, pages)
|   |   +-- theme.ts                                createTheme() avec defaults Maestro
|   |   +-- mock-api-client.ts                      mock pour dev/test
|   |   +-- tsconfig.json
|   |   +-- components/                             28 composants SPECIFIQUES au monitor Maestro
|   |   |   +-- HomeScreen.ts, SpacesScreen.ts, FoundryScreen.ts
|   |   |   +-- CatalogScreen.ts, ModelsScreen.ts, LLMMonitorScreen.ts
|   |   |   +-- SessionMonitor.ts, WorkflowTree.ts, PhaseList.ts, PhaseWorkflow.ts
|   |   |   +-- ExecutionLog.ts, LLMActivity.ts, Artifacts.ts, CommandLog.ts
|   |   |   +-- Variables.ts, WidgetsPanel.ts, MetricsPanel.ts, Filesystem.ts
|   |   |   +-- GlobalMonitor.ts, Header.ts, NavBar.ts, StatusBar.ts, Panel.ts
|   |   |   +-- BlockDetail.ts, ModelDetail.ts, RepoDetail.ts
|   |   |   +-- SessionList.ts, WorkspaceDetail.ts
|   |   |   (imports: @maestro/tui pour Panel, useScroll, theme, etc.)
|   |   +-- hooks/                                  hooks SPECIFIQUES au monitor Maestro
|   |       +-- useKeyboard.ts                      wrapper Ink useInput + createActionKeyboardHandler
|   |       +-- useSessionData.ts                   polling session data
|   |       +-- useAnimationTick.ts                 animation timer
|   |
|   +-- maestro-code/                               @maestro/code — MODE INTERACTIF (CJS bridge)
|   |   +-- package.json                            deps: { "@maestro/tui": "*" }, PAS de "type":"module"
|   |   +-- App.ts                                  composant Ink (SessionManager, prompt)
|   |   +-- launcher.ts                             CJS dynamic import wrapper
|   |   +-- headless.ts                             mode CI/pipes
|   |   +-- ink-table.ts                            InkTable (imports: @maestro/tui)
|   |   +-- ink-table-launcher.ts                   CJS wrapper InkTable
|   |   +-- tests/                                  32 tests (deplaces depuis maestro-cli/tests/interactive/)
|   |
|   +-- provider-monitor/                           @maestro/provider-monitor — MONITOR LLM-PROVIDER
|       +-- package.json                            deps: { "@maestro/tui": "*", "tail": "..." }
|       +-- tsconfig.json                           PAS d'alias @shared, clean
|       +-- src/
|           +-- index.ts                            entry point
|           +-- cli.ts                              commandes (start, stop, status, stats, models)
|           +-- api-client.ts                       HTTP client vers .NET API (port 5010)
|           +-- process-manager.ts                  lifecycle dotnet run
|           +-- log-streamer.ts                     tail Serilog logs
|           +-- output-formatter.ts                 dual JSON/text output
|           +-- mock-data.ts                        mock pour --mock
|           +-- app.tsx                             composant Ink racine
|           |   (imports: @maestro/tui/components, @maestro/tui/hooks)
|           +-- theme.ts                            createTheme({ palette: { brand: 'cyan', ... } })
|           +-- config/tui.ts                       tabs, shortcuts
|           +-- tui/                                keybinding resolver local (simple 4-action)
|           +-- tabs/                               ecrans SPECIFIQUES
|           |   +-- MetricsTab.tsx, LogsTab.tsx
|           |   +-- QueueTab.tsx, ModelsTab.tsx
|           +-- hooks/                              hooks SPECIFIQUES
|               +-- use-api-polling.ts              polling .NET API (port 5010)
|               +-- use-log-stream.ts               file watcher Serilog
|
+-- llm-provider/                                   LLM-PROVIDER (MIGRE DANS LE REPO)
|   +-- dotnet/                                     .NET Clean Architecture (port 5010)
|   |   +-- src/LLMProvider.{Domain,Application,Infrastructure,Web,...}/
|   +-- api/                                        Python FastAPI (GPU inference, port 8000)
|
+-- backend/                                        C# .NET MAESTRO (inchange)
|   +-- src/Maestro.{Domain,Application,Infrastructure,Api}/
|
+-- frontend/                                       React + Vite (MAJ alias @shared → packages/tui)
|   +-- src/
|
+-- content/                                        blocks, templates, sessions (inchange)
|   +-- system/blocks/, templates/
|
+-- docs/
|   +-- phases/PHASE-33C/
|
+-- maestro-mcp/                                    MCP server (MAJ import api-client)
+-- dev-scripts/                                    scripts de dev (MAJ paths LLM-Provider)
```

**Legende :**
- Tout ce qui est dans `packages/` est un workspace npm
- `@maestro/tui` = le design system partage, importe par TOUTES les apps ESM
- `packages/maestro-cli/` garde des copies locales pour les `require()` CJS
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
8. **Ne PAS require() @maestro/tui depuis cli.ts** — utiliser les copies locales CJS

---

## Etat actuel apres analyse profonde

### Maestro monitor (maestro-cli/monitor/ink/)
- 28 composants, 8 hooks
- **4 hooks sont des re-exports purs** de shared/tui (useScroll, usePanelFocus, useTreeNav, useMouse)
- useKeyboard importe `createActionKeyboardHandler` de shared/tui + ajoute du wiring Ink `useInput` (wrapper, pas un simple re-export)
- useApiData re-exporte `usePolling` de shared/app/hooks/usePolling.ts
- useSessionData et useAnimationTick sont des implementations standalone (pas de delegation vers shared/)
- Utilise shared/theme (palette, tokens, terminal), shared/types, shared/utils (tree, format, status)
- **0 tests** pour le monitor

### LLM-Provider monitor (C:\LLM-Provider\monitor/)
- ~25 fichiers source, 95% autonome actuellement
- **Copies independantes** de : useScroll (34 lignes), usePanelFocus (31 lignes), useActionKeyboard, keybinding-resolver
- Theme propre (palette cyan/violet, semantic, borders) — fichiers dans src/theme/
- Seulement **2 type imports** de @shared (TabDef, ShortcutProps) dans src/config/tui.ts — **ce fichier est lui-meme jamais importe (dead code)**
- useScroll API INCOMPATIBLE : `useScroll(contentHeight, panelHeight)` vs Maestro `useScroll()` multi-panel
- TabBar.tsx locale est dead code (Header.tsx rend ses propres tabs inline)
- use-process-state.ts est unused
- **0 tests**

### CLI interactive (maestro-cli/interactive/)
- 5 fichiers (App.ts, launcher.ts, headless.ts, ink-table.ts, ink-table-launcher.ts)
- Seul ink-table.ts importe de shared/tui (useSelectableList)
- 32 tests (App 25, headless 4, ink-table 3)

### CLI principal (maestro-cli/cli.ts)
- ~8000 lignes, CJS via tsx
- **6 require() vers shared/** (api-client, cli-colors, status, tier-selector, keybindings, keybinding-resolver)
- **4 require() vers sous-modules** (tui-monitor, launcher, headless, ink-table-launcher)
- `output-formatter.ts` utilise ESM `import` de shared/utils/cli-colors
- `shell.ts` utilise ESM `import` de shared/theme + shared/utils/cli-colors

### shared/tui — etat reel (40 fichiers total)
- **Hooks (8 avec index)** : 7 utilises via re-exports monitor ou import direct (useScroll, usePanelFocus, useKeyboard, useTreeNav, useMouse, useApiData, useSelectableList)
- **Components (15 avec index)** : 2 utilises (Panel par LLMMonitorScreen, TabBar/Shortcut types par LLM-Provider)
- **Widgets (13 avec index)** : 0 utilises — 100% mort
- **Keybindings (2)** : utilises par cli.ts (require runtime) et useKeyboard
- **Total code mort** : ~28 fichiers (13 composants inutilises + 13 widgets + index + WidgetRenderer)
- **Total code vivant** : ~12 fichiers (7 hooks + 2 keybindings + Panel + TabBar/Shortcut)

### shared/ hors tui — etat reel
- **theme/ (5)** : TOUS utilises (monitor + CLI shell)
- **types/ (9)** : 6 utilises (monitor types), 3 morts (page.ts, widget.ts, index.ts barrel)
- **utils/ (8)** : 7 utilises, 1 mort (index.ts barrel)
- **app/ (10)** : usePolling, useHealthMonitor, useSessionList + transforms utilises (frontend + monitor)
- **data/ (3), registry/ (3), ui/ (4)** : 0 imports — MORT (total 10 fichiers)
- **api-client.js** : utilise par cli.ts et maestro-mcp

---

## Incompatibilite useScroll [CRITIQUE]

Les deux monitors ont des APIs useScroll incompatibles :

| | Maestro (shared/tui) | LLM-Provider |
|---|---|---|
| Appel | `useScroll()` | `useScroll(contentHeight, panelHeight)` |
| Retour | `{ getOffset(panel), scrollUp(panel), scrollDown(panel), setMaxScroll(panel, max), reset(panel) }` | `{ offset, scrollUp, scrollDown, scrollToTop, scrollToBottom, canScrollUp, canScrollDown }` |
| Multi-panel | OUI (Map par nom de panel) | NON (un seul offset) |

**Decision** : L'API Maestro (multi-panel) devient canonique dans `@maestro/tui`. Le provider-monitor sera adapte en 33-C-C. Possibilite de creer un wrapper `useSinglePanelScroll()` pour simplifier les cas mono-panel.

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort | Plan detaille |
|-------|-------|--------|---------------|
| 33-C-A | Migration LLM-Provider + restructuration packages/ | 2-3 jours | `33-C-A/README.md` |
| 33-C-B | Construire @maestro/tui (nettoyage, merge, theme configurable) | 2-3 jours | `33-C-B/README.md` |
| 33-C-C | Migrer les consommateurs (monitor, provider, code, CLI, frontend) | 2-3 jours | `33-C-C/README.md` |
| 33-C-D | Fix bugs, tests du toolkit, validation E2E | 2-3 jours | `33-C-D/README.md` |

Les plans detailles de chaque sous-phase sont dans les dossiers correspondants.

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-33C/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 33-C COMPLETE — @maestro/tui design system, monorepo packages/, LLM-Provider migre, X tests"
- Ajouter : "Structure: packages/{tui, maestro-cli, maestro-monitor, maestro-code, provider-monitor}"
- Ajouter : "LLM-Provider: migre dans llm-provider/ (dotnet + api), monitor dans packages/provider-monitor/"
- Ajouter : "CJS/ESM: cli.ts garde copies locales, @maestro/monitor et @maestro/code sont CJS bridges, ESM consumers utilisent @maestro/tui"
- Mettre a jour tous les chemins dans Key File Paths et CLAUDE.md (CLI main, TUI monitor, Interactive App, etc.)
- Mettre a jour CLAUDE.md : section "CLI Commands" (paths), "Architecture Quick Reference", "Key File Paths", "Testing Commands"
- Retirer : "shared/tui ~70% code mort", "LLM-Provider a C:\LLM-Provider"
- Retirer de MEMORY.md : references a `C:\LLM-Provider\monitor\`, `maestro-cli/monitor/ink/`, `maestro-cli/interactive/`

---

## Risques techniques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| CJS require() d'un package ESM (@maestro/tui) | cli.ts crash ERR_REQUIRE_ESM | Copies locales CJS dans packages/maestro-cli/. @maestro/monitor et @maestro/code sont CJS (pas de "type":"module") pour que require() fonctionne |
| useScroll API incompatible entre monitors | Provider-monitor casse apres migration | Adapter les 4 tabs ou creer wrapper useSinglePanelScroll() |
| npm workspaces hoisting casse yoga-layout | Ink ne demarre plus | Dynamic import chain (launcher.ts) isole le probleme |
| Migration LLM-Provider casse les paths .NET | Backend LLM-Provider ne compile plus | Verifier `dotnet build` immediatement apres copie |
| CLI ne trouve plus monitor/code apres restructuration | Commandes `monitor` et `code` cassees | MAJ require() vers @maestro/monitor et @maestro/code |
| Tests cassent apres deplacement | 32 tests rouges | MAJ paths mecaniques, tester a chaque etape |
| Trop de fichiers a modifier dans 33-C-C | Risque de regression | Migrer un package a la fois, valider entre chaque |
