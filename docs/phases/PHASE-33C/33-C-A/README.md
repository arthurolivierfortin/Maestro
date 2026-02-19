# 33-C-A : Migration LLM-Provider + restructuration packages/

**Statut** : PAS_COMMENCE
**Objectif** : Creer la structure monorepo `packages/`, copier les fichiers, configurer npm workspaces, verifier que tout compile et que les 32 tests passent.

**Regle** : Cette sous-phase est UNIQUEMENT structurelle — deplacer, copier, creer des package.json, adapter les require() et imports. Ne PAS modifier la logique des composants, hooks, ou theme.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `C:\Meastro\package.json` | Root package actuel (pas de workspaces) |
| `C:\Meastro\maestro-cli\package.json` | Deps CLI actuelles |
| `C:\Meastro\maestro-cli\cli.ts` lignes 1-15 | require() de shared/ (api-client, cli-colors) |
| `C:\Meastro\maestro-cli\cli.ts` lignes 5924-5965 | require() de interactive/ (launcher, headless) |
| `C:\Meastro\maestro-cli\cli.ts` lignes 6053-6085 | require() de monitor/tui-monitor |
| `C:\Meastro\maestro-cli\cli.ts` lignes 7739-7740 | require() de keybindings |
| `C:\Meastro\maestro-cli\monitor\tui-monitor.ts` | Entry point monitor (CJS→ESM bridge) |
| `C:\Meastro\maestro-cli\interactive\launcher.ts` | Entry point interactive (CJS→ESM bridge) |
| `C:\LLM-Provider\monitor\package.json` | Deps LLM-Provider monitor |
| `C:\LLM-Provider\monitor\tsconfig.json` | Alias @shared vers ../../Meastro/shared |
| `C:\Meastro\maestro-mcp\index.js` | require('../shared/api-client') |
| `C:\Meastro\docs\phases\PHASE-33C\README.md` | Decision CJS/ESM, structure cible |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Copier LLM-Provider dans le repo

```
C:\LLM-Provider\dotnet\     → C:\Meastro\llm-provider\dotnet\
C:\LLM-Provider\api\        → C:\Meastro\llm-provider\api\
C:\LLM-Provider\monitor\src\ → C:\Meastro\packages\provider-monitor\src\
```

Exclure `node_modules/`, `bin/`, `obj/`, `dist/` de la copie.

Ajouter a `.gitignore` :
```
llm-provider/dotnet/**/bin/
llm-provider/dotnet/**/obj/
```

### Etape 2 : Creer les dossiers packages/

```
packages/tui/
packages/maestro-cli/
packages/maestro-cli/utils/
packages/maestro-cli/keybindings/
packages/maestro-monitor/
packages/maestro-monitor/components/
packages/maestro-monitor/hooks/
packages/maestro-code/
packages/maestro-code/tests/
packages/provider-monitor/
```

### Etape 3 : Copier les fichiers (table exhaustive)

