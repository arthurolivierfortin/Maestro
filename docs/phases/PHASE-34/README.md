# Phase 34 : Agent Maestro v4 — Dev Fullstack Exceptionnel

**Statut** : EN COURS
**Prerequis** : Phase 33-D COMPLETE (monorepo restructuration)
**Objectif** : Construire un agent de developpement fullstack autonome qui depasse considerablement Claude Code, puis le degrader progressivement en tiers mesures.

---

## Contexte

La Phase 34 combine deux ambitions :
1. **Tier 1 exceptionnel** : un agent compose de specialistes (frontend, backend, styling, review, E2E) capables de prendre un projet entier, le finir, et l'ameliorer — avec verification visuelle, interaction intelligente, et memoire persistante.
2. **Degradation progressive** : substituer les modeles bloc par bloc en utilisant le processus en escalier QualityScore-first (ADR), par paliers controles, jusqu'a un seuil minimal.

**Document de recherche** : `AGENT-REQUEST.md` (analyse de la requete, etat de l'art, architecture proposee)
**Requete originale** : `request.md`
**ADR qualite** : `ADR-QUALITY-FIRST-DEGRADATION.md` — separe QualityScore (qualite pure, Tier 1) et Fitness (rapport qualite/prix, Tiers 2+)

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-34/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS ecrire de code C# ou TypeScript dans les sous-phases 34-A et 34-PRE** — seulement du design
5. **Ne PAS creer de blocs "loose"** — suivre le workflow workspace > foundry > publish
6. **Ne PAS faire un agent "correct"** — le seuil est "exceptionnellement meilleur que Claude Code brut"
7. **Ne PAS utiliser d'outils lies a un provider specifique** — seulement des outils open-source/generiques
8. **Chaque sous-phase DOIT etre verifiee** avant d'etre declaree DONE
9. **Le Tier 1 utilise QualityScore (P x W)**, pas Fitness — le cout est irrelevant pour le Tier 1

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort | Niveau de detail |
|-------|-------|--------|------------------|
| 34-A | Design Spec — AGENT-V4-SPEC.md | 1-2 jours | COMPLET (DONE) |
| 34-PRE | Formalisation QualityScore — Alignement docs avec ADR | 0.5 jour | COMPLET |
| 34-B | Infrastructure — Tool blocks + State Manager + Checkpointing | 3-5 jours | MODERE |
| 34-C | Agents specialistes + Workflow orchestrateur v4 | 5-8 jours | MODERE |
| 34-D | Interaction Handler + Widget Protocol | 5-8 jours | VISION |
| 34-E | Integration + QualityScore Tier 1 + Comparaison vs Claude Code | 3-5 jours | VISION |
| 34-F | Degradation progressive — Tiers 2+ (processus en escalier) | 5-10 jours | VISION |

**Effort total estime** : 22-38 jours

**Niveaux de detail** (selon PHASE-TEMPLATE) :
- 34-A, 34-PRE : Detail complet (fait)
- 34-B, 34-C : Detail modere (1-2 phases d'ici)
- 34-D, 34-E, 34-F : Vision + effort (3+ phases d'ici — sera complete quand on y arrive)

---

## Vue d'ensemble de l'architecture cible

```
maestro-agent-v4 (workflow orchestrateur)
|
+--- PARALLELE: INTERACTION-HANDLER (agent composite)
|    Recoit les messages utilisateur, classifie l'intent,
|    peut pauser/resume/rewind le workflow via le state-manager.
|
+--- PHASE: COMPRENDRE
|    +-- project-analyzer      — Analyse stack, conventions, architecture
|    +-- task-architect         — Design high-level, decoupe en modules
|    +-- research-agent         — Cherche docs, exemples sur le web
|
+--- PHASE: PLANIFIER
|    +-- task-planner           — Plan d'implementation etape par etape
|    +-- plan-validator         — Valide le plan vs architecture + conventions
|
+--- PHASE: IMPLEMENTER (pour chaque module)
|    +-- backend-developer      — C#, API, DB, business logic
|    +-- frontend-developer     — React, TypeScript, components, state
|    +-- styling-developer      — CSS, Tailwind, animations, Framer Motion
|    +-- step-validator         — Verifie que les fichiers existent
|    +-- compilation-checker    — Build le projet, reporte les erreurs
|
+--- PHASE: VERIFIER
|    +-- test-writer            — Ecrit les tests unitaires
|    +-- test-runner            — Execute les tests, parse les resultats
|    +-- e2e-tester             — Playwright, teste les flows utilisateur
|    +-- ui-reviewer            — Screenshots, compare avec le design attendu
|    +-- accessibility-checker  — WCAG, arbre d'accessibilite
|
+--- PHASE: REVIEWER
|    +-- code-reviewer          — Score qualite code (v3, plus strict)
|    +-- security-reviewer      — Audit securite (OWASP top 10)
|    +-- architecture-reviewer  — Coherence avec l'architecture du projet
|
+--- PHASE: ITERER (boucle while — deja supporte)
|    +-- Si review < 0.8 : retour a IMPLEMENTER, max 3 iterations
|
+--- PHASE: LIVRER
     +-- git-committer          — Commit conventionnel (v3)
     +-- changelog-writer       — Met a jour le changelog
     +-- summary-reporter       — Rapport final
```

**State Manager** : Tool block partage entre le workflow et l'interaction-handler. Source unique de verite (status, currentPhase, plan, results, history).

**Widget Protocol** : L'agent communique avec l'utilisateur via des widgets dans `maestro code` (message, option-select, confirmation, progress, plan-view, diff-view, test-results).

---

## Metriques — QualityScore vs Fitness (ADR)

Le projet utilise deux metriques distinctes :

| Metrique | Formule | Quand l'utiliser |
|----------|---------|-----------------|
| **QualityScore** | P x W | Tier 1 (qualite pure, cout irrelevant) |
| **Fitness** | QualityScore / Cost^lambda | Tiers 2+ (rapport qualite/prix) |

Le processus de degradation suit un **escalier** :
1. **Tier 1** : maximiser QualityScore → etablir QualityBaseline
2. **Phase A** : optimiser le cout sous QualityFloor (QualityBaseline x 0.98)
3. **Plateau** : plus de substitution possible → Phase B
4. **Phase B** : baisser QualityFloor de 5% → retour Phase A
5. **STOP** quand QualityFloor < 0.70

Reference : `ADR-QUALITY-FIRST-DEGRADATION.md`

---

## Dependances entre sous-phases

```
34-A (Design Spec) ← DONE
  |
  +---> 34-PRE (QualityScore formalization) ← DONE
  |       |
  |       +---> 34-E (Integration + QualityScore Tier 1)
  |       +---> 34-F (Degradation — processus en escalier)
  |
  +---> 34-B (Infrastructure)
  |       |
  |       +---> 34-C (Specialist Agents + Workflow)
  |       |       |
  |       |       +---> 34-E (Integration + QualityScore Tier 1)
  |       |
  |       +---> 34-D (Interaction Handler)
  |               |
  |               +---> 34-E (Integration + QualityScore Tier 1)
  |
  +---> 34-E depend de 34-PRE + 34-B + 34-C + 34-D
          |
          +---> 34-F (Degradation Tiers 2+)
```

**Note** : 34-PRE ne bloque PAS 34-B, 34-C, ou 34-D. Ces sous-phases d'infrastructure et de creation de blocs peuvent avancer en parallele. 34-PRE bloque uniquement 34-E et 34-F (qui ont besoin du framework de mesure QualityScore).

---

## Documents de sous-phases

| Dossier | Sous-phase |
|---------|-----------|
| `34-A/` | Design Spec — AGENT-V4-SPEC.md |
| `34-PRE/` | Formalisation QualityScore — Alignement docs avec ADR |
| `34-B/` | Infrastructure — Tool blocks + State Manager + Checkpointing |
| `34-C/` | Agents specialistes + Workflow orchestrateur v4 |
| `34-D/` | Interaction Handler + Widget Protocol |
| `34-E/` | Integration + QualityScore Tier 1 + Comparaison vs Claude Code |
| `34-F/` | Degradation progressive — Tiers 2+ (processus en escalier) |

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-34/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 34 complete — Agent v4 avec X blocs, Y tiers, QualityBaseline Z"
- Ajouter : Nouveau topic file `memory/agent-v4.md` pour les patterns decouverts
- Retirer : References a "Active phase: 33-D" → remplacer par phase suivante
- Mettre a jour : Architecture Quick Reference avec les nouveaux blocs
