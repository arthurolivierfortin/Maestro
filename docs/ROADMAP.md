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

### Phase 47+ : Futur

| Phase | Objectif |
|-------|----------|
| 47 | Catalogue communautaire (publier/importer blocks + docs + sandboxes) |
| 48 | Auth et subscriptions |
| 49 | Fitness Engine + Agent Evaluateur Autonome |
| 50 | Agent Creator (meta-programmation — utilise l'evaluateur de 49) |
| 51+ | Multi-domaine, self-improvement |

---

## Chaine de dependances

```
44 Dogfooding Cantante (DONE)
 └→ 45-PREP Stabilisation essentielle (A FAIRE — 1 semaine)
     └→ 45 Distribution (A FAIRE — 2 semaines)
         └→ 46 Cantante v1 (premiere app Maestro publique)
             └→ 47+ Catalogue, Auth, Fitness Engine...
```

## Features planifiees (TODOS)

| Feature | Phase cible | Statut |
|---------|-------------|--------|
| Securite + conversations persistantes + slash commands | 45-PREP | A faire |
| Agent quality (Claude Code parity) | 45-PREP | A faire |
| npm packaging + global install + sidecar auto-start | 45 | A faire |
| Onboarding premier lancement | 45 | A faire |
| Documentation utilisateur | 45 | A faire |
| Beta testing externe | 45 | A faire |
| Cantante v1 | 46 | Futur |
| Pages secondaires (Spaces, Foundry, Catalog, Models) | 46+ | Futur |
| Foundry CRUD dans TUI | 46+ | Futur |
| Fitness Engine + Agent Evaluateur | 49 | Futur |
| Agent Creator | 50 | Futur |

## Principes

1. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree
2. **L'agent doit etre UTILE** — Pas juste fonctionnel. Utile au quotidien.
3. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
4. **Pas de refactoring cosmetique** — Seuls les bugs et features bloquees justifient du refactoring
5. **Dogfooding profond** — 2h continu, taches d'orchestration, comparaison vs CLI manuel (voir Section 8 de dogfooding-methodology.md)
6. **Max 3 jours par phase** — Decouper si necessaire
7. **Definition of Done AVANT de coder** — Chaque phase a un "NOT in scope" explicite
