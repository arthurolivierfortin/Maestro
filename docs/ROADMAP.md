# Maestro — Roadmap

**Derniere mise a jour** : 2026-05-22 (pivot post-Hermes analysis + Chemin C frontend)
**Version actuelle** : v0.1.0-alpha (tag sur main)

---

## Vision strategique (2026-05-22)

> **Maestro = orchestrateur d'agents verifies avec fitness mesurable.**
>
> Le marche 2026 est noye d'outils agent : Claude Code, Hermes (Nous Research, 110k stars), OpenClaw, Cursor, Cline, Aider, etc.
> Maestro n'est pas un Nieme concurrent. Maestro est la **couche de production** au-dessus :
>
> - **Hermes / Claude Code** = exploration, agent generates own skills
> - **Maestro** = production, blocks contractes + fitness mesurable + container isolation
>
> ### Trois angles uniques (a defendre)
>
> 1. **Contracts + Fitness** — chaque block a un contrat verifiable et une fitness mesuree. Pas de "skill genere par l'agent en background, qualite variable".
> 2. **Container isolation a la racine** — chaque session est un container. Permissions fail-closed, parent ∩ child, audit trail. Pas de YOLO.
> 3. **Plugin-first architecture** — memoire (Brain), MCP, providers LLM, gateways, voice : tout est plug-and-play. Pas un monolithe avec adapters.
>
> ### Ce qu'on prend de Hermes (vitamines necessaires)
>
> - **Plugin memoire pluggable** (`IMemoryProvider`) — Brain devient le premier provider, comme Honcho l'est chez Hermes.
> - **MCP support natif** (`McpBlockExecutor`) — wrapper un MCP server en block. Coherent avec "tout est un block".
> - **Multi-surface plus tard** (Telegram/Discord/Slack — V3) — une session Maestro adressable depuis n'importe ou.
> - **Voice mode plus tard** (V2-V3) — faster-whisper local + streaming TTS.
> - **SKILL.md import plus tard** (V2) — compat avec agentskills.io et les 672 skills du Hub Hermes (apres validation que ca ne dilue pas le positioning).
>
> ### Strategie frontend : Chemin C (hybride)
>
> Un seul renderer ne peut pas tout faire. Strategie hybride :
>
> ```
> packages/maestro-code/        Ink TUI (terminal, SSH, ops, hackers)
>   └─ existe, maintenu en mode "ne pas casser"
>
> apps/code/                    React + Vite + Electron (desktop, voice, polish) — NOUVEAU
>   └─ V1 cree from scratch, theme TUI (JetBrains Mono, ASCII borders, CRT optionnel)
>   └─ inspire par mock/claude-design/MaestroCodePure.html
>
> packages/code-core/           Logique partagee (services, hooks, state) — V2
>   └─ extrait apres V1 livree, evite refactor premature
> ```
>
> En V1 : duplication temporaire entre maestro-code et apps/code. C'est explicitement permis par la V1 Discipline (ne pas refactor avant que les patterns soient clairs).
>
> ### Soft split SDK / Code app (decision 2026-05-22)
>
> - `[sdk]` = `apps/backend/`, `llm-provider/`, `content/system/blocks/` generiques, contracts canoniques
> - `[code-app]` = `packages/maestro-code/`, `apps/code/`, `packages/maestro-cli/` user ops, app-specific blocks
> - Direction de dependance : code-app peut importer SDK, JAMAIS l'inverse
> - Hard split en packages npm/NuGet planifie Phase 76 (V2)

### Concepts fondamentaux (inchanges)

> **Contract** = un role verifiable qu'un block peut remplir.
> **Feature** = un groupement fonctionnel visible par l'utilisateur.
> **Capability** = une competence atomique d'un block.
> **Hierarchie** : Contract > Features > Capabilities > Tests
> Voir `docs/system/architecture/contracts.md`.

### Workflow de developpement : `/cycle` (mandatory autonomous dev)

Voir `docs/system/CYCLE.md`. `/cycle-start` (brainstorm + spec + checklist machine-readable + issue GitHub) → `/cycle` (researcher → builder → judge 2-stage → tui-verifier si UI). Inspire de Marcel/TODO, adapte avec 6 layers TESTING-PROTOCOL et Cardinal Rule litmus test.

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

## V1 — Production-grade orchestrator (Hermes-better)

> **V1 livre** : un orchestrateur d'agents avec memoire pluggable, MCP natif, frontend desktop polish.
> **Cible** : utilisateurs qui veulent les capacites Hermes/Claude Code MAIS avec contracts + fitness + container isolation.
> **NON cible V1** : multi-surface (gateways messageries) — V3. Voice mode — V2-V3. Self-improvement loop — V3.

