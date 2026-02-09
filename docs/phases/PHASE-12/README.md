# Phase 12: Runtime, CLI Agent Interface & Universal Repository Binding

**Status**: Design
**Date**: February 9, 2026
**Dependencies**: Phase 10 (Unified Session System), Phase 11 (LLM Output Safety)

---

## Overview

Phase 12 formalise trois décisions architecturales fondamentales pour l'avenir de Maestro :

1. **Runtime Isolation** — Comment les sessions sont isolées les unes des autres
2. **CLI Agent Interface** — Comment les agents interagissent avec Maestro
3. **Universal Repository Binding** — Tout enfant de ContainerSession peut se binder à un repo

Ces décisions sont liées : le modèle d'isolation détermine ce que le CLI doit gérer, le CLI détermine comment les agents perçoivent le système, et le binding universel détermine où vivent les artefacts (docs, logs, données) de chaque session.

---

## Documents

### Décisions architecturales (ADR)

| Document | Description |
|----------|-------------|
| [ADR: Runtime & CLI](./ADR-RUNTIME-AND-CLI.md) | Isolation hybride + interface agent CLI JSON |
| [ADR: Universal Repository Binding](./ADR-UNIVERSAL-REPO-BINDING.md) | Binding repo généralisé à tous les types de sessions |

### Plans d'implémentation

| Document | Phase | Effort |
|----------|-------|--------|
| [Runtime Hardening](./IMPL-PLAN-RUNTIME-HARDENING.md) | 12.1 | 2-3 jours |
| [CLI JSON Mode](./IMPL-PLAN-CLI-JSON-MODE.md) | 12.2-12.3 | 3-4 jours |
| [Universal Repo Binding](./IMPL-PLAN-UNIVERSAL-REPO-BINDING.md) | 12.5-12.7 | 4-5 jours |

### Validation

| Document | Description |
|----------|-------------|
| [Integration Test Plan](./INTEGRATION-TEST-PLAN.md) | 40+ tests CLI end-to-end — critères de done |

---

## Résumé des décisions

### Runtime: Hybride Backend-first

- **`ProcessContainerRuntime`** comme mode par défaut (léger, rapide)
- **`DockerContainerRuntime`** réservé à l'exécution de code non-fiable
- Le backend reste l'autorité unique pour les permissions et le routage
- Pas de container Docker par session — trop lourd pour les sessions imbriquées

### CLI: Mode JSON pour les agents

- Le CLI reste l'interface unique (humains ET agents)
- Ajout d'un mode `--json` pour l'entrée structurée
- Sortie JSON structurée pour le parsing automatique
- Pas de MCP pour les agents internes (blocks) — préserve "everything is a block"
- MCP server planifié en phase future pour les agents externes (IDE : Claude Code, Copilot, etc.)

### Universal Repository Binding

- Tout enfant de `ContainerSession` (Workspace, ProjectSession, FoundrySession, futur...) peut se binder à un repo
- `RepositoryPath` monte au niveau `ContainerSession` (base), plus seulement sur `ProjectSession`
- Les docs, logs et artefacts vivent dans le repo bindé (structure `.maestro/` standardisée)
- Les docs sont locales au repo pour le moment ; un futur workflow de partage ira chercher la doc pertinente entre sessions

---

## Ordre d'implémentation global

```
Phase 12.1: Runtime Hardening
  ├── WP1: PathValidator (nouveau fichier)
  ├── WP2: Env var whitelist (ProcessContainerRuntime)
  ├── WP3: Working directory enforcement
  ├── WP4: Output size limiting
  └── WP5: Tests unitaires runtime

Phase 12.2-12.3: CLI JSON Mode
  ├── WP1: OutputFormatter (nouveau fichier)
  ├── WP2: JsonInputParser (nouveau fichier)
  ├── WP3: Intégration dans index.js (point d'entrée + migration commandes)
  ├── WP4: Commande --schema
  └── WP5: Tests CLI JSON mode

Phase 12.5-12.7: Universal Repository Binding
  ├── WP1: ContainerSession.RepositoryPath (domain)
  ├── WP2: Simplifier ProjectSession (retirer RepositoryPath propre)
  ├── WP3: Simplifier FoundrySession (repositoryPath paramètre direct)
  ├── WP4: Workspace bindable
  ├── WP5: Mise à jour persistance (3 repositories)
  ├── WP6: MaestroDirectoryInitializer (.maestro/ scaffolding)
  ├── WP7: CLI --repo-path générique
  ├── WP8: API backend DTO
  └── WP9: Tests unitaires binding

Validation finale:
  └── Integration Test Plan (40+ tests CLI end-to-end)
```

**Dépendances entre phases** : Les 3 phases sont largement indépendantes. 12.1 (Runtime) et 12.2 (CLI JSON) peuvent avancer en parallèle. 12.5 (Repo Binding) modifie le CLI, donc les WP7 de 12.5 doivent intégrer le OutputFormatter de 12.2 si celui-ci est déjà implémenté. Les tests d'intégration (validation finale) nécessitent que les 3 phases soient terminées.
