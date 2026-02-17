# Roadmap V3 — Phases 30-33

**Date** : 2026-02-17
**Statut** : En cours (Phase 30 = a faire)
**Document racine** pour les phases 30 a 33 de Maestro V3.

---

## Vue d'ensemble

```
Phase 30 │  Premier agent autonome composite (Tier 1, Claude, qualite 100%)
         │  Prouver que la specialisation et la composition fonctionnent.
         │  Gate : >= 4/5 scenarios E2E reussis
         │
         ▼
Phase 31 │  CLI `maestro code` (teste avec l'agent Tier 1)
         │  Mode interactif TUI, detection de projet, widgets
         │  Gate : commande fonctionnelle, user-tested, documentee
         │
         ▼
Phase 32 │  Optimisation multi-tiers (Tier 1→5) + manifeste
         │  Substitution par bloc, mesure, publication avec metadata
         │  Gate : tiers publies avec manifeste, maestro check fonctionnel
         │
         ▼
Phase 33 │  Agent Creator + meta-optimisation (`adapt`, `optimize`)
         │  Automatiser la creation et l'optimisation d'agents
         │  Gate : adapt, creator, optimize automatises et mesures
```

---

## Phase 30 : Premier agent autonome

**Objectif** : Construire `autonomous-dev` (workflow composite de 6 sous-blocs), le tester, le mesurer, le publier.

| Sous-phase | Contenu | Issues | Estimation |
|-----------|---------|--------|-----------|
| **30-A** | Nettoyage legacy + fix infrastructure | 4 issues | 4-6h |
| **30-B** | Construction bottom-up des 6 sous-blocs | 6 issues | 6-8h |
| **30-C** | Assembler le composite + tester 3 scenarios | 5 issues | 7-10h |
| **30-D** | Foundry + mesure fitness + publication | 5 issues (incl. 30-D-0) | 4-7h |
| **30-E** | 5 scenarios E2E en session projet | 2 issues | 2-4h |

**Blocker critique** : 30-A-2 (tools-in-session-context) bloque tout.
**Decision architecturale** : ADR-COMPOSITE-AGENT-ARCHITECTURE.md, ADR-MODEL-SELECTION-STRATEGY.md

**Plans detailles** : `docs/phases/PHASE-30/PLAN.md`, `docs/phases/PHASE-30/DESIGN-AUTONOMOUS-DEV.md`

---

## Phase 31 : CLI `maestro code`

**Objectif** : Creer l'experience interactive `maestro code` (detection projet, creation session auto, widgets TUI, input utilisateur).

| Sous-phase | Contenu | Issues | Estimation |
|-----------|---------|--------|-----------|
| **31-A** | Mode interactif de base | 3 issues | 6-9h |
| **31-B** | Test et amelioration avec Tier 1 | 3 issues | 5-7h |

**Risque technique** : TUI inline (rendu + input dans le meme terminal) — prototype a valider avant implementation.

**Plans detailles** : `docs/phases/PHASE-31/README.md`, issues dans `31-A/` et `31-B/`

---

## Phase 32 : Optimisation multi-tiers

**Objectif** : Creer 5 tiers en substituant les modeles Claude par des modeles plus petits, mesurer, publier avec manifeste.

| Sous-phase | Contenu | Issues | Estimation |
|-----------|---------|--------|-----------|
| **32-A** | Substitution par bloc (Tiers 2-5) | 5 issues | 30-50h |
| **32-B** | Manifeste + `maestro check` | 2 issues | 3-5h |
| **32-C** | Selection automatique dans `maestro code` | 1 issue | 2-3h |

**Avertissement** : Les estimations de 32-A sont significativement plus elevees que le plan initial. La substitution vers des modeles plus petits necessite une reecriture des prompts, pas un simple changement de model_id. Les Tiers 4-5 (100% local) sont a haut risque d'echec.

**Plans detailles** : `docs/phases/PHASE-32/README.md`, issues dans `32-A/`, `32-B/`, `32-C/`

