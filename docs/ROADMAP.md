# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-02
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
| 42 | Restructuration maestro-code = Monitor + AgentPanel + keyboard fix | COMPLETE |
| 43 | Visual Gate — PTY Capture + Golden Files + Structural Assertions | COMPLETE |
| 44 | Dogfooding Pragmatique — Cantante + Jarvis (4/4 taches, 8 sessions, 100% succes) | COMPLETE |

---

## Phases actives et a venir

> **Decision strategique 2026-03-02** : Les phases 44-B et 44-C sont annulees comme prerequis.
> Seuls les items essentiels sont extraits dans 45-PREP. Voir `docs/phases/PHASE-45/STRATEGIC-ANALYSIS.md`.

---

### Phase 45-PREP : Stabilisation essentielle (1 semaine max)

**But** : Rendre maestro-code utilisable au quotidien. L'agent est un assistant conversationnel qui orchestre Maestro (workspaces, sessions, training, monitoring). Il discute, explique, confirme avant d'agir, et doit etre plus rapide que faire les commandes CLI a la main.

**Critere de succes** : Le developpeur principal utilise maestro-code pendant 2h pour orchestrer des sessions sur Cantante, score moyen >= 3.5/5 sur les dimensions de qualite agent.

| Item | Objectif | Effort |
|------|----------|--------|
| 1 | Securite : path traversal + shell injection sanitization | 0.5 jour |
| 2 | TUI : scroll fix, error display dans ConversationLog | 0.5 jour |
| 3 | Conversations persistantes (sauver/recharger entre sessions) | 1-2 jours |
| 4 | Slash commands essentiels (/help, /new, /clear, /stop, /quit) | 0.5 jour |
| 5 | Agent quality : system prompt Maestro-aware, CLI knowledge, operation chaining | 1-2 jours |
| 6 | Dogfooding profond (2h orchestration tasks, scoring, comparaison vs CLI manuel) | 0.5 jour |

**NOT in scope** : Foundry CRUD, block creation TUI, git status integration, token display, refactoring cosmetique.

**Gate** : Score dogfooding >= 3.5/5. Aucune dimension < 2. Le developpeur VEUT utiliser maestro-code.

---

### Phase 45 : Premiere version distribuable (2 semaines max)

**But** : `npm install -g @maestro/cli && maestro init && maestro code` fonctionne.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 45-0 | Fixes usabilite (context assembly delay, concurrent invocations, response corruption) | 0.5 jour |
| 45-A | Packaging npm, commande globale, sidecar auto-start | 3-4 jours |
| 45-B | `maestro init` + onboarding premier lancement (provider config) | 2-3 jours |
| 45-C | Documentation : README, Getting Started, 3 exemples concrets | 2-3 jours |
| 45-D | Beta testing (3-5 testeurs, feedback structure) | 3-5 jours |

**Gate** : 3 testeurs externes installent et utilisent maestro-code avec succes sur leur propre projet.

---

### Phase 46 : Cantante v1 — Premiere app propulsee par Maestro

**But** : Faire de Cantante la premiere application publique qui tourne SUR Maestro.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 46-A | Integration @maestro/client + @maestro/sidecar dans Cantante | 1 semaine |
| 46-B | Agent Jarvis specialise Cantante | 1-2 semaines |
| 46-C | Case study public (metriques, tutorial) | 3-5 jours |

---

### Phase 48 : Bug Fixes Dogfooding + Agent Local Model

**But** : Corriger les bugs critiques du dogfooding, dynamic blockRef, maestro-assistant-compact.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 48-A | Bug fixes dogfooding (4 bugs) | 1h |
| 48-B | Assistant local gratuit + dynamic blockRef | 2h |
| 48-C | Diagnostic provider Claude Code CLI | 30min |

---

### Phase 49 : Hardware-Aware Setup, Agent Capabilities & Provider Metrics

