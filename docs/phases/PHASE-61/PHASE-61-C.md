# 61-C : Validation Empirique des Contracts

> **Note** : Ce document remplace l'ancien 61-C (Live Execution View, deplace en Phase 62-C) et l'ancien 61-D (validation contracts, etendu a 1 jour).

**Effort** : 1 jour
**Prerequis** : 61-B COMPLETE (pre-flight bloquant, loop detection active)
**Critere de passage** : Chaque contract teste, resultats documentes, causes d'echec classifiees

---

## Lecture obligatoire

- `content/system/contracts/agent-creator.contract.json` — le contract de l'agent-creator. Lire les tests un par un
- `content/system/contracts/test-designer.contract.json` — si existant
- `content/system/contracts/code-reviewer.contract.json` — contract utilise comme cible de test
- `docs/system/architecture/contracts.md` — comment le systeme de contracts fonctionne
- `docs/phases/PHASE-57/checkpoint.md` — limitations connues des contract tests pour les agents

---

## Pourquoi cette sous-phase est critique

La validation empirique des contracts est LE point de donnees le plus important de la phase 61. Si les contracts sont irealistes (tests trop stricts, checks qui ne matchent pas ce qu'un agent peut produire), tout le reste echoue — l'agent ne peut pas atteindre fitness > 0.5 peu importe la qualite du system prompt.

Le rapport de Phase 57 note : "Contract tests inadequats pour blocks agentiques (verifient le texte de reponse, pas les fichiers crees)." Ceci doit etre verifie empiriquement ici.

**Budget : 1 jour complet. Ne pas rusher cette etape.**

---

## Etape 1 — Inventaire des contracts et tests

Lister tous les contracts avec leurs tests :

```bash
cd C:/Meastro/packages/maestro-cli
node index.js contract list
```

Pour chaque contract, noter :
- Nombre de features
- Nombre de tests par feature
- Types de checks utilises (contains, json-valid, regex, etc.)

---

## Etape 2 — Tester agent-creator contre son contract

```bash
node index.js contract test agent-creator --block agent-creator
```

### Analyse OBLIGATOIRE pour chaque test echoue

Pour chaque test qui echoue, repondre a ces 4 questions :

1. **Le prompt est-il clair ?** — Est-ce que le prompt du test donne assez d'information pour que l'agent sache quoi faire ?
2. **Les checks sont-ils raisonnables ?** — Est-ce que les checks mesurent une capacite reelle ou un format exact ?
3. **La reponse de l'agent est-elle correcte malgre l'echec ?** — L'agent a-t-il produit un resultat utile que le check ne detecte pas ?
4. **Classification** :
   - `check-too-strict` : le check demande un format exact que l'agent ne peut pas produire de facon fiable
   - `prompt-unclear` : le prompt est ambigu ou manque de contexte
   - `block-broken` : l'agent ne fait clairement pas ce qu'il devrait
   - `test-irrelevant` : le test ne mesure pas une capacite utile du contract
   - `runner-bug` : le ContractTestRunner a un bug (ex: ne passe pas les bons inputs)

### Limitation connue — agents et ContractTestRunner

Le ContractTestRunner envoie un prompt et verifie la reponse textuelle. Mais les agents produisent des **tool calls**, pas du texte. Le `_agentResult` est un resume genere par `step-complete`, pas la sortie brute de l'agent.

Pour les agents, les tests doivent verifier :
- Que `_agentResult` contient les informations attendues (blockId, fitness, etc.)
- Que les fichiers ont ete crees (side effects) — MAIS le runner ne verifie pas ca

**Si la majorite des echecs sont dus a cette limitation** : documenter comme `runner-limitation`, pas `block-broken`. C'est un point de donnees important pour la Phase 62 (quand on iterera les agents).

---

## Etape 3 — Tester test-designer contre son contract

```bash
node index.js contract test test-designer --block test-designer
```

Meme analyse que l'etape 2.

---

## Etape 4 — Tester les contracts cibles (code-reviewer, test-generator)

Ces contracts sont utilises comme CIBLES par block-forge (l'agent-creator cree des blocks qui implementent ces contracts). Verifier que les tests sont faisables :

```bash
# Si un block code-reviewer existe :
node index.js contract test code-reviewer --block code-reviewer
# Si un block test-generator existe :
node index.js contract test test-generator --block test-generator
```

Si ces blocks n'existent pas encore, lire les tests manuellement et evaluer :
- Les prompts sont-ils clairs pour un agent qui code ?
- Les checks sont-ils verifiables programmatiquement ?
- Les poids des features sont-ils raisonnables ?

---

## Etape 5 — Ajuster les contracts si necessaire

### Regles d'ajustement

| Ajustement | Autorise | Interdit |
|------------|----------|----------|
| Relaxer un check de format ("issues" OU "problems" acceptes) | OUI | |
| Supprimer un test redondant | OUI | |
| Ajouter un check alternatif (regex plus souple) | OUI | |
| Affaiblir un check de capacite core ("doit produire du JSON valide") | | INTERDIT |
| Supprimer un test parce que l'agent echoue | | INTERDIT |
| Ajouter des tests | OUI (si un gap est identifie) | |

### Documentation des ajustements

Pour chaque ajustement, noter dans le fichier de resultats :
- Quel test / quel check
- L'ancien check et le nouveau
- Pourquoi (avec la reponse de l'agent comme preuve)

---

## Etape 6 — Documenter les resultats

Creer `docs/phases/PHASE-61/contract-validation-results.md` :

```markdown
# Contract Validation Results — Phase 61-C

**Date** : YYYY-MM-DD
**Provider** : Anthropic API (claude-sonnet-4-6)
**Cout total de la validation** : $X.XX

## agent-creator contract

| # | Test | Feature | Result | Score | Classification | Notes |
|---|------|---------|--------|-------|----------------|-------|
| 1 | ... | ... | PASS/FAIL | 0.X | - / check-too-strict / ... | ... |

**Fitness global** : X.XX
**Tests ajustes** : [liste avec justification]
**Tests supprimes** : [liste avec justification]
**Recommandation pour Phase 62** : [ce qu'il faut changer dans le system prompt]

## test-designer contract
[meme tableau]

## code-reviewer contract (target)
[evaluation manuelle des tests si pas de block existant]

## Conclusions
- Les contracts sont-ils faisables par un agent avec le system prompt actuel ?
- Quels ajustements de system prompt sont necessaires ? (→ input pour Phase 62-A)
- Y a-t-il des limitations du ContractTestRunner a contourner ?
```

---

## Verification finale 61-C

- [ ] Tous les contracts testes (agent-creator, test-designer, + contracts cibles si blocks existent)
- [ ] Chaque test echoue est classifie (5 categories)
- [ ] Resultats documentes dans `contract-validation-results.md`
- [ ] Ajustements de contracts documentes avec justification
- [ ] Recommandations pour Phase 62 formulees
- [ ] Cout de la validation note
- [ ] Aucun contract affaibli sans justification

---

## Anti-patterns

- Ne PAS lancer les tests sans le provider Anthropic verifie (61-A)
- Ne PAS affaiblir les contracts pour obtenir un bon score
- Ne PAS ignorer les echecs — chaque echec doit etre classifie
- Ne PAS passer plus de 1 jour — si apres 4h les resultats sont clairs, documenter et passer a 61-T
- Ne PAS modifier le system prompt dans cette sous-phase — les modifications vont en Phase 62-A, informees par ces donnees
- Ne PAS lancer plus de 3 runs consecutifs sans analyser — ca brule du budget LLM

---

## Checkpoint

```markdown
## 61-C : Validation Empirique des Contracts
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**agent-creator fitness** : X.XX (X/Y tests passes)
**test-designer fitness** : X.XX (X/Y tests passes)
**Classifications** : X check-too-strict, X prompt-unclear, X block-broken, X runner-limitation
**Tests ajustes** : X — [liste courte]
**Cout validation** : $X.XX
**Fichier resultats** : docs/phases/PHASE-61/contract-validation-results.md
**Recommandations Phase 62** : [resume en 2-3 lignes]
```
