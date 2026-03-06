# ADR : Agent et Workflow = Multi-Node Blocks

**Date** : 2026-03-05
**Statut** : ACCEPTE (mis a jour)
**Decideurs** : Arthur (product owner) + Claude (architect)

---

## Contexte

`AgentBlockExecutor` est un monolithe de ~1100 lignes qui contient :
1. La boucle agentique (while true → LLM call → parse → tool → repeat)
2. Le dispatch de tools (resolution block, execution, formatage resultat)
3. La gestion de conversation (IConversationManager)
4. Le parsing de reponses LLM (JSON extraction, multi-tool detection)
5. La gestion d'erreurs (context window, provider routing, loop detection)
6. La detection de terminaison (step-complete)

Le tool dispatch a ete reintroduit dans l'agent **au moins 3 fois** malgre les corrections precedentes. C'est un signe que l'architecture actuelle rend cette erreur naturelle : l'agent "possede" sa boucle, donc il est logique d'y ajouter du code.

## Decision

**Tous les block types (agent, workflow, tool) partagent une base commune : `MultiNodeBlockExecutor`.** Le moteur d'execution de nodes est extrait de `EntryPointExecutor` dans un `NodeExecutionEngine` pur (controle de flux uniquement). Les operations natives (filesystem, shell, etc.) deviennent des blocks dispatches via `BlockExecutorRegistry`. Il n'y a qu'un seul registre.

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
        │     │     I/O: meme qu'inference (prompt/messages → text)
        │     │     + cree conversation, passe _conversationId
        │     │     + recupere _agentResult
        │     │
        │     └── ToolBlockExecutor      (blockType: "tool")
        │           I/O: defini par block.json schema (inputs/outputs)
        │           1 node natif (file-write) ou N nodes (create-commit)
        │
        └── InferenceBlockExecutor (blockType: "inference")
              Passe-plat : messages[] OU prompt → LLM → text

NodeExecutionEngine (extrait de EntryPointExecutor)
  └── pur controle de flux : while, conditional, sequence, parallel, for-each
  └── quand il rencontre un blockRef → BlockExecutorRegistry
  └── NE contient AUCUN handler natif — tout est un block
```

### Decomposition de EntryPointExecutor (4272 lignes)

`EntryPointExecutor` est un god class qui melange trois responsabilites :
1. **Moteur d'execution de nodes** → `NodeExecutionEngine` (~500 lignes)
2. **Handlers natifs** (LLM, shell, file-write, etc.) → deviennent des blocks avec leurs executors
3. **Gestion d'etat de session** (execution tree, logs, metrics) → `SessionStateManager` (~300 lignes)

Apres decomposition, `EntryPointExecutor` ne reste que comme point d'entree leger qui demarre l'execution en background.

### Pourquoi ToolBlockExecutor herite aussi de MultiNodeBlockExecutor

Un tool atomique (`file-write`) = 1 node dans config.nodes. Un tool composite (`create-commit`) = N nodes (read diff, build prompt, LLM call, git commit). La distinction tool atomique vs composite est artificielle — c'est juste le nombre de nodes. Le meme moteur execute les deux.

Pas de `NativeHandlerRegistry` ni de `ToolHandlerRegistry` — ce serait juste des god classes deguisees. Chaque operation est un block, dispatch par `BlockExecutorRegistry`.

### Agent block.json : nodes inline

Les agents ont desormais `config.nodes` dans leur block.json, comme les workflows. Les nodes definissent le comportement (boucle, parsing, dispatch). L'executor ne contient que le setup (conversation) et le contrat I/O.

```
Agent block.json:
  config.model: "claude-sonnet-4-6"
  config.maxIterations: 25
  config.nodes: [
    init → set _agentDone = false
    while (_agentDone != true):
      conversation-read → messages[]
      inference (llm-call) → content
      conversation-append → assistant response
      response-parser → {type, toolId, args}
      conditional (route-response):
        tool-call → tool-dispatcher → conversation-append (result)
        step-complete → _agentDone = true
        text → _agentResult = text, _agentDone = true
        retry → conversation-append (nudge)
  ]
