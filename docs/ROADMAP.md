# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-04
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
| 46 | Unit Tests — 89 tests maestro-code | COMPLETE |
| 47 | Integration Tests — 31 tests, condition quote stripping fix | COMPLETE |
| 48 | Bug Fixes Dogfooding + dynamic blockRef + local agent | COMPLETE |
| 49 | Hardware-Aware Setup + Agent Capabilities + Provider Metrics (28 tests, E2E 4/5) | COMPLETE |
| 50 | Contracts + Second Assistant + Fondations Adapt (141 tests, E2E 5/5) | COMPLETE |

---

## Vision strategique (mise a jour 2026-03-04)

> **Deux concepts fondamentaux** :
>
> **Contract** = le role qu'un block remplit (ex: `maestro-assistant`, `agent-creator`, `code-reviewer`).
> Plusieurs blocks peuvent implementer le meme contract. L'utilisateur choisit lequel utiliser.
>
> **Capabilities** = ce que le block sait faire concretement (ex: `conversation`, `structured-output`,
> `tool-calling`). Les features d'un contract sont activees/desactivees selon les capabilities
> du block choisi. Un assistant sans `structured-output` ne peut pas generer de JSON config.
>
> `/adapt` est un workflow qui utilise Agent Creator pour creer des variantes qui implementent
> le meme contract, optimisees pour un modele/hardware donne. Nous l'utilisons nous-memes
> pour produire les ~30 variantes pre-testees livrees avec l'app.
>
> L'utilisateur au premier lancement voit les implementations disponibles pour son hardware,
> avec les features actives/inactives de chacune, et choisit.

### Sequence logique

```
1. Concept contract + capabilities feature-gating + nettoyage adapt
2. Deuxieme maestro-assistant (meme contract, capabilities differentes)
3. Agent Creator (meta-agent, genere blocks avec contract + capabilities)
4. /adapt = workflow Agent Creator (cree variantes meme contract)
5. Production ~30 variantes pre-testees avec /adapt
6. Choix assistant au setup (UI par contract, features actives/inactives)
7. Catalogue communautaire organise par contract
8. Premiere version deployable
9. Self-improvement loop
```

---

## Phases actives et a venir

---

### Phase 50 : Contracts + Second Assistant + Fondations Adapt — COMPLETE

**Resultats** : Contract field sur BlockDefinition, feature gating par capabilities, AssistantSelector au first-run, SDK fitness, adapt-optimize type-safe. 141 tests, E2E 5/5.

**Checkpoint** : `docs/phases/PHASE-50/checkpoint.md`

---

### Phase 51 : Agent Creator

**But** : Meta-agent qui cree des agents/workflows avec contract + capabilities verifiees. Brique fondamentale pour `/adapt`.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 51-A | Agent Creator workflow (analyse → generation → test capabilities → publish) | 3-5 jours |
| 51-B | Integration TUI (`/create-agent`) + CLI | 2-3 jours |
| 51-C | 3 contracts pre-definis + templates (code-reviewer, doc-writer, test-generator) | 2 jours |

---

### Phase 52 : /adapt = Workflow Agent Creator + Contract Resolution

**But** : `/adapt` utilise Agent Creator pour creer des variantes qui implementent le meme contract. `contractRef` dans les workflows pour resolution runtime.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 52-A | Workflow `/adapt` : meme contract, capabilities adaptees au modele cible | 2-3 jours |
| 52-B | `contractRef` dans les workflows (resolution runtime + verification capabilities) | 1-2 jours |
| 52-C | Integration TUI : `/adapt` dans AgentPanel, `[A]` dans CatalogScreen | 1 jour |

---

### Phase 53 : Production des variantes pre-testees

**But** : Utiliser `/adapt` pour creer ~30 implementations du contract `maestro-assistant` avec capabilities verifiees. Config providers cloud opensource.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 53-A | Configuration providers cloud opensource dans LLM-Provider .NET | 2-3 jours |
| 53-B | Execution de `/adapt` par profil hardware (capabilities verifiees par tier) | 3-5 jours |
| 53-C | Validation, tri, integration dans `content/system/blocks/` | 1-2 jours |

**Gate** : 15+ variantes fitness > 0.6, toutes contract `maestro-assistant`, capabilities verifiees, features actives/inactives correctes.

---