---

### Phase 65 : Cleanup Streamlit + Hermes vitamins (IN PROGRESS)

**But** : Nettoyer la dette Streamlit, ajouter les deux vitamines Hermes critiques (memoire pluggable + MCP natif).

**Reference** : analyse Hermes 2026-05-22 (positionnement Maestro vs Hermes).

| Sous-phase | Objectif | Statut |
|------------|----------|--------|
| 65-A | Infrastructure Docker (2 containers, entrypoints, helper scripts) | DONE |
| 65-B | Deployer + GitHub App auth | DONE |
| 65-C | Hooks securite (PreToolUse, PostToolUse) | DONE |
| 65-D | Agents (.md) + Skills (7 slash commands) | DONE |
| 65-E | MCP server maestro-tools (7 tools) | DONE |
| 65-F | **Cleanup Streamlit + deprecation** | A FAIRE |
| 65-G | **`IMemoryProvider` interface + Brain provider** | A FAIRE |
| 65-H | **`McpBlockExecutor` + MCP server discovery** | A FAIRE |

**65-F : Cleanup Streamlit**

Le dashboard Streamlit etait un placeholder transitoire. Le nouveau frontend = `apps/code/` (Phase 66). On retire :
- `dashboard/` (641 lignes monolithe, 5 tabs)
- `docker/Dockerfile.dev` / `docker/Dockerfile.main` si specifiques Streamlit
- Scripts Python qui ne sont utilises QUE par Streamlit (les autres restent pour `/cycle` autonomous loop)
- References dans `README.md`, `CLAUDE.md`

GARDER : `scripts/deployer.py`, `scripts/gh_app_auth.py`, `scripts/task_coordinator.py`, `scripts/maestro_mcp_tools.py`, `scripts/hooks/*.py` (utilises par `/cycle`).

**65-G : `IMemoryProvider` interface + Brain provider**

Interface formelle dans le backend C# :

```csharp
public interface IMemoryProvider
{
    Task WriteAsync(MemoryWrite turn);
    Task<MemoryRecall[]> RecallAsync(string query, int topK);
    Task<string> ContextInjectionAsync(SessionContext ctx);    // hook: pre-system-prompt
    Task PrefetchAsync(SessionContext ctx);                     // hook: avant turn
    Task SyncAsync(MemoryTurn turn);                            // hook: apres turn
    Task ExtractAsync(SessionSummary summary);                  // hook: fin session
}
```

`BrainMemoryProvider` = premier impl, appelle Brain `:8621/store|search|hook/*` HTTP API. Future providers : Mem0Provider, SupermemoryProvider, etc.

DI registration dans `Program.cs`. Configuration par session via `_memoryProvider` variable.

**65-H : `McpBlockExecutor` + MCP discovery**

MCP server = block. Wrapper `IMcpClient` derriere un `McpBlockExecutor`. Le `*.block.json` declare le MCP server + ses tools :

```json
{
  "type": "mcp-server",
  "config": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
    "transport": "stdio",
    "exposedTools": ["read_file", "write_file", "list_directory"]
  }
}
```

A l'execution, `ToolDispatcherBlockExecutor` route les calls vers le MCP server via le block. Permissions normales (`_permissions_allowedBlocks`) appliquees. Coherent avec "tout est un block".

**Gate Phase 65** :
- `dashboard/` supprime ou archive
- ROADMAP coherent avec la realite (cette mise a jour)
- `IMemoryProvider` interface + 1 provider (Brain) avec tests d'integration
- `McpBlockExecutor` + 1 MCP server wrapped en block + tests

---

### Phase 66 : Scaffold apps/code (NOUVEAU)

**But** : Nouvelle app desktop React + Vite + Electron avec aesthetic TUI. C'est ICI qu'on quitte Ink comme renderer principal.

**Reference visuelle** : `mock/claude-design/MaestroCodePure.html` + `pure-app.jsx` + `pure-theme.css`.

| Sous-phase | Objectif |
|------------|----------|
| 66-A | `apps/code/` scaffold : Vite + React 19 + Electron + TypeScript |
| 66-B | TUI theme system : JetBrains Mono, ASCII borders, amber/green/white phosphor, CRT optional |
| 66-C | Page Console (chat-first) + slash autocomplete + status bar |
| 66-D | Electron packaging : `npm run dev` + `npm run build` + `npm run package` |
| 66-E | Backend connection : reuse `apps/desktop/src/services/` mapper pattern (V1=mock, V2=real API) |

**Decision Chemin C** :
- `packages/maestro-code/` (Ink) **continue d'exister** — mode maintenance pour SSH/serveur use cases
- `apps/code/` devient le focus principal V1
- **Duplication temporaire assumee** entre les deux. Factor en `packages/code-core/` reporte a Phase 78 (V2).

