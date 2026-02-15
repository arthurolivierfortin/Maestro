# Roadmap V2 — État réel et plan de complétion

> Rédigé le 2026-02-14 après audit complet du codebase, de l'API, du CLI, du TUI et du frontend.
> Ce document remplace `PHASE-19/ROADMAP-V1-TO-V4.md` comme référence active.

---

## Vue d'ensemble

| Version | Objectif | Progression | Gate |
|---------|----------|-------------|------|
| **V1** | App fonctionnelle, sécurisée, téléchargeable | **~50%** | `GATE-V1.md` |
| **V2** | Frontend pro, monitors vivants, templates | **~15%** | `GATE-V2.md` |
| **V3** | Workflows out-of-the-box, valeur jour 1 | **0%** (prématuré, annulé) | `GATE-V3.md` |
| **V4** | Plateforme cloud | **0%** | Futur |

```
ÉTAT ACTUEL DES PHASES
═══════════════════════

V1 ──────────────────────────────────────────────────
  Phase 19 (LLM+Chat)       ████████░░  80%
  Phase 20 (Sécurité)       ██████░░░░  60%
  Phase 21 (Packaging)      ████░░░░░░  40%
  Phase 22 (Stabilisation)  ██░░░░░░░░  20%
  ─── GATE V1 ─── (docs/phases/PHASE-27/GATE-V1.md)

V2 ──────────────────────────────────────────────────
  Phase 23 (Templates)      █░░░░░░░░░  10%
  Phase 24 (Monitors)       ██░░░░░░░░  20%
  Phase 25 (Frontend)       █░░░░░░░░░  10%
  ─── GATE V2 ─── (docs/phases/PHASE-27/GATE-V2.md)

V3 ──────────────────────────────────────────────────
  Phase 26 (Workflows)      ░░░░░░░░░░  0% (reset)
  Phase 27 (Ajustements)    ░░░░░░░░░░  0%
  Phase 28 (Stabilisation)  ░░░░░░░░░░  0%
```

---

## Étape 0 — Cleanup immédiat

> **AVANT toute phase.** Plan : `PLAN-V1-CLEANUP.md`

| Tâche | Détail |
|-------|--------|
| Arrêter les 10 sessions zombies | Toutes en "running" depuis le 2026-02-06 |
| Supprimer les sessions de test | 7x "Generate Commit Tool Foundry", sessions de test Phase 11/12 |
| Nettoyer les refs fantômes workspace | cantante-dev a 2 sessionIds → 404 |
| Établir convention de naming | `{Projet} — {Feature}` ou `[TEST] {Description}` |
| Vérifier toutes les données | Workspaces, sessions, blocks — état cohérent |

---

## V1 — App fonctionnelle, sécurisée, téléchargeable

### Phase 19 — Intégration LLM + Chat (80% fait)

> Plan : `PLAN-V1-PHASE-19.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | ProviderController (backend proxy) | ✅ FAIT | `Controllers/ProviderController.cs` — health, models, switch, load |
| 2 | Page Models (frontend) | ✅ FAIT | `SystemInfoTab.tsx` — hardware info, modèles, badges |
| 3 | Chat/Playground (frontend) | ✅ FAIT | `ChatPage.tsx` — chat avec sélection modèle |
| 4 | `maestro chat` (CLI) | ✅ FAIT | CLI chat command — interactif, --model, --temperature |
| 5 | `maestro models` (CLI) | ✅ FAIT | CLI models command — list, local, registry, switch, load |
| 6 | Configuration Azure | ❌ TODO | Aucun support Azure OpenAI (ni backend ni frontend) |
| 7 | Config centralisée | ✅ FAIT | `~/.maestro/config.json` via `FirstRunInitializer` |
| 8 | Config modèle custom | ❌ TODO | `~/.maestro/models.json` — pas implémenté |

**Restant** : Azure config (backend endpoint + frontend UI), modèles custom.

### Phase 20 — Sécurité & Permissions (60% fait)

> Plan : `PLAN-V1-PHASE-20.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | API Key locale | ✅ FAIT | Auto-générée au premier lancement dans `FirstRunInitializer` |
| 2 | Auth middleware | ✅ FAIT | `ApiKeyAuthMiddleware.cs` — Bearer token, exempt paths, localhost bypass |
| 3 | CLI auth | ✅ FAIT | `config.ts` lit la clé, `api-client.js` envoie `Authorization: Bearer` |
| 4 | Permissions H/A | ❌ TODO | Pas de distinction humain vs agent (même clé = mêmes droits) |
| 5 | Localhost binding | ⚠️ PARTIEL | `AllowRemote: false` bypass auth en local, mais backend bind 0.0.0.0 |
| 6 | Agent session scope | ❌ TODO | Un agent peut accéder à toutes les sessions, pas seulement la sienne |
| 7 | Audit log | ✅ FAIT | `IAuditLogger` singleton, failed auth logged |

