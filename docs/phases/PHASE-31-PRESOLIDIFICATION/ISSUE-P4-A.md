# Issue P4-A : Publish Phase 30 Agent Through Approval Flow

**Priorite** : P4 (process compliance)
**Estimation** : 2-3 heures
**Bloque** : Rien
**Bloque par** : P3-A (version protection must exist first)

---

## Probleme

Phase 30 a produit un workflow `autonomous-development` fonctionnel avec 6 sous-blocs, teste sur 3 scenarios (3/3 passing). Mais :

- Aucun bloc n'a ete soumis via `block publish`
- Aucun n'est passe par le workflow d'approbation
- Aucune metrique de fitness n'a ete enregistree dans les manifests
- Aucune entree catalogue n'existe
- Pas de documentation "voici ce qui a ete developpe, voici les metriques"

C'est exactement le workflow decrit dans `docs/guides/users/full-pipeline.md` — et on l'a saute.

---

## Blocs a publier

### Workflow principal

| Bloc | Type | Fichier |
|------|------|---------|
| `autonomous-development` | workflow | `content/system/blocks/workflows/autonomous-development.workflow.block.json` |

### Sous-blocs (6)

| Bloc | Type | Fichier |
|------|------|---------|
| `project-preparer` | agent | `content/system/blocks/agents/project-preparer/project-preparer.agent.block.json` |
| `task-planner` | agent | `content/system/blocks/agents/task-planner/task-planner.agent.block.json` |
| `implement-single-step` | agent | `content/system/blocks/agents/implement-single-step/implement-single-step.agent.block.json` |
| `test-executor` | agent | `content/system/blocks/agents/test-executor/test-executor.agent.block.json` |
| `code-reviewer` | inference | `content/system/blocks/inference/code-reviewer/code-reviewer.inference.block.json` |
| `git-committer` | agent | `content/system/blocks/agents/git-committer/git-committer.agent.block.json` |

---

## Metriques a enregistrer (depuis Phase 30 testing)

### Metriques globales du workflow

| Metrique | Valeur |
|----------|--------|
| Scenarios testes | 3 |
| Pass rate | 3/3 (100%) |
| Iterations pour stabiliser | 7 |
| Modele | Claude Sonnet (via ClaudeCodeLLMProvider) |

### Resultats par test

| Test | Difficulte | Resultat | Commit | Duree |
|------|-----------|----------|--------|-------|
| D-1: Add multiply function | Simple | PASS | `e73b38c` | ~4 min |
| D-2: Fix TypeScript errors | Moderate | PASS | `0d05433` | ~3 min |
| D-3: Create FileTree component | Complex | PASS | `25b7a5e` | ~10 min, 5 fichiers |

### Anti-hallucination mechanisms actifs

- Done guard (prevents premature completion)
- JSON validator (validates plan format)
- Step validator (validates step results)
- Multi-tool response guard (catches file-write + done in same response)
- repoPath auto-injection (prevents "0" path resolution)

---

## Procedure de publication

Pour chaque bloc, dans l'ordre (sous-blocs d'abord, workflow ensuite) :

```bash
cd C:\Meastro\maestro-cli

# 1. Publier chaque sous-bloc
node index.js block publish project-preparer --version 1.0.0
node index.js block publish task-planner --version 1.0.0
node index.js block publish implement-single-step --version 1.0.0
node index.js block publish test-executor --version 1.0.0
node index.js block publish code-reviewer --version 1.0.0
node index.js block publish git-committer --version 1.0.0

# 2. Publier le workflow
node index.js block publish autonomous-development --version 3.0.0

# 3. Verifier les approbations en attente
node index.js block --pending-approval

# 4. Approuver chaque bloc (l'utilisateur decide)
node index.js block approve <approval-id> --reviewed-by "user"
# Repeter pour chaque bloc

# 5. Verifier le catalogue
node index.js catalog
```

### Note sur le flag `--version`

Verifier que les blocs ont deja un champ `version` dans leur JSON. Si oui, le CLI devrait lire cette version. Si non, `--version` le definit.

Le workflow `autonomous-development` est deja en `version: "3.0.0"` dans son JSON.

---

## Double objectif

1. **Valider le flow de publication** end-to-end : publish → pending → approve → catalog
2. **Donner a l'utilisateur l'experience d'approbation** qu'il aurait du avoir

Si des bugs sont decouverts pendant la publication (et c'est probable), les documenter et corriger. C'est exactement le genre de test reel qui revele les gaps.

---

## Criteres de completion

- [ ] Les 7 blocs (6 sous-blocs + 1 workflow) sont soumis via `block publish`
- [ ] L'utilisateur a approuve chaque bloc
- [ ] `maestro catalog` affiche les 7 blocs avec version et type
- [ ] Si P3-C est fait : la provenance est visible dans `catalog show`
- [ ] Tout bug decouvert pendant le process est documente