---

## Phase 33 : Meta-optimisation et Agent Creator

**Objectif** : Automatiser la creation d'agents et l'optimisation de workflows.

| Sous-phase | Contenu | Issues | Estimation |
|-----------|---------|--------|-----------|
| **33-A** | `maestro adapt` | 1 issue | 1-2 sessions |
| **33-B** | Agent Creator | 1 issue | 2-3 sessions |
| **33-C** | `maestro optimize` | 1 issue | 2-3 sessions |

**Note** : Plans detailles a creer quand les phases 30-32 sont stables.

**Plans detailles** : `docs/phases/PHASE-33/README.md`, issues dans `33-A/`, `33-B/`, `33-C/`

---

## Budget et cout estime

### Phase 30 (Tier 1 — Opus/Sonnet)

| Activite | Appels LLM estimes | Cout estime |
|----------|--------------------| ------------|
| 30-B : tests standalone (6 blocs x 3 tentatives) | ~18 appels | ~$15-20 |
| 30-C : tests composite (3 scenarios x 3 iterations) | ~63 appels (9 runs x 7 noeuds) | ~$35-50 |
| 30-D : foundry (6 blocs + 1 composite) | ~30-50 appels | ~$20-30 |
| 30-E : E2E (5 scenarios) | ~35 appels | ~$20-25 |
| **Total Phase 30** | **~150-170 appels** | **~$90-125** |

### Phase 31 (test + iteration)

| Activite | Cout estime |
|----------|------------|
| 31-B : tests utilisateur (5 scenarios) | ~$25-35 |
| **Total Phase 31** | **~$25-35** |

### Phase 32 (re-training multi-tiers)

| Activite | Cout estime |
|----------|------------|
| Tier 2 (Sonnet/Haiku) | ~$20-30 |
| Tier 3 (Haiku/Qwen) | ~$15-25 |
| Tier 4 (Sonnet/Qwen local) | ~$10-15 |
| Tier 5 (tout local) | ~$5-10 |
| **Total Phase 32** | **~$50-80** |

### Total V3

**Estimation totale : $165-240** en appels LLM (Opus + Sonnet principalement).

> **Note** : Ces estimations supposent des prix Claude Opus ~$15/1M input, ~$75/1M output et Sonnet ~$3/1M input, ~$15/1M output. Les couts reels peuvent varier. Les tests sur modeles locaux (Qwen) sont gratuits.

---

## Dependances entre phases

```
Phase 30 ────────────────────────────────────────→ Phase 31
    │                                                  │
    │  (autonomous-dev publie,                         │  (maestro code
    │   >= 4/5 E2E reussis)                            │   fonctionnel)
    │                                                  │
    └──────────────────────────────────────────────────→ Phase 32
                                                          │
                                                          │  (tiers publies,
                                                          │   maestro check)
                                                          │
                                                          └→ Phase 33
```

Phase 31 et Phase 32 sont independantes l'une de l'autre mais toutes deux dependent de Phase 30. Phase 33 depend de Phase 32.

---

## Documents de reference

| Document | Contenu |
|----------|---------|
| `PHASE-28/ANALYSIS-V3-DEEP.md` | Analyse des erreurs Phase 28, lecons apprises |
| `PHASE-30/PLAN.md` | Plan detaille Phase 30 (30-A a 30-E) |
| `PHASE-30/DESIGN-AUTONOMOUS-DEV.md` | Design complet de l'agent composite |
| `PHASE-30/ADR-COMPOSITE-AGENT-ARCHITECTURE.md` | Pourquoi composite vs monolithique |
| `PHASE-30/ADR-MODEL-SELECTION-STRATEGY.md` | Pourquoi Opus pour X, Sonnet pour Y |
| `PHASE-31/README.md` | Plan Phase 31 |
| `PHASE-32/README.md` | Plan Phase 32 + avertissements |
| `PHASE-33/README.md` | Plan Phase 33 (haute altitude) |
