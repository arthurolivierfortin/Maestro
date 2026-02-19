# 33-C-C : Migrer les consommateurs vers @maestro/tui

**Statut** : PAS_COMMENCE
**Prerequis** : 33-C-B DONE (@maestro/tui construit, exports map OK, tsc --noEmit 0 erreurs)
**Objectif** : Remplacer tous les imports `../../../../shared/` et copies locales par des imports `@maestro/tui`. Supprimer les re-exports et duplicatas. Chaque package importe uniquement `@maestro/tui`.

**Regle** : Migrer un package a la fois, valider entre chaque. Ordre : maestro-monitor (le plus gros), provider-monitor, maestro-code, maestro-cli, frontend.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `C:\Meastro\packages\tui\index.ts` | Exports du toolkit apres 33-C-B |
| `C:\Meastro\packages\tui\hooks\index.ts` | Hooks disponibles |
| `C:\Meastro\packages\tui\components\index.ts` | Components disponibles |
| `C:\Meastro\packages\tui\theme\index.ts` | Theme + createTheme disponible |
| `C:\Meastro\packages\maestro-monitor\hooks\useScroll.ts` | Re-export pur (a supprimer) |
| `C:\Meastro\packages\maestro-monitor\hooks\useKeyboard.ts` | Wrapper Ink (a garder + MAJ import) |
| `C:\Meastro\packages\maestro-monitor\theme.ts` | Imports shared/ actuels |
| `C:\Meastro\packages\maestro-monitor\App.ts` | Imports shared/ actuels |
| `C:\Meastro\packages\provider-monitor\src\tui\hooks\use-scroll.ts` | Copie locale (a supprimer) |
| `C:\Meastro\packages\provider-monitor\src\theme\index.ts` | Theme locale (a remplacer) |
| `C:\Meastro\packages\provider-monitor\src\app.tsx` | Imports locaux |
| `C:\Meastro\packages\maestro-code\ink-table.ts` | Import shared/tui |
| `C:\Meastro\packages\maestro-cli\output-formatter.ts` | Import ESM de shared/ |
| `C:\Meastro\packages\maestro-cli\shell.ts` | Import ESM de shared/ |
| `C:\Meastro\frontend\src\pages\HomePage.tsx` | Imports @shared/ |
| `C:\Meastro\frontend\vite.config.ts` | Alias @shared |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Migrer packages/maestro-monitor/ (28 composants + hooks)

**1a. Supprimer les 5 re-exports purs dans hooks/ :**
- `hooks/useScroll.ts` — re-export de shared/tui/hooks/useScroll
- `hooks/usePanelFocus.ts` — re-export de shared/tui/hooks/usePanelFocus
- `hooks/useTreeNav.ts` — re-export de shared/tui/hooks/useTreeNav
- `hooks/useMouse.ts` — re-export de shared/tui/hooks/useMouse
- `hooks/useApiData.ts` — re-export de shared/app/hooks/usePolling

**1b. MAJ hooks/useKeyboard.ts** (garder le wrapper Ink, MAJ import) :
```typescript
// AVANT :
import { createActionKeyboardHandler, ... } from '../../../../shared/tui/hooks/useKeyboard.ts';
// APRES :
import { createActionKeyboardHandler, ... } from '@maestro/tui/hooks';
```

**1c. MAJ hooks/useSessionData.ts** :
```typescript
// AVANT :
import type { ... } from '../../../../shared/types/session.ts';
import type { MaestroApiClient } from '../../../../shared/types/api-client.ts';
// APRES :
import type { ... } from '@maestro/tui/types';
import type { MaestroApiClient } from '@maestro/tui/types';
```

Note : Verifier que `@maestro/tui/types` exporte bien ces types (barrel packages/tui/types/index.ts).

**1d. MAJ les 28 composants** — pattern de remplacement :

