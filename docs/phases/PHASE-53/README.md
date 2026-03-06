# Phase 53 : Agent et Workflow = Multi-Node Blocks

**Statut** : COMPLETE
**Prerequis** : Phase 52 COMPLETE
**Objectif** : Creer une hierarchie de classes `MultiNodeBlockExecutor` → `WorkflowBlockExecutor` / `AgentBlockExecutor` / `ToolBlockExecutor`. Decomposer `EntryPointExecutor` (4272 lignes) en `NodeExecutionEngine` (controle de flux pur) + `SessionStateManager`. Tous les handlers natifs deviennent des blocks. Un seul registre : `BlockExecutorRegistry`.
**Duree estimee** : 9-10 jours
**ADR** : `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md`

---

## Le probleme

`AgentBlockExecutor` est un monolithe de ~1100 lignes. Il contient :
- La boucle agentique (while → LLM → parse → tool → repeat)
- Le dispatch de tools (resolution, execution, formatage)
- La gestion de conversation
- Le parsing de reponses LLM
- La gestion d'erreurs, loop detection, timeout

Le tool dispatch a ete reintroduit dans l'agent **au moins 3 fois**. L'architecture actuelle rend cette erreur naturelle : l'agent "possede" sa boucle, donc on y ajoute du code.

**Solution** : L'agent est un multi-node block. Ses nodes definissent son comportement (boucle, parsing, dispatch). L'executor ne contient que le contrat I/O.

---

## Architecture cible

### Hierarchie des executors

```
BlockExecutorRegistry (le seul registre)
  │
  └── blockType → IBlockExecutor
        │
        ├── MultiNodeBlockExecutor (abstract)
        │     — execute config.nodes via NodeExecutionEngine
        │     │
        │     ├── WorkflowBlockExecutor  (blockType: "workflow")
        │     │     I/O: arbitraire
        │     │
        │     ├── AgentBlockExecutor     (blockType: "agent")
        │     │     I/O: inference (prompt/messages → text) + conversation
        │     │
        │     └── ToolBlockExecutor      (blockType: "tool")
        │           I/O: defini par block.json schema
        │           1 node (atomique) ou N nodes (composite)
        │
        └── InferenceBlockExecutor (blockType: "inference")
              Passe-plat : messages[] OU prompt → LLM → text

NodeExecutionEngine (extrait de EntryPointExecutor)
  └── pur controle de flux : while, conditional, sequence, parallel, for-each
  └── blockRef → BlockExecutorRegistry (tout est un block)
  └── NE contient AUCUN handler — il orchestre, il n'execute pas

SessionStateManager (extrait de EntryPointExecutor)
  └── execution tree, logs, metrics, artifacts, active block
```

### Difference entre agent, workflow et tool

| | Agent | Workflow | Tool |
|---|---|---|---|
| `blockType` | `"agent"` | `"workflow"` | `"tool"` |
| Executor | `AgentBlockExecutor` | `WorkflowBlockExecutor` | `ToolBlockExecutor` |
| Base class | `MultiNodeBlockExecutor` | `MultiNodeBlockExecutor` | `MultiNodeBlockExecutor` |
| I/O contract | Meme qu'inference (prompt/messages → text) | Arbitraire (defini par le workflow) | Defini par block.json schema |
| Conversation | Cree automatiquement, passe via `_conversationId` | Pas de conversation implicite | Pas de conversation implicite |
| `config.nodes` | Inline dans le block.json | Inline dans le block.json | Inline (1 node atomique ou N nodes) |
| Templates | `content/system/templates/agent-nodes/` | `content/system/templates/workflow-nodes/` | N/A (trop varies) |

### Templates de nodes

Les utilisateurs ne creent PAS les nodes from scratch. Ils partent de templates :
- `agent-loop-standard` — conversation + LLM + parse + dispatch
- `agent-loop-planning` — premiers N iterations avec model planification
- `agent-loop-simple` — pas de tool dispatch, juste conversation + LLM + reponse

---

## Sous-phases

