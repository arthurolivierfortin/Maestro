# Phase 23 — Template partagé & Infrastructure UI

## Résumé

Infrastructure UI partagée entre frontend web et TUI : types, registres de widgets/pages, composants réutilisables.

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `shared/ui/types.ts` | Types partagés : WidgetConfig, PageConfig, DataSourceConfig, NavItem, NavGroup, StatusInfo |
| `shared/ui/widget-registry.ts` | Registre de 11 types de widgets (health, stat, chart, list, table, log, progress, status, timeline, custom) |
| `shared/ui/page-registry.ts` | Registre de pages par config (route, layout, widgets, nav group) |
| `shared/ui/index.ts` | Barrel export |
| `frontend/src/components/ui/Card.tsx` | Card + CardHeader — variant (default/outlined/elevated/ghost), padding, hoverable |
| `frontend/src/components/ui/Badge.tsx` | Badge — variant (primary/success/warning/error/info/muted), size, dot |
| `frontend/src/components/ui/StatusIndicator.tsx` | Dot + label avec animation pulse — 10 statuts supportés |
| `frontend/src/components/ui/ui.scss` | Styles des composants UI + animations (fadeIn, fadeInUp, pulse, shimmer, breathe), skeleton loader, empty state |
| `frontend/src/components/ui/index.ts` | Barrel export des composants |

## Principe

Les composants UI sont des primitives simples et réutilisables. Le widget registry et page registry permettent de déclarer des pages/widgets par config JSON plutôt que par code.

## Design tokens

Tous les composants utilisent les CSS custom properties de `frontend/src/styles/tokens.css` (couleurs, spacing, radius, shadows, transitions).
