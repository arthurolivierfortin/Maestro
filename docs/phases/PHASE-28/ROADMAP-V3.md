# Roadmap V3 — Agent Autonome, Mode Interactif, Agent Creator

> Date : 2026-02-15
> Prérequis : V1 ✅ V2 ✅ — Gates passées (voir AUDIT-V1V2.md)
> Infrastructure : ClaudeCodeProvider ✅ (Phase 26-B)

---

## Vue d'ensemble

```
Phase 28-INFRA  │  BlockRef dispatch + timeout + model-detector   │ ~3h
     │
     ▼
Phase 28-A      │  Agent "idéal" (créé manuellement, Claude)      │ ~3 jours
     │             ├── autonomous-dev (agent composite)
     │             ├── 7 sous-blocs + state manager + interaction agent
     │             ├── Test sur Cantante (9 scénarios)
     │             └── Processus développeur (temporaire)
     │
     ▼
Phase 28-B      │  Mode `maestro code` + Widgets                  │ ~2 jours
     │             ├── Mode TUI interactif (comme Claude Code)
     │             ├── Système de widgets génériques (11 types)
     │             ├── Sélection d'agent
     │             ├── `maestro check` (compatibilité statique)
     │             └── Protocole agent ↔ widgets
     │
     ▼
Phase 28-B2     │  Agent Creator                                   │ ~2 jours
     │             ├── Agent qui crée des agents automatiquement
     │             ├── Orchestre le processus foundry existant
     │             ├── Design → génère JSON → train → publish
     │             └── L'utilisateur ne programme jamais
     │
     ▼
Phase 28-C      │  Optimisation multi-tiers + manifeste            │ ~2 jours
     │             ├── Tier 1→5 (via Agent Creator ou manuel)
     │             ├── Manifeste de publication (auto-généré)
     │             ├── Sélection automatique de tier
     │             └── Rapport comparatif
     │
     ▼
Phase 29-A      │  Adaptation automatique                          │ ~2 jours
     │             ├── `maestro adapt` (test modèles locaux)
     │             ├── Évaluateurs comme blocs (3 niveaux)
     │             └── Workflow system:adapt-workflow
     │
     ▼
Phase 29-B      │  Optimisation automatique                        │ ~2 jours
                   ├── `maestro optimize` (meta-workflow)
                   ├── Stratégies comme blocs
                   ├── Récursion bottom-up
                   └── Préparer infra évaluateur cloud
```

---

## Phase 28 — Agent Autonome et Outillage

### Phase 28-INFRA : Infrastructure critique

**But** : Débloquer la composition de workflows V3.

| Étape | Description | Effort |
|-------|-------------|--------|
| INFRA-1 | BlockRef dispatch dans ExecuteRegularNodeAsync | 2h |
| INFRA-2 | Agent wall-clock timeout (configurable) | 30min |
| INFRA-3 | Agent loop detection (même appel 3x) | 30min |
| INFRA-4 | Test E2E : bloc avec model=claude-sonnet via ClaudeCodeProvider | 30min |
| INFRA-5 | Tool `model-detector` : liste les modèles disponibles via API | 30min |

**Gate INFRA** : BlockRef dispatch + Claude E2E + timeout + `model-detector` retourne les modèles.

---

### Phase 28-A : Agent "idéal"

**But** : Créer le meilleur agent de développement autonome possible. Qualité maximale.

**Architecture** : Agent composite (`blockType: "agent"`) contenant :
- **State Manager** — État partagé (source de vérité unique)
- **Workflow interne** — Pipeline déterministe : prepare → analyze → plan → implement → test → review → commit
- **Interaction Agent** — Intelligence conversationnelle, a le dernier mot. Pause, resume, rewind, dispatch.

**Livrables** :
1. **`autonomous-dev-v3`** — Bloc agent composite avec 3 composants internes
2. **7 sous-blocs** composites + `interaction-handler-v3` + `workflow-state-manager`
3. **Test E2E sur Cantante** : 9 scénarios (docs, tâches, review, rewind, override)
4. Création manuelle (processus développeur — remplacé par Agent Creator en 28-B2)

**Gate 28-A** : 9 tests Cantante passés. State manager + rewind + interjections fonctionnent. Monitor affiche tout.

**Plan détaillé** : `PLAN-PHASE-28A.md`

---

### Phase 28-B : Mode `maestro code` + Widgets

**But** : `maestro code` — mode interactif TUI (comme Claude Code) avec des widgets dynamiques.

**Architecture** :
- **Mode TUI** (app Ink) — pas un alias, pas un wrapper. Une expérience interactive persistante.
- **Widgets génériques** — 11 types (option-select, text-input, progress, diff-view, plan-view, etc.). Réutilisables par n'importe quel agent.
- **Protocole** — L'agent demande un widget par type via `_widgetRequest`. Le mode le rend. Aucun widget n'est spécifique à un agent.

