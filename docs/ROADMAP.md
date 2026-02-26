# Maestro — Roadmap

**Derniere mise a jour** : 2026-02-26
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
| 40-PRE | Maestro Code — L'App Unifiee (agent-first architecture, shared @maestro/tui, identity) | COMPLETE |
| 41-PRE | Spatial TUI (Page Registry, 2D grid, mascotte, command palette) | COMPLETE (remplace par Phase 42) |

---

## Phases actives et a venir

---

### Phase 42 : Restructuration maestro-code = Monitor + AgentPanel

**Statut** : EN COURS (code quasi-fini, verification en attente du Visual Gate)
**But** : Remplacer l'architecture spatiale over-engineered de 41-PRE par une copie du monitor solide + AgentPanel interactif.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 1 | Copier les fichiers du monitor (~25 composants, 3 hooks, theme) | fait |
| 2 | Creer AgentPanel + TaskInputBar | fait |
| 3 | Reecrire App.ts (pattern monitor + SessionManager + demo) | fait |
| 4 | Modifier SessionMonitor (ajouter AgentPanel dans layout) | fait |
| 5 | Supprimer le spatial (registry/, pages/, mascotte, etc.) | fait |
| 6 | Tests et verification | en attente Phase 43 |

**Docs** : `docs/phases/PHASE-42/README.md`

---

### Phase 43 : Visual Gate — PTY Capture + Golden Files + Structural Assertions

**Statut** : A FAIRE (priorite haute — bloque la verification de Phase 42)
**But** : Pipeline de verification visuelle automatise. Spawne le TUI dans un vrai PTY (node-pty + @xterm/headless), capture le buffer terminal, valide contre des golden files et assertions structurelles.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 43-A | Frame capture infrastructure (node-pty + @xterm/headless + smoke test) | 1-1.5 jours |
| 43-B | Golden files + structural assertions + integration test:visual | 1-1.5 jours |

**Docs** : `docs/phases/PHASE-43/README.md`

---

### Phase 44 : TUI Sentinel — Agent autonome de validation TUI

**Statut** : PLANIFIE (depend de Phase 43)
**But** : Agent Maestro (workflow block) qui decouvre, teste, et corrige le TUI automatiquement. Premiere utilisation reelle de Maestro sur son propre code.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 44-A | Block infrastructure (workflow + agent blocks + session template) | 3-5 jours |
| 44-B | Discovery + Analysis agents | 3-5 jours |
| 44-C | Atomic + Integration testing | 3-5 jours |
| 44-D | Visual capture + Fix loop (SWE-Agent style) | 5-7 jours |
| 44-E | Report + Self-improvement | 3-5 jours |

**Docs** : `docs/phases/PHASE-44/README.md`

---

### Phase 45 : Premiere version distribuable

**But** : Maestro installable et utilisable par quelqu'un d'autre.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 45-A | Packaging et installation (npm global + SDK) | 1 semaine |
| 45-B | Onboarding premier lancement | 3-5 jours |
| 45-C | Documentation utilisateur | 3-5 jours |
| 45-D | Beta testing (3-5 testeurs) | 2 semaines |

---

### Phase 46 : Cantante v1 — Premiere app propulsee par Maestro

**But** : Faire de Cantante la premiere application publique qui tourne SUR Maestro.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 46-A | Integration @maestro/client + @maestro/sidecar dans Cantante | 1 semaine |
| 46-B | Agent Jarvis specialise Cantante | 1-2 semaines |
| 46-C | Case study public (metriques, tutorial) | 3-5 jours |

---

### Phase 47+ : Futur

- 47 : Catalogue communautaire (publier/importer blocks + docs + sandboxes)
- 48 : Auth et subscriptions
- 49 : Fitness Engine + Agent Evaluateur Autonome
- 50 : Agent Creator (meta-programmation — utilise l'evaluateur de 49)
- 51+ : Multi-domaine

---

## Chaine de dependances

```
35 Dogfooding (DONE)
 └→ 36 Context/Memory/Docs (DONE)
     └→ 37 Runtime & SDK (DONE)
         └→ 38 Sandbox Foundry (DONE)
             └→ 39 adapt + optimize (DONE)
                 └→ 40-PRE Polish & Agent-First UX (DONE)
                     └→ 41-PRE Spatial TUI (DONE — remplace par 42)
                         └→ 42 Restructuration maestro-code (EN COURS)
                             └→ 43 Visual Gate (A FAIRE — debloque la verification de 42)
                                 └→ 44 TUI Sentinel (utilise le visual gate)
                                     └→ 45 Distribution (empaquetter tout)
                                         └→ 46 Cantante v1 (premiere app Maestro publique)
                                             └→ 47+ Catalogue, Auth, Fitness Engine...
```

## Features planifiees (TODOS)

| Feature | Phase cible | Document |
|---------|-------------|----------|
| Visual Gate (PTY capture) | 43 | `docs/phases/PHASE-43/README.md` |
| TUI Sentinel (agent QA) | 44 | `docs/phases/PHASE-44/README.md` |
| Distribution / packaging | 45 | A creer |
| Cantante v1 | 46 | A creer |
| Catalogue communautaire | 47 | Futur |
| Fitness Engine + Agent Evaluateur | 49 | `docs/TODOS/FEATURE-fitness-engine-evaluator.md` |

## Principes

1. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
2. **Usage reel avant features** — Tester sur Cantante avant d'ajouter des commandes
3. **Pas de phase "complete" sans test** — Un commit sur main ne suffit pas
4. **Committer directement sur main** — Pas de PRs pour un dev solo, tags pour les milestones
5. **Chaque phase construit sur la precedente** — Pas de trou dans les dependances
6. **Verifier avant de declarer** — vitest passing ≠ feature works (incident Phase 41-PRE)