**packages/tui/** (depuis shared/) :
| Source | Destination | Note |
|--------|-------------|------|
| `shared/tui/` | `packages/tui/tui/` | Sera aplati en 33-C-B |
| `shared/theme/` | `packages/tui/theme/` | |
| `shared/types/` | `packages/tui/types/` | |
| `shared/utils/` | `packages/tui/utils/` | |
| `shared/app/` | `packages/tui/app/` | |
| `shared/tsconfig.json` | `packages/tui/tsconfig.json` | |
| NE PAS copier | `shared/data/`, `shared/registry/`, `shared/ui/` | Code mort |
| NE PAS copier | `shared/api-client.js` | Va dans maestro-cli |

**packages/maestro-cli/** (depuis maestro-cli/) :
| Source | Destination |
|--------|-------------|
| `maestro-cli/index.js` | `packages/maestro-cli/index.js` |
| `maestro-cli/cli.ts` | `packages/maestro-cli/cli.ts` |
| `maestro-cli/output-formatter.ts` | `packages/maestro-cli/output-formatter.ts` |
| `maestro-cli/shell.ts` | `packages/maestro-cli/shell.ts` |
| `maestro-cli/config.ts` | `packages/maestro-cli/config.ts` |
| `maestro-cli/discover.ts` | `packages/maestro-cli/discover.ts` |
| `maestro-cli/json-parser.ts` | `packages/maestro-cli/json-parser.ts` |
| `maestro-cli/tsconfig.json` | `packages/maestro-cli/tsconfig.json` |
| `maestro-cli/vitest.config.ts` | `packages/maestro-cli/vitest.config.ts` |
| `maestro-cli/tests/validator.test.ts` | `packages/maestro-cli/tests/validator.test.ts` |
| `maestro-cli/tests/execute-integration.test.ts` | `packages/maestro-cli/tests/execute-integration.test.ts` |
| `maestro-cli/tests/phase-workflow-tree.test.ts` | `packages/maestro-cli/tests/phase-workflow-tree.test.ts` |
| `maestro-cli/tests/shared-app-transforms.test.ts` | `packages/maestro-cli/tests/shared-app-transforms.test.ts` |
| `maestro-cli/tests/verify-shared-app-imports.test.ts` | `packages/maestro-cli/tests/verify-shared-app-imports.test.ts` |
| `maestro-cli/tests/verify-shared-imports.ts` | `packages/maestro-cli/tests/verify-shared-imports.ts` |
| `shared/api-client.js` | `packages/maestro-cli/api-client.js` |
| `shared/utils/cli-colors.ts` | `packages/maestro-cli/utils/cli-colors.ts` |
| `shared/utils/status.ts` | `packages/maestro-cli/utils/status.ts` |
| `shared/utils/tier-selector.ts` | `packages/maestro-cli/utils/tier-selector.ts` |
| `shared/tui/keybindings.ts` | `packages/maestro-cli/keybindings/keybindings.ts` |
| `shared/tui/keybinding-resolver.ts` | `packages/maestro-cli/keybindings/keybinding-resolver.ts` |

**packages/maestro-monitor/** (depuis maestro-cli/monitor/) :
| Source | Destination |
|--------|-------------|
| `maestro-cli/monitor/tui-monitor.ts` | `packages/maestro-monitor/tui-monitor.ts` |
| `maestro-cli/monitor/ink/App.ts` | `packages/maestro-monitor/App.ts` |
| `maestro-cli/monitor/ink/theme.ts` | `packages/maestro-monitor/theme.ts` |
| `maestro-cli/monitor/ink/mock-api-client.ts` | `packages/maestro-monitor/mock-api-client.ts` |
| `maestro-cli/monitor/ink/components/*.ts` (28 fichiers) | `packages/maestro-monitor/components/` |
| `maestro-cli/monitor/ink/hooks/*.ts` (8 fichiers) | `packages/maestro-monitor/hooks/` |

NE PAS copier : `maestro-cli/monitor/ink/tsconfig.json` (sera recree), `maestro-cli/monitor/ink/package.json` (sera recree), `maestro-cli/monitor/*.js` (legacy blessed), `maestro-cli/monitor/widgets/` (legacy).

**packages/maestro-code/** (depuis maestro-cli/interactive/) :
| Source | Destination |
|--------|-------------|
| `maestro-cli/interactive/App.ts` | `packages/maestro-code/App.ts` |
| `maestro-cli/interactive/launcher.ts` | `packages/maestro-code/launcher.ts` |
| `maestro-cli/interactive/headless.ts` | `packages/maestro-code/headless.ts` |
| `maestro-cli/interactive/ink-table.ts` | `packages/maestro-code/ink-table.ts` |
| `maestro-cli/interactive/ink-table-launcher.ts` | `packages/maestro-code/ink-table-launcher.ts` |
| `maestro-cli/tests/interactive/App.test.ts` | `packages/maestro-code/tests/App.test.ts` |
| `maestro-cli/tests/interactive/headless.test.ts` | `packages/maestro-code/tests/headless.test.ts` |
| `maestro-cli/tests/interactive/ink-table.test.ts` | `packages/maestro-code/tests/ink-table.test.ts` |

### Etape 4 : Creer les package.json

**IMPORTANT** : Lire `C:\Meastro\package.json` AVANT de le modifier. Merger les workspaces et devDeps avec le contenu existant (ne pas ecraser les deps existantes comme `react`).

**Root** `C:\Meastro\package.json` :
```json
{
  "private": true,
  "name": "maestro-root",
  "description": "Root package — provides shared dependencies (react) for shared/ modules",
  "workspaces": ["packages/*"],
  "dependencies": {
    "react": "^19.2.4"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.18",
    "tsx": "^4.21.0",
    "@types/node": "^25.2.3",
    "@types/react": "^19.2.14",
    "ink-testing-library": "^4.0.0"
  }
}
```

**packages/tui/package.json** :
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
    "./keybindings": "./keybindings/index.ts",
    "./types": "./types/index.ts",
    "./utils": "./utils/index.ts",
    "./utils/*": "./utils/*",
    "./app": "./app/index.ts",
    "./app/*": "./app/*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "ink": "^6.0.0"
  }
}
```

Note : l'exports map pointe vers des fichiers qui n'existent pas encore (hooks/, components/ a la racine) — ils seront crees en 33-C-B quand on aplatit tui/. Pour l'instant, les imports internes continuent avec les paths relatifs existants.

Note : les sub-path wildcards (`./utils/*`, `./app/*`) permettent des imports granulaires comme `@maestro/tui/utils/cli-colors.ts` sans passer par le barrel (evite les namespace collisions).

**packages/maestro-cli/package.json** :
```json
{
  "name": "@maestro/cli",
  "version": "0.1.0",
  "bin": { "maestro": "./index.js" },
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "@maestro/tui": "*",
    "@maestro/monitor": "*",
    "@maestro/code": "*",
    "minimist": "^1.2.8",
    "ink": "^6.7.0",
    "react": "^19.2.4"
  },
  "scripts": {
    "test:ink": "vitest run tests/interactive/",
    "test:all": "npm test && npm run test:ink"
  }
}
```

**packages/maestro-monitor/package.json** :

**ATTENTION** : PAS de `"type": "module"`. `tui-monitor.ts` utilise `exports.startMonitor = async function() { await import('./App.ts') }` — c'est du CJS qui fait un dynamic import ESM. Si on met `"type": "module"`, la syntaxe `exports.xxx` est invalide et `require('@maestro/monitor')` depuis cli.ts echoue avec ERR_REQUIRE_ESM.

```json
{
  "name": "@maestro/monitor",
  "version": "0.1.0",
  "main": "./tui-monitor.ts",
  "exports": {
    ".": "./tui-monitor.ts"
  },
  "dependencies": {
    "@maestro/tui": "*",
    "ink": "^6.7.0",
    "react": "^19.2.4"
  }
}
```

**packages/maestro-code/package.json** :

**ATTENTION** : PAS de `"type": "module"`. Meme raison que maestro-monitor — `launcher.ts` et `headless.ts` sont des CJS bridges (`exports.xxx = async function() { await import(...) }`). cli.ts les charge via `require()`.

```json
{
  "name": "@maestro/code",
  "version": "0.1.0",
  "exports": {
    ".": "./launcher.ts",
    "./launcher.ts": "./launcher.ts",
    "./headless.ts": "./headless.ts",
    "./ink-table-launcher.ts": "./ink-table-launcher.ts"
  },
  "dependencies": {
    "@maestro/tui": "*",
    "ink": "^6.7.0",
    "react": "^19.2.4"
  }
}
```

**packages/provider-monitor/package.json** :
```json
{
  "name": "@maestro/provider-monitor",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "tsx src/index.ts start",
    "status": "tsx src/index.ts status"
  },
  "dependencies": {
    "@maestro/tui": "*",
    "ink": "^6.0.0",
    "react": "^19.0.0",
    "minimist": "^1.2.8",
    "chalk": "^5.4.1",
    "tail": "^2.2.6"
  }
}
```

### Etape 5 : MAJ les require() dans packages/maestro-cli/cli.ts

**Shared → local :**
```
require('../shared/api-client')                    → require('./api-client.js')
require('../shared/utils/cli-colors.js')           → require('./utils/cli-colors.ts')
require('../shared/utils/status.js')               → require('./utils/status.ts')
require('../shared/utils/tier-selector.ts')        → require('./utils/tier-selector.ts')
require('../shared/tui/keybindings.ts')            → require('./keybindings/keybindings.ts')
require('../shared/tui/keybinding-resolver.ts')    → require('./keybindings/keybinding-resolver.ts')
```

**Sous-modules → workspace packages :**

Note : `@maestro/monitor` et `@maestro/code` n'ont PAS `"type": "module"` — ce sont des packages CJS. Leurs fichiers d'entree (`tui-monitor.ts`, `launcher.ts`) utilisent `exports.xxx = async function() { ... }` (syntaxe CJS) avec `await import()` interne (bridge ESM). Donc `require()` fonctionne.

```
require('./monitor/tui-monitor.ts')                → require('@maestro/monitor/tui-monitor.ts')
require('./interactive/launcher.ts')               → require('@maestro/code/launcher.ts')
require('./interactive/headless.ts')               → require('@maestro/code/headless.ts')
require('./interactive/ink-table-launcher.ts')     → require('@maestro/code/ink-table-launcher.ts')
```

### Etape 6 : MAJ les imports dans les tests deplaces

Dans `packages/maestro-code/tests/App.test.ts` :
```typescript
// AVANT : await import('../../interactive/App.ts')
// APRES : await import('../App.ts')
```

Idem pour `headless.test.ts` et `ink-table.test.ts`.

### Etape 7 : MAJ tui-monitor.ts

Dans `packages/maestro-monitor/tui-monitor.ts` :
```typescript
// AVANT : const { startInkMonitor } = await import('./ink/App.ts');
// APRES : const { startInkMonitor } = await import('./App.ts');
```

### Etape 8 : MAJ maestro-mcp/index.js

```javascript
// AVANT : const { MaestroApiClient, ApiError } = require('../shared/api-client');
// APRES : const { MaestroApiClient, ApiError } = require('../packages/maestro-cli/api-client');
```

### Etape 9 : npm install + .gitignore

Ajouter a `.gitignore` si pas deja present :
```
llm-provider/dotnet/**/bin/
llm-provider/dotnet/**/obj/
```

Executer `npm install` depuis la racine pour creer les symlinks workspaces.

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `C:\Meastro\package.json` | Reecrire — workspaces config |
| `C:\Meastro\.gitignore` | Modifier — ajouter llm-provider paths |
| `C:\Meastro\packages\tui\package.json` | Creer |
| `C:\Meastro\packages\maestro-cli\package.json` | Creer |
| `C:\Meastro\packages\maestro-monitor\package.json` | Creer |
| `C:\Meastro\packages\maestro-code\package.json` | Creer |
| `C:\Meastro\packages\provider-monitor\package.json` | Creer |
| `C:\Meastro\packages\maestro-cli\cli.ts` | Modifier — 10 require() paths |
| `C:\Meastro\packages\maestro-monitor\tui-monitor.ts` | Modifier — import path |
| `C:\Meastro\packages\maestro-code\tests\App.test.ts` | Modifier — import paths |
| `C:\Meastro\packages\maestro-code\tests\headless.test.ts` | Modifier — import paths |
| `C:\Meastro\packages\maestro-code\tests\ink-table.test.ts` | Modifier — import paths |
| `C:\Meastro\maestro-mcp\index.js` | Modifier — import api-client path |
| Copie de ~80 fichiers | Depuis shared/, maestro-cli/, C:\LLM-Provider\ |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : npm workspaces detectes
powershell.exe -Command "cd C:\Meastro; npm install 2>&1"
# Resultat attendu : 5 workspaces resolus, pas d'erreur

# Commande 2 : symlinks crees
powershell.exe -Command "ls C:\Meastro\node_modules\@maestro"
# Resultat attendu : tui, cli, monitor, code, provider-monitor

# Commande 3 : LLM-Provider .NET compile
powershell.exe -Command "cd C:\Meastro\llm-provider\dotnet; dotnet build 2>&1 | Select-String 'Build succeeded|Error'"
# Resultat attendu : Build succeeded

# Commande 4 : tests interactive passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/ 2>&1"
# Resultat attendu : 32 tests passent

# Commande 5 : structure packages/ correcte
powershell.exe -Command "ls C:\Meastro\packages"
# Resultat attendu : tui, maestro-cli, maestro-monitor, maestro-code, provider-monitor
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS faire `git mv` du depot LLM-Provider — c'est une COPIE. L'historique Git de LLM-Provider reste dans son repo d'origine.
- Ne PAS modifier la logique des composants/hooks dans cette sous-phase — 33-C-A est UNIQUEMENT structure.
- Ne PAS supprimer `C:\LLM-Provider\` original — le garder jusqu'a validation complete.
- Ne PAS supprimer `shared/` ou `maestro-cli/` — ils restent jusqu'a ce que 33-C-C ait migre tous les consommateurs.
- Ne PAS oublier les copies locales CJS dans `packages/maestro-cli/` — sans elles, cli.ts crashera.
- Ne PAS essayer de require() @maestro/tui depuis cli.ts — ERR_REQUIRE_ESM garanti.
- Ne PAS mettre `"type": "module"` dans @maestro/monitor ou @maestro/code — ce sont des CJS bridges, `require()` depuis cli.ts doit fonctionner.
- Ne PAS reecrire le root package.json sans lire l'existant — MERGER les workspaces et devDeps avec le contenu actuel.

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-C-A : Migration + restructuration
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**LLM-Provider copie** : OUI/NON
**LLM-Provider .NET compile** : OUI/NON (coller output)
**packages/ crees** : X/5 (lister)
**package.json ecrits** : X/6 (root + 5 packages)
**npm install clean** : OUI/NON (coller output)
**Symlinks @maestro/** : OUI/NON (coller ls)
**Tests interactive** : X/32 passent (coller output)
**Imports CLI mis a jour** : OUI/NON (X require() modifies)
**maestro-mcp MAJ** : OUI/NON
```
