# Agent Maestro v4 — Specification de Conception Complete

**Version** : 4.0.0
**Date** : 2026-02-19
**Auteur** : Claude Opus 4.6
**Phase** : 34-A (Design Spec)
**Statut** : Draft

---

## Vue d'ensemble

Ce document est le plan de conception complet de l'Agent Maestro v4, un agent de developpement fullstack autonome compose de specialistes coordonnes par un workflow orchestrateur. Il couvre chaque bloc, du workflow parent jusqu'au bloc atomique le plus petit, avec des system prompts reels et complets.

**Objectif** : Depasser considerablement Claude Code brut en termes de qualite, autonomie, et capacites — grace a la specialisation, la verification visuelle, l'interaction intelligente, et la memoire persistante.

---

## Structure du document

Chaque sous-phase a son propre dossier contenant un `spec.md` (specification) et un `plan.md` (plan d'execution pour un agent).

| # | Dossier | Section | Spec | Plan |
|---|---------|---------|------|------|
| 1 | [01-architecture-overview/](01-architecture-overview/) | Architecture | [spec.md](01-architecture-overview/spec.md) | — (design only) |
| 2 | [02-interaction-handler/](02-interaction-handler/) | Interaction Handler | [spec.md](02-interaction-handler/spec.md) | plan.md (a ecrire) |
| 3 | [03-specialists-comprendre/](03-specialists-comprendre/) | Phase COMPRENDRE | [spec.md](03-specialists-comprendre/spec.md) | [plan.md](03-specialists-comprendre/plan.md) |
| 4 | [04-specialists-planifier/](04-specialists-planifier/) | Phase PLANIFIER | [spec.md](04-specialists-planifier/spec.md) | plan.md (a ecrire) |
| 5 | [05-specialists-implementer/](05-specialists-implementer/) | Phase IMPLEMENTER | [spec.md](05-specialists-implementer/spec.md) | plan.md (a ecrire) |
| 6 | [06-specialists-verifier/](06-specialists-verifier/) | Phase VERIFIER | [spec.md](06-specialists-verifier/spec.md) | plan.md (a ecrire) |
| 7 | [07-specialists-reviewer/](07-specialists-reviewer/) | Phase REVIEWER | [spec.md](07-specialists-reviewer/spec.md) | plan.md (a ecrire) |
| 8 | [08-specialists-livrer/](08-specialists-livrer/) | Phase LIVRER | [spec.md](08-specialists-livrer/spec.md) | plan.md (a ecrire) |
| 9 | [09-tool-blocks/](09-tool-blocks/) | Tool Blocks | [spec.md](09-tool-blocks/spec.md) | plan.md (a ecrire) |
| 10 | [10-workflow-orchestrator/](10-workflow-orchestrator/) | Workflow | [spec.md](10-workflow-orchestrator/spec.md) | plan.md (a ecrire) |
| 11 | [11-fitness-criteria/](11-fitness-criteria/) | Fitness | [spec.md](11-fitness-criteria/spec.md) | — (mesure en 34-E) |
| 12 | [12-memory-strategy/](12-memory-strategy/) | Memoire | [spec.md](12-memory-strategy/spec.md) | — (couvert par 09-tool-blocks) |
| 13 | [13-technical-dependencies/](13-technical-dependencies/) | Infrastructure Backend | [spec.md](13-technical-dependencies/spec.md) | [plan.md](13-technical-dependencies/plan.md) |
| 14 | [14-test-plan/](14-test-plan/) | Tests | [spec.md](14-test-plan/spec.md) | — (execute en 34-E) |

**Plans existants** : 03 (COMPRENDRE) et 13 (Infrastructure Backend)
**Plans a ecrire** : 02, 04, 05, 06, 07, 08, 09, 10

---

## Inventaire des blocs v4

### Blocs specialistes (agents/inference) — 21 blocs

| # | ID | Type | Phase | Modele Tier 1 |
|---|----|------|-------|---------------|
| 1 | `project-analyzer` | agent | COMPRENDRE | Sonnet 4.6 |
| 2 | `task-architect` | agent | COMPRENDRE | Opus 4.6 |
| 3 | `research-agent` | agent | COMPRENDRE | Sonnet 4.6 |
| 4 | `task-planner` | agent | PLANIFIER | Sonnet 4.6 |
| 5 | `plan-validator` | inference | PLANIFIER | Sonnet 4.6 |
| 6 | `backend-developer` | agent | IMPLEMENTER | Sonnet 4.6 |
| 7 | `frontend-developer` | agent | IMPLEMENTER | Sonnet 4.6 |
| 8 | `styling-developer` | agent | IMPLEMENTER | Sonnet 4.6 |
| 9 | `step-validator` | inference | IMPLEMENTER | Haiku 4.5 |
| 10 | `compilation-checker` | agent | IMPLEMENTER | Haiku 4.5 |
| 11 | `test-writer` | agent | VERIFIER | Sonnet 4.6 |
| 12 | `test-runner` | agent | VERIFIER | Sonnet 4.6 |
| 13 | `e2e-tester` | agent | VERIFIER | Sonnet 4.6 |
| 14 | `ui-reviewer` | inference | VERIFIER | Opus 4.6 |
| 15 | `accessibility-checker` | inference | VERIFIER | Sonnet 4.6 |
| 16 | `code-reviewer` | inference | REVIEWER | Opus 4.6 |
| 17 | `security-reviewer` | inference | REVIEWER | Opus 4.6 |
| 18 | `architecture-reviewer` | inference | REVIEWER | Opus 4.6 |
| 19 | `git-committer` | agent | LIVRER | Sonnet 4.6 |
| 20 | `changelog-writer` | inference | LIVRER | Sonnet 4.6 |
| 21 | `summary-reporter` | inference | LIVRER | Sonnet 4.6 |

### Blocs composites — 2 blocs

| # | ID | Type | Description |
|---|----|------|-------------|
| 1 | `maestro-agent-v4` | workflow | Orchestrateur principal avec toutes les phases |
| 2 | `interaction-handler` | agent (composite) | Agent parallele pour l'interaction humain-agent |

### Blocs tool — 8 blocs

| # | ID | Description |
|---|----|-------------|
| 1 | `playwright-screenshot` | Capture un screenshot d'une URL |
| 2 | `playwright-accessibility` | Lit l'arbre d'accessibilite d'une page |
| 3 | `playwright-interact` | Interagit avec le DOM (clic, type, navigate) |
| 4 | `web-search` | Recherche web via Playwright |
| 5 | `compilation-check` | Build le projet, reporte les erreurs |
| 6 | `memory-read` | Lit un fichier depuis .maestro/memory/ |
| 7 | `memory-write` | Ecrit un fichier dans .maestro/memory/ |
| 8 | `state-manager` | Gestion de l'etat partage (get/set/pause/resume/rewind) |

**Total : 31 blocs** (21 specialistes + 2 composites + 8 tools)

---

## Mapping plan → sous-phase 34-B/C/D

Les plans dans 34-A definissent le QUOI (specification + plan d'execution). L'implementation se fait dans les sous-phases suivantes :

| Plan 34-A | Implementation | Dependances |
|-----------|----------------|-------------|
| 13 (Infrastructure Backend) | **34-B** | Aucune |
| 09 (Tool Blocks) | **34-B** | Aucune |
| 03 (COMPRENDRE) | **34-C** | 34-B (tool blocks) |
| 04 (PLANIFIER) | **34-C** | Aucune |
| 05 (IMPLEMENTER) | **34-C** | 34-B (compilation-check) |
| 06 (VERIFIER) | **34-C** | 34-B (Playwright tools) |
| 07 (REVIEWER) | **34-C** | Aucune |
| 08 (LIVRER) | **34-C** | Aucune |
| 10 (Workflow) | **34-C** | 34-B (parallel, branches) |
| 02 (Interaction Handler) | **34-D** | 34-B (state-manager, parallel) |

---

## References croisees

| Document de reference | Utilise dans |
|-----------------------|-------------|
| `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` | 11-fitness-criteria |
| `docs/phases/PHASE-28/PLAN-PHASE-28A.md` | 02-interaction-handler |
| `docs/phases/PHASE-28/PLAN-PHASE-28B.md` | 02-interaction-handler |
| `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md` | 10-workflow-orchestrator |
| `content/system/blocks/agents/*` | 03-08 (conventions de prompts) |
| `content/system/blocks/workflows/autonomous-development/` | 10-workflow-orchestrator |
| `CLAUDE.md` | Toutes les sections (regles architecturales) |
