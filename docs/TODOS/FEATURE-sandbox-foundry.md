# Feature : Sandbox Images pour Foundry Sessions

**Statut** : Planifie
**Priorite** : Haute
**Depends on** : [Documentation attachee](./FEATURE-attached-docs.md) (les resultats de test doivent pouvoir alimenter la doc)
**Contexte** : Tester un agent en foundry session exige aujourd'hui un repo reel dans l'etat exact voulu. Chaque test part de zero, n'est pas reproductible, et si l'agent modifie le repo il faut tout reset manuellement. Les sandbox images resolvent ce probleme.

## Probleme

1. **Pas de reproductibilite** : chaque test depend de l'etat courant d'un repo reel
2. **Reset manuel** : si l'agent fait un commit ou edite des fichiers, il faut git reset/checkout manuellement
3. **Pas de batch testing** : impossible de tester le meme agent sur 10 etats de repo differents automatiquement
4. **Resultats ephemeres** : les artifacts produits par l'agent disparaissent avec l'environnement
5. **Setup repetitif** : recreer l'etat "repo avec merge conflict" ou "repo a mi-feature" a chaque test

## Concepts cles

### Sandbox Image

Snapshot immutable d'un environnement de test, versionne et reutilisable.

```
Sandbox Registry (catalogue d'images)
  ├── git-commits v1.0     — 50 commits, 5 checkpoints
  ├── python-proj v1.0     — projet Python avec tests casses, 3 checkpoints
  └── react-app v1.0       — app React sans tests, 2 checkpoints
```

### Checkpoint

Un etat nommé dans une sandbox image. Exemples pour `git-commits` :
- `clean-main` : branche main, working tree propre, au commit #50
- `mid-feature` : branche feature/auth, 3 fichiers non commites
- `merge-conflict` : main avec conflit de merge entrant
- `empty-repo` : juste `git init`, aucun commit
- `commit-25` : repo au commit #25 (avant refactor auth)

### Volume de sortie

Le container est jetable, mais les resultats ne le sont pas. Un volume monte `/output/` persiste apres la destruction du container :

```
Container (jetable)
  /workspace/           <- repo sandbox (checkpoint)
  /output/              <- volume monte, PERSISTE
    /output/docs/       <- documentation generee
    /output/fitness/    <- scores, metriques
    /output/artifacts/  <- fichiers produits par l'agent

Volume monte vers :
  .maestro/sessions/<id>/output/   <- survit au container
```

## Structure d'une sandbox image

```jsonc
// .maestro/sandboxes/git-commits/sandbox.json
{
  "id": "git-commits",
  "version": "1.0",
  "description": "Git repo with 50 commits for testing commit generation agents",
  "type": "git-repo",
  "base": {
    "source": "template",       // ou "dockerfile", "archive"
    "template": "git-repo-50-commits"
  },
  "checkpoints": [
    {
      "id": "clean-main",
      "description": "Main branch, working tree clean, at commit #50",
      "git_ref": "main",
      "git_state": "clean"
    },
    {
      "id": "mid-feature",
      "description": "Feature branch with 3 uncommitted files",
      "git_ref": "feature/auth",
      "git_state": "dirty",
      "uncommitted_files": ["src/auth.ts", "src/middleware.ts", "tests/auth.test.ts"]
    },
    {
      "id": "merge-conflict",
      "description": "Main with incoming merge conflict from feature/refactor",
      "git_ref": "main",
      "git_state": "conflict",
      "conflict_branch": "feature/refactor"
    },
    {
      "id": "empty-repo",
      "description": "Just git init, no commits",
      "git_ref": null,
      "git_state": "clean"
    },
    {
      "id": "commit-25",
      "description": "Repo at commit #25 (before auth refactor)",
      "git_ref": "main~25",
      "git_state": "clean"
    }
  ],
  "docs": {
    "readme": "docs/README.md"
  }
}
```

## Workflow

```
1. PREPARE    ->  Creer/importer une sandbox image (une fois)
2. LAUNCH     ->  Lancer un container depuis un checkpoint
3. TEST       ->  L'agent travaille dans le container (isole, jetable)
4. EXTRACT    ->  Extraire les resultats (docs, fitness, artifacts)
5. RESET      ->  Relancer depuis le meme ou un autre checkpoint
```

## Commandes CLI

```bash
# --- Creation d'images ---

# Creer depuis un repo existant avec checkpoints nommes
maestro sandbox create --from-repo ./mon-projet --name "git-commits" \
  --checkpoint "clean-main:HEAD" \
  --checkpoint "mid-feature:feature/auth"

# Creer depuis un Dockerfile
maestro sandbox create --from-dockerfile ./Dockerfile --name "python-proj"

# Lister les images disponibles
maestro sandbox list

# Inspecter une image (checkpoints, metadata)
maestro sandbox inspect git-commits

# --- Utilisation en foundry ---

# Lancer une foundry session avec sandbox
maestro session create --type foundry \
  --name "Commit Agent - Test Git" \
  --sandbox git-commits \
  --checkpoint mid-feature \
  --start

# Voir les resultats extraits du container
maestro session results <id>

# Relancer avec un autre checkpoint (meme session, container frais)
maestro session reset <id> --checkpoint merge-conflict

# --- Batch testing ---

# Tester sur TOUS les checkpoints, collecter la fitness
maestro foundry test <block-id> --sandbox git-commits --all-checkpoints
```

### Batch testing — output

```
Testing commit-agent@1.0 against sandbox git-commits...

  OK  clean-main      -> fitness: 0.92 (correct commit message)
  OK  mid-feature     -> fitness: 0.85 (staged right files, message OK)
  FAIL  merge-conflict  -> fitness: 0.30 (tried to commit during conflict)
  OK  empty-repo      -> fitness: 0.88 (created initial commit correctly)
  OK  commit-25       -> fitness: 0.90 (correct message for older state)

  Overall fitness: 0.77
  Worst case: merge-conflict (0.30) -- needs work
```

