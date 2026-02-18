# Issue 30-C-5 : Iterer le composite

**Statut** : COMPLETE (2026-02-18) — 3/3 tests passing via 30-C-AJUSTEMENT Phase D
**Estimation** : 3-6 heures
**Bloquant** : Bloque 30-D (foundry)
**Prerequis** : 30-C-2, 30-C-3, 30-C-4 (les 3 tests initiaux)

---

## Description

Apres les 3 premiers tests, analyser les echecs et ajuster le composite. L'objectif est d'arriver a 3/3 taches reussies avec les MEMES prompts, sans modification entre les tests.

---

## Tache detaillee

### 1. Analyser les echecs des tests 30-C-2, 30-C-3, 30-C-4

Pour chaque echec, identifier la cause :

| Categorie | Exemples | Correction |
|-----------|----------|-----------|
| Prompt insuffisant | Le planner ne separe pas par domaine | Renforcer le system-prompt.md du planner |
| Format de sortie | Le plan n'est pas un JSON array pur | Ajouter "Output ONLY the JSON array" |
| Passage de donnees | Le for-each ne recoit pas le bon format | Verifier les templates {{...}} |
| Contexte insuffisant | L'implementeur ne connait pas les conventions | Ajouter l'input `conventions` |
| Model limité | Sonnet ne gere pas la tache | Essayer Opus pour ce bloc |

### 2. Ajuster les sous-blocs

Modifier les `system-prompt.md` des sous-blocs concernes. NE PAS modifier le composite (config.nodes) sauf si le probleme est structurel.

### 3. Re-tester les 3 scenarios

Executer les 3 tests dans le MEME ordre :
1. "Create a README.md"
2. "Fix TypeScript errors"
3. "Create a file-tree module"

### 4. Repeter jusqu'a stabilite

**Minimum 3 iterations**. Chaque iteration :
- Identifier les echecs
- Ajuster UN SEUL element (prompt, input, modele)
- Re-tester les 3 scenarios

**Regle** : ne jamais changer plus d'une variable a la fois entre deux iterations.

---

## Journal d'iteration

Tenir un journal dans un fichier `content/user/experiments/phase-30-iterations.md` :

```markdown
## Iteration 1 (date)
- Test simple : ✅/❌ — raison
- Test modere : ✅/❌ — raison
- Test complexe : ✅/❌ — raison
- Ajustement : description du changement

## Iteration 2 (date)
...
```

---

## Critere de completion

- [x] 3/3 taches reussies avec les MEMES prompts
- [x] Aucune modification entre les 3 tests de la derniere iteration
- [x] Minimum 3 iterations documentees dans le journal (7 iterations total)
- [x] Les system-prompt.md des sous-blocs sont finalises
- [x] Le composite `autonomous-dev` est stable

## Results

- **D-1 (simple)**: "Add a multiply function" → commit `e73b38c` ✅
- **D-2 (moderate)**: "Fix all TypeScript compilation errors" → commit `0d05433` ✅
- **D-3 (complex)**: "Create a FileTree component" → commit `25b7a5e` ✅

See `content/user/experiments/phase-30-iterations.md` for full iteration journal (7 iterations).
See `IMPLEMENTATION-NOTES.md` for detailed results and anti-hallucination mechanisms.

---

## Gate de passage

**STOP si** apres 6 iterations, les 3 tests ne passent pas tous :
- Documenter les problemes restants
- Identifier s'il s'agit d'un probleme d'infrastructure (30-A) ou de contenu (prompts)
- Demander de l'aide pour les problemes d'infrastructure
