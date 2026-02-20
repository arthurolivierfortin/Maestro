# Phase 34-D : Interaction Handler + Widget Protocol

**Statut** : A faire
**Prerequis** : Phase 34-B COMPLETE (state manager fonctionnel), Phase 34-C COMPLETE (workflow v4 fonctionnel)
**Objectif** : Construire l'interaction-handler (agent composite parallele) et integrer le widget protocol dans `maestro code` pour permettre a l'utilisateur d'interagir avec l'agent pendant qu'il travaille.

---

## Vision

> **C'est LA feature differenciante de Maestro.** L'utilisateur peut interagir avec l'agent pendant qu'il travaille, sans perdre le contexte, et meme changer de direction.

L'interaction-handler est un agent composite qui tourne en parallele du workflow principal. Il :
- Recoit les messages utilisateur
- Classifie l'intent (question, feedback, change-request, override)
- Decide l'action (repondre, pauser, rewind, injecter)
- Execute l'action via le state-manager
- Rend la reponse via des widgets dans le TUI

### Architecture

```
┌─ Session ──────────────────────────────────────────────────┐
│                                                            │
│  ┌─ Workflow autonome (deterministe) ──────────────────┐  │
│  │  comprendre -> planifier -> implementer -> ...      │  │
│  │  Lit/ecrit le state-manager a chaque noeud          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Interaction Handler (parallele, intelligent) ──────┐  │
│  │  classify-intent → decide-action → execute → respond│  │
│  │  Controle le workflow via le state-manager           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ State Manager (tool, single source of truth) ──────┐  │
│  │  status, currentPhase, plan, results, history       │  │
│  │  Operations: get, set, pause, resume, rewind, inject│  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Composants a creer

1. **classify-intent** (bloc inference) — classifie le message utilisateur
2. **decide-action** (bloc inference) — decide quoi faire
3. **execute-action** (bloc conditionnel) — execute l'action choisie
4. **interaction-handler** (agent composite) — orchestre les 3 ci-dessus
5. **Widget components** dans `maestro code` — render les widgets (message, option-select, confirmation, progress, plan-view, diff-view, test-results)
6. **Integration parallele** — le workflow et l'interaction-handler tournent en meme temps

### Dependances backend

- Le block type `parallel` doit etre fonctionnel dans `EntryPointExecutor`
- Le state-manager (cree en 34-B) doit supporter les operations de pause/resume/rewind
- `maestro code` doit pouvoir router les messages utilisateur vers l'interaction-handler

### Effort estime : 5-8 jours

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/AGENT-V4-SPEC.md` | Design detaille de l'interaction-handler |
| `docs/phases/PHASE-28/PLAN-PHASE-28A.md` | Design original du state manager et de l'interaction-handler |
| `docs/phases/PHASE-28/PLAN-PHASE-28B.md` | Widget protocol complet |
| `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md` | Block `parallel` — comment l'execution parallele fonctionne |
| `packages/maestro-code/App.ts` | Le mode interactif actuel — ou integrer les widgets |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | L'executeur de workflows — ou ajouter le support parallele |

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/inference/classify-intent/classify-intent.block.json` | CREER |
| `content/system/blocks/inference/decide-action/decide-action.block.json` | CREER |
| `content/system/blocks/agents/interaction-handler/interaction-handler.block.json` | CREER |
| `content/system/blocks/agents/interaction-handler/system-prompt.md` | CREER |
| `packages/maestro-code/widgets/` | CREER — composants widget (message, option-select, confirmation, etc.) |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | MODIFIER — support du block `parallel` |

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS mettre la logique d'interaction dans le workflow — l'interaction-handler est un agent PARALLELE, pas un noeud sequentiel
- Ne PAS hardcoder les types d'intent dans le backend — c'est le LLM qui classifie, pas du code
- Ne PAS creer des widgets specifiques a un agent — les widgets sont generiques

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-D : Interaction Handler
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : classify-intent, decide-action, interaction-handler
**Block parallel fonctionnel** : OUI / NON
**Widgets implementes** : X / 7
**Integration maestro code** : OUI / NON
**Test pause/resume** : PASS / FAIL
**Test rewind** : PASS / FAIL
**Problemes** : [si BLOQUE]
```
