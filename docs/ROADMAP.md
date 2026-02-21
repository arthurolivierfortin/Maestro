# Maestro — Roadmap

**Derniere mise a jour** : 2026-02-20
**Version actuelle** : v0.1.0-alpha (tag sur main)

---

## Phases completees (v0.1.0-alpha)

| Phase | Titre | Statut |
|-------|-------|--------|
| 4-10 | Infrastructure de base (blocks, sessions, execution, CLI) | COMPLETE |
| 11 | LLM Output Safety (JSON extraction, write guard) | COMPLETE |
| 12 | Runtime, CLI JSON, Universal Repo Binding | COMPLETE |
| 13 | Training Research + Directory Restructuring | COMPLETE |
| 14 | Documentation System + Publishing Architecture | COMPLETE |
| 15 | TUI Migration blessed → Ink | COMPLETE |
| 16 | TypeScript Migration + Shared Layer | COMPLETE |
| 17 | Shared Theme + Contextual Navigation + Keybindings | COMPLETE |
| 18 | ADR Blocks Are The Universal Unit | COMPLETE |
| 19 | First Version Planning (vision document) | COMPLETE (doc only) |
| 20-22 | V1 Features | COMPLETE |
| 23-25 | V2 Features + Shared App Logic | COMPLETE |
| 26 | V3 Autonomous Dev Agent (coaching, Cantante) | COMPLETE |
| 26-B | Claude Code LLM Provider | COMPLETE |
| 27 | Infrastructure | COMPLETE |
| 28 | V3 Roadmap + Suggestions | COMPLETE (planning) |
| 29 | Purpose document (adapt/optimize) | COMPLETE (planning) |
| 30 | Autonomous Dev v3 (8 nodes, 7 sub-blocks, 3/3 tests) | COMPLETE |
| 31-PRESOL | Bug fixes (TUI leaks, phase display, json-validator, quality gates) | COMPLETE |
| 31 | Solidification des fondations (publish, audit, usage reel Cantante) | COMPLETE |
| 32 | CLI Polish + maestro init + aliases + review gate | COMPLETE |
| 33 | `maestro code` — TUI interactive + headless + tests (29/29) | COMPLETE |
| 33-B | Audit UX & Ameliorations CLI (32/32 tests) | COMPLETE |
| 33-C | Consolidation TUI Monorepo (40+4+32 tests) | COMPLETE |
| 33-D | Restructuration Monorepo (apps/, cleanup, docs) | COMPLETE |
| 34-E-PRE | Extraction Conversation + Context comme entites | COMPLETE |
| 35-PRE | Agent composite, tool dispatch JSON, dev-orchestrator | COMPLETE |

---

## Phases actives et a venir

---

### Phase 34 : Agent Maestro v4 — Dev Fullstack Exceptionnel + Degradation Multi-Tiers

**But** : Construire un agent fullstack autonome compose de specialistes (verification visuelle, interaction intelligente, memoire persistante) qui depasse considerablement Claude Code, puis le degrader progressivement en tiers mesures.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 34-A | Design Spec — AGENT-V4-SPEC.md (conception complete de chaque bloc) | 1-2 jours |
| 34-B | Infrastructure — Tool blocks (Playwright, web-search) + State Manager + Checkpointing | 3-5 jours |
| 34-C | Agents specialistes + Workflow orchestrateur v4 (~19 blocs) | 5-8 jours |
| 34-D | Interaction Handler + Widget Protocol (feature differenciante) | 5-8 jours |
| 34-E-PRE | Extraction Conversation + Context comme entites (fondation pour 34-E) | 1 jour |
| 34-E | Integration + Fixes messages structures + --resume + Fitness Tier 1 | 3-5 jours |
| 34-F | Degradation progressive — Tiers 2+ (par paliers de ~5%) | 5-10 jours |

**Docs** : `docs/phases/PHASE-34/README.md`

---

### Phase 35 : Dogfooding — Maestro autonome sur Cantante

**But** : Prouver que le pipeline Maestro fonctionne de bout en bout en utilisant le dev-orchestrator pour developper Cantante via `maestro code`. Ameliorer l'agent et le tooling de maniere iterative basee sur l'usage reel.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 35-PRE | Agent composite, tool dispatch JSON, dev-orchestrator | COMPLETE |
| 35-A | Pipeline setup — workspace Cantante + session + validation | 1 jour |
| 35-B | Scaffold — React + Vite + Electron via agent | 1-2 jours |
| 35-C | Editor — Monaco integration via agent | 1-2 jours |
| 35-D | Agent improvement — analyse des echecs, amelioration prompts | 2-3 jours |
| 35-E | File tree + navigation via agent ameliore | 1-2 jours |
| 35-F | CLI/widget improvements bases sur les gaps | 2-3 jours |
| 35-G | Bilan — metriques, documentation, fitness report | 1 jour |

**Docs** : `docs/phases/PHASE-35/README.md`

---

### Phase 36 : Contexte et Conversation comme Blocs

**But** : Formaliser la conversation, le contexte et la memoire comme des blocs first-class, observables et composables. Fondation pour l'optimisation de contexte et le TUI panel.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 36-A | Conversation Block — extraction de AgentBlockExecutor | 3-5 jours |
| 36-B | Context Block — formalisation du context assembler | 2-3 jours |
| 36-C | Memory Block — connaissances persistantes | 5-8 jours |
| 36-D | TUI Context Panel — observabilite en temps reel | 3-5 jours |
| 36-E | Orchestration avancee — selection de contexte par l'orchestrateur | 5-8 jours |

**Docs** : `docs/phases/PHASE-36/README.md`

---

### Phase 37 : `maestro adapt` + `maestro optimize`

**But** : Automatiser l'adaptation aux modeles de l'utilisateur.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 37-A | `maestro adapt` (adaptation automatique) | 1-2 semaines |
| 37-B | `maestro optimize` (strategies pluggables) | 1-2 semaines |

**Docs** : `docs/phases/PHASE-37/README.md`

---

### Phase 38 : Premiere version distribuable

**But** : Maestro installable et utilisable par quelqu'un d'autre.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 38-A | Packaging et installation | 1 semaine |
| 38-B | Onboarding premier lancement | 3-5 jours |
| 38-C | Documentation utilisateur | 3-5 jours |
| 38-D | Beta testing (3-5 testeurs) | 2 semaines |

**Docs** : `docs/phases/PHASE-38/README.md`

---

### Phase 39+ : Futur

- 39 : Catalogue communautaire
- 40 : Auth et subscriptions
- 41 : Evaluateur cloud
- 42 : Agent Creator (meta-programmation)
- 43+ : Multi-domaine

**Docs** : `docs/phases/PHASE-39/README.md`

---

## Principes

1. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
2. **Usage reel avant features** — Tester sur Cantante avant d'ajouter des commandes
3. **Pas de phase "complete" sans test** — Un commit sur main ne suffit pas
4. **Committer directement sur main** — Pas de PRs pour un dev solo, tags pour les milestones
