# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-22
**Version actuelle** : v0.1.0-alpha (tag sur main)

---

## Vision strategique (mise a jour 2026-03-22)

> **Meme destination, chemin different.**
>
> Maestro centralise la gestion de projets autonomes (Money, Cantante, Maestro lui-meme).
> Chaque projet a des agents Claude Code dans des containers Docker.
> Maestro orchestre le tout : workspaces, sessions, blocks, contracts, fitness.
>
> **V1** : Dashboard Streamlit = centre de controle.
> Les agents sont des containers Claude Code persistants avec memoire.
> Le dashboard les surveille et les controle (start/stop/logs/attach).
> maestro-assistant = un shell Claude Code avec acces a tous les projets.
> Service layer avec mapper : chaque concept Maestro pointe vers son implementation Claude Code.
>
> **V2** : Maestro remplace Claude Code comme moteur d'agent.
> Le mapper switch : containers → vraies sessions Maestro, .md agents → vrais blocks.
> Page Agent = chat integre dans le dashboard (conversation geree par le backend).
> Block-forge cree des agents specialises (contrats, fitness, /adapt).
>
> **V3** : TUI Ink + interface web React.
> Meme backend, meme API, differents renderers.
> maestro-assistant fait la meme chose qu'en V1 mais nativement via blocks.
> C'est la meme destination que l'ancien roadmap pre-pivot, avec l'experience acquise en V1/V2.
>
> **Mapper architecture** : Service layer Python entre le dashboard et l'implementation.
> Switch V1→V2 = changer l'implementation des services, zero changement aux pages.
> ```
> WorkspaceService  V1: ~/.maestro/projects.json + docker-compose    V2: API /api/workspaces
> SessionService    V1: docker compose up/down/inspect               V2: API /api/sessions
> BlockService      V1: .claude/agents/*.md + .claude/skills/        V2: API /api/blocks
> AgentService      V1: docker exec/attach (Claude Code persistent)  V2: API /api/sessions/invoke
> ContractService   V1=V2: API /api/contracts (deja natif)
> ```

### Concepts fondamentaux (inchanges)

> **Contract** = un role verifiable qu'un block peut remplir.
> **Feature** = un groupement fonctionnel visible par l'utilisateur.
> **Capability** = une competence atomique d'un block.
> **Hierarchie** : Contract > Features > Capabilities > Tests
> Voir `docs/system/architecture/contracts.md`.

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
| 36 | Contexte, Memoire et Documentation | COMPLETE |
| 37 | Maestro Runtime & SDK (@maestro/client, @maestro/sidecar) | COMPLETE |
| 38 | Sandbox Foundry — git worktrees + Docker (22 tests) | COMPLETE |
| 39 | `maestro adapt` + `maestro optimize` (16 tests) | COMPLETE |
| 40-PRE | Maestro Code — L'App Unifiee | COMPLETE |
| 41-PRE | Spatial TUI | COMPLETE (remplace par Phase 42) |
| 42 | Restructuration maestro-code | COMPLETE |
| 43 | Visual Gate — PTY Capture + Golden Files | COMPLETE |
| 44 | Dogfooding Pragmatique — Cantante + Jarvis | COMPLETE |
| 46 | Unit Tests — 89 tests maestro-code | COMPLETE |
| 47 | Integration Tests — 31 tests | COMPLETE |
| 48 | Bug Fixes Dogfooding + dynamic blockRef + local agent | COMPLETE |
| 49 | Hardware-Aware Setup + Agent Capabilities + Provider Metrics (28 tests) | COMPLETE |
| 50 | Contracts + Second Assistant + Fondations Adapt (141 tests) | COMPLETE |
| 51 | Contract System — Schema, documentation, verification, bareme | COMPLETE |
| 52 | Agent test-designer + Contract Test Runner | COMPLETE |
| 53 | Agent et Workflow = Multi-Node Blocks (9 executors) | COMPLETE |
| 54 | Re-verification Phase 52 — FitnessScore, tests dans contract | COMPLETE |
| 53-B | Decomposition NodeExecutionEngine | COMPLETE |
| 53-C | INodeHandler extraction + DispatchNodeAsync | COMPLETE |
| 55 | Block Dependency Resolution | COMPLETE |
| 56 | Metrics Pipeline — Fitness Accuracy | COMPLETE |
| 57 | Agent agent-creator | COMPLETE |
| 58 | Workflow block-forge + /create-agent TUI/CLI | COMPLETE |
| 59-PRE | Gouvernance des Couts + Providers API | COMPLETE |
| 59-PRE-2 | Cost Enforcement (hard stop, graceful shutdown, auto-resume) | COMPLETE |
| 59 | Agent Isolation (sessions enfants, I/O controle, permissions) | COMPLETE |
| 60 | Model Playground | COMPLETE |
| 61 | Block-Forge Fiable (bugs, safety, validation contracts) | COMPLETE |
| 62 | Container Isolation (permissions, arbre, couts) — 82 tests | COMPLETE |
| 63 | TUI Chat-First (chat-first paradigm, FocusProvider, widgets) | COMPLETE |
| 64 | Agents Fonctionnels — infra (64-A a 64-E DONE, block-forge → V2) | COMPLETE (partiel) |

