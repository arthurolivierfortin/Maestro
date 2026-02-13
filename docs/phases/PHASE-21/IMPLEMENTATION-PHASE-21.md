# Phase 21 — Packaging & Distribution

## Résumé

Prépare Maestro pour la distribution : build automatisé, initialisation premier lancement, packaging Electron, et préparation CLI pour npm.

## Composants

### FirstRunInitializer (Backend)
- `IHostedService` qui s'exécute au démarrage
- Crée `~/.maestro/` avec sous-dossiers (logs, config, blocks, cache)
- Copie `content/system` vers `~/.maestro/system` si absent
- Crée `config.json` par défaut si absent
- Non-bloquant : les erreurs sont logguées mais ne crashent pas le serveur

### build-release.ps1
- Script PowerShell pour build complet
- `dotnet publish` pour le backend
- `npm run build` pour le frontend
- Copie CLI + shared + content dans `dist/`
- Paramètres : `-Configuration`, `-OutputDir`, `-SkipFrontend`, `-SkipBackend`, `-SkipCli`

### Electron Packaging
- `getBackendPath()` supporte mode packagé (extraResources/backend)
- `electron-builder` configuré avec `extraResources` pour backend et content/system
- Backend publié comme executable autonome dans le package

### CLI discover.ts
- Auto-découverte du backend sur ports candidats (5000, 5001, 5050, 8080)
- Ordre de priorité : env var → config → auto-discover → default
- Timeout 2s par port

### CLI init
- `maestro init [path]` — initialise `.maestro/` dans un repo
- Crée : blocks/, docs/, logs/, artifacts/, metrics/
- README.md explicatif

### CLI package.json
- Nom : `@b-one/maestro-cli`
- Version : 1.0.0
- `engines.node >= 18.0.0`
- `files` et `bin` configurés pour npm publish
