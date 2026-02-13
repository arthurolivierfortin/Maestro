# ADR: Unification de la logique applicative TUI ↔ Frontend

**Statut** : Accepté
**Date** : 2026-02-13
**Phase** : 25

## Contexte

Maestro possède deux interfaces utilisateur :
- **TUI Monitor** (Ink/React terminal) — première implémentation, orientée développeur, navigation clavier
- **Frontend Web** (React DOM) — seconde implémentation, orientée utilisateur no-code, interface graphique

Les deux sont des applications React qui consomment la même API backend REST. Cependant, un audit révèle une duplication significative de la logique applicative :

1. **Deux API clients** — `shared/api-client.js` (851 lignes, fetch) et `frontend/src/services/api.ts` (axios) appellent les mêmes endpoints indépendamment
2. **`useApiData` copié byte-for-byte** — existe dans `ink/hooks/` ET `shared/tui/hooks/` (57 lignes × 2)
3. **`useTreeNav` copié byte-for-byte** — existe dans `ink/hooks/` ET `shared/tui/hooks/` (158 lignes × 2)
4. **Le frontend n'importe RIEN de `shared/`** — l'alias `@shared` est configuré dans Vite mais zéro fichier ne l'utilise
5. **Fonctions pures dupliquées** — `statusColor()`, `formatDuration()`, extraction du modèle actif LLM, comptage de sessions par statut : toutes réimplémentées en inline dans le frontend
6. **Polling identique** — Les deux apps font `setInterval` + `fetch` vers `/api/health`, `/api/provider/health`, `/api/sessions` avec la même logique de retry/error

## Décision

Extraire toute la logique applicative non liée au rendu dans `shared/app/` :

```
shared/app/
├── transforms/          ← Fonctions pures (0 dépendance React)
│   ├── health.ts        ← extractActiveModel(), isServiceHealthy()
│   ├── session.ts       ← countByStatus(), filterByStatus()
│   ├── block.ts         ← sortByType(), groupByCategory()
│   └── model.ts         ← normalizeModelEntry()
├── hooks/               ← React hooks purs (useState/useEffect/useCallback)
│   ├── usePolling.ts    ← Remplace useApiData dupliqué
│   ├── useHealthMonitor.ts
│   ├── useSessionList.ts
│   └── useModelList.ts
├── services/            ← (futur) API client unifié TypeScript
└── __tests__/           ← Tests des transforms et hooks
```

### Règle de séparation

| Couche | Où | Peut importer de |
|--------|-----|------------------|
| **Transforms** (fonctions pures) | `shared/app/transforms/` | Rien (0 dépendance) |
| **Hooks applicatifs** (React pur) | `shared/app/hooks/` | `transforms/`, `shared/utils/` |
| **Composants TUI** (Ink) | `maestro-cli/monitor/ink/` | `shared/app/`, Ink |
| **Composants Frontend** (DOM) | `frontend/src/` | `shared/app/`, React DOM |

### Principe clé

> Un hook dans `shared/app/hooks/` ne doit JAMAIS importer de `ink`, `react-dom`, ou tout module spécifique à un renderer. Il utilise uniquement `react` (useState, useEffect, useCallback, useRef) — qui fonctionne dans les DEUX environnements car Ink EST React.

## Alternatives considérées

### 1. Garder les implémentations séparées
- **Pour** : Aucun risque de régression, simplicité
- **Contre** : Duplication croissante, divergence inévitable, bugs fixés d'un côté mais pas de l'autre

### 2. Zustand stores partagés
- **Pour** : State management unifié avec persistance
- **Contre** : Le TUI n'a pas besoin de persistance localStorage, surengineering pour le polling simple

### 3. Approche choisie : Hooks React purs + transforms
- **Pour** : Fonctionne dans les deux renderers, testable unitairement, migration incrémentale
- **Contre** : Refactoring des imports dans les deux apps

## Conséquences

