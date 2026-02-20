# Prompt d'execution — Phase 34 (34-B → 34-D → 34-E)

> **Copiez ce prompt dans une nouvelle session Claude Code pour executer le reste de la Phase 34.**

---

## Contexte

Tu travailles sur le projet **Maestro** (`C:\Meastro`). C'est un orchestrateur d'agents LLM specialises avec un backend C# .NET, un CLI TypeScript, et un TUI Ink.

### Ce qui est DEJA FAIT (ne pas refaire)

- **Phase 34-A** (COMPLETE) : 34 blocs v4 crees et publies (12 agents, 12 inference, 8 tools, 2 workflows). Verifiable avec :
  ```bash
  powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block info maestro-agent-v4"
  ```
- **Plan 13 Infrastructure** (COMPLETE) : `EntryPointExecutor.cs` supporte deja `sequence`, `parallel`, `branches` multi-way, `CheckPauseAsync`. Ces node types fonctionnent.
- **Session template** `project-v4.session.json` cree dans `content/system/templates/sessions/`
- **Tous les blocs d'interaction** existent : `classify-intent`, `decide-action`, `send-widget-response`, `interaction-handler` (workflow), `state-manager`
- **ADR Quality-First Degradation** ecrit : `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md`

### Ce qui RESTE A FAIRE (ton travail)

3 sous-phases, dans cet ordre strict :

| Ordre | Phase | Plan | Scope |
|-------|-------|------|-------|
| 1 | **34-B** | `docs/phases/PHASE-34/34-B/plan-checkpointing.md` | Ajouter le checkpointing dans `EntryPointExecutor.cs` (sauvegarde + reprise) |
| 2 | **34-D** | `docs/phases/PHASE-34/34-D/plan.md` | Integrer le widget protocol dans `packages/maestro-code/App.ts` (WidgetRenderer, sendMessage, widget polling, input always active) |
| 3 | **34-E** | `docs/phases/PHASE-34/34-E/plan.md` | Integration testing : 5 repos de test, QualityScore par bloc, comparaison vs Claude Code, manifeste Tier 1 |

---

## Instructions d'execution

### AVANT DE COMMENCER — Lecture obligatoire

Lis ces fichiers dans cet ordre exact :

1. `C:\Meastro\CLAUDE.md` — les regles architecturales du projet (charge automatiquement)
2. `C:\Meastro\docs\system\AGENT-PROTOCOL.md` — le protocole d'execution obligatoire (5 regles)
3. `C:\Meastro\docs\phases\PHASE-34\checkpoint.md` — l'etat actuel (si le fichier existe, respecter ce qui est marque DONE)

### Pour chaque sous-phase (34-B, puis 34-D, puis 34-E)

1. **Lire le plan** integralement (le fichier indique dans le tableau ci-dessus)
2. **Lire les fichiers de "Lecture obligatoire"** listes dans chaque sous-phase du plan
3. **Executer les actions** dans l'ordre
4. **Executer les commandes de verification** — copier les resultats
5. **Ecrire le checkpoint** dans `docs/phases/PHASE-34/checkpoint.md` apres chaque sous-phase
6. **NE PAS passer a la phase suivante** si la verification echoue — corriger d'abord

### Verification entre phases

Apres 34-B (avant de commencer 34-D) :
```bash
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# DOIT afficher Build succeeded
powershell.exe -Command "Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\Sessions\EntryPointExecutor.cs' -Pattern '_workflowCheckpoint' | Measure-Object"
# DOIT afficher Count >= 8
```

Apres 34-D (avant de commencer 34-E) :
```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# DOIT afficher 32 tests passed, 0 failed
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'WidgetRenderer|sendMessage|startWidgetPolling|sendWidgetResponse|pendingInteractive' | Measure-Object"
# DOIT afficher Count >= 10
```

Avant 34-E (services requis) :
```bash
curl -s http://localhost:5000/api/health
curl -s http://localhost:5010/api/v1/health/
# Les deux DOIVENT repondre. Si non → demarrer avec :
# powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1
```

---

## Regles critiques

1. **AGENT-PROTOCOL.md est OBLIGATOIRE** — lis-le, suis-le, checkpoint apres chaque sous-phase
2. **Ne PAS modifier la logique existante** de while/for-each/conditional/parallel — AJOUTER le checkpointing autour (34-B)
3. **Ne PAS casser les 32 tests existants** de `packages/maestro-code/` (34-D)
4. **Utiliser `h(Text, null, ...)` pour Ink** — PAS `h('ink:text', ...)` — ink rejette les string element types
5. **Ne PAS inventer de scores** — chaque QualityScore doit venir d'une mesure reelle (34-E)
6. **InputPrompt `disabled: false`** quand busy — c'est LE changement fondamental de 34-D
7. **Ne PAS confondre `_workflowStatus` et `_workflowState`** — deux variables separees
8. **Infrastructure generique, contenu specifique** — le checkpointing ne doit rien savoir des phases v4
9. **Si un service n'est pas disponible pour 34-E**, documenter BLOQUE dans le checkpoint et decrire exactement ce qui manque

---

## Fichiers cles

| Quoi | Chemin |
|------|--------|
| Plan 34-B | `docs/phases/PHASE-34/34-B/plan-checkpointing.md` |
| Plan 34-D | `docs/phases/PHASE-34/34-D/plan.md` |
| Plan 34-E | `docs/phases/PHASE-34/34-E/plan.md` |
| Design TUI detaille | `docs/phases/PHASE-34/34-A/02-interaction-handler/plan-workflow-tui.md` |
| ADR QualityScore | `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` |
| Test plan (5 taches) | `docs/phases/PHASE-34/34-A/14-test-plan/spec.md` |
| EntryPointExecutor | `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` |
| App.ts (TUI) | `packages/maestro-code/App.ts` |
| Session template v4 | `content/system/templates/sessions/project-v4.session.json` |
| Workflow v4 | `content/system/blocks/workflows/maestro-agent-v4/maestro-agent-v4.workflow.block.json` |
| Interaction handler | `content/system/blocks/workflows/interaction-handler/interaction-handler.workflow.block.json` |
| Checkpoint | `docs/phases/PHASE-34/checkpoint.md` |

---

## Commandes utiles

```bash
# Backend build
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"

# Backend tests
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"

# TUI tests (maestro-code)
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"

# TypeScript check
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit 2>&1"

# Block info
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block info <block-id>"

# Health checks
curl -s http://localhost:5000/api/health
curl -s http://localhost:5010/api/v1/health/

# Demarrer les services
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1

# Lancer maestro code (test manuel)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js code"
```

---

## Critere de succes final

La Phase 34 est COMPLETE quand :

1. **34-B** : `_workflowCheckpoint` est sauvegarde a chaque noeud, les noeuds deja completes sont skippes au redemarrage, le backend compile et passe les tests
2. **34-D** : `App.ts` a le `WidgetRenderer` (6 types), `sendMessage`, `startWidgetPolling`, `sendWidgetResponse`, InputPrompt toujours actif, placeholder dynamique, les 32 tests passent
3. **34-E** : 5 repos de test crees, QualityScore mesure pour chaque bloc, 5 taches executees avec Maestro v4 et Claude Code, comparaison documentee, manifeste Tier 1 publie a `content/system/manifests/tier-1.manifest.json`
4. **Checkpoint** : `docs/phases/PHASE-34/checkpoint.md` documente chaque sous-phase avec statut, resultats reels, et outputs de verification copies

**Commence par lire `docs/system/AGENT-PROTOCOL.md`, puis lis le plan 34-B et execute-le.**
