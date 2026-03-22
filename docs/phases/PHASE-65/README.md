# Phase 65 — Pipeline Claude Code pour dev Maestro

**But** : Monter un setup autonome (base sur Money) pour developper Maestro lui-meme.
Ce pipeline est utilise pour construire les phases suivantes (66-70).

**Reference** : `C:\Money\docs\AUTONOMOUS-ARCHITECTURE.md`

**Prerequis** : Setup Money finalise (DONE)

---

## Architecture cible

```
+-- maestro-main (backend + LLM provider) -------------------------+
| dotnet runtime + node                                             |
|                                                                    |
|  deployer.py (polls main branch every 5 min)                     |
|  +-- git fetch main                                               |
|  +-- dotnet build + dotnet test (gate)                            |
|  +-- restart backend if tests pass                                |
|  +-- rollback if tests fail                                       |
|                                                                    |
|  Maestro Backend (dotnet run, :5000)                              |
|  LLM-Provider (dotnet run, :5010)                                 |
+-------------------------------------------------------------------+

+-- maestro-dev (Claude Code agents) --------------------------------+
| node:22-alpine + dotnet-sdk + python3                              |
|                                                                     |
|  Claude Code (--dangerously-skip-permissions)                      |
|  +-- /startup   -> init GitHub auth, schedule crons                |
|  +-- /health    -> every 5 min, check backend + LLM health        |
|  +-- /improve   -> every 15 min, fix issues                       |
|  +-- /dev-cycle -> every 15 min, think + build + review            |
|                                                                     |
|  MCP: maestro-tools (curl backend API), process-manager            |
+---------------------------------------------------------------------+

Shared volumes:
  maestro-data:/app/data    (deploy state, task locks, improvement journal)
  maestro-logs:/app/logs    (deploy log, backend log)
  claude-config:/home/node/.claude  (Claude Code session state)
```

---

## Sous-phases

### 65-A : Infrastructure Docker (1-2 jours)

| Fichier | Base | Adaptation |
|---------|------|------------|
| `docker/Dockerfile.main` | Money Dockerfile.main | dotnet runtime au lieu de python |
| `docker/Dockerfile.dev` | Money Dockerfile.dev | + dotnet-sdk pour build/test |
| `docker/docker-compose.yml` | Money docker-compose | ports 5000/5010, volumes adaptes |
| `docker/entrypoint.main.sh` | Money entrypoint.main | dotnet build/run au lieu de python |
| `docker/entrypoint.dev.sh` | Money entrypoint.dev | sed C:/Meastro -> /app |
| `docker/scripts/*.sh` | Money docker/scripts/ | copie directe |

**Gate** : `docker compose up` lance les deux containers, backend accessible sur :5000

### 65-B : Deployer + GitHub App (1 jour)

| Fichier | Base | Adaptation |
|---------|------|------------|
| `scripts/deployer.py` | Money deployer.py | dotnet build/test au lieu de ruff/pytest |
| `scripts/gh_app_auth.py` | Money gh_app_auth.py | copie directe, changer APP_ID/INSTALLATION_ID |
| `scripts/task_coordinator.py` | Money task_coordinator.py | copie directe |

Setup GitHub :
1. Creer GitHub App pour Maestro (permissions: Contents, Issues, PRs, Metadata)
2. Installer sur le repo Maestro
3. Generer PEM, stocker dans `~/.github-apps/`
4. Creer branche `dev`, labels, branch protection sur `main`

**Gate** : Deployer poll main, teste, deploie. GitHub App peut creer des PRs.

### 65-C : Hooks de securite (0.5 jour)

| Fichier | Base | Adaptation |
|---------|------|------------|
| `scripts/hooks/validate_code_safety.py` | Money validate_code_safety.py | patterns C#/TypeScript |
| `scripts/hooks/post_edit_check.py` | Money post_edit_check.py | route vers dotnet test / npm test |
| `docker/settings.json` | Money docker/settings.json | chemins adaptes |

Fichiers proteges Maestro :
- `apps/backend/src/Maestro.Api/Program.cs` (DI)
- `apps/backend/src/Maestro.Domain/ValueObjects/BlockPermissionLevel.cs` (permissions)
- `scripts/hooks/validate_code_safety.py` (auto-protection)

**Gate** : Hook bloque les edits sur fichiers proteges, auto-test apres chaque edit

### 65-D : Agents et Skills (1-2 jours)

Agents (`.claude/agents/`) :

| Agent | Role | Outils |
|-------|------|--------|
| `dev-agent.md` | Developpe features Maestro (backend C#, CLI/TUI TypeScript) | Read, Write, Edit, Bash, Grep |
| `code-quality.md` | CI : dotnet build, dotnet test, npx tsc, vitest | Bash (read-only code) |
| `test-runner.md` | Execute les tests specifiques apres chaque changement | Bash |

Skills (`.claude/skills/`) :

| Skill | Cron | Role |
|-------|------|------|
| `/startup` | manuel | Init GitHub auth, lancer crons |
| `/health` | 5 min | Check :5000, :5010, deployer, disk |
| `/improve` | 15 min | Lock -> health -> fix top issue -> release |
| `/dev-cycle` | 15 min | /think -> /build -> /review (feature loop) |
| `/think` | via dev-cycle | Proposer features comme GitHub Issues |
| `/build` | via dev-cycle | Implementer sur feat/ branch, ouvrir PR vers dev |
| `/review` | via dev-cycle | Tester PR, merge ou demander corrections |

**Gate** : `/startup` lance les 3 crons. `/dev-cycle` cree un PR fonctionnel.

### 65-E : MCP Server maestro-tools (0.5 jour)

MCP server simple (Python ou Node) qui wrape les appels API Maestro :

| Tool | Description |
|------|-------------|
| `maestro_health()` | Check backend + LLM provider health |
| `maestro_build()` | dotnet build + retourne success/errors |
| `maestro_test(scope)` | dotnet test (full, unit, integration) |
| `maestro_contract_test(id, block)` | Run contract test via API |
| `maestro_block_list()` | List blocks via API |
| `maestro_session_list()` | List sessions via API |

**Gate** : Agent peut appeler `maestro_build()` et `maestro_test()` via MCP

### 65-T : Validation (0.5 jour)

1. `docker compose up -d` -> deux containers demarrent
2. Backend accessible :5000, LLM provider :5010
3. `docker attach maestro-dev` -> Claude Code interactif
4. `/startup` -> crons schedules
5. `/dev-cycle` -> cree une issue, branche, PR, merge
6. Deployer detecte le merge, teste, deploie

---

## Definition of Done

- [ ] Deux containers Docker fonctionnels (maestro-main, maestro-dev)
- [ ] Deployer poll main, teste (dotnet build + test), deploie ou rollback
- [ ] GitHub App configuree, PRs automatiques
- [ ] Hooks de securite (PreToolUse bloque fichiers proteges, PostToolUse auto-test)
- [ ] 3 agents + 7 skills adaptes pour Maestro
- [ ] MCP maestro-tools fonctionnel
- [ ] /dev-cycle produit un PR fonctionnel end-to-end

## NOT in scope

- Remplacer le deployer par du code Maestro natif (Phase 66)
- Agent Runtime dans Maestro (Phase 67)
- Dashboard dans le TUI (Phase 68)
- V2 (block-forge, /adapt, variants)
