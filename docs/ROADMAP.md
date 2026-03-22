# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-22
**Version actuelle** : v0.1.0-alpha (tag sur main)

---

## Vision strategique (mise a jour 2026-03-22)

> **Option C : Orchestrer maintenant, specialiser plus tard.**
>
> **Court terme** : Maestro orchestre Claude Code (et autres providers) — fournissant ce que
> Claude Code ne peut pas faire seul : permissions granulaires, isolation par session,
> gestion multi-projet, fitness tracking, catalogue, integration GitHub.
>
> **Moyen terme** : Block-forge cree des agents specialises qui remplacent progressivement
> les appels Opus par des Haiku/Sonnet/local sur des taches contraintes.
> Metrique de succes : meme fitness, cout reduit.
>
> **Reference** : Le projet Money (`C:\Money`) a un pipeline autonome complet
> (Docker + Claude Code + GitHub App + 5 agents + hooks + dashboard).
> Maestro doit faire la meme chose, mais mieux — puis se remplacer lui-meme.
>
> **Self-hosting progressif** : On monte un setup Money-like pour developper Maestro.
> Chaque phase V1 integre dans Maestro une piece de ce setup externe.
> Quand la V1 est livree, Maestro se gere lui-meme.

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

### Phase 64 — Detail

Les sous-phases d'infrastructure sont terminees :
- 64-A : `_toolMapping` + 4 capture blocks + 20 tests
- 64-B : Provider conflict detection + priority API + 11 tests
- 64-C : agent-creator 9/9, performance 1.0
- 64-D0 : capture-generic + summary-validator + 9 tests
- 64-E : maestro-assistant 24/24, performance 1.0

Bugs infra fixes (2026-03-20) :
- InferenceBlockExecutor : systemPrompt + messages
- WriteContractBlockExecutor / WriteTestSuiteBlockExecutor / WriteBlockBlockExecutor : markdown fences
- WorkflowBlockExecutor : output filtering
- SetVariableNodeHandler : JSON auto-parse destructif
- ContractTestRunner : SerializeOutputValue pour List/JObject
- MaestroClient : timeout 30s → 600s

Le block-forge pipeline (64-F/G/T : contract-definer, test-designer, block-creator) est reporte en V2.
Le contract-definer workflow fonctionne (12/12, performance 1.0) comme preuve de concept.

---

## V1 — Maestro comme plateforme d'orchestration

> Chaque phase integre dans Maestro une piece du setup externe (Claude Code pipeline).
> Quand la V1 est livree, Maestro se gere lui-meme.

---

### Phase 65 : Pipeline Claude Code pour dev Maestro

**But** : Monter un setup autonome (base sur Money) pour developper Maestro lui-meme.
Ce pipeline est utilise pour construire les phases suivantes.

**Reference** : `C:\Money\docs\AUTONOMOUS-ARCHITECTURE.md`