**But** : L'utilisateur arrive pour la premiere fois, voit ses capacites hardware, telecharge un modele local gratuit, et commence a utiliser Maestro en 5 minutes. Les capacites agent sont claires. La page Models retrouve la richesse du provider-monitor.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 49-A | First-run hardware-aware + model download + CPU-only support | 3-4 jours |
| 49-B | Modele de capacites agent (schema, tests, affichage TUI) | 2-3 jours |
| 49-C | Restauration metriques provider (stats, queue, perf dans page Models) | 2-3 jours |

**Analyse detaillee** : `docs/phases/PHASE-49/analysis.md`

---

### Phase 50 : Adapt Integration TUI + Fitness Engine Production

**But** : `/adapt` dans le TUI, fitness multi-dimensionnel (formule PHILOSOPHY-V2), auto-adapt post-setup.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 50-A | Adapt dans le TUI (/adapt, [A] dans Models) | 2-3 jours |
| 50-B | Fitness multi-dimensionnel (P×S×W / costs^λ) + cascade evaluateurs | 2-3 jours |
| 50-C | Auto-adapt propose apres le first-run | 1-2 jours |

---

### Phase 51 : Agent Creator — Meta-agent de creation d'agents

**But** : `maestro create-agent --description "..."` — Maestro cree automatiquement le workflow complet.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 51-A | Agent Creator workflow (5 sous-blocks, iteration, fitness gate) | 3-5 jours |
| 51-B | Integration TUI (/create-agent) + CLI | 2-3 jours |
| 51-C | 3 templates pre-construits + documentation | 2 jours |

---

### Phase 52 : Catalogue communautaire + Auth

**But** : Publier et importer des blocks. Systeme d'auth et comptes.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 52-A | Auth + comptes utilisateurs (JWT, local d'abord) | 3-5 jours |
| 52-B | Catalogue backend (publish/search/import API) | 3-5 jours |
| 52-C | TUI integration (local + community, filtrage hardware) | 2-3 jours |

---

### Phase 53+ : Self-Improvement — Maestro s'ameliore lui-meme

**But** : Research Team workflow (observer → ameliorer → tester → publier). Workspace Orchestrator pour promotion automatique. L'Agent Creator s'ameliore lui-meme.

---

## Chaine de dependances

```
47 Integration Tests (DONE)
 └→ 48 Bug fixes + dynamic blockRef + local agent (A FAIRE)
     └→ 49 Hardware-aware setup + capabilities + metrics (A FAIRE)
         └→ 50 Adapt TUI + fitness engine production
             └→ 51 Agent Creator
                 └→ 52 Catalogue communautaire + Auth
                     └→ 53+ Self-improvement loop
```

## Features planifiees (TODOS)

| Feature | Phase cible | Statut |
|---------|-------------|--------|
| Bug fixes dogfooding + dynamic blockRef | 48 | A faire |
| Hardware-aware first-run + model download | 49-A | A faire |
| Agent capabilities model + tests | 49-B | A faire |
| Provider metrics restoration (page Models) | 49-C | A faire |
| CPU-only support avec avertissement | 49-A | A faire |
| Adapt dans le TUI (/adapt) | 50 | Planifie |
| Fitness engine multi-dimensionnel | 50 | Planifie |
| Agent Creator | 51 | Planifie |
| Catalogue communautaire | 52 | Planifie |
| Auth + comptes | 52 | Planifie |
| Self-improvement | 53+ | Vision |

## Principes

1. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree
2. **L'agent doit etre UTILE** — Pas juste fonctionnel. Utile au quotidien.
3. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
4. **Pas de refactoring cosmetique** — Seuls les bugs et features bloquees justifient du refactoring
5. **Dogfooding profond** — 2h continu, taches d'orchestration, comparaison vs CLI manuel (voir Section 8 de dogfooding-methodology.md)
6. **Max 3 jours par phase** — Decouper si necessaire
7. **Definition of Done AVANT de coder** — Chaque phase a un "NOT in scope" explicite
