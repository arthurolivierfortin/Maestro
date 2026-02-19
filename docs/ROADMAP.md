# Maestro — Roadmap

**Derniere mise a jour** : 2026-02-19
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

---

## Phases actives et a venir

---

### Phase 33-C : Consolidation TUI Monorepo

**But** : Consolider les 3 implementations TUI paralleles (Maestro monitor, LLM-Provider monitor, CLI interactive) en un monorepo npm workspaces avec code partage reel. Supprimer le code mort shared/tui (~35 fichiers), unifier les hooks dupliques, corriger les bugs monitors, ajouter des tests.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 33-C-A | Audit et nettoyage shared/tui (supprimer code mort) | 1 jour |
| 33-C-B | npm workspaces + migration imports | 2-3 jours |
| 33-C-C | Unification hooks (une seule version par hook) | 2-3 jours |
| 33-C-D | Correction bugs monitors + tests monitors | 2-3 jours |

**Docs** : `docs/phases/PHASE-33C/README.md`

---

### Phase 34 : Optimisation multi-tiers

**But** : Creer des tiers substituant Claude par des modeles plus petits.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 34-A | Fitness par bloc individuel | 2-3 jours |
| 34-B | Tier 2 (Sonnet + Haiku) | 3-5 jours |
| 34-C | Manifeste + `maestro check` | 2-3 jours |
| 34-D | Tier 3+ si fitness suffisant | 5-10 jours |

**Docs** : `docs/phases/PHASE-34/README.md`

---

### Phase 35 : `maestro adapt` + `maestro optimize`

**But** : Automatiser l'adaptation aux modeles de l'utilisateur.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 35-A | `maestro adapt` (adaptation automatique) | 1-2 semaines |
| 35-B | `maestro optimize` (strategies pluggables) | 1-2 semaines |

**Docs** : `docs/phases/PHASE-35/README.md`

---

### Phase 36 : Premiere version distribuable

**But** : Maestro installable et utilisable par quelqu'un d'autre.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 36-A | Packaging et installation | 1 semaine |
| 36-B | Onboarding premier lancement | 3-5 jours |
| 36-C | Documentation utilisateur | 3-5 jours |
| 36-D | Beta testing (3-5 testeurs) | 2 semaines |

**Docs** : `docs/phases/PHASE-36/README.md`

---

### Phase 37+ : Futur

- 37 : Catalogue communautaire
- 38 : Auth et subscriptions
- 39 : Evaluateur cloud
- 40 : Agent Creator (meta-programmation)
- 41+ : Multi-domaine

**Docs** : `docs/phases/PHASE-37/README.md`

---

## Principes

1. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
2. **Usage reel avant features** — Tester sur Cantante avant d'ajouter des commandes
3. **Pas de phase "complete" sans test** — Un commit sur main ne suffit pas
4. **Committer directement sur main** — Pas de PRs pour un dev solo, tags pour les milestones
