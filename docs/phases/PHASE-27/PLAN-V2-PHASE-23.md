# Plan — V2 Phase 23 : Template partagé & Infrastructure UI

## Prérequis
- [x] GATE V1 complète

## Objectif
Créer un système de layout, widgets et pages configurables, partagé entre TUI, CLI et Frontend.

## Déjà fait (10%)
- `shared/theme/` : couleurs, brand, tokens, terminal
- `shared/tui/components/` : Panel, NavBar, StatusBar
- `shared/tui/hooks/` : useActionKeyboard, usePanelFocus, useScroll, useTreeNav, useApiData, useMouse
- TUI `_monitorDescriptor` : layout zones + component bindings (données, pas registre)
- `frontend/src/components/ui/` : Badge, Card, StatusIndicator, ui.scss (animations, skeleton)

---

## Étapes — Widget Registry

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 1 | Définir l'interface Widget | `shared/types/widget.ts` — WidgetDefinition, WidgetInstance, DataSourceConfig, LayoutZone, PageLayout | ✅ |
| 2 | Créer WidgetRegistry | `shared/registry/widget-registry.ts` — register, get, list, setComponent, 13 built-in definitions | ✅ |
| 3 | Enregistrer widgets existants | registerBuiltinWidgets() — phase-list, execution-tree, execution-log, llm-activity, metrics, artifacts, variables, command-log, filesystem, phase-workflow, health, session-list, widgets | ✅ |
| 4 | Widget renderer dynamique | `shared/tui/components/WidgetRenderer.ts` — resolves type via registry, feeds data from bindings | ✅ |
| 5 | Refactorer SessionMonitor | Remplacer les imports directs par WidgetRenderer + descriptor | ⬜ Requires component-level refactor |
| 6 | Tester widget custom | Créer un widget "custom-counter" → l'ajouter au descriptor d'une session | ⬜ Run-time |

## Étapes — Page Registry

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 8 | Définir l'interface Page | `shared/types/page.ts` — PageDefinition, NavigationState, DetailView, BreadcrumbItem | ✅ |
| 9 | Créer PageRegistry | `shared/registry/page-registry.ts` — register, get, list, findByShortcut, 5 built-in pages | ✅ |
| 10 | Enregistrer pages TUI existantes | registerBuiltinPages() — home, spaces, foundry, catalog, models (with shortcuts) | ✅ |
| 11 | Refactorer App.ts | Remplacer switch(currentPage) par PageRegistry | ⬜ Requires component-level refactor |

## Étapes — Navigation Framework

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 14 | Breadcrumb TUI | `shared/tui/components/Breadcrumb.ts` — buildBreadcrumbs helper + Ink component | ✅ |
| 16 | Breadcrumb Frontend | `frontend/src/components/ui/Breadcrumb.tsx` — web breadcrumb with click navigation | ✅ |
| 17 | Intégrer breadcrumbs | Wire into TUI App.ts and frontend layout | ⬜ Requires component-level refactor |

## Étapes — Data Binding

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 18 | Définir DataSource interface | `DataSourceConfig` type in `shared/types/widget.ts` (api, signalr, variable, static) | ✅ |
| 19 | Créer DataSourceResolver | `shared/data/data-source-resolver.ts` — resolveDataSource, resolveBindingSync | ✅ |
| 20 | Connecter WidgetRenderer au DataSource | WidgetRenderer resolves bindings via resolveBindingSync | ✅ |

## Étapes — Shared Component Library

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 24 | Frontend UI components | LoadingState, ErrorState, EmptyState — `frontend/src/components/ui/StateDisplays.tsx` | ✅ |
| 25 | Frontend Breadcrumb | `frontend/src/components/ui/Breadcrumb.tsx` | ✅ |
| 26 | TUI WidgetRenderer | `shared/tui/components/WidgetRenderer.ts` | ✅ |
| 27 | Barrel exports updated | shared/types/index.ts, shared/tui/components/index.ts, shared/registry/index.ts, shared/data/index.ts | ✅ |

---

## Gate de sortie
- [x] Widget types and registry créés (13 built-in definitions)
- [x] Page types and registry créés (5 built-in pages)
- [x] Breadcrumbs créés pour TUI et Frontend
- [x] Data binding resolver créé (variable, api, static, signalr placeholder)
- [x] LoadingState/ErrorState/EmptyState composants frontend
- [ ] Refactoring SessionMonitor et App.ts vers registries — requires deep TUI refactor (deferred to Phase 24 audit)

## Fichiers créés
- `shared/types/widget.ts` — WidgetDefinition, WidgetInstance, DataSourceConfig, LayoutZone, PageLayout
- `shared/types/page.ts` — PageDefinition, NavigationState, DetailView, BreadcrumbItem
- `shared/registry/widget-registry.ts` — WidgetRegistry singleton + registerBuiltinWidgets
- `shared/registry/page-registry.ts` — PageRegistry singleton + registerBuiltinPages
- `shared/registry/index.ts` — barrel export
- `shared/data/data-source-resolver.ts` — resolveDataSource, resolveBindingSync
- `shared/data/index.ts` — barrel export
- `shared/tui/components/Breadcrumb.ts` — TUI breadcrumb + buildBreadcrumbs
- `shared/tui/components/WidgetRenderer.ts` — dynamic widget renderer
- `frontend/src/components/ui/StateDisplays.tsx` — LoadingState, ErrorState, EmptyState
- `frontend/src/components/ui/Breadcrumb.tsx` — web breadcrumb component

## Fichiers modifiés
- `shared/types/index.ts` — added widget and page type exports
- `shared/tui/components/index.ts` — added Breadcrumb, WidgetRenderer exports
- `frontend/src/components/ui/index.ts` — added StateDisplays, Breadcrumb exports