---

## V1 — Dashboard Streamlit + Claude Code containers

> **Le dashboard est un centre de controle, PAS une interface conversationnelle.**
> Les agents vivent dans des containers Docker et gerent leur propre conversation.
> Le dashboard les surveille et les controle.
> maestro-assistant = shell Claude Code avec acces multi-projet.

---

### Phase 65 : Pipeline Claude Code + Dashboard V1

**But** : Setup autonome (base sur Money) + dashboard Streamlit comme interface principale.

**Reference** : `C:\Money\docs\AUTONOMOUS-ARCHITECTURE.md`

| Sous-phase | Objectif | Statut |
|------------|----------|--------|
| 65-A | Infrastructure Docker (2 containers, entrypoints, helper scripts) | DONE |
| 65-B | Deployer + GitHub App auth | DONE |
| 65-C | Hooks securite (PreToolUse, PostToolUse) | DONE |
| 65-D | Agents (.md) + Skills (7 slash commands) | DONE |
| 65-E | MCP server maestro-tools (7 tools) | DONE |
| 65-F | Dashboard Streamlit enrichi — pages et service layer | A FAIRE |
| 65-G | maestro-assistant container (Claude Code multi-projet) | A FAIRE |
| 65-T | Validation Docker build + /dev-cycle E2E | A FAIRE |

**65-F : Dashboard enrichi**

Pages (memes que le TUI, adaptees pour Streamlit) :
- **Agent** : panneau de controle de maestro-assistant (status, logs, attach terminal). PAS de chat en V1.
- **Spaces** : workspaces (projets) + sessions (containers Docker). Start/stop/rebuild.
- **Catalog** : blocks = agents `.md` + skills de tous les projets connectes.
- **Models** : status des LLM providers.
- **Monitor** : agent monitoring (logs, verdicts, scheduled loops).
- **Pipeline** : feature backlog (GitHub Issues → PRs → merge).

Service layer (mapper V1→V2) :
```
dashboard/
  pages/
    agent.py, spaces.py, catalog.py, models.py, monitor.py, pipeline.py
  services/
    workspace_service.py    V1: ~/.maestro/projects.json + docker-compose
    session_service.py      V1: docker compose up/down/inspect
    block_service.py        V1: lit .claude/agents/*.md + .claude/skills/
    agent_service.py        V1: docker exec/attach
    contract_service.py     V1=V2: API /api/contracts (deja natif)
    health_service.py       V1: docker inspect + curl endpoints
  config.py                 Lit ~/.maestro/projects.json
```

**65-G : maestro-assistant**

Un container Claude Code persistant avec :
- Acces a tous les projets connectes (via volumes ou git clone)
- CLAUDE.md qui decrit Maestro et ses projets
- Skills : /create-agent, /add-feature, /explain, /status
- MCP tools pour interagir avec le backend Maestro

**Gate** :
- Dashboard Streamlit avec 6 pages fonctionnelles
- Service layer avec interfaces pour switch V2
- maestro-assistant repond aux questions et cree des agents
- /dev-cycle produit un PR end-to-end
- ~/.maestro/projects.json avec Money et Maestro enregistres

---

### Phase 66 : GitHub Integration dans le backend

**But** : Le backend Maestro gere GitHub nativement. Le mapper GitHubService switch de scripts Python → API backend.

| Sous-phase | Objectif |
|------------|----------|
| 66-A | API : connecter un repo (GitHub App auth dans le backend) |
| 66-B | API : creer PR, push, merge, branch management |
| 66-C | Webhook receiver (push → trigger workflow) |
| 66-D | CLI : `maestro project connect <repo>` |

**Mapper switch** : `gh_app_auth.py` + `deployer.py` → API endpoints dans le backend.

---

### Phase 67 : Agent Runtime + Mapper backend

**But** : Le backend Maestro lance et gere des agents. Le mapper SessionService switch de Docker → API.