**Restant** : Permissions H/A (clés de session à scope limité), binding 127.0.0.1, agent session scope.

### Phase 21 — Packaging & Distribution (40% fait)

> Plan : `PLAN-V1-PHASE-21.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | Build Electron production | ⚠️ CONFIG EXISTE | `package.json` a build section (NSIS, portable), pas testé |
| 2 | Backend embarqué | ❌ TODO | Electron doit spawner le backend .NET, gérer son cycle de vie |
| 3 | LLM-Provider optionnel | ❌ TODO | L'app ne fonctionne pas sans (pas de mode Azure/cloud) |
| 4 | First-run init | ✅ FAIT | `FirstRunInitializer.cs` crée `~/.maestro/`, config, copie content |
| 5 | npm publish CLI | ❌ TODO | Pas de `@maestro-ai/cli` publié, CLI local uniquement |
| 6 | CLI auto-discover | ✅ FAIT | `config.ts` lit `~/.maestro/config.json`, fallback localhost:5000 |
| 7 | `maestro setup` | ✅ FAIT | Setup wizard dans CLI |
| 8 | `maestro init` | ✅ FAIT | Init repo avec `.maestro/` |
| 9 | Sanity checks | ❌ TODO | Pas de vérification au lancement (backend up, espace disque, etc.) |

**Restant** : Build Electron E2E testé, backend embarqué dans Electron, LLM optionnel (Azure), npm publish, sanity checks.

### Phase 22 — Stabilisation V1 (20% fait)

> Plan : `PLAN-V1-PHASE-22.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | Tests d'intégration E2E | ❌ TODO | Aucun scénario complet install → setup → workflow → results |
| 2 | Error handling humain | ❌ TODO | Messages techniques, pas user-friendly |
| 3 | Health dashboard | ✅ FAIT | `maestro health`, `HomeScreen` TUI, `/api/discovery/health` |
| 4 | `maestro logs` | ✅ FAIT | CLI logs command |
| 5 | Doc d'installation | ❌ TODO | Pas de guide Windows step-by-step |
| 6 | Getting Started | ❌ TODO | Pas de guide "5 minutes" |
| 7 | Bug fixes critiques | ❌ TODO | Session recovery au restart, cascade delete, workspace cleanup |

**Restant** : Session recovery, cascade delete, tests E2E, docs, error messages.

### GATE V1 — Critères de passage

Voir `GATE-V1.md` pour la liste complète. Résumé :

- [ ] L'app se télécharge et s'installe (.exe Windows)
- [ ] `maestro setup` détecte le hardware et guide l'utilisateur
- [ ] Chat fonctionne (CLI + frontend)
- [ ] Session créée depuis template, workflow exécuté, résultats visibles
- [ ] CLI disponible globalement (`npm install -g`)
- [ ] Auth différencie humain vs agent
- [ ] 0 sessions zombies après restart du backend
- [ ] Messages d'erreur lisibles par un humain
- [ ] Guide "Getting Started" existe et fonctionne

---

## V2 — Frontend pro, monitors vivants, templates

### Phase 23 — Template partagé & Infrastructure UI (10% fait)

> Plan : `PLAN-V2-PHASE-23.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | Shared layout system | ⚠️ PARTIEL | `shared/theme/` et `shared/tui/` existent, pas de layout engine partagé |
| 2 | Widget registry | ❌ TODO | Widgets hardcodés dans les composants TUI |
| 3 | Page registry | ❌ TODO | Pages hardcodées dans router (frontend) et App.ts (TUI) |
| 4 | Navigation framework | ⚠️ PARTIEL | TUI a Schema A navigation, frontend a React Router, pas unifié |
| 5 | Data binding | ⚠️ PARTIEL | TUI `$.variables.xxx` binding existe, frontend a hooks API |
| 6 | Shared component library | ⚠️ PARTIEL | `shared/tui/components/` existe (Panel, NavBar, StatusBar), frontend n'a pas |

### Phase 24 — Monitors "vivants" (20% fait)

> Plan : `PLAN-V2-PHASE-24.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | Monitor Maestro (TUI) refonte | ⚠️ PARTIEL | Fonctionne mais polling-based, pas de template dynamique |
| 2 | Monitor LLM-Provider (TUI) | ❌ TODO | Aucun monitor dédié LLM |
| 3 | CLI amélioré | ✅ FAIT | Couleurs, formatage, spinners |
| 4 | Temps réel (SignalR) | ❌ TODO | Tout est polling 2s |
| 5 | Status bar persistante | ❌ TODO | Pas d'info constante (health, LLM actif, VRAM) |

