# Issue 30-C-1 : Reecrire autonomous-dev.agent.block.json

**Statut** : A faire
**Estimation** : 1 heure
**Bloquant** : Bloque 30-C-2 a 30-C-5
**Prerequis** : 30-B (tous les sous-blocs existent et sont testes)

---

## Description

Reecrire le fichier `autonomous-dev` comme workflow composite utilisant `config.nodes` pour orchestrer les sous-blocs dans le bon ordre : prepare → plan → for-each implement → test → review → conditional(commit/fix).

---

## Tache detaillee

### 1. Ecrire le .block.json

Chemin : `content/system/blocks/agents/autonomous-dev/autonomous-dev.agent.block.json`

Le fichier DOIT contenir :
- `id: "autonomous-dev"`
- `blockType: "agent"`, `isAtomic: false`
- `inputs: [task, repoPath]`
- `config.nodes` avec la sequence complete (voir PLAN.md pour le JSON detaille) :
  - prepare → plan → for-each(implement-step) → test → review → **conditional(quality-gate)** → commit
  - La branche `else` du conditional contient un **while(fix-loop)** : fix → retest → re-review (max 2 iterations)
  - Apres le fix-loop, un noeud `commit-after-fix` commit avec une note sur les issues restantes
- `metadata.tier: 1`, `metadata.models` avec le mapping bloc→modele

### 2. Verifier la validite du JSON

```bash
# Le JSON doit etre valide
cat content/system/blocks/agents/autonomous-dev/autonomous-dev.agent.block.json | python -m json.tool
```

### 3. Verifier que le backend parse le fichier

```bash
# Redemarrer le backend
cd backend && dotnet build && dotnet run --urls http://localhost:5000

# Lister les blocs — autonomous-dev doit apparaitre
cd maestro-cli && node index.js list-blocks | grep autonomous-dev
```

### 4. Verifier que les blockRef referencent des blocs existants

Chaque `blockRef` dans `config.nodes` doit correspondre a un bloc trouve par `IBlockDiscoveryService` :
- `project-preparer` ✓ (prepare)
- `task-planner` ✓ (plan)
- `implement-single-step` ✓ (implement-step + fix — meme bloc, input different)
- `test-executor` ✓ (test + retest)
- `code-reviewer` ✓ (review + re-review)
- `git-committer` ✓ (commit + commit-after-fix)

**Note** : `fix` reutilise `implement-single-step` avec un input `mode: "fix"` et les issues de la review. Pas de bloc separe.

---

## Instructions de test

### Test 1 : JSON valide

```bash
cat content/system/blocks/agents/autonomous-dev/autonomous-dev.agent.block.json | python -m json.tool
# Doit retourner le JSON formate sans erreur
```

### Test 2 : Backend parse le bloc

```bash
curl -s http://localhost:5000/api/blocks | python -m json.tool | grep autonomous-dev
# Doit trouver le bloc dans la liste
```

### Test 3 : Les blockRef sont resolus

```bash
# Pour chaque blockRef, verifier qu'il existe
for bloc in project-preparer task-planner implement-single-step test-executor code-reviewer git-committer; do
  echo "$bloc:"
  curl -s "http://localhost:5000/api/blocks/$bloc" | head -1
done
# Chaque bloc doit retourner un JSON valide (pas 404)
```

---

## Critere de completion

- [ ] Le fichier `autonomous-dev.agent.block.json` existe et est JSON valide
- [ ] Le backend parse le fichier sans erreur
- [ ] Le bloc apparait dans `list-blocks`
- [ ] Tous les `blockRef` dans `config.nodes` sont resolus (les blocs existent)
- [ ] Les inputs (`task`, `repoPath`) sont definis
- [ ] Le `config.nodes` contient la sequence complete : prepare → plan → for-each → test → review → **conditional(quality-gate)** → commit/fix-loop
- [ ] Le noeud `conditional` verifie `score >= 0.8` et branche vers commit ou fix-loop
- [ ] Le `while` fix-loop a une condition `_fixIterations < 2` pour eviter les boucles infinies
- [ ] Le for-each itere sur `_nodeResult_plan`
- [ ] Le `metadata.tier` est 1

---

## Risques

- **Risque** : Le format du JSON n'est pas compatible avec le parser de `config.nodes` dans le backend
- **Mitigation** : Verifier dans le code C# comment `config.nodes` est deserialisé
- **Risque** : Le noeud `conditional` (score >= 0.8 → commit/fix) n'est pas supporte par le backend
- **Mitigation** : Verifier le support dans `ExecuteConfigNodesAsync`. Le `conditional` est deja implemente (Phase 12). Le `while` est aussi supporte. Tester avec un cas simple avant le composite complet.
- **Risque** : La condition `{{_nodeResult_review.score}} >= 0.8` necessite l'acces a un champ d'un objet JSON
- **Mitigation** : Verifier que le template resolver supporte le dot-path. Si non, extraire le score dans une variable separee via un noeud intermediaire.
