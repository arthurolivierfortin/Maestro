# Phase 38 : Sandbox Foundry — Tests reproductibles pour agents

**Statut** : A faire
**Prerequis** : Phase 36-D COMPLETE (documentation attachee — les resultats de test alimentent RESEARCH.md)
**Objectif** : Permettre de tester des agents dans des environnements reproductibles avec des checkpoints nommes, et automatiser le batch testing pour mesurer la fitness.

---

## Probleme

Aujourd'hui pour tester un agent en foundry :
1. Il faut un vrai repo dans l'etat exact voulu — setup manuel a chaque fois
2. Si l'agent modifie le repo (commit, edit), il faut tout reset manuellement
3. Impossible de tester le meme agent sur 10 etats de repo differents automatiquement
4. Les resultats de test (docs, fitness, artifacts) disparaissent avec l'environnement ephemere
5. Pas de reproductibilite — chaque test depend de l'etat courant

---

## Concepts cles

### Sandbox Image
Snapshot immutable d'un environnement de test, versionne et reutilisable.

### Checkpoint
Un etat nomme dans une sandbox image (ex: `clean-main`, `mid-feature`, `merge-conflict`).

### Volume de sortie
Le container/worktree est jetable, mais `/output/` est un volume monte qui persiste les resultats.

Voir `docs/TODOS/FEATURE-sandbox-foundry.md` pour la specification complete.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 38-A | Sandbox images — entites, manager, git worktrees (V1) | 1 semaine |
| 38-B | Integration foundry sessions — lancer avec sandbox + checkpoint | 1 semaine |
| 38-C | Batch testing — tester sur tous les checkpoints, rapport fitness | 1 semaine |
| 38-D | Docker sandbox (V2) — isolation complete, types non-git | 1-2 semaines |

---

## 38-A : Sandbox images (V1 — Git worktrees)

### Ce que cette sous-phase fait

1. Creer `SandboxImage` entity dans Domain (id, version, type, checkpoints)
2. Creer `SandboxCheckpoint` value object (id, description, git_ref, git_state)
3. Creer `ISandboxManager` interface dans Application
4. Implementer `GitWorktreeSandboxManager` dans Infrastructure (git worktrees)
5. CLI : `maestro sandbox create/list/inspect`
6. Structure sur disque : `.maestro/sandboxes/<id>/sandbox.json`

### Structure d'une sandbox

```json
{
  "id": "git-commits",
  "version": "1.0",
  "description": "Git repo with 50 commits for testing commit generation agents",
  "type": "git-repo",
  "checkpoints": [
    { "id": "clean-main", "description": "Main branch, clean", "git_ref": "main" },
    { "id": "mid-feature", "description": "Feature branch, 3 uncommitted files", "git_ref": "feature/auth" },
    { "id": "merge-conflict", "description": "Main with merge conflict", "git_ref": "main" }
  ]
}
```

### Anti-patterns
- Ne PAS implementer Docker dans cette sous-phase — git worktrees suffisent pour V1
- Ne PAS coupler les sandboxes a un type d'agent — elles sont generiques
- Ne PAS persister les sandbox images dans le backend — fichiers locaux seulement

### Checkpoint
```markdown
## 38-A : Sandbox images
**Statut** : DONE / BLOQUE
**Entites creees** : SandboxImage, SandboxCheckpoint
**Manager** : GitWorktreeSandboxManager
**CLI create/list/inspect** : OUI/NON
**Tests** : [nombre]
```

---

## 38-B : Integration foundry sessions

### Ce que cette sous-phase fait

1. Support `--sandbox <id> --checkpoint <id>` sur `maestro session create`
2. Au demarrage de session : creer un worktree depuis le checkpoint
3. L'agent travaille dans le worktree (isole du repo original)
4. Volume de sortie : `.maestro/sessions/<id>/output/` recoit les artifacts
5. `maestro session reset --checkpoint <id>` : remet la sandbox dans un autre etat sans perdre les resultats precedents
6. `maestro session results <id>` : affiche ce qui est dans le volume de sortie

### Anti-patterns
- Ne PAS modifier le repo original — le worktree est une copie isolee
- Ne PAS melanger les artifacts de sortie avec les fichiers du worktree
- Ne PAS supprimer le volume de sortie au reset — il accumule les resultats

### Checkpoint
```markdown
## 38-B : Integration foundry
**Statut** : DONE / BLOQUE
**--sandbox flag** : OUI/NON
**Worktree isole** : OUI/NON
**Volume de sortie persist** : OUI/NON
**Reset sans perte** : OUI/NON
```

---

## 38-C : Batch testing

### Ce que cette sous-phase fait

1. `maestro foundry test <block-id> --sandbox <id> --all-checkpoints`
2. Pour chaque checkpoint : creer un worktree, lancer l'agent, mesurer la fitness, collecter les artifacts
3. Rapport final : fitness par checkpoint, worst case, overall fitness
4. Les resultats alimentent le `RESEARCH.md` auto-genere du bloc (lien Phase 36-D)

### Output attendu

```
Testing commit-agent@1.0 against sandbox git-commits...

  OK    clean-main      → fitness: 0.92
  OK    mid-feature     → fitness: 0.85
  FAIL  merge-conflict  → fitness: 0.30
  OK    empty-repo      → fitness: 0.88

  Overall fitness: 0.74
  Worst case: merge-conflict (0.30)
```

### Anti-patterns
- Ne PAS lancer les checkpoints en parallele dans V1 — sequentiel suffit
- Ne PAS hardcoder les evaluateurs — utiliser les evaluateurs de blocks existants
- Ne PAS ignorer les echecs — un echec sur un checkpoint est un signal, pas un bug

### Checkpoint
```markdown
## 38-C : Batch testing
**Statut** : DONE / BLOQUE
**Commande batch** : fonctionnelle / non
**Rapport genere** : OUI/NON
**RESEARCH.md alimente** : OUI/NON
```

---

## 38-D : Docker sandbox (V2)

### Ce que cette sous-phase fait

1. Implementer `DockerSandboxManager` (alternative a `GitWorktreeSandboxManager`)
2. Support Dockerfile dans la definition de sandbox
3. Chaque checkpoint = un script execute au demarrage du container
4. Volume `/output/` monte sur le host
5. Support des types non-git (project, data, broken, docs)

### Anti-patterns
- Ne PAS rendre Docker obligatoire — git worktrees restent le defaut
- Ne PAS implementer d'orchestration multi-container — un container par test suffit
- Ne PAS ajouter de registre Docker — images locales seulement

### Checkpoint
```markdown
## 38-D : Docker sandbox
**Statut** : DONE / BLOQUE
**DockerSandboxManager** : cree / teste
**Dockerfile support** : OUI/NON
**Types non-git** : [lesquels testes]
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-38/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 38 : Sandbox images avec checkpoints pour foundry. ISandboxManager, GitWorktreeSandboxManager (V1), DockerSandboxManager (V2)"
- Ajouter : "maestro sandbox create/list/inspect, maestro foundry test --all-checkpoints"

---

## Criteres de completion

- [ ] `maestro sandbox create --from-repo` cree une image avec checkpoints
- [ ] `maestro session create --sandbox X --checkpoint Y` lance dans l'etat Y
- [ ] L'agent travaille dans la sandbox sans affecter le repo original
- [ ] Les fichiers dans `/output/` survivent a la destruction du worktree/container
- [ ] `maestro foundry test --all-checkpoints` produit un rapport de fitness par checkpoint
- [ ] Les resultats alimentent le RESEARCH.md auto-genere (Phase 36-D)
- [ ] V1 fonctionne sans Docker (git worktrees)
