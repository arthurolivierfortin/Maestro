# Phase 61 — Analyse de redesign

**Date** : 2026-03-17
**Contexte** : Block-forge echoue systematiquement. Les agents ne completent pas, le monitoring est une boite noire, les couts ne sont pas controles, et le pipeline n'est pas utilise comme il a ete concu.

---

## Diagnostic complet

### Problemes identifies

| # | Probleme | Severite | Cause racine |
|---|----------|----------|-------------|
| 1 | `maxIterations` resolu a 50 au lieu de 12 | Critique | La variable `{{maxIterations}}` n'est pas populee en session depuis `config.maxIterations` |
| 2 | Agent tourne en boucle sans progres | Critique | Aucune detection de boucle (meme tool call 3+ fois) |
| 3 | System prompt agent-creator trop gros (994 lignes) | Majeur | Exemples verbeux, documentation inline qui devrait etre dans le contract |
| 4 | Couts parent = $0 avec sessions enfants | Majeur | BlockRefHandler accumule sur l'enfant, pas le parent |
| 5 | Aucune visibilite pendant l'execution | Majeur | Le TUI montre "Still running..." sans detail |
| 6 | Pas de pre-flight check avant de depenser | Majeur | Aucune validation config/modele/cout avant lancement |
| 7 | Contracts non valides empiriquement | Moyen | Les tests verifient du texte, pas que le block genere fonctionne |
| 8 | Pas de feedback entre test-designer et agent-creator | Moyen | Pipeline lineaire sans iteration |

### Etat de l'infrastructure

| Composant | Existe | Fonctionne | Manque |
|-----------|--------|-----------|--------|
| Contracts (agent-creator, test-designer) | Oui (10 + 18 tests) | Partiellement | Validation empirique |
| System prompts | Oui (994L + 210L) | agent-creator trop gros | Condensation a ~500L |
| Block-forge workflow | Oui (8 nodes) | Pipeline lineaire OK | Iteration, feedback |
| ContractTestRunner | Oui (8 check types) | OK pour inference blocks | Pas de model override |
| Monitoring components | Partiellement | PhaseList OK | ExecutionTree, tool calls live, fitness graph |
| Loop detection | Non | N/A | Tout a creer |
| Pre-flight checks | Non | N/A | Tout a creer |
| Foundry sessions | Template existe | Non utilise | Integration avec block-forge |

---

## Phase 61 redesignee : Block-Forge Production-Ready

### Vision

L'utilisateur lance `/create-agent` et voit en temps reel :
- Chaque etape de l'agent (read contract → write block → test → fix → complete)
- Chaque tool call avec son resultat
- Le cout qui s'accumule
- Le fitness qui evolue
- La possibilite d'annuler a tout moment

Si l'agent tourne en rond, Maestro le detecte et l'arrete automatiquement.
Avant de lancer, Maestro valide la config et estime le cout.

### Sous-phases proposees

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 61-A | Fix bugs bloquants | maxIterations, cout parent, system prompt condense | 1 jour |
| 61-B | Pre-flight + Safety | Validation config, estimation cout, loop detection, auto-stop | 1 jour |
| 61-C | Live execution view | Arbre d'etapes en temps reel, tool calls, cout, fitness dans le TUI | 1.5 jours |
| 61-D | Valider les contracts | Verifier empiriquement que les tests des contracts sont faisables et pertinents | 0.5 jour |
| 61-E | Creer les agents via pipeline Maestro | Utiliser foundry sessions, iterer les system prompts, valider le fitness | 1-2 jours |
| 61-T | Tests + validation visuelle | Tests E2E, verification MCP | 0.5 jour |

---

### 61-A : Fix bugs bloquants

1. **maxIterations** : Dans `MultiNodeBlockExecutor` ou `AgentBlockExecutor`, copier `config.maxIterations` vers la session comme variable avant d'entrer dans la boucle while
2. **Cout parent** : Dans `BlockRefHandler`, apres l'execution de l'enfant, copier `_accumulatedCost` de l'enfant vers le parent (additionner)
3. **System prompt** : Condenser agent-creator de 994 → ~400 lignes. Garder : role, format JSON minimal, tools, step-complete, iteration budget. Retirer : exemples exhaustifs, anti-patterns detailles, model tier guidelines (ca va dans le contract)

### 61-B : Pre-flight + Safety

**Pre-flight avant chaque workflow :**
- Verifier que le modele est accessible (appel test rapide via playground endpoint)
- Verifier que `maxIterations` est resolu correctement
- Estimer le cout max : `maxIterations * avgTokensPerCall * pricePerToken`
- Si cout estime > limite session → avertir l'utilisateur
- Verifier que le contract existe et a des tests