| Import ancien | Import nouveau |
|---------------|----------------|
| `from '../../../../shared/tui/hooks/useScroll.ts'` | `from '@maestro/tui/hooks'` |
| `from '../../../../shared/tui/hooks/usePanelFocus.ts'` | `from '@maestro/tui/hooks'` |
| `from '../../../../shared/tui/hooks/useTreeNav.ts'` | `from '@maestro/tui/hooks'` |
| `from '../../../../shared/tui/hooks/useMouse.ts'` | `from '@maestro/tui/hooks'` |
| `from '../../../../shared/tui/hooks/useKeyboard.ts'` | `from '@maestro/tui/hooks'` |
| `from '../../../../shared/tui/hooks/useApiData.ts'` | `from '@maestro/tui/hooks'` |
| `from '../../../../shared/tui/components/Panel.ts'` | `from '@maestro/tui/components'` |
| `from '../../../../shared/theme/colors.ts'` | `from '@maestro/tui/theme'` |
| `from '../../../../shared/theme/tokens.ts'` | `from '@maestro/tui/theme'` |
| `from '../../../../shared/utils/tree.ts'` | `from '@maestro/tui/utils'` |
| `from '../../../../shared/utils/format.ts'` | `from '@maestro/tui/utils'` |
| `from '../../../../shared/utils/status.ts'` | `from '@maestro/tui/utils'` |
| `from '../../../../shared/utils/progress.ts'` | `from '@maestro/tui/utils'` |
| `from '../../../../shared/utils/resolve.ts'` | `from '@maestro/tui/utils'` |
| `from '../../../../shared/app/hooks/usePolling.ts'` | `from '@maestro/tui/app'` |
| `from '../../../../shared/types/session.ts'` | `from '@maestro/tui/types'` |
| `from '../../../../shared/types/api-client.ts'` | `from '@maestro/tui/types'` |
| `from '../../../../shared/types/block.ts'` | `from '@maestro/tui/types'` |
| `from '../../../../shared/types/workspace.ts'` | `from '@maestro/tui/types'` |
| `from '../../../../shared/types/project.ts'` | `from '@maestro/tui/types'` |
| `from '../../../../shared/types/llm.ts'` | `from '@maestro/tui/types'` |
| `from '../hooks/useScroll.ts'` | `from '@maestro/tui/hooks'` |
| `from '../hooks/usePanelFocus.ts'` | `from '@maestro/tui/hooks'` |
| `from '../hooks/useTreeNav.ts'` | `from '@maestro/tui/hooks'` |
| `from '../hooks/useMouse.ts'` | `from '@maestro/tui/hooks'` |
| `from '../hooks/useApiData.ts'` | `from '@maestro/tui/hooks'` |

Note : Les composants importent aussi depuis `'../theme.ts'` (le theme local du monitor) — ces imports ne changent PAS, car c'est la config locale du monitor.

**1e. MAJ theme.ts** :
```typescript
// AVANT :
import { palette, semantic } from '../../../shared/theme/colors.ts';
import { icons, layout } from '../../../shared/theme/tokens.ts';
import { statusColor, statusIcon } from '../../../shared/utils/status.ts';
import { formatDuration, formatBytes, truncate } from '../../../shared/utils/format.ts';
import { progressBar } from '../../../shared/utils/progress.ts';
import { resolveConfigValue } from '../../../shared/utils/resolve.ts';
// APRES :
import { palette, semantic } from '@maestro/tui/theme';
import { icons, layout } from '@maestro/tui/theme';
import { statusColor, statusIcon } from '@maestro/tui/utils';
import { formatDuration, formatBytes, truncate } from '@maestro/tui/utils';
import { progressBar } from '@maestro/tui/utils';
import { resolveConfigValue } from '@maestro/tui/utils';
```

**1f. MAJ App.ts** — meme pattern que les composants.

**1g. Creer tsconfig.json** pour maestro-monitor :
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
    "allowImportingTsExtensions": true,
    "paths": {
      "@maestro/tui": ["../tui/index.ts"],
      "@maestro/tui/*": ["../tui/*"]
    }
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules"]
}
```

**1h. Valider** : `npx tsc --noEmit` dans packages/maestro-monitor — 0 erreurs.

### Etape 2 : Migrer packages/provider-monitor/

**2a. Supprimer les copies locales de hooks :**
- `src/tui/hooks/use-scroll.ts` — remplace par @maestro/tui/hooks
- `src/tui/hooks/use-panel-focus.ts` — remplace par @maestro/tui/hooks
- `src/tui/hooks/use-action-keyboard.ts` — remplace par @maestro/tui/hooks

**2b. Garder le keybinding resolver local** :
Le provider-monitor a un systeme simple 4-action (`src/tui/keybindings.ts` + `src/tui/keybinding-resolver.ts`). C'est fondamentalement different du systeme Maestro (configurable, file-based). NE PAS remplacer par @maestro/tui/keybindings — garder local.

**2c. Remplacer src/theme/ (6 fichiers) par un seul fichier** :

Supprimer : `src/theme/palette.ts`, `src/theme/semantic.ts`, `src/theme/icons.ts`, `src/theme/borders.ts`, `src/theme/layout.ts`, `src/theme/terminal.ts`, `src/theme/index.ts`

Creer `src/theme.ts` :
```typescript
import { createTheme } from '@maestro/tui/theme';

