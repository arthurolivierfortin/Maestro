# Phase 67 : Agent Runtime + Mapper backend

**But** : Le backend Maestro lance et gere des agents.
Le mapper SessionService switch de Docker vers API.

## Sous-phases

| Sous-phase | Objectif |
|------------|----------|
| 67-A | Interface `IAgentRuntime` + `ClaudeCodeRuntime` dans le backend C# |
| 67-B | Session Maestro → processus Claude Code (isolation, permissions) |
| 67-C | Lifecycle : start, stop, restart, status, logs via API |
| 67-D | CLI : `maestro agent start/stop/status` |

## Mapper switch

| Avant (V1) | Apres | Service |
|------------|-------|---------|
| `docker compose up/down` | `POST /api/agents/start` | SessionService |
| `docker inspect` | `GET /api/agents/{id}/status` | SessionService |
| `docker exec claude -p` | `POST /api/sessions/{id}/invoke` | AgentService |

## Gate

Maestro peut lancer un agent Claude Code, l'isoler dans une session, et recuperer ses resultats via API.
