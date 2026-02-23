# Maestro — Roadmap

**Derniere mise a jour** : 2026-02-24
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
| 35 | Dogfooding — Maestro autonome sur Cantante (34 sessions, 41 fixes, 100% post-fix) | COMPLETE |
| 36 | Contexte, Memoire et Documentation (conversation/context/memory blocks, attached docs, TUI context panel) | COMPLETE |
| 37 | Maestro Runtime & SDK (@maestro/client, @maestro/sidecar, Jarvis, voice, CLI migration) | COMPLETE |
| 38 | Sandbox Foundry — git worktrees + Docker, session integration, batch testing (22 tests) | COMPLETE |
| 39 | `maestro adapt` + `maestro optimize` — manifest extraction, model substitution, temperature tuning (16 tests) | COMPLETE |

---

## Phases actives et a venir

---

### Phase 40-PRE : Maestro Code — L'App Unifiee

**But** : Transformer `maestro code` d'un task runner mono-ecran en L'application Maestro. Architecture agent-first (Flipper Zero), composants shared dans @maestro/tui, identite visuelle Command Center.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 40-PRE-C | Bug fixing & verification (138+ tests, CLI audit) | 2-3 jours |
| 40-PRE-A | Shared components @maestro/tui + architecture agent-first | 5-7 jours |
| 40-PRE-B | Identite visuelle Command Center (palette, borders, splash, mascotte) | 2-3 jours |
| 40-PRE-D | First-run experience (WelcomeScreen, help overlay) | 1-2 jours |
| 40-PRE-E | Test E2E & polish final | 1-2 jours |

**Docs** : `docs/phases/PHASE-40-PRE/README.md`

---

### Phase 37 : Maestro Runtime & SDK

**But** : Permettre aux applications tierces d'embarquer Maestro comme runtime. Ajouter le mode vocal a maestro code et creer l'agent Jarvis generique.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 37-A | SDK client npm (@maestro/client) | 1 semaine |
| 37-B | Mode sidecar (@maestro/sidecar) | 1 semaine |
| 37-C | Blocks audio (STT + TTS) | 3-5 jours |
| 37-D | Mode vocal dans maestro code (toggle a chaud, Ctrl+V) | 3-5 jours |
| 37-E | Agent Jarvis — template generique de router d'intentions | 3-5 jours |

**Docs** : `docs/phases/PHASE-37/README.md`

---

### Phase 38 : Sandbox Foundry — Tests reproductibles

**But** : Tester des agents dans des environnements reproductibles avec checkpoints nommes. Automatiser le batch testing pour mesurer la fitness.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 38-A | Sandbox images — entites, ISandboxManager, git worktrees (V1) | 1 semaine |
| 38-B | Integration foundry sessions — lancer avec sandbox + checkpoint | 1 semaine |
| 38-C | Batch testing — tous les checkpoints, rapport fitness | 1 semaine |
| 38-D | Docker sandbox (V2) — isolation complete, types non-git | 1-2 semaines |

**Docs** : `docs/phases/PHASE-38/README.md`

---

### Phase 39 : `maestro adapt` + `maestro optimize`

**But** : Automatiser l'adaptation des workflows aux modeles de l'utilisateur et l'optimisation des tiers.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 39-A | `maestro adapt` — adaptation automatique | 1-2 semaines |
| 39-B | `maestro optimize` — strategies pluggables d'optimisation | 1-2 semaines |

**Docs** : `docs/phases/PHASE-39/README.md`

---

### Phase 40 : Premiere version distribuable

**But** : Maestro installable et utilisable par quelqu'un d'autre, incluant le SDK pour apps.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 40-A | Packaging et installation (npm global + SDK) | 1 semaine |
| 40-B | Onboarding premier lancement | 3-5 jours |
| 40-C | Documentation utilisateur (+ guide "Building Maestro Apps") | 3-5 jours |
| 40-D | Beta testing (3-5 testeurs) | 2 semaines |

**Docs** : `docs/phases/PHASE-40/README.md`

---

### Phase 41 : Cantante v1 — Premiere app propulsee par Maestro

**But** : Faire de Cantante la premiere application publique qui tourne SUR Maestro, avec navigation vocale et assistance IA embarquee.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 41-A | Integration @maestro/client + @maestro/sidecar dans Cantante | 1 semaine |
| 41-B | Agent Jarvis specialise Cantante (7+ intents vocaux) | 1-2 semaines |
| 41-C | Case study public (metriques, tutorial, template) | 3-5 jours |

**Docs** : `docs/phases/PHASE-41/README.md`

---

### Phase 42+ : Futur

- 42 : Catalogue communautaire (publier/importer blocks + docs + sandboxes)
- 43 : Auth et subscriptions
- 44 : Fitness Engine + Agent Evaluateur Autonome (description + reference → tests auto, cascade heuristique/LLM-local/cloud)
- 45 : Agent Creator (meta-programmation — utilise l'agent evaluateur de 44 pour valider ses creations)
- 46+ : Multi-domaine

---

## Chaine de dependances

```
35 Dogfooding (DONE — 34 sessions, 41 fixes, 100% post-fix)
 └→ 36 Context/Memory/Docs (fondations pour Jarvis + encyclopedie)
     └→ 37 Runtime & SDK (embarquer Maestro dans des apps + vocal)
         └→ 38 Sandbox Foundry (tests reproductibles)
             └→ 39 adapt + optimize (utilise les sandboxes pour la fitness)
                 └→ 40-PRE Polish & Agent-First UX (maestro code = L'app)
                     └→ 40 Distribution (empaquetter tout)
                     └→ 41 Cantante v1 (premiere app Maestro publique)
                         └→ 42 Catalogue communautaire
                         └→ 43 Auth + subscriptions
                             └→ 44 Fitness Engine + Agent Evaluateur (description + reference → tests auto)
                                 └→ 45 Agent Creator (utilise 44 pour valider)
```

## Features planifiees (TODOS)

| Feature | Phase cible | Document |
|---------|-------------|----------|
| Documentation attachee | 36-D | `docs/TODOS/FEATURE-attached-docs.md` |
| Sandbox foundry | 38 | `docs/TODOS/FEATURE-sandbox-foundry.md` |
| Maestro Runtime & SDK | 37 | `docs/phases/PHASE-37/README.md` |
| Mode vocal (toggle) | 37-D | `docs/phases/PHASE-37/README.md` |
| Agent Jarvis | 37-E + 41-B | Generique en 37, specialise Cantante en 41 |
| Fitness Engine + Agent Evaluateur | 44 | `docs/TODOS/FEATURE-fitness-engine-evaluator.md` |

## Principes

1. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
2. **Usage reel avant features** — Tester sur Cantante avant d'ajouter des commandes
3. **Pas de phase "complete" sans test** — Un commit sur main ne suffit pas
4. **Committer directement sur main** — Pas de PRs pour un dev solo, tags pour les milestones
5. **Chaque phase construit sur la precedente** — Pas de trou dans les dependances
