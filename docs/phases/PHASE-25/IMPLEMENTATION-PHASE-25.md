# Phase 25 — Refonte Frontend Web

## Résumé

Refonte des pages frontend principales : Dashboard dynamique, Settings amélioré, Chat poli, loading/error/empty states, animations de page.

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `frontend/src/pages/HomePage.tsx` | Transformation complète : page statique → dashboard live. Affiche health services (Backend API + LLM Provider), statistiques (sessions actives, blocks, modèle actif, VRAM), quick actions (6 liens), sessions récentes avec statut. Auto-refresh toutes les 10s. |
| `frontend/src/pages/HomePage.scss` | Refonte complète des styles : grilles responsive, cards stat, action cards avec hover, session list, empty state, responsive 768px |
| `frontend/src/pages/SettingsPage.tsx` | Ajout de tabs (LLM Provider / General / About). Tab General : auth status, API URL, version, data paths. Tab About : info produit. Fetch dynamique de `/api/health` et `/api/auth/status`. |
| `frontend/src/pages/SettingsPage.scss` | Refonte : tabs avec underline active, panels avec animation fadeIn, info rows, input styling via tokens |
| `frontend/src/pages/ChatPage.tsx` | Ajout toggle de paramètres (température avec slider), header restructuré |
| `frontend/src/pages/ChatPage.scss` | Refonte complète via tokens CSS : message animations (fadeIn), panel vide avec emoji, input focus, model selector. Suppression des couleurs hardcodées, utilisation de `var(--*)` partout. |

## Animations

| Animation | Fichier | Comportement |
|-----------|---------|-------------|
| `page-enter` | `ui.scss` → pages | `fadeInUp` 0.25s sur chaque page (classe CSS) |
| `fadeIn` | `ui.scss` → cards/panels | Apparition subtile 0.3s |
| `stagger-children` | `ui.scss` → grilles | Chaque enfant apparaît avec un délai de 50ms |
| `shimmer` | `ui.scss` → skeletons | Effet de chargement animé |
| `pulse` | `ui.scss` → status dots | Pulsation pour les statuts actifs |

## Design system

Tous les styles utilisent les CSS custom properties de `tokens.css` :
- Couleurs : `var(--color-primary)`, `var(--color-success)`, `var(--text-secondary)`, etc.
- Spacing : `var(--spacing-md)`, `var(--spacing-lg)`, etc.
- Border radius : `var(--radius-lg)`, etc.
- Shadows : `var(--shadow-md)`, etc.
- Transitions : `var(--transition-fast)`, `var(--transition-base)`, etc.
- Dark theme via `[data-theme='dark']` — fonctionne automatiquement

## Empty states

Le Dashboard affiche un empty state guidé quand il n'y a pas de sessions, avec un call-to-action pour en créer une.

## Loading states

Le Dashboard utilise des skeleton loaders (`ui-skeleton--card`) pendant le chargement initial.
