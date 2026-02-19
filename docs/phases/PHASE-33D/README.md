# Phase 33-D : Restructuration Monorepo — apps/ + nettoyage root

**Statut** : A faire
**Prerequis** : Phase 33-C COMPLETE (verifier `docs/phases/PHASE-33C/checkpoint.md`)
**Objectif** : Nettoyer le root (supprimer bruit), regrouper les applications deployables dans `apps/`, nettoyer les dev-scripts obsoletes.

---

## Analyse de la situation actuelle

### Etat du repo (post 33-C)

Le root contient **45+ elements** dont beaucoup sont du bruit :

| Categorie | Fichiers | Verdict |
|-----------|----------|---------|
| Logs orphelins | `backend-err.log`, `backend-error.log`, `backend-out.log`, `backend-output.log`, `backend-stderr.log`, `backend-stdout.log`, `monitor-bg-stderr.log`, `monitor-final-stderr.log`, `monitor-legacy-stderr.log`, `monitor-test-stderr.log` | **Supprimer** — aucun ne devrait etre versionne |
| JSON temporaires | `temp-blocks.json`, `test-agent-multiturn.json`, `test-multiturn.json`, `compat.json` | **Supprimer** — artefacts de debug |
| Docs orphelins | `pr-description.md`, `guide.md`, `ROADMAP.md` (obsolete, date du 2026-01-20), `BUILD.md`, `CONTRIBUTING.md` | **Supprimer** — contenu obsolete ou duplique |
| Scripts root | `dotnet-install.ps1` | **Supprimer** — one-time setup |
| Docker root | `docker-compose.yml`, `.backend.yml`, `.dev.yml`, `.full.yml` | **Garder a la racine** — mettre a jour les paths internes |
| Dev scripts | `dev-scripts/` (35 fichiers) | **Trier** — garder ~10 utiles, supprimer le reste |

### Structure actuelle vs cible

```
ACTUEL (45+ items):                  CIBLE (~20 items):
C:\Meastro\                          C:\Meastro\
├── backend/         (app)           ├── apps/
├── frontend/        (app)           │   ├── backend/   ← backend
├── maestro-mcp/     (app)           │   ├── desktop/   ← frontend (Electron)
├── packages/        (libs)          │   └── mcp/       ← maestro-mcp
├── llm-provider/    (ext)           ├── packages/       (inchange)
├── content/         (data)          ├── llm-provider/   (inchange)
├── dev-scripts/     (35 scripts)    ├── content/        (inchange)
├── docker-compose*  (4 fichiers)    ├── dev-scripts/    (nettoye, ~10 scripts)
├── docs/            (docs)          ├── docker-compose* (reste a la racine, paths maj)
├── 10 logs...       (bruit)         ├── docs/           (inchange)
├── 4 temp json...   (bruit)         └── [config files propres]
└── 6 orphan docs... (bruit)
```

### Pourquoi cette structure

1. **`apps/`** = unites deployables. Chaque sous-dossier peut etre deploye independamment. Crucial pour le futur Electron + cloud.
2. **`apps/backend`** (pas `api`) = le backend est un Domain + Application + Infrastructure + moteur d'execution, pas "juste une API".
3. **`apps/desktop`** (pas `web`) = c'est une app Electron. Phase 36 = version telechargeable. Si un jour on ajoute une version cloud-only, ce sera `apps/web` a ce moment-la.
4. **`packages/`** = librairies partagees. Inchange — deja correct post 33-C.
5. **`content/`** = donnees (blocks, templates, sessions). Reste a la racine — c'est une categorie a part entiere, ni app ni package ni infra.
6. **`docker-compose*` reste a la racine** — `docker-compose up` fonctionne directement, pas besoin de `-f infra/docker/...`. Les paths internes sont mis a jour (`./backend` → `./apps/backend`).
7. **`dev-scripts/` reste a la racine** — simplement nettoye des 25+ scripts obsoletes.
8. **`llm-provider/`** = reste a part car c'est un projet independant avec sa propre architecture.

### Bug critique a corriger AVANT les deplacements

**`MaestroPathConfiguration.cs` ligne 152** utilise `Maestro.sln` comme marqueur pour trouver la racine du repo :

```csharp
var markers = new[] { ".git", "Maestro.sln", "maestro.config.json" };
```

Apres le deplacement `backend/` → `apps/backend/`, le fichier `Maestro.sln` sera a `apps/backend/Maestro.sln`. L'algorithme remonte le systeme de fichiers et trouvera `Maestro.sln` AVANT `.git` (qui est a la racine). Resultat : **le backend croit que `apps/backend/` est la racine** → paths `content/`, `blocks/` invalides → **crash silencieux**.

**Fix** : Retirer `"Maestro.sln"` des marqueurs. Garder uniquement `".git"` et `"maestro.config.json"`.

### dev-scripts : triage

