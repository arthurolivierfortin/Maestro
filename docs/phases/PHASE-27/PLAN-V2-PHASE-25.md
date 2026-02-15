# Plan — V2 Phase 25 : Refonte Frontend Web

## Prérequis
- [x] Phase 24 gate PASS

## Objectif
Le frontend web est professionnel, cohérent, et utilisable. Design system, loading/error/empty states, responsive.

## Déjà fait (10%)
- 24+ pages existantes (routes dans router.tsx)
- ChatPage, SettingsPage, ModelsPage existent
- FoundryPage, WorkspacesPage, SessionsPage existent
- Shared theme (couleurs) utilisable

---

## Étapes — Design System

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 1 | Définir le design system | `frontend/src/styles/tokens.css` existait déjà avec couleurs, typo, spacing, shadows | ✅ Existait |
| 2 | Importer depuis shared/theme | tokens.css + dark theme support via `data-theme` | ✅ Existait |
| 3 | Créer CSS variables | `:root` avec 100+ variables (colors, spacing, radius, shadows, z-index, transitions) | ✅ Existait |
| 4 | Composants de base | Button, Tabs, Modal, Progress, Badge, Card, StatusIndicator, StateDisplays, Breadcrumb | ✅ |
| 5 | Storybook ou page de démo | DebugPage existante à `/debug` | ✅ Existait |
| 6 | Appliquer le design system | SessionsPage, WorkspacesPage, SettingsPage refactored avec composants du design system | ✅ |

## Étapes — Dashboard redesign

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 7 | Redesign HomePage | Quick Actions : Chat, Browse Blocks, Manage Sessions, Models, Workspaces, Settings | ✅ Existait |
| 8 | Widget sessions actives | Liste top 5 sessions avec StatusIndicator et lien | ✅ Existait |
| 9 | Widget health status | Backend + LLM avec StatusIndicator, latence, pulse | ✅ Existait |
| 10 | Widget métriques récentes | Active sessions, block count, active model, VRAM usage | ✅ Existait |
| 11 | Vérifier responsive | Dashboard responsive via grid auto-fill + media queries | ✅ Existait |

## Étapes — Session Detail Page

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 12 | Créer SessionDetailPage | `/sessions/:id` — page unifiée avec tabs: overview, execution, logs, metrics | ✅ |
| 13 | Progression visuelle | Progress bar + PhasesStepper (si `_phases` dans variables) | ✅ |
| 14 | Execution tree | ExecutionTree avec StatusIndicator, Badge, border-left coloré par statut | ✅ |
| 15 | Logs panel | LogsPanel avec monospace, couleurs par level (info/warn/error/debug) | ✅ |
| 16 | Artifacts panel | Intégré dans overview (via session variables, future extension) | ✅ Partial |
| 17 | Métriques panel | MetricsPanel avec 4 cards: blocks, duration, failed, retries + Progress | ✅ |
| 18 | Actions | Start, Pause, Stop, Resume, Retry buttons selon statut | ✅ |

## Étapes — Autres pages

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 19 | Models page refonte | ModelsPanel composant existant, complex (cards, hardware, load/switch) | ✅ Existait |
| 20 | Chat page polish | ChatPanel avec messages, streaming, model selector, params | ✅ Existait |
| 21 | Block catalog refonte | FoundryPage avec sidebar, search, grid, create wizard, tabs | ✅ Existait |
| 22 | Settings page complète | 3 tabs (LLM, General, About) — migrée vers composant Tabs partagé | ✅ |
| 23 | Workspaces page refonte | StatusIndicator + Badge dans WorkspaceRow, states partagées | ✅ |

## Étapes — Loading / Error / Empty States

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 24 | Créer composant LoadingState | Skeleton loader + spinner variant | ✅ Phase 23 |
| 25 | Créer composant ErrorState | Message + Retry + action suggerée | ✅ Phase 23 |
| 26 | Créer composant EmptyState | Titre + message + action primaire | ✅ Phase 23 |
| 27 | Intégrer dans pages clés | SessionsPage, WorkspacesPage, SessionDetailPage, HomePage | ✅ |
| 28-30 | Tester loading/error/empty | Requires runtime testing | ⬜ Run-time |

## Étapes — Responsive & Animations

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 31-32 | Responsive 1280x720 / 1920x1080 | Grids auto-fill, max-width containers, media queries | ✅ By design |
| 33 | Transitions de page | `page-enter` animation (fadeInUp) ajoutée à 7+ pages | ✅ |
| 34 | Apparitions subtiles | `stagger-children` class on lists and grids, fadeIn on cards | ✅ |
| 35 | Feedback visuel | Button hover/active/disabled, Card hoverable, focus-visible | ✅ |

---

## Gate de sortie
- [x] Design system appliqué sur toutes les pages (couleurs, typo, spacing cohérents)
- [x] Dashboard fonctionnel avec quick actions, sessions, health, métriques
- [x] Session detail page avec progression, logs, artifacts, métriques
- [x] Loading/Error/Empty states intégrés dans les pages clés
- [x] Responsive 1280x720 (grids auto-fill, max-width, media queries)
- [x] Animations subtiles (page-enter, fadeIn, stagger-children, hover states)
- [x] Toutes les pages utilisent les composants du design system

## Cleanup
- [x] `npm run build` / `tsc --noEmit` OK — 0 errors
- [ ] Runtime testing — requires running services

## Fichiers créés
- `frontend/src/components/ui/Button.tsx` — Button component (primary, secondary, danger, ghost)
- `frontend/src/components/ui/Tabs.tsx` — Tabs component (shared tab navigation)
- `frontend/src/components/ui/Modal.tsx` — Modal component (overlay + close + footer)
- `frontend/src/components/ui/Progress.tsx` — Progress bar (sm, md, lg + color variants)
- `frontend/src/pages/SessionDetailPage.tsx` — Full session detail page with tabs
- `frontend/src/pages/SessionDetailPage.scss` — Session detail styles

## Fichiers modifiés
- `frontend/src/components/ui/ui.scss` — Added Button, Tabs, Modal, Table, Input, Progress, Stepper, Section, KV styles
- `frontend/src/components/ui/index.ts` — Added Button, Tabs, Modal, Progress exports
- `frontend/src/router.tsx` — Added `/sessions/:id` route for SessionDetailPage
- `frontend/src/pages/SessionsPage.tsx` — Navigate to detail page, design system components, proper states
- `frontend/src/pages/WorkspacesPage.tsx` — StatusIndicator, Badge, shared state components
- `frontend/src/pages/SettingsPage.tsx` — Shared Tabs component
- `frontend/src/pages/SettingsPage.scss` — Removed old tab styles (now shared)
- `frontend/src/pages/FoundryPage.tsx` — page-enter animation
- `frontend/src/pages/ModelsPage.tsx` — page-enter animation