```

### Templates de nodes (pas de default hardcode)

Il n'y a PAS de workflow par defaut (`agent-loop`). A la place, des templates fournissent des patterns de nodes standard :

- `agent-loop-standard` — conversation + LLM + parse + tool dispatch
- `agent-loop-planning` — premiers N iterations avec model planification
- `agent-loop-simple` — pas de tools, juste conversation + LLM + reponse

Les templates sont dans `content/system/templates/agent-nodes/`. Quand on cree un agent (agent-creator Phase 55, /adapt, manuellement), le template injecte les nodes dans le block.json. L'agent est ensuite autonome.

### Regle fondamentale : separation des responsabilites

**L'inference block ne gere PAS de conversation.** Il recoit des messages, appelle le LLM, retourne du texte. Il peut etre utilise seul (single call, pas de conversation) ou comme node dans un agent/workflow.

**La conversation est geree par des tool blocks** (`conversation-read`, `conversation-append`) qui utilisent `IConversationManager` du DI. Le workflow/agent orchestre ces blocks autour de l'inference block.

**Le comportement de l'agent est defini par ses nodes**, pas par l'executor. `AgentBlockExecutor` ne contient que le setup conversation + I/O contract.

### Chaque block atomique du workflow

| Block | Type | Responsabilite | Optimisable ? |
|-------|------|---------------|---------------|
| `inference` | inference | Passe-plat vers LLM Provider. Recoit messages[] OU prompt string, retourne du texte. | Oui (modele, temperature) |
| `message-builder` | tool | Transforme prompt + system prompt en messages[]. Usage standalone. | Oui (format, enrichissement) |
| `conversation-read` | tool | Lit les messages d'une conversation via IConversationManager | Oui (truncation strategy, summarization) |
| `conversation-append` | tool | Ajoute un message a une conversation | Oui (filtrage, transformation) |
| `response-parser` | tool | Parse la reponse LLM brute, extrait le tool call | Oui (meilleur parsing, multi-format) |
| `tool-dispatcher` | tool | Resout et execute le tool cible | Oui (mapping, caching, permissions) |

## Justification

### Pourquoi c'est mieux

1. **Visibilite TUI** : Chaque iteration montre exactement ce qui se passe : "Iteration 3 → LLM call → tool-call: file-write → dispatch → success". Aujourd'hui c'est une boite noire.

2. **Optimisabilite** : Chaque block a un contract, est testable, peut etre ameliore par un agent optimiseur.

3. **"Tout est un block"** : L'agent n'est plus special. Agent et workflow partagent la meme base. Les nodes definissent le comportement, pas l'executor.

4. **Prevention structurelle** : Il est physiquement impossible de remettre du tool dispatch dans l'agent, parce que l'executor ne contient que le setup et le I/O contract.

5. **Flexibilite** : Differents patterns d'agent (standard, planning, simple, RAG) = differents templates de nodes. Pas de logique conditionnelle dans l'executor.

6. **Auto-amelioration** : La boucle d'auto-amelioration de Maestro (Phase 62+) peut optimiser chaque block independamment.

7. **Compilation future** : Quand la compilation sera implementee, les nodes stables seront compiles en code natif — zero overhead.

### Ce qui existe deja dans le workflow engine

| Feature | Statut | Details |
|---------|--------|---------|
| While loops | EXISTE | `type: "while"`, condition, maxIterations, checkpoint resume |
| Conditional branching | EXISTE | `type: "conditional"`, then/else, multi-way branches |
| For-each | EXISTE | `type: "for-each"`, source list, per-item variables |
| Set-variable | EXISTE | `type: "set-variable"`, template resolution, JSON parsing |
| Sequence | EXISTE | `type: "sequence"`, sequential execution |
| Node result passing | EXISTE | `{{_nodeResult_nodeId}}`, `{{previousOutput}}` |
| Iteration variables | EXISTE | `{{iteration}}`, `{{currentIteration}}` auto-populated |
| Display tree / TUI | EXISTE | `_executionTree` mis a jour a chaque noeud |
| Checkpoint resume | EXISTE | `_workflowCheckpoint` pour reprendre apres crash |

| Feature | MANQUE | A construire |
|---------|--------|-------------|
| Append to list variable | MANQUE | `set-variable` ecrase, ne concatene pas. Besoin d'un mode "append" |
| InferenceBlockExecutor = passe-plat | A MODIFIER | Simplifier pour etre un tunnel : recoit messages[] OU prompt, passe a LLM Provider, retourne la reponse. |
| Block `message-builder` | MANQUE | Transforme prompt + system prompt en messages[] |
| Block `conversation-read` | MANQUE | Nouveau tool block qui lit les messages d'une conversation |
| Block `conversation-append` | MANQUE | Nouveau tool block qui ajoute un message a une conversation |
| Block `response-parser` | MANQUE | Nouveau tool block qui parse les reponses LLM |
| Block `tool-dispatcher` | MANQUE | Nouveau tool block qui resout et execute un tool par son ID |
| `MultiNodeBlockExecutor` | MANQUE | Base class abstraite pour agent et workflow |
| Templates de nodes | MANQUE | Patterns standard pour config.nodes des agents |

### Ce qui est dans AgentBlockExecutor et doit etre redistribue

| Fonctionnalite | Lignes actuelles | Destination |
|----------------|-----------------|-------------|
| Boucle while(true) | 209-561 | config.nodes : `type: "while"` |
| LLM call + retry | 252-372 | config.nodes : `blockRef: "inference"` |
| JSON extraction + tool parsing | 416-530 | config.nodes : `blockRef: "response-parser"` |
| Tool dispatch | 849-1008 | config.nodes : `blockRef: "tool-dispatcher"` |
| step-complete detection | 430-516 | Block `response-parser` (output type = "step-complete") |
| Conversation management | 83-147, 562-577 | `AgentBlockExecutor.PrepareExecutionAsync()` + `conversation-read/append` blocks |
| Context assembly + truncation | 240-244, 336-359 | Block `conversation-read` (truncation via IContextAssembler) |
| Loop detection | 518-530 | Workflow condition ou block dedie dans config.nodes |
| Multi-tool detection | 536-560 | Block `response-parser` |
| Planning model switch | 247-249 | Template `agent-loop-planning` avec condition dans config.nodes |
| Empty response nudge | 375-403 | Block `response-parser` (output type = "retry") + config.nodes conditional |
| Wall-clock timeout | 188-191, 211-217 | Workflow-level timeout sur le while node |
| Token accumulation | 204-207, 407-410 | Workflow variable accumulation dans config.nodes |

## Plan de migration

### Phase 53-A : Creer les blocks atomiques
- `response-parser` : tool block, reprend TOUTE la logique de parsing existante
- `tool-dispatcher` : tool block, resout et execute un tool
- `conversation-read` : tool block, lit les messages d'une conversation
- `conversation-append` : tool block, ajoute un message a une conversation
- `message-builder` : tool block, transforme prompt + system prompt en messages[]
- Simplifier `InferenceBlockExecutor` en passe-plat

### Phase 53-B : MultiNodeBlockExecutor + migration
- Creer `MultiNodeBlockExecutor` (abstract base class)
- `WorkflowBlockExecutor` extends `MultiNodeBlockExecutor` — migrer le chemin inline de EntryPointExecutor
- `AgentBlockExecutor` extends `MultiNodeBlockExecutor` — I/O inference + conversation setup
- Ajouter `mode: "append"` a set-variable

### Phase 53-C : Agents avec nodes inline + templates
- Creer templates de nodes (`agent-loop-standard`, `agent-loop-planning`, `agent-loop-simple`)
- Migrer les agents existants : ajouter `config.nodes` depuis le template standard
- Fallback temporaire : agents sans config.nodes → injection automatique du template standard
- Tests E2E complets

### Phase 53-D : Protection anti-regression
- Commentaires dans le code
- Mise a jour CLAUDE.md, docs architecture, memory
- Tests de regression

### Futur : Block compilation
- Les nodes stables sont "compiles" en code natif
- Un agent compile = equivalent a l'actuel AgentBlockExecutor monolithique
- Zero overhead en production

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Regression sur agents existants | Fallback temporaire : agents sans config.nodes → injection du template standard |
| Performance (overhead multi-node) | ~5-10ms par iteration vs ~5-30s LLM call = negligeable |
| Conversation state across iterations | `AgentBlockExecutor.PrepareExecutionAsync()` cree la conversation. `conversation-read/append` blocks la gerent. L'inference block ne connait PAS les conversations. |
| Complexite pour creer un agent | Templates de nodes. Les utilisateurs ne creent pas les nodes from scratch — agent-creator, /adapt, ou templates. |
| `set-variable` n'a pas d'append | Ajouter un mode `append` a `ExecuteSetVariableNode` |
| InferenceBlockExecutor ne supporte pas `messages` en input | Ajouter le support de `messages` (liste ChatMessage). PAS de conversationId. |
| Migration des agents existants | Script de migration + fallback automatique. Progressive, pas big-bang. |

## Ce qui NE change PAS

- Le format `*.agent.block.json` garde sa structure (config.model, system-prompt.md, etc.)
- L'API `POST /api/sessions/{id}/invoke` reste identique
- `IConversationManager` reste un service DI (pas un block — c'est du stockage d'etat)
- `blockType: "agent"` reste valide et significatif (= multi-node block avec I/O inference)
- Le discovery, le catalog, l'AssistantSelector reconnaissent toujours les agents

## Ce qui CHANGE

- Agent block.json a desormais `config.nodes` (inline, comme un workflow)
- `AgentBlockExecutor` herite de `MultiNodeBlockExecutor` (plus de monolithe)
- `WorkflowBlockExecutor` herite de `MultiNodeBlockExecutor` (migre depuis EntryPointExecutor)
- `ToolBlockExecutor` herite de `MultiNodeBlockExecutor` — les tools sont aussi des multi-node blocks
- `EntryPointExecutor` decompose en `NodeExecutionEngine` + `SessionStateManager` + blocks
- Les handlers natifs (LLM, shell, file-write, etc.) deviennent des blocks avec leurs propres executors
- Plus de `NativeHandlerRegistry` ni `ToolHandlerRegistry` — un seul registre (`BlockExecutorRegistry`)
- Pas de default `agent-loop` — templates de nodes a la place

---

*Voir aussi : `docs/phases/PHASE-53/DESIGN-DISCUSSION.md` pour l'historique de la discussion*
