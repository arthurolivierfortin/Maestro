# 33-C-B : Construire @maestro/tui

**Statut** : PAS_COMMENCE
**Prerequis** : 33-C-A DONE (packages/ existent, npm install OK, tests passent)
**Objectif** : Transformer `packages/tui/` (copie brute de shared/) en un vrai package `@maestro/tui` : supprimer le code mort, aplatir la structure, creer `createTheme()`, barrel exports.

**Regle** : Cette sous-phase modifie UNIQUEMENT `packages/tui/`. Aucun consommateur n'est mis a jour — ils continuent a utiliser les anciens paths jusqu'a 33-C-C.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `C:\Meastro\packages\tui\tui\hooks\index.ts` | Barrel exports actuels des hooks |
| `C:\Meastro\packages\tui\tui\hooks\useKeyboard.ts` | Import de keybinding-resolver (path a corriger) |
| `C:\Meastro\packages\tui\tui\hooks\useApiData.ts` | Re-export shim vers app/hooks/usePolling (path a corriger) |
| `C:\Meastro\packages\tui\tui\components\Panel.ts` | Composant vivant — garder |
| `C:\Meastro\packages\tui\tui\components\TabBar.ts` | Type TabDef vivant — garder |
| `C:\Meastro\packages\tui\tui\components\Shortcut.ts` | Type ShortcutProps vivant — garder |
| `C:\Meastro\packages\tui\theme\colors.ts` | Palette actuelle (defaultPalette, semantic) |
| `C:\Meastro\packages\tui\theme\tokens.ts` | Icons, layout constants |
| `C:\Meastro\packages\tui\theme\index.ts` | Barrel actuel — a enrichir avec createTheme |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Supprimer le code mort

**Supprimer entierement (dossiers complets) :**
- `packages/tui/tui/widgets/` — 13 fichiers, 0 imports externes
  - Confirmation.ts, DiffView.ts, FileTreeWidget.ts, LogStream.ts, MessageWidget.ts
  - OptionSelect.ts, PlanView.ts, ProgressWidget.ts, TableWidget.ts, TestResults.ts
  - TextInput.ts, WidgetDispatcher.ts, index.ts