**Safety pendant l'execution :**
- **Loop detection** : tracker les tool calls dans `_toolHistory`. Si meme toolId appele 3+ fois consecutivement → warning dans les logs. Si 5+ fois → set `_agentDone = true` avec message "Agent stuck in loop"
- **Progress detection** : si 3 iterations sans nouveau type de tool call → nudge l'agent avec un message "You seem stuck. Try a different approach or call step-complete."
- **Budget check** : verifier le cout apres chaque iteration (deja fait via cost enforcement, mais ajouter la verification dans la boucle while)

### 61-C : Live execution view

Le TUI montre en temps reel ce que l'agent fait. Dans la page Agent, quand un workflow/agent est en cours :

```
┌─ BLOCK FORGE ───────────────────────────────────────────────┐
│ code-reviewer (contract: code-reviewer)                      │
│ Model: claude-sonnet-4-6 | Iter: 3/12 | Cost: $0.05         │
│                                                               │
│ ── test-designer (complete ✓) ──────────── $0.01 ──────     │
│ [✓] directory-list content/system/contracts/                  │
│ [✓] file-read code-reviewer.contract.json                     │
│ [✓] file-write test-suite.json (8 tests)                      │
│ [✓] step-complete "Generated 8 tests"                         │
│                                                               │
│ ── agent-creator (iteration 3/12) ──────── $0.04 ──────     │
│ [✓] file-read code-reviewer.contract.json                     │
│ [✓] file-write code-reviewer.agent.block.json                 │
│ [→] contract-test code-reviewer...                            │
│ [ ] Fix issues                                                │
│ [ ] step-complete                                             │
│                                                               │
│ Cost: $0.05 / $1.00 | Time: 2m 30s                          │
│ [Esc] Cancel                                                  │
└──────────────────────────────────────────────────────────────┘
```

Ceci utilise les variables de session existantes (`_executionLog`, `_activeBlock`, etc.) mais les presente de maniere lisible au lieu de "Still running..."

### 61-D : Valider les contracts

Avant de creer des agents avec block-forge, verifier que les contracts sont solides :
- Lancer les tests du contract `agent-creator` manuellement sur un block existant
- Lancer les tests du contract `test-designer` manuellement
- Verifier que les tests sont faisables et que le scoring a du sens
- Ajuster les tests si necessaire

### 61-E : Creer les agents via pipeline Maestro

C'est le travail que block-forge automatise, fait manuellement avec les outils Maestro :
1. **Creer une session foundry** pour agent-creator
2. **Iterer le system prompt** : tester → mesurer fitness → ajuster
3. **Tester avec au moins 2 modeles** (Claude Sonnet + gpt-4o/Llama)
4. **Publier** quand fitness > 0.5
5. **Repeter** pour test-generator
6. **Documenter** chaque iteration et les resultats

### 61-T : Tests + validation

- Tests E2E : block-forge complete en < 5 min avec outputs valides
- Verification visuelle MCP : live execution view fonctionne
- Pre-flight check fonctionne (empeche le lancement si config invalide)
- Loop detection arrete un agent en boucle

---

## Instructions pour l'agent (Claude Code)

A ajouter dans CLAUDE.md ou dans un guide agent :

1. **JAMAIS lancer un workflow LLM sans verification** :
   - Verifier `maxIterations` resolu correctement
   - Verifier que le modele repond (appel test via playground)
   - Estimer le cout max et le communiquer
   - Verifier que le contract existe

2. **TOUJOURS monitorer les 2 premieres iterations** :
   - Apres iteration 1 : l'agent a-t-il fait un tool call utile ?
   - Apres iteration 2 : l'agent fait-il des tool calls differents ?
   - Si non → ARRETER et diagnostiquer

3. **TOUJOURS utiliser le pipeline Maestro** :
   - Creer une session foundry, pas du curl ad-hoc
   - Tester via ContractTestRunner, pas en regardant les logs
   - Iterer systematiquement, pas relancer en esperant

4. **JAMAIS augmenter maxIterations sans justification** :
   - 12 iterations = budget pour 1 cycle creation + 2 cycles fix
   - Si l'agent n'accomplit rien en 12, le system prompt est le probleme, pas le nombre d'iterations

---

## Estimation effort total

~5-6 jours pour la Phase 61 complete. C'est plus que l'estimation initiale (3-5 jours) mais ca inclut maintenant le monitoring live, les safety checks, et la validation empirique des contracts — sans lesquels block-forge est inutilisable.