export const theme = createTheme({
  palette: {
    brand: '#00BCD4',
    accent: '#7C4DFF',
  },
});

// Re-export pour acces rapide
export const { palette, icons, layout } = theme;
```

Note : Le provider-monitor a des tokens specifiques (borders, semantic) que createTheme() ne couvre pas encore. Si necessaire, les garder dans un fichier local `src/theme-extras.ts` en attendant que createTheme() soit enrichi en 33-C-D.

**2d. MAJ imports dans app.tsx** :
```typescript
// AVANT :
import { useScroll } from './tui/hooks/use-scroll.js';
import { usePanelFocus } from './tui/hooks/use-panel-focus.js';
// APRES :
import { useScroll, usePanelFocus } from '@maestro/tui/hooks';
```

**ATTENTION — API useScroll incompatible** : voir section suivante.

**2e. Adapter les 4 tabs a l'API useScroll de @maestro/tui** :

L'API LLM-Provider :
```typescript
const { offset, scrollUp, scrollDown, scrollToTop, scrollToBottom } = useScroll(contentHeight, panelHeight);
```

L'API @maestro/tui :
```typescript
const { getOffset, scrollUp, scrollDown, setMaxScroll } = useScroll();
// Puis : setMaxScroll('panel', contentHeight - panelHeight);
// Et : const offset = getOffset('panel');
```

Pour chaque tab (`MetricsTab.tsx`, `LogsTab.tsx`, `QueueTab.tsx`, `ModelsTab.tsx`) :
1. Remplacer `useScroll(contentHeight, panelHeight)` par `useScroll()`
2. Ajouter un `useEffect` qui appelle `setMaxScroll('main', contentHeight - panelHeight)` quand les donnees changent
3. Remplacer `offset` par `getOffset('main')`
4. Remplacer `scrollUp()` par `scrollUp('main')`, idem pour scrollDown

**Decision : Creer un wrapper `useSinglePanelScroll()` dans @maestro/tui** (en 33-C-B ou debut 33-C-C) :

```typescript
// packages/tui/hooks/useSinglePanelScroll.ts
import { useScroll } from './useScroll.ts';
import { useEffect } from 'react';

export function useSinglePanelScroll(contentHeight: number, panelHeight: number) {
  const { getOffset, scrollUp, scrollDown, scrollToTop, scrollToBottom, setMaxScroll } = useScroll();
  const panel = '_single';

  useEffect(() => {
    setMaxScroll(panel, Math.max(0, contentHeight - panelHeight));
  }, [contentHeight, panelHeight, setMaxScroll]);

  return {
    offset: getOffset(panel),
    scrollUp: () => scrollUp(panel),
    scrollDown: () => scrollDown(panel),
    scrollToTop: () => scrollToTop?.(panel),
    scrollToBottom: () => scrollToBottom?.(panel),
    canScrollUp: getOffset(panel) > 0,
    canScrollDown: getOffset(panel) < Math.max(0, contentHeight - panelHeight),
  };
}
```

Cela preserve l'API existante du provider-monitor (meme signature de retour) tout en delegant au hook canonique. Les 4 tabs changent un seul import, pas toute leur logique.

**2f. MAJ src/config/tui.ts** :
```typescript
// AVANT :
import type { TabDef } from '@shared/tui/components/TabBar.js';
import type { ShortcutProps } from '@shared/tui/components/Shortcut.js';
// APRES :
import type { TabDef } from '@maestro/tui/components';
import type { ShortcutProps } from '@maestro/tui/components';
```

**2g. MAJ tsconfig.json** — supprimer @shared alias et includes Meastro :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "paths": {
      "@maestro/tui": ["../tui/index.ts"],
      "@maestro/tui/*": ["../tui/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**2h. MAJ les imports dans src/tui/components/ (Panel, Header, StatusBar)** :
```typescript
// AVANT :
import { semantic, icons, layout } from '../../theme/index.js';
// APRES :
import { palette, icons, layout } from '../../theme.ts';
```

**2i. Valider** : `npx tsc --noEmit` dans packages/provider-monitor.

### Etape 3 : Migrer packages/maestro-code/

Un seul fichier : `ink-table.ts` :
```typescript
// AVANT :
import { useSelectableList } from '../../shared/tui/hooks/useSelectableList.ts';
// APRES :
import { useSelectableList } from '@maestro/tui/hooks';
```

Creer `packages/maestro-code/tsconfig.json` :
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
    "allowImportingTsExtensions": true,
    "paths": {
      "@maestro/tui": ["../tui/index.ts"],
      "@maestro/tui/*": ["../tui/*"]
    }
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "tests"]
}
```

