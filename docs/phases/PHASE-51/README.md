# Phase 51 : Agent Creator — Meta-agent de creation d'agents

**Statut** : Planifie
**Prerequis** : Phase 50 COMPLETE (fitness engine production, adapt TUI, evaluateur multi-dimensionnel)
**Objectif** : Un utilisateur decrit un agent en langage naturel, et Maestro cree automatiquement le workflow complet : analyse, decomposition en sous-blocks, generation de prompts, assemblage, tests de fitness, et publication.

---

## Contexte

### La vision (depuis Phase 28)

L'Agent Creator est le premier composant "meta" de Maestro : un agent qui cree des agents. C'est le passage de "l'utilisateur configure manuellement des blocks JSON" a "l'utilisateur decrit ce qu'il veut et Maestro le construit".

### Ce qui existe deja

| Composant | Phase | Statut |
|-----------|-------|--------|
| Block JSON format + discovery | Phase 4-10 | Stable |
| Composite agents (isAtomic: false, config.nodes) | Phase 35-PRE | Stable |
| Foundry sessions (training, testing) | Phase 38 | Stable |
| Sandbox + git worktrees pour tests | Phase 38 | Stable |
| Adapt/Optimize module | Phase 39 | Stable |
| Fitness engine multi-dimensionnel | Phase 50 | A faire |
| Capabilities model + tests | Phase 49 | A faire |

### Ce que cette phase construit

```
"Create an agent that translates documentation from English to French,
preserving code blocks and markdown formatting."

        │
        ▼

agent-creator (workflow, blockType: "agent", isAtomic: false)
  │
  ├── understand-request (inference, Opus)
  │   "Analyze the task, identify: sub-tasks, required tools,
  │    competencies needed, success criteria"
  │   → Output: task analysis JSON
  │
  ├── design-architecture (inference, Opus)
  │   "Given this analysis, design a Maestro workflow:
  │    which blocks? which types? which connections?"
  │   → Output: architecture JSON (nodes, connections, conditions)
  │
  ├── for-each block to create:
  │   ├── generate-block (agent, Sonnet)
  │   │   "Create a .block.json and system-prompt.md for this sub-task.
  │   │    Follow Maestro block conventions. Reference existing blocks
  │   │    in the catalog for patterns."
  │   │   → Output: block JSON + prompt files
  │   │
  │   └── test-block (agent, Sonnet)
  │       "Test this block individually against the capability tests.
  │        Verify JSON validity, tool schemas, prompt coherence."
  │       → Output: test results
  │
  ├── assemble-workflow (agent, Sonnet)
  │   "Create the composite .block.json with config.nodes
  │    connecting all sub-blocks. Set up inputs/outputs."
  │   → Output: workflow block JSON
  │
  ├── test-workflow (agent, Sonnet)
  │   "Test the complete workflow against fitness criteria.
  │    Use the Phase 50 fitness engine."
  │   → Output: fitness report
  │
  └── publish-or-iterate (conditional)
      fitness >= 0.75 → publish to user workspace
      fitness < 0.75 → iterate (modify prompts, retry)
      max 3 iterations
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 51-A | Agent Creator workflow (block-based) | 3-5 jours |
| 51-B | Integration TUI + CLI | 2-3 jours |
| 51-C | Templates et exemples | 2 jours |

---

## 51-A : Agent Creator workflow

### Taches

1. **Creer le block `system:agent-creator`** — workflow composite
   - Utilise un modele puissant pour l'analyse (Opus ou Sonnet)
   - Genere des blocks JSON conformes au schema Maestro
   - Inclut des exemples de blocks existants dans le contexte

2. **Sous-blocks** :
   - `agent-creator:analyze` — comprend la requete
   - `agent-creator:architect` — dessine l'architecture
   - `agent-creator:generate` — genere chaque block
   - `agent-creator:assemble` — assemble le workflow
   - `agent-creator:validate` — teste le resultat via fitness engine

3. **Le contexte du creator inclut** :
   - Le schema block JSON (valide)
   - 3-5 exemples de blocks existants (maestro-assistant, dev-orchestrator, etc.)
   - La liste des tools disponibles (file-read, file-write, shell-execute, etc.)
   - Les conventions de nommage et de structure

4. **Iteration** :
   - Si fitness < 0.75, le creator peut modifier les prompts et retester
   - Max 3 iterations pour eviter une boucle infinie
   - A chaque iteration, le feedback du test est injecte dans le contexte

### Verification
```bash
# Creer un agent simple
maestro create-agent --description "An agent that adds docstrings to Python functions"

# Verifier que les blocks sont crees dans le workspace
ls .maestro/workspace/blocks/

# Verifier le fitness
maestro fitness <created-workflow-id>
```

---

## 51-B : Integration TUI + CLI

### Taches

1. **Commande CLI** :
   ```bash
   maestro create-agent --description "..." [--workspace <id>] [--model <model>]
   ```

2. **Commande TUI `/create-agent`** :
   - L'agent maestro-assistant demande la description
   - Lance le workflow agent-creator en arriere-plan
   - Affiche la progression dans le ConversationLog
   - A la fin, propose de tester l'agent cree

3. **Page Foundry enrichie** :
   - Afficher les agents en cours de creation
   - Afficher l'historique des creations avec leur fitness

---

## 51-C : Templates et exemples

1. **3 templates pre-construits** :
   - "Code reviewer" — review + suggestions
   - "Documentation writer" — docstrings, README, guides
   - "Test generator" — unit tests, integration tests

2. **Exemples dans la doc** :
   - Comment creer un agent de A a Z
   - Comment personaliser un template
   - Comment tester et publier

---

## La dimension auto-referentielle

L'Agent Creator est lui-meme un workflow Maestro. En theorie, il pourrait s'ameliorer lui-meme :
1. L'Agent Creator v1 est cree manuellement (cette phase)
2. L'Agent Creator v1 cree des agents et les teste
3. Les patterns decouverts (quels prompts marchent, quelles architectures reussissent) alimentent une v2
4. L'Agent Creator v2 est genere par l'Agent Creator v1 + un humain qui valide

**Pour cette phase** : on cree le v1 manuellement. L'auto-amelioration = Phase 53+.

---

## Definition of Done

- [ ] Block `system:agent-creator` cree comme workflow composite
- [ ] 5 sous-blocks (analyze, architect, generate, assemble, validate)
- [ ] `maestro create-agent --description "..."` fonctionne
- [ ] L'agent cree passe le fitness test (>= 0.75)
- [ ] `/create-agent` fonctionne dans le TUI
- [ ] 3 templates pre-construits
- [ ] Documentation : comment creer un agent

### NOT in scope
- Auto-amelioration de l'Agent Creator (Phase 53)
- Catalogue communautaire (Phase 52)
- Multi-domain (Phase 53)
- LLM-as-Judge cloud dans le fitness (peut etre ajoute si Phase 50-B l'a fait)