| Phase | Titre | Effort | Plan detaille |
|-------|-------|--------|---------------|
| 53-A | Decomposition EntryPointExecutor → NodeExecutionEngine + SessionStateManager | 2 jours | [53-A.md](./53-A.md) |
| 53-B | `MultiNodeBlockExecutor` base class + WorkflowBlockExecutor + AgentBlockExecutor + ToolBlockExecutor | 2 jours | [53-B.md](./53-B.md) |
| 53-C | Blocks atomiques + migration handlers natifs en blocks | 2 jours | [53-C.md](./53-C.md) |
| 53-D | Migration agents existants + templates de nodes | 1.5 jours | [53-D.md](./53-D.md) |
| 53-E | Protection anti-regression + documentation + suppression code mort | 0.5 jour | [53-E.md](./53-E.md) |
| 53-F | Verification E2E exhaustive — 10 couches, regression zero | 1.5 jours | [53-F.md](./53-F.md) |

---

## Definition of Done

- [ ] Block `response-parser` cree et fonctionnel
- [ ] Block `tool-dispatcher` cree et fonctionnel
- [ ] Block `conversation-read` cree et fonctionnel
- [ ] Block `conversation-append` cree et fonctionnel
- [ ] Block `message-builder` cree et fonctionnel
- [ ] `set-variable` supporte `mode: "append"`
- [ ] `InferenceBlockExecutor` simplifie en passe-plat (messages OU prompt → LLM → texte)
- [ ] `MultiNodeBlockExecutor` base class creee
- [ ] `WorkflowBlockExecutor` herite de `MultiNodeBlockExecutor`
- [ ] `AgentBlockExecutor` herite de `MultiNodeBlockExecutor`
- [ ] `ToolBlockExecutor` herite de `MultiNodeBlockExecutor`
- [ ] `EntryPointExecutor` decompose en `NodeExecutionEngine` + `SessionStateManager`
- [ ] Handlers natifs migres en blocks (filesystem, shell, LLM, etc.)
- [ ] Plus aucun handler inline dans EntryPointExecutor ni ToolBlockExecutor
- [ ] Agents existants migres avec `config.nodes` inline
- [ ] Templates de nodes crees (`agent-loop-standard`, etc.)
- [ ] `AgentBlockExecutor` ne contient AUCUN code de tool dispatch, parsing, ou boucle
- [ ] Le format `*.agent.block.json` garde sa structure (model, system-prompt, etc.)
- [ ] Les agents existants fonctionnent sans regression
- [ ] Chaque etape est visible dans le TUI
- [ ] Commentaires anti-regression dans le code
- [ ] CLAUDE.md mis a jour
- [ ] Docs architecture mis a jour
- [ ] Memory mis a jour
- [ ] `NodeExecutionEngine` extrait — pur controle de flux, aucun handler natif
- [ ] `SessionStateManager` extrait — execution tree, logs, metrics, artifacts
- [ ] `EntryPointExecutor` reduit a < 200 lignes
- [ ] Code mort supprime (ancien monolithe agent, ancien if-chain tools, handlers inline EPE)
- [ ] Tous les tests existants passent (regression zero)
- [ ] **53-F checklist 100% verte** — 10 couches de verification, 0 regression
- [ ] Checkpoint final avec la checklist remplie et les outputs colles

### NOT in scope
- Re-verification du contract test runner avec FitnessScore (Phase 54)
- Merger test-suites dans contracts (Phase 54)
- Agent agent-creator (Phase 55)
- Block compilation pour zero overhead (futur)

---

## Documents associes

- [ADR-AGENT-AS-WORKFLOW.md](./ADR-AGENT-AS-WORKFLOW.md) — Decision architecturale complete
- [DESIGN-DISCUSSION.md](./DESIGN-DISCUSSION.md) — Historique des discussions et points d'accord
- [53-A.md](./53-A.md) — Decomposition EntryPointExecutor
- [53-B.md](./53-B.md) — MultiNodeBlockExecutor + 3 executors
- [53-C.md](./53-C.md) — Blocks atomiques + migration handlers natifs
- [53-D.md](./53-D.md) — Migration agents + templates de nodes
- [53-E.md](./53-E.md) — Protection anti-regression + documentation
- [53-F.md](./53-F.md) — Verification E2E exhaustive (10 couches)