## Types de sandbox (generique)

Le systeme est generique, pas specifique a git :

| Type | Cas d'usage | Checkpoints typiques |
|------|-------------|----------------------|
| `git-repo` | Test d'agents de commit, review, merge | Branches, etats de working tree |
| `project` | Test d'agents de code (ajout feature, refactor) | Etapes du projet (avant/apres feature X) |
| `data` | Test d'agents de traitement de donnees | Datasets de tailles/formats differents |
| `broken` | Test d'agents de debug | Differents bugs injectes |
| `docs` | Test d'agents de documentation | Projets avec doc manquante/incomplete |

Les types sont des conventions, pas du code. L'infrastructure traite toutes les sandboxes de la meme facon.

## Implementation technique

### V1 : Git worktrees (sans Docker)

Pour les cas les plus courants (repos git), utiliser des worktrees :

```bash
# Cree un worktree dans un repertoire temporaire
git worktree add /tmp/sandbox-<session-id> <checkpoint-ref>
```

Avantages :
- Pas besoin de Docker
- Rapide a creer/detruire
- Natif git

Inconvenients :
- Pas d'isolation OS
- Pas de dependances custom (node_modules, venv)
- Limite aux repos git

Implementation :

```
ISandboxManager
  ├── GitWorktreeSandboxManager   <- V1
  └── DockerSandboxManager        <- V2
```

### V2 : Docker containers

```yaml
# .maestro/sandboxes/git-commits/Dockerfile
FROM alpine:3.19
RUN apk add --no-cache git nodejs npm
COPY repo/ /workspace/
VOLUME /output
WORKDIR /workspace
```

Chaque checkpoint = un script executé au demarrage du container :

```bash
# .maestro/sandboxes/git-commits/checkpoints/mid-feature.sh
#!/bin/sh
git checkout feature/auth
git reset --soft HEAD~1
```

Le volume `/output/` est monte vers `.maestro/sessions/<id>/output/` sur le host.

Avantages :
- Isolation complete
- Dependances custom
- Reproductibilite totale
- Fonctionne pour tous les types de sandbox

## Lien avec la documentation attachee

Les deux features se completent directement :

```
Sandbox (git-commits)
  |-- Checkpoint: mid-feature
  |     |-- Foundry run #1
  |     |     |-- Fitness: 0.85
  |     |     |-- Artifacts: /output/commit.patch
  |     |     '-- Auto-doc: "Agent staged 3 files, message quality 4/5"
  |     '-- Foundry run #2 (apres iteration prompt)
  |           |-- Fitness: 0.92
  |           '-- Auto-doc: "Improved with few-shot examples"
  |
  '-- RESEARCH.md auto-genere avec les donnees de TOUS les runs
       '-- Publie avec le block
```

Le batch testing sur plusieurs checkpoints produit des donnees riches qui alimentent automatiquement le `RESEARCH.md` du block (voir FEATURE-attached-docs.md).

## Changements requis dans l'infrastructure

| Composant | Changement |
|-----------|-----------|
| Domain | `SandboxImage` entity (id, version, type, checkpoints) |
| Domain | `SandboxCheckpoint` value object (id, description, config) |
| Application | `ISandboxManager` interface — create, launch, reset, extract, destroy |
| Infrastructure (V1) | `GitWorktreeSandboxManager` implementation |
| Infrastructure (V2) | `DockerSandboxManager` implementation |
| CLI | `maestro sandbox create/list/inspect` commands |
| CLI | `maestro session create --sandbox --checkpoint` flag |
| CLI | `maestro session reset --checkpoint` command |
| CLI | `maestro foundry test --sandbox --all-checkpoints` command |
| Session template | Support `sandbox` et `checkpoint` dans la config foundry |
| Publishing | Le `RESEARCH.md` inclut les resultats par checkpoint |
| API | `GET /api/sandboxes`, `POST /api/sandboxes/{id}/launch` |

## Criteres de validation

- [ ] `maestro sandbox create --from-repo` cree une image avec checkpoints depuis un repo existant
- [ ] `maestro sandbox list` affiche les images disponibles
- [ ] `maestro session create --sandbox X --checkpoint Y` lance une session avec le repo dans l'etat Y
- [ ] L'agent peut travailler dans la sandbox sans affecter le repo original
- [ ] Les fichiers ecrits dans `/output/` (ou equivalent worktree) survivent a la destruction du container
- [ ] `maestro session reset --checkpoint Z` remet la sandbox dans l'etat Z sans perdre les resultats precedents
- [ ] `maestro foundry test --all-checkpoints` execute le batch et produit un rapport de fitness par checkpoint
- [ ] Les resultats de batch test alimentent le `RESEARCH.md` auto-genere (lien avec FEATURE-attached-docs)
- [ ] V1 fonctionne sans Docker (git worktrees uniquement)
- [ ] V2 fonctionne avec Docker pour les types non-git

## Questions ouvertes

1. **Partage de sandboxes** : les sandbox images devraient-elles etre publiables/importables comme les blocks ? (probablement oui, pour que la communaute partage des datasets de test)
2. **Sandbox-as-a-block** : une sandbox image est-elle un block de type `sandbox` ? Ou une entite separee ? (argument pour : "everything is a block" ; argument contre : une sandbox n'est pas executable au sens classique)
3. **Taille des images** : les repos git avec beaucoup d'historique peuvent etre lourds. Faut-il un mecanisme de shallow clone ou de compression ?
4. **Parallelisme** : le batch testing peut-il lancer N containers en parallele pour accelerer ? (probablement oui, c'est un des avantages de Docker)