**Livrables** :
1. **`maestro code`** — Commande CLI qui entre dans le mode interactif
2. **Système de widgets** dans `shared/tui/widgets/` — 11 composants Ink réutilisables
3. **Sélection d'agent** — L'utilisateur choisit quel agent utiliser (comme choisir un modèle dans Claude Code)
4. **`maestro check`** — Vérification statique de compatibilité modèles
5. **Input permanent** — L'utilisateur peut taper à tout moment, même pendant l'exécution

**Gate 28-B** : `maestro code` fonctionne E2E. Widgets s'affichent. Messages routés à l'interaction agent. Pause/resume.

**Plan détaillé** : `PLAN-PHASE-28B.md`

---

### Phase 28-B2 : Agent Creator

**But** : Automatiser la création d'agents. L'utilisateur décrit ce qu'il veut, l'Agent Creator fait le reste.

**Architecture** : Agent composite (même pattern que `autonomous-dev-v3`) :
- **Workflow** : comprendre → designer → valider → créer workspace → for-each bloc (générer JSON → foundry → train → publish) → assembler → test E2E → publier
- **Réutilise** les workflows foundry existants (`agent-improvement-loop`, `tool-creation`, `block-validation`)
- **Interaction Agent** : questionne sur les exigences, montre la progression, permet d'ajuster

**Livrables** :
1. **`agent-creator-v3`** — Bloc agent qui crée des agents
2. **5 sous-blocs** : understand-request, design-architecture, block-generator, training-orchestrator, agent-assembler
3. **Test** : créer un agent simple (résumé de fichiers), un agent complexe (traduction), recréer autonomous-dev-v3

**Gate 28-B2** : Créer un agent de traduction de documents de A à Z automatiquement. Litmus test : agent de recettes de cuisine.

**Plan détaillé** : `PLAN-PHASE-28B2.md`

---

### Phase 28-C : Optimisation multi-tiers + manifeste

**But** : Publier 3-5 tiers de `autonomous-dev-v3` + générer les manifestes pour la compatibilité.

**Livrables** :
1. **5 tiers** — De Claude partout (Tier 1) à locaux partout (Tier 5)
2. **Manifeste auto-généré** — Modèles requis, fitness par bloc, substituts testés, critères d'évaluation
3. **Sélection automatique** — Détecte les modèles, propose le meilleur tier
4. **L'Agent Creator peut créer les variantes** — ou processus manuel si nécessaire
5. **Rapport comparatif** — Qualité/coût/fitness par tier

**Gate 28-C** : ≥3 tiers publiés avec manifestes. Tier local fonctionne. Rapport comparatif généré.

**Plan détaillé** : `PLAN-PHASE-28C.md`

---

## Phase 29 — Adaptation et Optimisation Automatiques

### Phase 29-A : Adaptation automatique

**But** : `maestro adapt` — teste les modèles locaux comme substituts et produit un workflow adapté.

**Livrables** :
1. **Workflow `system:adapt-workflow`** avec manifeste
2. **Évaluateurs comme blocs** : heuristic (gratuit), llm (local), cloud (stub)
3. **`maestro adapt <workflow>`** — CLI
4. **Raccourcis via manifeste**

**Gate 29-A** : `maestro adapt tier3` produit un workflow adapté. Évaluation heuristique fonctionne.

**Plan détaillé** : `PLAN-PHASE-29A.md`

---

### Phase 29-B : Optimisation automatique

**But** : `maestro optimize` — meta-workflow qui optimise n'importe quel bloc.

**Livrables** :
1. **Workflow `system:optimize-block`**
2. **Stratégies comme blocs** : model-downgrade, prompt-refinement, temperature-tuning
3. **`maestro optimize <block>`** avec `--recursive`
4. **Infrastructure évaluateur cloud** (préparer l'API)

**Gate 29-B** : `maestro optimize context-analyzer-v3` fonctionne. `--recursive` sur un workflow fonctionne.

**Plan détaillé** : `PLAN-PHASE-29B.md`

---

## Phase 30+ — Futur

| Phase | But | Description |
|-------|-----|-------------|
| 30 | Service cloud Maestro | API d'évaluation hébergée, freemium, self-hosted enterprise |
| 31 | Marketplace de blocs | Partage communautaire de blocs, workflows, stratégies |
| 32 | Multi-domaine | Templates workflow pour docs, traduction, data, musique |

---

## Métriques de succès

| Métrique | Phase | Critère |
|----------|-------|---------|
| Agent Tier 1 complet | 28-A | 9 tests Cantante réussis |
| Mode `maestro code` fonctionnel | 28-B | TUI interactive + widgets + sélection d'agent |
| Agent Creator crée des agents | 28-B2 | Créer un agent de traduction automatiquement |
| ≥3 tiers publiés avec manifestes | 28-C | Manifestes avec fitness + substituts |
| Adaptation automatique | 29-A | `adapt` produit un workflow utilisable |
| Optimisation automatique | 29-B | `optimize` + `--recursive` |
| Zéro code spécifique dans l'infrastructure | Toutes | Litmus test : recettes de cuisine |
| L'utilisateur ne programme jamais | 28-B2+ | Tout via agents dans le mode `maestro code` |