**Supprimer dans `packages/tui/tui/components/` (10 fichiers morts) :**
- AppHeader.ts — 0 imports
- AppStatusBar.ts — 0 imports
- Breadcrumb.ts — 0 imports (frontend a sa propre version React)
- DataTable.ts — 0 imports (ink-table.ts ne l'importe pas, juste un commentaire)
- KV.ts — 0 imports
- NavBar.ts — 0 imports (monitor a sa propre NavBar locale)
- PersistentStatusBar.ts — 0 imports
- ProgressBar.ts — 0 imports
- StatusIndicator.ts — 0 imports
- WidgetRenderer.ts — 0 imports

**Garder dans `packages/tui/tui/components/` (5 fichiers) :**
- Panel.ts — utilise par maestro-cli/monitor/ink/components/LLMMonitorScreen.ts
- TabBar.ts — type `TabDef` utilise par LLM-Provider config/tui.ts
- Shortcut.ts — type `ShortcutProps` utilise par LLM-Provider config/tui.ts
- StatusBar.ts — futur composant canonique
- index.ts — a reecrire (exporter seulement les survivants)

**Supprimer dans `packages/tui/types/` (2 fichiers morts) :**
- page.ts — 0 imports externes
- widget.ts — 0 imports externes

**Total supprime : ~25 fichiers**

### Etape 2 : Aplatir tui/ vers la racine du package

Deplacer les sous-dossiers de `packages/tui/tui/` un niveau plus haut :

```
packages/tui/tui/hooks/              → packages/tui/hooks/
packages/tui/tui/components/         → packages/tui/components/
packages/tui/tui/keybindings.ts      → packages/tui/keybindings/keybindings.ts
packages/tui/tui/keybinding-resolver.ts → packages/tui/keybindings/keybinding-resolver.ts
```

Supprimer `packages/tui/tui/` apres les moves (index.ts restant est mort).

Creer `packages/tui/keybindings/index.ts` :
```typescript
export * from './keybindings.ts';
export * from './keybinding-resolver.ts';
```

### Etape 3 : Fixer les imports internes

Apres l'aplatissement, les chemins relatifs internes changent :

**`packages/tui/hooks/useKeyboard.ts`** :
```typescript
// AVANT (depuis tui/hooks/) :
import { resolveBindings, matchInput, ... } from '../keybinding-resolver.ts';
// APRES (depuis hooks/) :
import { resolveBindings, matchInput, ... } from '../keybindings/keybinding-resolver.ts';
```

**`packages/tui/hooks/useApiData.ts`** :
```typescript
// AVANT (depuis tui/hooks/, pointant vers shared/app/) :
export { usePolling as useApiData, ... } from '../../app/hooks/usePolling.ts';
// APRES (depuis hooks/, pointant vers app/) :
export { usePolling as useApiData, ... } from '../app/hooks/usePolling.ts';
```

**`packages/tui/components/index.ts`** : reecrire pour exporter seulement les survivants :
```typescript
export { Panel } from './Panel.ts';
export { TabBar } from './TabBar.ts';
export type { TabDef } from './TabBar.ts';
export { Shortcut } from './Shortcut.ts';
export type { ShortcutProps } from './Shortcut.ts';
export { StatusBar } from './StatusBar.ts';
```

**`packages/tui/hooks/index.ts`** : verifier qu'il exporte les 7 hooks + useApiData.

### Etape 4 : Creer createTheme()

Nouveau fichier `packages/tui/theme/create-theme.ts` :
```typescript
import { palette as defaultPalette, semantic as defaultSemantic } from './colors.ts';
import { icons as defaultIcons, layout as defaultLayout } from './tokens.ts';

export interface ThemeOverrides {
  palette?: Partial<typeof defaultPalette>;
  icons?: Partial<typeof defaultIcons>;
}

export function createTheme(overrides: ThemeOverrides = {}) {
  return {
    palette: { ...defaultPalette, ...overrides.palette },
    icons: { ...defaultIcons, ...overrides.icons },
    layout: defaultLayout,
  };
}

export type MaestroTheme = ReturnType<typeof createTheme>;
```

MAJ `packages/tui/theme/index.ts` — ajouter :
```typescript
export { createTheme, type MaestroTheme, type ThemeOverrides } from './create-theme.ts';
```

### Etape 5 : Barrel exports racine

Creer `packages/tui/index.ts` :
```typescript
export * from './hooks/index.ts';
export * from './components/index.ts';
export * from './theme/index.ts';
export * from './keybindings/index.ts';
```

Note : `types/`, `utils/`, `app/` sont accessibles via les sub-path exports du package.json (`@maestro/tui/types`, etc.) mais PAS dans le barrel racine pour eviter les conflits de noms. Les sub-path wildcards (`"./utils/*": "./utils/*"`, `"./app/*": "./app/*"`) permettent aussi des imports granulaires comme `@maestro/tui/utils/cli-colors.ts` pour les cas ou le barrel causerait des namespace collisions (ex: `import * as c from '@maestro/tui/utils'` importerait TOUT utils/).

### Etape 6 : Configuration test et build

Creer `packages/tui/vitest.config.ts` pour que @maestro/tui ait ses propres tests (les tests du toolkit doivent vivre dans leur package, pas dans maestro-code) :
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

Creer le dossier `packages/tui/tests/` (vide pour l'instant, les tests seront ajoutes en 33-C-D).

### Etape 7 : tsconfig.json du package

Creer/reecrire `packages/tui/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react",
    "jsxFactory": "createElement",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": [
    "hooks/**/*.ts",
    "components/**/*.ts",
    "theme/**/*.ts",
    "keybindings/**/*.ts",
    "types/**/*.ts",
    "utils/**/*.ts",
    "app/**/*.ts",
    "index.ts"
  ],
  "exclude": ["node_modules"]
}
```

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/tui/tui/widgets/` (13 fichiers) | Supprimer — code mort |
| `packages/tui/tui/components/` (10 fichiers) | Supprimer — AppHeader, AppStatusBar, Breadcrumb, DataTable, KV, NavBar, PersistentStatusBar, ProgressBar, StatusIndicator, WidgetRenderer |
| `packages/tui/types/page.ts` | Supprimer — code mort |
| `packages/tui/types/widget.ts` | Supprimer — code mort |
| `packages/tui/tui/hooks/` | Deplacer → `packages/tui/hooks/` |
| `packages/tui/tui/components/` (5 survivants) | Deplacer → `packages/tui/components/` |
| `packages/tui/tui/keybindings.ts` | Deplacer → `packages/tui/keybindings/keybindings.ts` |
| `packages/tui/tui/keybinding-resolver.ts` | Deplacer → `packages/tui/keybindings/keybinding-resolver.ts` |
| `packages/tui/tui/` | Supprimer (vide apres moves) |
| `packages/tui/hooks/useKeyboard.ts` | Modifier — fix import keybinding-resolver |
| `packages/tui/hooks/useApiData.ts` | Modifier — fix import usePolling |
| `packages/tui/components/index.ts` | Reecrire — exporter seulement survivants |
| `packages/tui/keybindings/index.ts` | Creer — barrel export |
| `packages/tui/theme/create-theme.ts` | Creer — factory configurable |
| `packages/tui/theme/index.ts` | Modifier — ajouter export createTheme |
| `packages/tui/index.ts` | Creer — barrel racine |
| `packages/tui/tsconfig.json` | Reecrire — adapter a la nouvelle structure |
| `packages/tui/vitest.config.ts` | Creer — config tests du toolkit |
| `packages/tui/tests/` | Creer — dossier vide (tests en 33-C-D) |
| `packages/tui/package.json` | Verifier exports map (deja cree en 33-C-A) |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : typecheck du package tui
powershell.exe -Command "cd C:\Meastro\packages\tui; npx tsc --noEmit 2>&1"
# Resultat attendu : 0 erreur

# Commande 2 : compter les fichiers .ts restants (hors node_modules)
powershell.exe -Command "Get-ChildItem -Path C:\Meastro\packages\tui -Filter *.ts -Recurse | Where-Object { $_.FullName -notmatch 'node_modules' } | Measure-Object | Select-Object -ExpandProperty Count"
# Resultat attendu : ~25-30 fichiers (hooks 8 + components 5 + theme 6 + keybindings 3 + types 7 + utils 8 + app 10 + index 1)

# Commande 3 : verifier que tui/ n'existe plus
powershell.exe -Command "Test-Path C:\Meastro\packages\tui\tui"
# Resultat attendu : False

# Commande 4 : verifier que widgets/ n'existe plus
powershell.exe -Command "Test-Path C:\Meastro\packages\tui\hooks\..\..\tui\widgets"
# Ou simplement :
powershell.exe -Command "Get-ChildItem -Path C:\Meastro\packages\tui -Directory -Recurse | Select-Object FullName"
# Resultat attendu : hooks, components, theme, keybindings, types, utils, app (pas de tui/, widgets/, data/, registry/, ui/)

# Commande 5 : tests passent toujours (les consommateurs n'ont pas change)
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/ 2>&1"
# Resultat attendu : 32/32 (les tests n'importent pas de packages/tui directement)
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS inclure de logique metier dans @maestro/tui — pas de useSessionData, pas de useApiPolling
- Ne PAS supprimer des composants sans verifier l'absence d'imports — utiliser Grep sur tout le repo
- Ne PAS forcer une seule palette — createTheme() DOIT supporter les overrides
- Ne PAS casser l'API existante des hooks — les re-exports du monitor doivent continuer a fonctionner jusqu'a 33-C-C
- Ne PAS creer de barrel exports qui re-exportent `types/` et `utils/` dans le barrel racine — utiliser les sub-path imports

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-C-B : Package @maestro/tui
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Code mort supprime** : X fichiers (lister)
**vitest.config.ts cree** : OUI/NON
**Structure aplatie** : OUI/NON (tui/ supprime)
**Hooks dans le toolkit** : X (lister noms)
**Components dans le toolkit** : X (lister noms)
**Theme configurable** : OUI/NON
**createTheme() compile** : OUI/NON (coller output tsc)
**Exports map coherente** : OUI/NON
**Barrel index.ts cree** : OUI/NON
**tsc --noEmit** : X erreurs (coller output)
**Tests** : X/32 passent
```