### Phase 54 : Choix assistant au setup + Catalog par contract

**But** : L'utilisateur voit les implementations du contract `maestro-assistant` compatibles avec son hardware, avec features actives/inactives, et choisit. Changement possible depuis le Catalog.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 54-A | Filtrage compatibilite + feature gating UI | 1 jour |
| 54-B | UI de choix au setup (par contract, features ✓/✗, recommended) | 1.5-2 jours |
| 54-C | Catalog organise par contract + changement d'implementation | 1 jour |
| 54-D | Dogfooding complet | 0.5 jour |

**Gate** : L'utilisateur comprend ce qu'il gagne/perd avec chaque choix et peut changer depuis le Catalog.

---

### Phase 55 : Catalogue communautaire + Auth

**But** : Publier et importer des blocks. Catalogue organise par contract — chercher "un code-reviewer" montre toutes les implementations avec capabilities et compatibilite hardware.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 55-A | Auth + comptes utilisateurs (JWT, SQLite) | 3-5 jours |
| 55-B | Catalogue backend (publish/search/import par contract + capabilities) | 3-5 jours |
| 55-C | TUI integration (local + community, par contract, filtrage hardware) | 2-3 jours |

---

### Phase 56 : Premiere version deployable

**But** : `npm install -g @maestro/cli && maestro init && maestro code`. L'utilisateur voit les implementations disponibles par contract, choisit, et commence a travailler.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 56-A | Packaging npm, commande globale, sidecar auto-start | 3-4 jours |
| 56-B | `maestro init` + onboarding (provider + choix assistant par contract) | 2-3 jours |
| 56-C | Documentation : README, Getting Started, 3 exemples | 2-3 jours |
| 56-D | Beta testing (3-5 testeurs) | 3-5 jours |

**Gate** : 3 testeurs externes installent, choisissent leur assistant par contract, et accomplissent des taches reelles.

---

### Phase 57+ : Self-Improvement — Maestro s'ameliore lui-meme

**But** : Research Team observe les metriques par contract/capability → `/adapt` cree des variantes ameliorees → Workspace Orchestrator gere la promotion. L'Agent Creator s'ameliore lui-meme.

---

## Chaine de dependances

```
49 Hardware-aware + capabilities + metrics (DONE)
 └→ 50 Contracts + second assistant + fondations adapt
     └→ 51 Agent Creator (genere blocks avec contract + capabilities)
         └→ 52 /adapt = workflow Agent Creator + contractRef
             └→ 53 Production ~30 variantes (capabilities verifiees)
                 └→ 54 Choix au setup par contract (features ✓/✗)
                     └→ 55 Catalogue communautaire (par contract)
                         └→ 56 Premiere version deployable
                             └→ 57+ Self-improvement loop
```

## Features planifiees (TODOS)

| Feature | Phase cible | Statut |
|---------|-------------|--------|
| Concept contract + feature gating par capabilities | 50-A | COMPLETE |
| Nettoyage adapt-optimize + SDK fitness | 50-B | COMPLETE |
| Second maestro-assistant (meme contract) | 50-C | COMPLETE |
| Agent Creator (genere contract + capabilities) | 51 | Planifie |
| /adapt + contractRef dans workflows | 52 | Planifie |
| Production ~30 variantes pre-testees | 53 | Planifie |
| Choix assistant au setup par contract | 54 | Planifie |
| Catalogue communautaire par contract | 55 | Planifie |
| Premiere version deployable (npm) | 56 | Planifie |
| Self-improvement loop | 57+ | Vision |

## Principes

1. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree
2. **L'agent doit etre UTILE** — Pas juste fonctionnel. Utile au quotidien.
3. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
4. **Pas de refactoring cosmetique** — Seuls les bugs et features bloquees justifient du refactoring
5. **Dogfooding profond** — 2h continu, taches d'orchestration, comparaison vs CLI manuel
6. **Max 3 jours par phase** — Decouper si necessaire
7. **Definition of Done AVANT de coder** — Chaque phase a un "NOT in scope" explicite
8. **Nous sommes nos premiers utilisateurs** — `/adapt` et Agent Creator servent d'abord a NOUS
9. **Contract + Capabilities** — Le contract definit le role, les capabilities determinent les features actives. Les blocks sont interchangeables au sein d'un meme contract.