| Composant | Description |
|-----------|-------------|
| 2 containers | maestro-main (backend, services) + maestro-dev (Claude Code agents) |
| Agents | /health, /improve, /dev-cycle (/think + /build + /review) |
| GitHub App | Auth bot, commits, PRs, branch protection (feat/* → dev → main) |
| Hooks | PreToolUse (safety), PostToolUse (auto-test) |
| Task coordination | Locks, verdicts (JSON files), backlog management |
| MCP server | maestro-tools (build, test, session create, block list, contract test) |
| Dashboard | Streamlit ou TUI Maestro existant |

**Prerequis** : Setup Money finalise (on adapte sa structure).

**Gate** : Pipeline autonome qui peut creer une branche, implementer une feature, tester, ouvrir un PR, merger.

---

### Phase 66 : GitHub Integration dans Maestro

**But** : Integrer dans le backend Maestro ce que `gh_app_auth.py` et `deployer.py` font en externe.

| Sous-phase | Objectif |
|------------|----------|
| 66-A | API : connecter un repo (git remote, GitHub App auth) |
| 66-B | API : creer PR, push, merge, branch management |
| 66-C | Webhook receiver (push → trigger workflow Maestro) |
| 66-D | CLI : `maestro project connect <repo>` |

**Remplace** : `scripts/gh_app_auth.py`, integration GitHub manuelle

**Gate** : Maestro peut creer un PR sur un repo connecte via son API.

---

### Phase 67 : Agent Runtime + Mapper

**But** : Maestro lance et gere des agents (aujourd'hui Claude Code, demain natif).

| Sous-phase | Objectif |
|------------|----------|
| 67-A | Interface `IAgentRuntime` + `ClaudeCodeRuntime` |
| 67-B | Session Maestro → processus Claude Code (isolation, permissions) |
| 67-C | Lifecycle : start, stop, restart, status, logs |
| 67-D | CLI : `maestro agent start/stop/status` |

**Remplace** : `process_manager.py`, docker manage scripts

**Gate** : Maestro peut lancer un agent Claude Code, l'isoler dans une session, et recuperer ses resultats.

**Le mapper** :
```
interface IAgentRuntime
    ExecuteAsync(config, session) → result

ClaudeCodeRuntime   ← court terme (lance claude --dangerously-skip-permissions)
MaestroNativeRuntime ← moyen terme (execute via blocks/workflows)
```

---

### Phase 68 : Agent Dashboard dans Maestro

**But** : Le TUI/frontend Maestro remplace le dashboard externe (Streamlit dans Money).

| Sous-phase | Objectif |
|------------|----------|
| 68-A | Monitoring agents : status, logs, verdicts en temps reel |
| 68-B | Controle : start/stop/restart agents depuis le TUI |
| 68-C | Historique : journal d'ameliorations, deploy state |

**Remplace** : Streamlit dashboard

**Gate** : L'utilisateur peut surveiller et controler ses agents depuis maestro-code.

---

### Phase 69 : Onboarding + Packaging npm

**But** : `npm install -g @maestro/cli && maestro init && maestro code` qui marche.

| Sous-phase | Objectif |
|------------|----------|
| 69-A | Packaging npm, commande globale, sidecar auto-start |
| 69-B | `maestro init` + onboarding (provider, repo, premier agent) |
| 69-C | Documentation : README, Getting Started |
| 69-D | `maestro project add ./my-app` — setup complet via Maestro |

**Gate** : Un utilisateur installe, connecte son repo, lance un agent, et voit les resultats.

---

### Phase 70 : V1 Deploy + Beta testing

**But** : Deployer, recruter 3-5 beta testeurs, iterer.

**Gate** : 3 testeurs externes installent et accomplissent des taches reelles.

---

## V2 — Specialisation et optimisation

> Maestro remplace progressivement les gros modeles par des agents specialises.
> Metrique de succes : meme fitness, cout reduit.

---

### Phase 71 : Block-forge pipeline

Le pipeline de creation d'agents specialises (ex-Phase 64 F/G/T) :
- contract-definer → test-designer → block-creator
- Workflows multi-nodes, pas des LLM generalistes
- Contract-definer deja valide (12/12)

---

### Phase 72 : /adapt + contractRef

`/adapt` utilise block-forge pour creer des variantes optimisees pour un modele/hardware.

---

### Phase 73 : Production variantes

~30 implementations du contract `maestro-assistant` avec capabilities verifiees.

---

### Phase 74 : Catalog par contract + choix au setup

L'utilisateur voit les implementations compatibles avec son hardware.

---

### Phase 75 : Self-improvement loop

Maestro s'ameliore lui-meme — observe, diagnostique, propose, implemente.

---

### Phase 76 : Catalogue communautaire

Publier et importer des blocks. Auth. Marketplace.

---

## Chaine de dependances

```
=== Phases completees ===
4-64 : Infrastructure, blocks, sessions, execution, TUI, contracts, isolation, agents infra

=== V1 : Orchestration ===
65 Pipeline Claude Code pour dev Maestro (quand Money est pret)
 └→ 66 GitHub Integration dans Maestro
     └→ 67 Agent Runtime + Mapper
         └→ 68 Agent Dashboard
             └→ 69 Onboarding + npm
                 └→ 70 V1 Deploy + Beta

=== V2 : Specialisation ===
71 Block-forge pipeline
 └→ 72 /adapt + contractRef
     └→ 73 Production variantes
         └→ 74 Catalog par contract
             └→ 75 Self-improvement loop
                 └→ 76 Catalogue communautaire
```

---

## Principes

1. **Option C** — Orchestrer Claude Code maintenant, specialiser avec blocks plus tard
2. **Self-hosting progressif** — Chaque phase V1 remplace une piece du setup externe
3. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree
4. **Pas de couplage fort** — Le mapper IAgentRuntime permet de switcher de provider
5. **Money est la reference** — `C:\Money\docs\AUTONOMOUS-ARCHITECTURE.md`
6. **Max 3 jours par phase** — Decouper si necessaire
7. **Infrastructure solide AVANT les modeles** — Fixer les bugs, verifier le provider, puis creer les agents
8. **Tout est un block** — Si c'est dans le moteur d'execution, c'est un block
9. **Contract > Features > Capabilities > Tests** — Le contract definit le role verifiable
