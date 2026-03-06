# Phase 53 — Design Discussion (2026-03-05)

## Points d'accord (FINALISES)

### 1. Tout est un block
- Le block est l'unite d'optimisation de Maestro
- Sortir quelque chose des blocks = le sortir de la boucle d'auto-amelioration
- Le tool dispatch, le response parsing, la gestion de conversation — tout doit etre un block
- Chaque block peut avoir un contract, etre teste, optimise, swap

### 2. Le tool dispatch NE DOIT JAMAIS etre dans AgentBlockExecutor
- Erreur survenue au moins 3 fois (35-PRE, corrections, Phase 52)
- Erreur sur la fondation qui brise toute l'app
- Protections necessaires : commentaires, CLAUDE.md, docs, memory

### 3. Blocks maintenant, compilation plus tard
- Phase dev : tout est un block (lent mais flexible, observable, testable, optimisable)
- Phase production : blocks stables compiles en code natif (zero overhead)
- L'overhead block (~1-5ms) est negligeable vs latence LLM (~2-30s)

### 4. L'agent produit sa sortie et c'est le PIPELINE qui route (DECISION CLE)
- AgentBlockExecutor ne doit PAS appeler le dispatcher lui-meme
- L'agent est un inference block (single LLM call) utilise comme NODE dans un multi-node block
- Le pipeline gere la boucle : conversation-read → inference → parse → dispatch → conversation-append → ...
- Chaque etape est visible dans le TUI comme un noeud du workflow
- Les mecanismes de boucle (while, for-each, conditional) existent deja dans le workflow engine

### 5. Agent, Workflow ET Tool partagent une base commune (DECISION CLE — mise a jour 2)
- `MultiNodeBlockExecutor` est la classe abstraite pour TOUS les blocks avec `config.nodes`
- `WorkflowBlockExecutor` herite : I/O arbitraire
- `AgentBlockExecutor` herite : I/O = meme qu'inference (prompt/messages → text), + conversation setup
- `ToolBlockExecutor` herite : I/O = defini par block.json schema. Un tool atomique = 1 node, un tool composite = N nodes
- Agent block.json contient ses `config.nodes` INLINE (comme un workflow)
- PAS de reference a un workflow externe (`config.workflow: "agent-loop"` = SUPPRIME)
- Templates de nodes fournissent les patterns standard (`agent-loop-standard`, `agent-loop-planning`, etc.)
- Les utilisateurs creent des agents via templates, agent-creator, ou /adapt — jamais from scratch

### 5b. EntryPointExecutor est un god class qui doit etre decompose (DECISION CLE — 2026-03-05)
- `EntryPointExecutor` fait 4272 lignes et melange 3 responsabilites
- **NodeExecutionEngine** (~500 lignes) : pur controle de flux (while, conditional, sequence, parallel, for-each). Quand il rencontre un `blockRef` → `BlockExecutorRegistry`. Il n'execute RIEN lui-meme.
- **SessionStateManager** (~300 lignes) : gestion d'etat (execution tree, logs, metrics, artifacts)
- **Handlers natifs** (LLM call, shell, file-write, etc.) : deviennent des blocks avec leurs propres executors
- Pas de `NativeHandlerRegistry` — ce serait juste un autre god class deguise
- Un seul registre : `BlockExecutorRegistry`. Chaque operation est un block.
- `EntryPointExecutor` reste comme point d'entree leger (demarre l'execution en background)

### 6. Verification de l'infrastructure existante (2026-03-05)
Le workflow engine a deja :
- While loops (`type: "while"`) avec condition, maxIterations, checkpoint
- Conditional branching (`type: "conditional"`) avec then/else et multi-way
- For-each, sequence, parallel, set-variable
- Template resolution (`{{variable}}`, `{{_nodeResult_nodeId}}`)
- Display tree pour le TUI (`_executionTree`)

Ce qui manque :
- Append to list (set-variable ecrase, ne concatene pas)
- Input `messages` pour InferenceBlockExecutor (liste de ChatMessage, PAS de conversationId)
- Blocks `conversation-read` et `conversation-append` (nouveaux tool blocks)
- Response parser block (nouveau)
- Tool dispatcher block (nouveau)
- `MultiNodeBlockExecutor` base class (nouveau)
- Templates de nodes pour agents (nouveau)

### 7. L'inference block ne gere PAS de conversation (REGLE CLE)
- L'inference block recoit `messages[]` et retourne du texte. Point.
- Il ne connait PAS `conversationId`, `IConversationManager`, ou `IContextAssembler`
- La conversation est geree par des tool blocks dans les config.nodes (`conversation-read`, `conversation-append`)
- Ceci evite de reproduire l'erreur de `AgentBlockExecutor` ou la gestion de conversation etait interne
- L'inference block peut etre utilise seul (single call sans conversation) ou comme node dans un agent

### 8. L'inference block est un passe-plat (REGLE CLE)
- L'inference block recoit un input (messages[] OU prompt string) et le passe a LLM Provider
- Il ne transforme rien, ne charge pas de template, ne gere pas de conversation
- `LLMRequest` accepte deja les deux formats (Messages et Prompt)
- LLM Provider gere la conversion vers le format du provider specifique
- La decision "quel format utiliser" est faite par les blocks en AMONT :
  - `conversation-read` → produit des messages[]
  - `message-builder` → transforme prompt + system prompt en messages[]
  - Ou un simple prompt string pour les cas triviaux
- L'inference block = tunnel vers le LLM. Rien d'autre.

### 9. Le response-parser doit reprendre TOUTE la logique de parsing
- `LLMBlockExecutorBase.ExtractJson()` — extraction JSON robuste (markdown, prose, balanced braces)
- Multi-tool detection et avertissement
- Trailing text capture (reponse apres le JSON)
- Empty response detection
- step-complete detection
- C'est la logique qui avait ete debuggee et corrigee — ne pas la perdre en la re-implementant de zero

### 10. Pas de default hardcode — templates a la place (DECISION CLE — 2026-03-05)
- L'ancienne approche `config.workflow: "agent-loop"` (default si absent) est REJETEE
- Raison : ca suppose UN pattern d'agent, ce qui est faux. Un agent de planification, un agent simple, un agent RAG ont des flows differents.
- A la place : templates de nodes dans `content/system/templates/agent-nodes/`
- Quand on cree un agent, on instancie un template qui injecte les nodes dans le block.json
- L'agent est ensuite autonome — ses nodes sont inline, pas une reference externe
- Fallback temporaire pour la migration : agents sans config.nodes → injection du template standard

## Decision finale

Voir `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md` pour la decision complete.

**Resume** : Agent, Workflow ET Tool heritent de `MultiNodeBlockExecutor`. L'agent a des `config.nodes` inline (comme un workflow) et le meme I/O qu'un inference block. Les tools ont aussi `config.nodes` (1 node pour atomique, N pour composite). `EntryPointExecutor` est decompose en `NodeExecutionEngine` (controle de flux pur) + `SessionStateManager`. Les handlers natifs deviennent des blocks. Un seul registre : `BlockExecutorRegistry`.