### Etape 4 : Migrer packages/maestro-cli/ (fichiers ESM)

`output-formatter.ts` :
```typescript
// AVANT :
import * as c from '../shared/utils/cli-colors.js';
// APRES :
import * as c from '@maestro/tui/utils/cli-colors.ts';
```

**IMPORTANT** : Utiliser le path granulaire `@maestro/tui/utils/cli-colors.ts` et NON le barrel `@maestro/tui/utils`. Le barrel exporte TOUTES les fonctions utils (formatDuration, statusColor, etc.), ce qui change la semantique de `import * as c` — on aurait `c.formatDuration`, `c.statusColor` en plus de `c.red`, `c.bold`, etc. Le sub-path wildcard dans le package.json (`"./utils/*": "./utils/*"`) permet cet import granulaire.

`shell.ts` :
```typescript
// AVANT :
import * as c from '../shared/utils/cli-colors.js';
import { palette, brand } from '../shared/theme/index.ts';
import { setTerminalBg, resetTerminalBg } from '../shared/theme/terminal.ts';
// APRES :
import * as c from '@maestro/tui/utils/cli-colors.ts';
import { palette, brand } from '@maestro/tui/theme';
import { setTerminalBg, resetTerminalBg } from '@maestro/tui/theme';
```

Note : `output-formatter.ts` et `shell.ts` utilisent ESM `import` — ils sont charges par tsx qui gere la resolution. Puisque `@maestro/tui` est ESM, les imports fonctionnent.

### Etape 5 : Migrer frontend

`frontend/src/pages/HomePage.tsx` :
```typescript
// AVANT :
import { useHealthMonitor } from '@shared/app/hooks/useHealthMonitor';
import { useSessionList } from '@shared/app/hooks/useSessionList';
import { usePolling } from '@shared/app/hooks/usePolling';
import { statusToSemantic } from '@shared/app/transforms/session';
import type { ServiceHealth } from '@shared/app/transforms/health';
// APRES :
import { useHealthMonitor } from '@maestro/tui/app/hooks/useHealthMonitor';
import { useSessionList } from '@maestro/tui/app/hooks/useSessionList';
import { usePolling } from '@maestro/tui/app/hooks/usePolling';
import { statusToSemantic } from '@maestro/tui/app/transforms/session';
import type { ServiceHealth } from '@maestro/tui/app/transforms/health';
```

`frontend/vite.config.ts` — MAJ alias :
```typescript
// AVANT :
'@shared': path.resolve(__dirname, '../shared'),
// APRES :
'@shared': path.resolve(__dirname, '../packages/tui'),
```

Verifier qu'aucun autre fichier frontend n'utilise `@shared` :
```bash
powershell.exe -Command "Select-String -Path 'C:\Meastro\frontend\src\**\*.ts','C:\Meastro\frontend\src\**\*.tsx' -Pattern '@shared' -Recurse"
```
Si seulement `HomePage.tsx`, supprimer l'alias `@shared` du vite.config.ts. Sinon, migrer les autres fichiers aussi.

---

## Fichiers a modifier/creer [OBLIGATOIRE]

**maestro-monitor (etape 1) :**
| Fichier | Action |
|---------|--------|
| `hooks/useScroll.ts` | Supprimer (re-export pur) |
| `hooks/usePanelFocus.ts` | Supprimer (re-export pur) |
| `hooks/useTreeNav.ts` | Supprimer (re-export pur) |
| `hooks/useMouse.ts` | Supprimer (re-export pur) |
| `hooks/useApiData.ts` | Supprimer (re-export pur) |
| `hooks/useKeyboard.ts` | Modifier — import @maestro/tui |
| `hooks/useSessionData.ts` | Modifier — import types @maestro/tui |
| `theme.ts` | Modifier — imports @maestro/tui |
| `App.ts` | Modifier — imports @maestro/tui |
| `components/*.ts` (28 fichiers) | Modifier — tous les imports shared/ |
| `tsconfig.json` | Creer — paths @maestro/tui |