| Sous-phase | Objectif |
|------------|----------|
| 67-A | Interface `IAgentRuntime` + `ClaudeCodeRuntime` dans le backend C# |
| 67-B | Session Maestro → processus Claude Code (isolation, permissions) |
| 67-C | Lifecycle : start, stop, restart, status, logs via API |
| 67-D | CLI : `maestro agent start/stop/status` |

**Mapper switch** : `docker compose` + `process_manager.py` → `POST /api/agents/start`

---

### Phase 68 : Chat integre (debut V2)

**But** : La page Agent passe de "panneau de controle" a "chat integre". La conversation est geree par le backend Maestro (ConversationManager), plus par Claude Code.

| Sous-phase | Objectif |
|------------|----------|
| 68-A | ConversationService : V2 implementation (API backend) |
| 68-B | Page Agent : chat Streamlit connecte a l'API conversation |
| 68-C | maestro-assistant : block agent natif (block.json + system-prompt.md) |

**Mapper switch** : `docker exec claude -p` → `POST /api/sessions/{id}/invoke` avec streaming.

---

### Phase 69 : Onboarding + Packaging npm

**But** : `npm install -g @maestro/cli && maestro init && maestro code` qui marche.

| Sous-phase | Objectif |
|------------|----------|
| 69-A | Packaging npm, commande globale, sidecar auto-start |
| 69-B | `maestro init` + onboarding (provider, repo, premier agent) |
| 69-C | `maestro project add ./my-app` — setup complet via Maestro |
| 69-D | Documentation : README, Getting Started |

---

### Phase 70 : V1 Deploy + Beta testing

**But** : Deployer, recruter 3-5 beta testeurs, iterer.

**Gate** : 3 testeurs externes installent et accomplissent des taches reelles.

---

## V2 — Maestro remplace Claude Code

> Le mapper switch progressivement : chaque service pointe vers le vrai backend Maestro.
> Block-forge cree des agents specialises. /adapt optimise pour differents modeles.

---

### Phase 71 : Block-forge pipeline

contract-definer → test-designer → block-creator (deja valide en Phase 64).

### Phase 72 : /adapt + contractRef

Variantes optimisees par modele/hardware.

### Phase 73 : Production variantes

~30 implementations avec capabilities verifiees.

### Phase 74 : Catalog par contract + choix au setup

L'utilisateur voit les implementations compatibles.

---

## V3 — Multi-interface

> TUI Ink + interface web React. Meme backend, meme API.
> C'est la meme destination que l'ancien roadmap pre-pivot.

---

### Phase 75 : TUI Ink revival

Reutilise le TUI existant (packages/maestro-code) avec le vrai backend V2.
Les composants Ink parlent a la meme API que le dashboard Streamlit.

### Phase 76 : Interface web React

React SPA connectee a l'API Maestro. Reutilise @maestro/client.

### Phase 77 : Self-improvement loop

Maestro s'ameliore lui-meme.

### Phase 78 : Catalogue communautaire

Publier et importer des blocks. Auth. Marketplace.

---

## Chaine de dependances

```
=== Phases completees ===
4-64 : Infrastructure, blocks, sessions, execution, TUI, contracts, isolation, agents infra

=== V1 : Dashboard + Claude Code containers ===
65 Pipeline CC + Dashboard Streamlit + maestro-assistant [EN COURS]
 └→ 66 GitHub Integration backend
     └→ 67 Agent Runtime + Mapper backend
         └→ 68 Chat integre (debut V2)
             └→ 69 Onboarding + npm
                 └→ 70 V1 Deploy + Beta

=== V2 : Maestro native ===
71 Block-forge pipeline
 └→ 72 /adapt + contractRef
     └→ 73 Production variantes
         └→ 74 Catalog par contract

=== V3 : Multi-interface ===
75 TUI Ink revival
76 Interface web React
77 Self-improvement loop
78 Catalogue communautaire
```

---

## Principes

1. **V1 = centre de controle** — Dashboard Streamlit surveille et controle des agents Claude Code
2. **V2 = Maestro natif** — Le mapper switch, le chat arrive dans le dashboard
3. **V3 = meme destination** — TUI + web, le meme resultat que l'ancien roadmap
4. **Mapper au niveau service** — Switch = changer l'implementation, pas les pages
5. **Container = agent** — Il a sa memoire, son contexte, sa conversation. On le controle, on ne le remplace pas (V1)
6. **Self-hosting progressif** — Maestro se developpe via son propre pipeline
7. **Money est la reference** — `C:\Money\docs\AUTONOMOUS-ARCHITECTURE.md`
8. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree
9. **Contract > Features > Capabilities > Tests** — Inchange
10. **Tout est un block** — Inchange (moteur d'execution)
