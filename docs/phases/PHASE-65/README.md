# Phase 65 — Pipeline Claude Code + Dashboard V1

**But** : Setup autonome (base sur Money) + dashboard Streamlit comme interface principale V1.

**Reference** : `C:\Money\docs\AUTONOMOUS-ARCHITECTURE.md`

---

## Sous-phases

### 65-A : Infrastructure Docker — DONE
- docker-compose.yml (2 services), 2 Dockerfiles, 2 entrypoints, 8 helper scripts

### 65-B : Deployer + GitHub App — DONE
- deployer.py, gh_app_auth.py, task_coordinator.py

### 65-C : Hooks securite — DONE
- validate_code_safety.py, post_edit_check.py, update_status.py

### 65-D : Agents + Skills — DONE
- 2 agents (dev-agent, code-quality), 7 skills

### 65-E : MCP server maestro-tools — DONE
- 7 tools (health, build, test, tsc, blocks, sessions, contract-test)

### 65-F : Dashboard Streamlit enrichi — A FAIRE

**Pages** (memes que le TUI, adaptees) :
| Page | Contenu | Equivalent TUI |
|------|---------|---------------|
| Agent | Panneau controle maestro-assistant (status, logs, attach). PAS de chat V1. | AgentScreen |
| Spaces | Workspaces (projets) + sessions (containers). Start/stop/rebuild. | SpacesScreen |
| Catalog | Blocks = agents .md + skills de tous les projets | CatalogScreen |
| Models | Status LLM providers | ModelsScreen |
| Monitor | Logs, verdicts, scheduled loops | Monitor widgets |
| Pipeline | Feature backlog GitHub Issues → PRs → merge | (nouveau) |

**Service layer** (mapper V1→V2) :
```
dashboard/services/
  workspace_service.py    V1: ~/.maestro/projects.json + docker-compose
  session_service.py      V1: docker compose up/down/inspect
  block_service.py        V1: lit .claude/agents/*.md + .claude/skills/
  agent_service.py        V1: docker exec/attach
  contract_service.py     V1=V2: API /api/contracts (deja natif)
  health_service.py       V1: docker inspect + curl endpoints
```

### 65-G : maestro-assistant container — A FAIRE

Un container Claude Code persistant avec :
- Acces multi-projet (Money, Maestro, Cantante via volumes/git)
- CLAUDE.md decrivant tous les projets
- Skills : /create-agent, /add-feature, /explain, /status
- MCP tools pour le backend Maestro

### 65-T : Validation — A FAIRE

1. Docker build + up (les deux containers)
2. Dashboard accessible :8503 avec 6 pages
3. Service layer avec interfaces documentees
4. maestro-assistant repond aux questions multi-projet
5. /dev-cycle produit un PR end-to-end
6. ~/.maestro/projects.json avec Money et Maestro

---

## Definition of Done

- [ ] Dashboard Streamlit 6 pages (Agent, Spaces, Catalog, Models, Monitor, Pipeline)
- [ ] Service layer avec interfaces pour switch V2
- [ ] ~/.maestro/projects.json registre de projets
- [ ] maestro-assistant container multi-projet
- [ ] Docker build + up fonctionnel
- [ ] /dev-cycle E2E (issue → branch → PR → merge)

## NOT in scope

- Chat integre dans la page Agent (V2 Phase 68)
- Switch du mapper vers le vrai backend (V2 Phases 66-68)
- TUI Ink (V3 Phase 75)
