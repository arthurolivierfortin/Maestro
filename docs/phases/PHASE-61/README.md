# Phase 61 : Block-Forge Fiable

**Statut** : En cours
**Prerequis** : Phase 59 COMPLETE (agent isolation), Phase 60 COMPLETE (playground)
**Objectif** : Rendre block-forge fiable en corrigeant les bugs bloquants, verifiant le provider, renforçant le pre-flight, et validant les contracts empiriquement. Aucun agent n'est cree dans cette phase — on s'assure que l'infrastructure est solide AVANT d'y injecter des modeles.
**Duree estimee** : 2 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Ecrire dans `PHASE-61/checkpoint.md`** apres chaque sous-phase
3. **Lire `docs/phases/PHASE-61/phase-61-redesign-analysis.md`** — diagnostic complet
4. **Ne PAS lancer de workflow LLM sans avoir verifie le provider** (etape 0 de 61-A)
5. **Ne PAS condenser le system prompt** dans cette phase — attendre les resultats de 61-C
6. **Ne PAS creer d'agents** — c'est le travail de la Phase 62
7. **Ne PAS ignorer les couts** — configurer des limites avant chaque test LLM
8. **Ne PAS augmenter maxIterations** — si l'agent echoue en 12, le system prompt est le probleme

---

## Contexte — Pourquoi cette phase existe

### Diagnostic (session de nuit 2026-03-16)

L'agent precedent a tente 4 combinaisons modele/provider sans jamais verifier que l'infrastructure etait solide. Chaque echec avait une cause infrastructure, pas une cause "model trop bete" :

| Tentative | Echec | Vraie cause |
|-----------|-------|-------------|
| Claude Code CLI | Timeout 15+ min | 30-60s/appel = infrastructure, pas le modele |
| Llama 405B | Pas de step-complete | Limitation connue des modeles open source |
| gpt-4o #1 | 413 context overflow | Bug ConversationReadBlockExecutor (pas de truncation) |
| gpt-4o #2 | 429 rate limit | Free tier GitHub Models (15 appels max) |

**Aucun de ces echecs n'etait un probleme de qualite de modele.** L'infrastructure etait cassee.

### Fixes deja codes (session de nuit)

| Fix | Fichier | Status |
|-----|---------|--------|
| `config.maxIterations` injecte en variable session | `MultiNodeBlockExecutor.cs:229-244` | Code ecrit, non verifie E2E |
| `keepLastN` dans ConversationReadBlockExecutor | `ConversationReadBlockExecutor.cs:50-73` | Code ecrit, non verifie E2E |
| Propagation couts sous-blocs | `ToolDispatcherBlockExecutor.cs:143-149` | Code ecrit, non verifie E2E |
| Loop detection (warn@3, stop@5) | `NodeExecutionEngine.cs:402-518` | Code ecrit, non verifie E2E |
| Pre-flight (informatif seulement) | `MultiNodeBlockExecutor.cs:127-167` | Code ecrit, TROP FAIBLE |

**Le probleme** : tout est code, rien n'est verifie. Cette phase verifie et renforce.

---

## Sous-phases

| Phase | Titre | Effort | Document |
|-------|-------|--------|----------|
| 61-A | Provider setup + verification des fixes | 0.5 jour | [`PHASE-61-A.md`](PHASE-61-A.md) |
| 61-B | Pre-flight bloquant + loop detection verification | 0.5 jour | [`PHASE-61-B.md`](PHASE-61-B.md) |
| 61-C | Validation empirique des contracts | 1 jour | [`PHASE-61-C.md`](PHASE-61-C.md) |
| 61-T | Tests + verification finale | 0.5 jour | [`PHASE-61-T.md`](PHASE-61-T.md) |

**Ordre d'execution** : A → B → C → T (strict, pas de parallelisme)

Chaque sous-phase a un critere de passage explicite. Ne pas passer a la suivante si le critere n'est pas rempli.

---

## Definition of Done

- [ ] Provider Anthropic API verifie : un appel test reussit en < 5s
- [ ] `maxIterations` resolu a 12 (pas 50) — verifie dans les logs
- [ ] Couts parent > $0 apres execution avec child sessions — verifie par curl
- [ ] `keepLastN` fonctionne : contexte tronque apres N messages — verifie dans les logs
- [ ] Pre-flight BLOQUE si maxIterations non resolu ou modele inaccessible
- [ ] Loop detection arrete un agent apres 5 tool calls identiques — verifie par test unitaire
- [ ] Contracts valides empiriquement — resultats documentes dans `contract-validation-results.md`
- [ ] Au moins 1 test E2E : block-forge lance, execute 2+ iterations, s'arrete proprement
- [ ] Tous les tests passent, 0 regression
- [ ] `dotnet build` : 0 erreurs
- [ ] `npx tsc --noEmit` : 0 erreurs

### NOT in scope

- Condensation du system prompt (Phase 62, apres les donnees de 61-C)
- Creation d'agents (Phase 62)
- Live execution view (Phase 62)
- /adapt workflow (Phase 63)
- Modification de l'architecture des blocks

---

## Estimation des couts

Avec Claude Sonnet 4.6 via Anthropic API :
- System prompt agent-creator : ~30K tokens
- 8 messages contexte : ~8K tokens
- Input par appel : ~38K tokens × $3/MTok = **~$0.11/appel**
- Output par appel : ~2K tokens × $15/MTok = **~$0.03/appel**
- **12 iterations = ~$1.70 par creation d'agent**

Le pre-flight doit communiquer ce chiffre. Si un agent boucle et ne produit rien, c'est $1.70 perdus.

---

## Documents de reference

| Document | Contenu |
|----------|---------|
| `phase-61-redesign-analysis.md` | Diagnostic complet des 8 problemes identifies |
| `overnight-report-2026-03-16.md` | Rapport de la session precedente |
| `checkpoint.md` | Checkpoint de progression |