**Gate Phase 66** :
- `apps/code` lance via `npm run dev` (desktop window) ou `cd apps/code && npm run build && electron-builder`
- Page Console fonctionnelle : input + chat output + slash autocomplete
- Theme TUI applique (mono, borders, accent color configurable)
- Backend C# reachable via fetch (`POST /api/sessions/invoke`)

---

### Phase 67 : Migration UX vers apps/code

**But** : Porter les pages restantes (Spaces, Catalog, Models, Monitor) de `packages/maestro-code` vers `apps/code`, avec amelioration (mouse, syntax highlight, etc.).

| Sous-phase | Objectif |
|------------|----------|
| 67-A | Page Spaces (workspaces tab + sessions tab + history heat-strip 30j) |
| 67-B | Page Catalog (blocks browser + contract widget central type MaestroCodePure) |
| 67-C | Page Models (providers + routing rules + tier selector) |
| 67-D | Page Monitor (token economy + fitness + savings vs Tier 1) |
| 67-E | InlineWidget system (pin/unpin widgets dans le chat scrollback) |
| 67-F | Help overlay 4 colonnes (GLOBAL/NAVIGATE/WIDGETS/SESSION) |
| 67-G | Command palette `⌘K` (groupes Navigate / Actions / Sessions) |

**Gate Phase 67** :
- 5 pages fonctionnelles dans `apps/code`
- Contract widget central (Inputs/Outputs + fitness + tests passants)
- Widgets pinnables inline (narrative Hermes-style "I pinned the workflow widget")
- Command palette + help overlay polish

---

### Phase 68 : GitHub Integration backend

**But** : Le backend Maestro gere GitHub nativement. Port des scripts Python vers API C#.

| Sous-phase | Objectif |
|------------|----------|
| 68-A | `IGitHubClient` interface + `OctokitGitHubClient` impl dans `Maestro.Infrastructure` |
| 68-B | API `POST /api/github/auth`, `POST /api/github/pr`, `POST /api/github/webhook` |
| 68-C | CLI `maestro project connect <repo>` |
| 68-D | Page Pipeline dans apps/code (backlog GitHub Issues → PRs → merge) |

**Mapper switch** : `gh_app_auth.py` + `deployer.py` → API C#. Les scripts Python restent pour `/cycle` autonomous dev (orthogonal).

---

### Phase 69 : Agent Runtime backend

**But** : Le backend Maestro lance et gere des agents via `IAgentRuntime`. Sessions Maestro = processus Claude Code isoles.

| Sous-phase | Objectif |
|------------|----------|
| 69-A | Interface `IAgentRuntime` + `ClaudeCodeRuntime` dans `Maestro.Application` |
| 69-B | Session Maestro → processus Claude Code (isolation, permissions via `_permissions_allowedBlocks`) |
| 69-C | Lifecycle : start, stop, restart, status, logs via API |
| 69-D | CLI `maestro agent start/stop/status` + Page Spaces wired |
| 69-E | Streaming output via SSE (`GET /api/sessions/{id}/stream`) |

---

### Phase 70 : Onboarding + Packaging

**But** : `npm install -g @maestro/cli && maestro init && maestro code` qui marche. `maestro code` lance Ink TUI ; `maestro desktop` (ou nouveau binary) lance apps/code.

| Sous-phase | Objectif |
|------------|----------|
| 70-A | Packaging npm de @maestro/cli, sidecar auto-start |
| 70-B | `maestro init` interactif (provider, repo, premier agent, memoire provider) |
| 70-C | Tier selector (Frontier/Balanced/Local) dans onboarding |
| 70-D | Spending guardrail (`$2/session, $25/jour` defaults) |
| 70-E | Distribution apps/code : `.dmg` (Mac), `.exe` (Win), `.AppImage` (Linux) |
| 70-F | Documentation : README, Getting Started, Migration guide pour utilisateurs Hermes/CC |

---

### Phase 71 : V1 Deploy + Beta testing

**But** : Recruter 3-5 beta testeurs externes, iterer.

**Gate V1** :
- 3 beta testeurs externes installent `@maestro/cli` + `apps/code`
- Chacun connecte 1 repo, lance 1 agent, accomplit 1 tache reelle
- Au moins 1 utilise le `IMemoryProvider` (Brain ou autre)
- Au moins 1 utilise un MCP server wrapped en block
- Feedback recolte, P0 bugs fixes en moins de 7 jours

---

## V2 — Specialization & Plugin Ecosystem

> Block-forge actif (cree des agents specialises). /adapt optimise par modele/hardware.
> Plugin ecosystem : SKILL.md import, voice mode, code-core factored.