**provider-monitor (etape 2) :**
| Fichier | Action |
|---------|--------|
| `src/tui/hooks/use-scroll.ts` | Supprimer |
| `src/tui/hooks/use-panel-focus.ts` | Supprimer |
| `src/tui/hooks/use-action-keyboard.ts` | Supprimer |
| `src/theme/` (7 fichiers) | Supprimer |
| `src/theme.ts` | Creer — createTheme() |
| `src/app.tsx` | Modifier — imports @maestro/tui |
| `src/tabs/*.tsx` (4 fichiers) | Modifier — imports + adaptation API useScroll |
| `src/tui/components/*.tsx` | Modifier — imports theme |
| `src/config/tui.ts` | Modifier — @shared → @maestro/tui |
| `tsconfig.json` | Modifier — supprimer @shared, ajouter @maestro/tui |

**@maestro/tui (prerequis etape 2) :**
| Fichier | Action |
|---------|--------|
| `../tui/hooks/useSinglePanelScroll.ts` | Creer — wrapper mono-panel autour de useScroll |
| `../tui/hooks/index.ts` | Modifier — ajouter export useSinglePanelScroll |

**maestro-code (etape 3) :**
| Fichier | Action |
|---------|--------|
| `ink-table.ts` | Modifier — import @maestro/tui/hooks |
| `tsconfig.json` | Creer |

**maestro-cli (etape 4) :**
| Fichier | Action |
|---------|--------|
| `output-formatter.ts` | Modifier — import @maestro/tui |
| `shell.ts` | Modifier — imports @maestro/tui |

**frontend (etape 5) :**
| Fichier | Action |
|---------|--------|
| `src/pages/HomePage.tsx` | Modifier — @shared → @maestro/tui |
| `vite.config.ts` | Modifier — MAJ alias @shared → packages/tui |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : plus d'imports ../../../../shared dans les packages
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\**\*.ts' -Pattern '../../../../shared' -Recurse | Select-Object -First 5"
# Resultat attendu : 0 resultats

# Commande 2 : plus d'imports @shared dans provider-monitor
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\provider-monitor\**\*.ts' -Pattern '@shared/' -Recurse"
# Resultat attendu : 0 resultats

# Commande 3 : tests interactive passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/ 2>&1"
# Resultat attendu : 32/32

# Commande 4 : maestro-monitor typecheck
powershell.exe -Command "cd C:\Meastro\packages\maestro-monitor; npx tsc --noEmit 2>&1"
# Resultat attendu : 0 erreur

# Commande 5 : provider-monitor typecheck
powershell.exe -Command "cd C:\Meastro\packages\provider-monitor; npx tsc --noEmit 2>&1"
# Resultat attendu : 0 erreur

# Commande 6 : frontend build
powershell.exe -Command "cd C:\Meastro\frontend; npm run build 2>&1 | Select-String 'error|built'"
# Resultat attendu : built in X.Xs

# Commande 7 : plus de copies locales hooks dans provider-monitor
powershell.exe -Command "Test-Path C:\Meastro\packages\provider-monitor\src\tui\hooks"
# Resultat attendu : False (dossier supprime)
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS migrer mecaniquement sans tester apres chaque package — Maestro d'abord, valider, PUIS provider
- Ne PAS supprimer le keybinding resolver local du provider-monitor — c'est un systeme different
- Ne PAS supprimer un composant provider si @maestro/tui ne couvre pas ses features — garder temporairement
- Ne PAS oublier de creer les tsconfig.json avec les paths @maestro/tui — sinon tsc ne resoudra pas
- Ne PAS modifier les copies locales CJS dans packages/maestro-cli/ — elles restent pour les require() de cli.ts
- Ne PAS remplacer les imports `from '../theme.ts'` dans les composants monitor — c'est le theme local, pas shared/

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-C-C : Migration consommateurs
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**maestro-monitor migre** : OUI/NON (X fichiers modifies, X supprimes)
**provider-monitor migre** : OUI/NON (X fichiers supprimes, X modifies)
**useScroll API adaptee** : OUI/NON (methode choisie : wrapper / adaptation directe)
**maestro-code migre** : OUI/NON
**maestro-cli ESM migre** : OUI/NON (output-formatter + shell)
**frontend migre** : OUI/NON
**Imports ../../../../shared restants** : 0 / X (coller output grep)
**Imports @shared restants** : 0 / X
**Copies locales provider hooks restantes** : 0 / X
**Tests** : X/32 passent
**tsc maestro-monitor** : X erreurs
**tsc provider-monitor** : X erreurs
**frontend build** : OK / FAIL
```
