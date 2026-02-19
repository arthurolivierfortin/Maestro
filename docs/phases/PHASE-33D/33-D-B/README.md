# 33-D-B : Creation apps/ (backend, desktop, mcp) + maj docker-compose

**Statut** : PAS_COMMENCE
**Objectif** : Deplacer les 3 applications deployables (backend, frontend, maestro-mcp) dans `apps/`, mettre a jour tous les paths relatifs, et mettre a jour les docker-compose.

**Regle** : Utiliser `git mv` exclusivement pour les deplacements. Ne PAS modifier les fichiers dans `packages/`. Les docker-compose restent a la racine.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `frontend/tsconfig.json` | Comprendre les alias `@shared/*` et les `include` paths |
| `frontend/vite.config.ts` | Comprendre le resolve `@shared` |
| `frontend/package.json` | Comprendre les scripts avec paths relatifs docker-compose et dev-scripts |
| `frontend/electron/main.ts` | Comprendre `__dirname` et `getBackendPath()` — les paths relatifs changent |
| `maestro-mcp/index.js` | Comprendre le `require('../packages/maestro-cli/...')` |
| `backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs` | VERIFIER que le fix 33-D-A est en place (pas de `Maestro.sln` dans les markers) |
| `docker-compose.yml` | Comprendre les paths relatifs (`./backend`, `./frontend`) |
| `docker-compose.full.yml` | Comprendre les build contexts et volumes |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Deplacements git mv

```bash
git mv backend apps/backend
git mv frontend apps/desktop
git mv maestro-mcp apps/mcp
```

**Nommage** :
- `apps/backend` (pas `api`) — le backend est un Domain + Application + Infrastructure + moteur d'execution, pas "juste une API"
- `apps/desktop` (pas `web`) — c'est une app Electron. Phase 36 = version telechargeable. Si un jour on separe cloud et desktop, `apps/web` sera libre.
- `apps/mcp` — serveur MCP, nom court et clair

### Etape 2 : Mise a jour paths apps/desktop (ex-frontend)

**`apps/desktop/tsconfig.json`** :
- Alias `../packages/tui/*` → `../../packages/tui/*`
- Verifier et mettre a jour les `include` paths

**`apps/desktop/vite.config.ts`** :
- Resolve `../packages/tui` → `../../packages/tui`

**`apps/desktop/package.json`** :
- Tous les paths relatifs `../` → `../../` :
  - `../docker-compose*` → `../../docker-compose*`
  - `../dev-scripts/` → `../../dev-scripts/`
  - `../dist/` → `../../dist/` (si present)
  - `../content/` → `../../content/` (si present)

**`apps/desktop/electron/main.ts`** :
- Recalculer les paths `__dirname` relatifs
- **IMPORTANT** : lire les paths existants et les recalculer manuellement — ne PAS deviner

### Etape 3 : Mise a jour paths apps/mcp

**`apps/mcp/index.js`** :
```javascript
// AVANT : require('../packages/maestro-cli/...')
// APRES : require('../../packages/maestro-cli/...')
```

### Etape 4 : Mise a jour docker-compose (restent a la racine)

Les 4 fichiers docker-compose restent a la racine. Seuls les paths internes changent :

**`docker-compose.yml`** :
- `./backend` → `./apps/backend`

**`docker-compose.backend.yml`** :
- `./backend` → `./apps/backend`

**`docker-compose.dev.yml`** :
- `./backend` → `./apps/backend`
- `./frontend` → `./apps/desktop`

**`docker-compose.full.yml`** :
- `./backend` → `./apps/backend`
- `./frontend` → `./apps/desktop`

### Etape 5 : Verifications solution

- Verifier que `Maestro.sln` dans `apps/backend/` resout tous les projets (paths relatifs dans .sln et .csproj sont relatifs a leur dossier parent — ils ne changent pas)
- Verifier que `global.json` a la racine n'a pas besoin de mise a jour

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `backend/` | `git mv` → `apps/backend/` |
| `frontend/` | `git mv` → `apps/desktop/` |
| `maestro-mcp/` | `git mv` → `apps/mcp/` |
| `apps/desktop/tsconfig.json` | Modifier alias : `../packages/tui/*` → `../../packages/tui/*`, et `include` paths |
| `apps/desktop/vite.config.ts` | Modifier resolve : `../packages/tui` → `../../packages/tui` |
| `apps/desktop/package.json` | Modifier tous les paths relatifs (`../` → `../../`) |
| `apps/desktop/electron/main.ts` | Recalculer `__dirname` paths relatifs |
| `apps/mcp/index.js` | Modifier `require('../packages/...')` → `require('../../packages/...')` |
| `docker-compose.yml` | `./backend` → `./apps/backend` |
| `docker-compose.backend.yml` | `./backend` → `./apps/backend` |
| `docker-compose.dev.yml` | `./backend` → `./apps/backend`, `./frontend` → `./apps/desktop` |
| `docker-compose.full.yml` | `./backend` → `./apps/backend`, `./frontend` → `./apps/desktop` |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Backend build
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build 2>&1 | Select-Object -Last 3"
# Resultat attendu : Build succeeded

# Commande 2 : Frontend build
powershell.exe -Command "cd C:\Meastro\apps\desktop; npm run build:web 2>&1 | Select-Object -Last 5"
# Resultat attendu : build completed
# Note : utiliser build:web (pas build) pour eviter electron-builder qui necessite des deps systeme

# Commande 3 : MCP require resolves
powershell.exe -Command "cd C:\Meastro\apps\mcp; node -e `"try { require('./index.js'); console.log('OK') } catch(e) { console.log('FAIL:', e.message) }`""
# Resultat attendu : OK (ou warning non-fatal)

# Commande 4 : Package tests still pass
powershell.exe -Command "cd C:\Meastro\packages\tui; npx vitest run tests/ 2>&1 | Select-Object -Last 5"
# Resultat attendu : Tests passed

# Commande 5 : Les anciens dossiers n'existent plus
powershell.exe -Command "Test-Path C:\Meastro\backend, C:\Meastro\frontend, C:\Meastro\maestro-mcp"
# Resultat attendu : False, False, False

# Commande 6 : Docker compose syntax valide
powershell.exe -Command "cd C:\Meastro; docker-compose config --quiet 2>&1"
# Resultat attendu : pas d'erreur (ou docker non installe — acceptable)
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS utiliser `cp -r && rm -rf` — utiliser `git mv` pour preserver l'historique git
- Ne PAS modifier les fichiers DANS `packages/` — cette sous-phase ne touche que `apps/` et les docker-compose
- Ne PAS deviner les paths `__dirname` dans `electron/main.ts` — les lire et recalculer manuellement
- Ne PAS oublier les `include` dans `tsconfig.json` — c'est souvent oublie quand on change les alias
- Ne PAS deplacer les docker-compose dans un sous-dossier — ils restent a la racine pour un DX simple (`docker-compose up` sans `-f`)
- Ne PAS nommer le frontend `apps/web` — c'est une app Electron, voir decisions architecturales dans le README principal

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-D-B : Creation apps/ + maj docker-compose
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Backend build** : [copier derniere ligne]
**Frontend build** : [copier derniere ligne]
**MCP require** : [OK ou FAIL + message]
**Package tests** : [X passed, Y failed]
**Anciens dossiers supprimes** : [True/False pour chacun]
**Docker-compose paths** : [mis a jour / erreurs]
```