---

### Phase 72 : Block-forge pipeline (reactive de Phase 64)

contract-definer → test-designer → block-creator. Workflows valides en Phase 64 (12/12 pour contract-definer), a finaliser ici.

### Phase 73 : /adapt + contractRef

Variantes optimisees par modele/hardware (Frontier/Balanced/Local).

### Phase 74 : Production variantes

~30 implementations avec capabilities verifiees.

### Phase 75 : Catalog par contract + choix au setup

L'utilisateur voit les implementations compatibles avec son hardware/budget.

### Phase 76 : SKILL.md import (agentskills.io compat)

Parser SKILL.md → `*.block.json` converti. Importer les 672 skills du Hub Hermes apres review. Decision a prendre : on importe verbatim ou on "contractualise" chaque skill avant integration (recommande).

### Phase 77 : Voice mode

`faster-whisper` local (STT) + streaming TTS sentence-by-sentence pendant la generation. Integre dans `apps/code` (Electron a acces mic via Web Audio API). Pas dans `maestro-code` Ink (terminal n'a pas d'audio).

### Phase 78 : code-core extraction (factor shared)

Extraire la logique partagee de `packages/maestro-code/` et `apps/code/` vers `packages/code-core/`. Maintenant que les patterns sont clairs (post-V1), c'est le moment de rembourser la dette de duplication.

---

## V3 — Multi-surface & Marketplace

> Hard split SDK / Code app. Multi-surface (Telegram, Discord, Slack — comme Hermes).
> Catalogue communautaire, marketplace, self-improvement loop.

---

### Phase 79 : Hard split SDK / Code app

Extraire `@maestro/sdk` (npm + NuGet) du repo principal. `@maestro/code` (cli + apps/code) devient consommateur N°1. Documentation publique de l'API SDK.

### Phase 80 : Multi-surface gateways

Une session Maestro adressable via Telegram, Discord, Slack, Email, Webhook. Inspire Hermes mais avec contracts + fitness pour chaque interaction. C'est le "Hermes-killer feature" si on l'execute bien.

### Phase 81 : Self-improvement loop

Maestro s'ameliore lui-meme. Block-forge + /adapt + dogfooding automatise.

### Phase 82 : Catalogue communautaire / Marketplace

Publier et importer des blocks. Auth. Fitness rating publique. Trust score. Reviews.

---

## Chaine de dependances

```
=== Phases completees ===
4-64 : Infrastructure, blocks, sessions, execution, TUI Ink, contracts, isolation, agents infra

=== V1 : Production-grade orchestrator ===
65 Cleanup Streamlit + Hermes vitamins (IMemoryProvider + MCP) [EN COURS]
 └→ 66 Scaffold apps/code (React + Vite + Electron + TUI theme)
     └→ 67 Migration UX vers apps/code (Spaces, Catalog, Models, Monitor)
         └→ 68 GitHub Integration backend
             └→ 69 Agent Runtime backend
                 └→ 70 Onboarding + Packaging
                     └→ 71 V1 Deploy + Beta

=== V2 : Specialization & Plugin ===
72 Block-forge pipeline (reactivation Phase 64)
 └→ 73 /adapt + contractRef
     └→ 74 Production variantes
         └→ 75 Catalog par contract
             └→ 76 SKILL.md import (agentskills.io)
                 └→ 77 Voice mode
                     └→ 78 code-core extraction (rembourse duplication V1)

=== V3 : Multi-surface & Marketplace ===
79 Hard split SDK / Code app
80 Multi-surface gateways (Telegram, Discord, Slack)
81 Self-improvement loop
82 Catalogue communautaire / Marketplace
```

---

## Principes

1. **Maestro = production-grade orchestrator** — Hermes = exploration, Maestro = vetted + fitness. Differentiation au coeur du positioning.
2. **Plugin-first** — memoire, MCP, providers, gateways : tout pluggable, rien hardcode.
3. **Chemin C frontend** — Ink (terminal) + React-web (desktop) coexistent. Duplication temporaire V1, factor V2 (Phase 78).
4. **Soft split SDK / Code app** — tags `[sdk]` vs `[code-app]` enforces, hard split V3 (Phase 79).
5. **Container = session** — permissions fail-closed, parent ∩ child, audit trail. Non-negociable.
6. **`/cycle` mandatory pour autonomous dev** — voir `docs/system/CYCLE.md`.
7. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree. Max 3 jours par phase. Max 20% refactor budget.
8. **Contract > Features > Capabilities > Tests** — Inchange.
9. **Tout est un block** — Inchange. MCP servers, memory providers, gateways = blocks.
10. **No Legacy Support** — quand un systeme est remplace, ancien code supprime. Pas de compat shims.