1. **Le frontend importe de `@shared/`** — statusColor, formatDuration, transforms, hooks
2. **Les copies ink/** deviennent des re-exports — `useApiData` et `useTreeNav` importent de `shared/`
3. **Nouveaux hooks partagés** — usePolling, useHealthMonitor, useSessionList, useModelList
4. **Tests unitaires** — Chaque module `shared/app/` a ses tests
5. **Les composants de rendu restent séparés** — Ink Box/Text vs DOM div/span, c'est normal

## Plan de migration

1. Créer `shared/app/transforms/` avec fonctions pures extraites
2. Créer `shared/app/hooks/usePolling.ts` (remplace useApiData dupliqué)
3. Créer hooks domaine partagés (useHealthMonitor, useSessionList, useModelList)
4. Frontend importe de `@shared/utils/` et `@shared/app/`
5. `ink/hooks/useApiData.ts` → re-export de `shared/app/hooks/usePolling.ts`
6. `ink/hooks/useTreeNav.ts` → re-export de `shared/tui/hooks/useTreeNav.ts`
7. Tests pour tous les modules partagés
8. Build complet (backend + frontend + TUI)

## Implémentation (réalisée)

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `shared/app/transforms/health.ts` | `extractActiveModel()`, `isServiceHealthy()`, `toServiceHealth()`, `toLLMServiceHealth()`, `extractMaxTokens()`, `extractDevice()`, `extractBackend()` |
| `shared/app/transforms/session.ts` | `countByStatus()`, `filterByStatus()`, `filterRunning()`, `extractFitness()`, `statusToSemantic()` |
| `shared/app/transforms/block.ts` | `sortByType()`, `groupByType()`, `countByType()` |
| `shared/app/transforms/model.ts` | `normalizeModelEntry()`, `getModelName()`, `isActiveModel()` |
| `shared/app/transforms/index.ts` | Barrel export |
| `shared/app/hooks/usePolling.ts` | Hook de polling générique (remplace useApiData), alias `useApiData` |
| `shared/app/hooks/useHealthMonitor.ts` | Monitoring backend + LLM normalisé |
| `shared/app/hooks/useSessionList.ts` | Liste sessions avec compteurs par statut |
| `shared/app/hooks/useModelList.ts` | Liste modèles normalisée avec modèle actif |
| `shared/app/hooks/index.ts` | Barrel export |
| `shared/app/index.ts` | Barrel top-level |

### Fichiers modifiés (dedup)

| Fichier | Changement |
|---------|------------|
| `shared/tui/hooks/useApiData.ts` | Re-export de `shared/app/hooks/usePolling` |
| `ink/hooks/useApiData.ts` | Re-export de `shared/app/hooks/usePolling` |
| `ink/hooks/usePanelFocus.ts` | Re-export de `shared/tui/hooks/usePanelFocus` |
| `ink/hooks/useScroll.ts` | Re-export de `shared/tui/hooks/useScroll` |
| `ink/hooks/useTreeNav.ts` | Re-export de `shared/tui/hooks/useTreeNav` |
| `ink/hooks/useMouse.ts` | Re-export de `shared/tui/hooks/useMouse` |
| `frontend/tsconfig.json` | `include` ajoute `../shared/{app,types,utils,theme,ui}`, paths map `react` |
| `frontend/src/pages/HomePage.tsx` | Utilise `useHealthMonitor`, `useSessionList`, `usePolling`, `statusToSemantic` |

### Tests

| Fichier | Tests |
|---------|-------|
| `maestro-cli/tests/shared-app-transforms.test.ts` | 86 tests (health, session, block, model transforms) |
| `maestro-cli/tests/verify-shared-app-imports.test.ts` | 32 tests (barrel exports, re-export chain, single-source-of-truth) |

### Vérification builds

- Backend: 0 erreurs, 93 tests passent
- Frontend: `tsc --noEmit` propre, `vite build` succès
- CLI: 88 tree tests passent, 29 shared-imports tests passent