| Script | Garder | Raison |
|--------|--------|--------|
| `dev-start.ps1` | OUI | Startup principal |
| `kill-backend.ps1` | OUI | Utilitaire recurrent |
| `build-release.ps1` | OUI | Release builds |
| `restart-backend.ps1` | OUI | Quick restart |
| `wait-backend-health.ps1` | OUI | Utilise par dev-start |
| `wait-backend.ps1` | OUI | Utilise par dev-start |
| `wait-services.ps1` | OUI | Utilise par dev-start |
| `nugetCommands/` | OUI | NuGet config |
| `update-feature-from-main-branch.ps1` | OUI | Git workflow |
| `README.update-feature-from-main-branch.md` | OUI | Documentation du script |
| Tous les autres (25+ fichiers) | NON | One-time, debug, ou remplaces par CLI |

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire le README de la sous-phase** avant de l'executer
3. **Ecrire dans `docs/phases/PHASE-33D/checkpoint.md`** apres chaque sous-phase
4. **Utiliser `git mv`** pour tous les deplacements — jamais cp+delete
5. **Corriger MaestroPathConfiguration AVANT tout deplacement** — c'est le bug le plus dangereux
6. **Tester les builds apres chaque sous-phase** — ne pas accumuler de dette
7. **Ne PAS modifier `packages/`** — cette phase ne touche que les apps, les scripts, et les docker-compose

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | README | Effort |
|-------|-------|--------|--------|
| 33-D-A | Nettoyage root + fix MaestroPathConfiguration | [`33-D-A/README.md`](33-D-A/README.md) | 1-2h |
| 33-D-B | Creation apps/ (backend, desktop, mcp) + maj docker-compose | [`33-D-B/README.md`](33-D-B/README.md) | 3-5h |
| 33-D-C | Nettoyage dev-scripts + maj paths internes | [`33-D-C/README.md`](33-D-C/README.md) | 30min-1h |
| 33-D-D | Mise a jour docs, CLAUDE.md, MEMORY.md + validation E2E | [`33-D-D/README.md`](33-D-D/README.md) | 2-3h |

---

## Decisions architecturales documentees

### Pourquoi `apps/backend` et pas `apps/api`
Le backend contient le Domain, Application, Infrastructure, et le moteur d'execution. L'appeler "api" serait reducteur — c'est comme appeler un moteur de voiture "le bouchon d'essence". Le nom `backend` est honnete sur le contenu.

### Pourquoi `apps/desktop` et pas `apps/web`
Le frontend est une app Electron (Phase 36 = version telechargeable). L'appeler "web" est faux et ferme une porte : si un jour on separe la version cloud (web) de la version desktop (Electron), le nom `web` est deja pris par la mauvaise chose. `desktop` est honnete sur ce qu'on construit.

### Pourquoi docker-compose reste a la racine
Deplacer docker-compose dans `infra/docker/` force `docker-compose -f infra/docker/docker-compose.yml up` au lieu de `docker-compose up`. Les build contexts deviennent `../../apps/backend` au lieu de `./apps/backend`. C'est strictement pire en DX pour zero gain reel.

### Pourquoi dev-scripts reste a la racine
Le dossier est simplement nettoye (de 35 a ~10 scripts). Le deplacer dans `infra/scripts/` ajoute de la profondeur sans ajouter de clarte. Apres nettoyage, ~10 scripts utiles dans un dossier nomme `dev-scripts` est parfaitement lisible.

### Pourquoi content/ reste a la racine
`content/` est une categorie a part entiere — les donnees sur lesquelles Maestro opere (blocks, templates, sessions). Ce n'est ni une app, ni un package, ni de l'infra. `MaestroPathConfiguration` le resout deja relatif a la racine. Les utilisateurs et agents y accedent directement.

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-33D/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 33-D COMPLETE — apps/backend, apps/desktop, apps/mcp"
- Ajouter : "Backend at apps/backend/, Desktop (Electron) at apps/desktop/, MCP at apps/mcp/"
- Ajouter : "Docker-compose at root (paths updated), dev-scripts cleaned (~10 scripts)"
- Retirer : toutes les references a `backend/`, `frontend/`, `maestro-mcp/` comme chemins directs

---

## Risques

| Risque | Severite | Mitigation |
|--------|----------|------------|
| MaestroPathConfiguration trouve le mauvais root | **CRITIQUE** | Corriger en 33-D-A AVANT tout deplacement |
| Electron `__dirname` paths casses | HAUT | Tester `npm run build:web` + verifier les paths dans dist |
| docker-compose paths internes casses | MOYEN | Mettre a jour `./backend` → `./apps/backend` dans les 4 fichiers |
| dev-start.ps1 paths casses | MOYEN | Mettre a jour `$MaestroRoot\backend` → `$MaestroRoot\apps\backend` |
| Historique git perdu | BAS | Utiliser `git mv` exclusivement |
| Paths stales dans CLAUDE.md / MEMORY.md | MOYEN | Recherche systematique de tous les anciens paths en 33-D-D |