### Phase 25 — Refonte Frontend Web (10% fait)

> Plan : `PLAN-V2-PHASE-25.md`

| # | Tâche | État | Preuve / Détail |
|---|-------|------|-----------------|
| 1 | Design system | ❌ TODO | Pas de système de design cohérent |
| 2 | Dashboard redesign | ❌ TODO | HomePage basique |
| 3 | Session detail | ❌ TODO | Pas de page session unifiée |
| 4 | Models page refonte | ⚠️ PARTIEL | SystemInfoTab existe mais basique |
| 5 | Chat polish | ⚠️ PARTIEL | ChatPage existe mais basique |
| 6 | Block catalog | ⚠️ PARTIEL | FoundryPage existe |
| 7 | Settings page | ⚠️ PARTIEL | SettingsPage nouvelle, contenu inconnu |
| 8 | Responsive | ❌ TODO | Minimum 1280x720 non vérifié |
| 9 | Loading/Error/Empty states | ❌ TODO | Pas de spinners, skeletons, empty states |
| 10 | Animations | ❌ TODO | Pas de transitions |

### GATE V2 — Critères de passage

Voir `GATE-V2.md`. Résumé :

- [ ] Frontend professionnel (design system cohérent)
- [ ] Monitor Maestro avec pages dynamiques et widgets temps réel
- [ ] Monitor LLM-Provider fonctionnel
- [ ] SignalR temps réel (0 polling restant)
- [ ] Template partagé : ajouter une page = ajouter un fichier de config
- [ ] Tout est "vivant" — animations, loading states, transitions

---

## V3 — Valeur utilisateur (Reset)

> La Phase 26 précédente est annulée. V3 reprend de zéro après complétion de V2.
> Les blocks/agents créés en Phase 26 restent disponibles comme matière première.

### Phase 26 (nouveau) — Workflows out-of-the-box

| # | Workflow | Blocks existants | État |
|---|----------|-----------------|------|
| 1 | Code Review | git-diff, file-read, llm-generate | À faire |
| 2 | Generate README | directory-list, file-read, project-structure, llm-generate | À faire |
| 3 | Generate Tests | file-read, code-extractor, llm-generate, file-write | À faire |
| 4 | Refactor Suggestions | code-search, file-read, llm-generate | À faire |
| 5 | Documentation | project-structure, code-extractor, llm-generate, file-write | À faire |
| 6 | Commit Message v2 | git-diff, git-status, llm-generate | À faire |

**Prérequis** : GATE V2 complète.

### Phase 27 (nouveau) — Ajustements

Contenu identique au roadmap original (onboarding, quick actions, sample repos, etc.)

### Phase 28 (nouveau) — Stabilisation V3

Contenu identique au roadmap original (test chaque workflow, qualité outputs, docs, performance).

---

## V4 — Plateforme cloud

Identique au roadmap original (Phases 29-32). Aucun changement.

---

## Séquence d'exécution

```
[MAINTENANT]
  │
  ├─ CLEANUP ←── PLAN-V1-CLEANUP.md
  │
  ├─ V1 Phase 19 ←── PLAN-V1-PHASE-19.md (compléter Azure + modèles custom)
  │
  ├─ V1 Phase 20 ←── PLAN-V1-PHASE-20.md (permissions H/A, binding, scope)
  │
  ├─ V1 Phase 21 ←── PLAN-V1-PHASE-21.md (Electron build, npm publish)
  │
  ├─ V1 Phase 22 ←── PLAN-V1-PHASE-22.md (session recovery, E2E, docs)
  │
  ├─ ═══ GATE V1 ═══
  │
  ├─ V2 Phase 23 ←── PLAN-V2-PHASE-23.md (template system)
  │
  ├─ V2 Phase 24 ←── PLAN-V2-PHASE-24.md (monitors vivants)
  │
  ├─ V2 Phase 25 ←── PLAN-V2-PHASE-25.md (frontend refonte)
  │
  ├─ ═══ GATE V2 ═══
  │
  └─ V3 Phase 26+ (workflows, valeur utilisateur)
```

---

## Règles de travail (voir SUGGESTIONS.md)

1. **Gate obligatoire** — Pas de version N+1 sans gate N passée
2. **Vérification par l'interface** — Monitor/CLI/Frontend, pas curl
3. **Critères de done** — Chaque étape a une vérification explicite
4. **Cleanup systématique** — Zombies, fantômes, naming avant chaque phase
5. **Plan avant code** — Commandes CLI exactes et critères dans le plan
6. **Monitor cassé = blocage** — Priorité maximale sur les bugs visuels
