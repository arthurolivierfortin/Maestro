# Phase 66 : GitHub Integration dans le backend

**But** : Le backend Maestro gere GitHub nativement.
Le mapper switch de scripts Python vers API backend.

## Sous-phases

| Sous-phase | Objectif |
|------------|----------|
| 66-A | API : connecter un repo (GitHub App auth dans le backend C#) |
| 66-B | API : creer PR, push, merge, branch management |
| 66-C | Webhook receiver (push → trigger workflow Maestro) |
| 66-D | CLI : `maestro project connect <repo>` |

## Mapper switch

| Avant (V1) | Apres | Service |
|------------|-------|---------|
| `scripts/gh_app_auth.py` | `POST /api/github/auth` | GitHubService |
| `scripts/deployer.py` | `POST /api/deploy/trigger` | DeployService |
| `gh pr create` via bash | `POST /api/github/pr` | GitHubService |

## Gate

Maestro peut creer un PR sur un repo connecte via son API, sans scripts externes.
