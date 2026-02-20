# 13. Dependances Techniques

## Ce qui EXISTE deja dans Maestro

### Backend (EntryPointExecutor.cs)

| Capacite | Status | Details |
|----------|--------|---------|
| Execution de workflows (config.nodes) | IMPLEMENTE | `ExecuteWorkflowNodeAsync` |
| Noeuds `blockRef` | IMPLEMENTE | `ExecuteBlockRefAsync` |
| Noeuds `sequence` | IMPLEMENTE | Children executes sequentiellement |
| Noeuds `decision` (conditional) | IMPLEMENTE | `ExecuteConditionalNodeAsync` — condition + ifTrue/ifFalse |
| Noeuds `while` | IMPLEMENTE | `ExecuteWhileNodeAsync` — condition, maxIterations, evaluateFirst, plateau detection |
| Noeuds `for-each` | IMPLEMENTE | `ExecuteForEachNodeAsync` — collection, itemVariable |
| Noeuds `write` | IMPLEMENTE | `ExecuteWriteNodeAsync` — ecriture de variables de session |
| Noeuds `llm` | IMPLEMENTE | `ExecuteLLMNodeAsync` — appel LLM inline |
| Noeuds `shell` | IMPLEMENTE | `ExecuteShellNodeAsync` — execution de commandes shell |
| **Noeuds `parallel`** | **NON IMPLEMENTE** | Concu dans DESIGN-CONTROL-FLOW-BLOCKS.md mais absent de EntryPointExecutor.cs |

### Blocks existants (content/system/blocks/)

| Block | Status | Reutilise dans v4 |
|-------|--------|-------------------|
| `project-preparer` (agent, v2.0.0) | Existant | Remplace par `project-analyzer` (v4) — prompt ameliore |
| `task-planner` (agent, v2.0.0) | Existant | Remplace par `task-planner` (v4) — ajout domain routing |
| `implement-single-step` (agent, v3.0.0) | Existant | Split en 3 : backend-developer, frontend-developer, styling-developer |
| `step-validator` (tool) | Existant | Garde, prompt ameliore |
| `json-validator` (tool) | Existant | Remplace par `plan-validator` (inference, v4) |
| `test-executor` (agent, v2.0.0) | Existant | Split en 2 : test-writer, test-runner |
| `code-reviewer` (inference, v2.0.0) | Existant | Remplace par `code-reviewer` (v4) — 7 axes, plus strict |
| `git-committer` (agent, v2.0.0) | Existant | Remplace par `git-committer` (v4) — staging ameliore |
| `file-read` (tool) | Existant | Reutilise tel quel |
| `file-write` (tool) | Existant | Reutilise tel quel |
| `directory-list` (tool) | Existant | Reutilise tel quel |
| `shell-execute` (tool) | Existant | Reutilise tel quel |
| `autonomous-development` (workflow) | Existant | Remplace par `maestro-agent-v4` (workflow, v4) |

### Infrastructure CLI

| Capacite | Status |
|----------|--------|
| `session create/start/invoke` | IMPLEMENTE |
| `session set-var` | IMPLEMENTE |
| `monitor <session-id>` | IMPLEMENTE |
| `maestro code` (mode interactif) | IMPLEMENTE |
| `maestro code --headless` | IMPLEMENTE |
| `run <block-id>` (execution directe) | IMPLEMENTE |

### Autres

| Capacite | Status |
|----------|--------|
| LLM-Provider gateway (multi-provider) | IMPLEMENTE |
| Session templates | IMPLEMENTE |
| TUI monitor | IMPLEMENTE |
| Block discovery service | IMPLEMENTE |
| Agent block executor | IMPLEMENTE |
| Inference block executor | IMPLEMENTE |
| Tool block executor | IMPLEMENTE |

---

## Ce qui DOIT etre ajoute/modifie

### CRITIQUE — Bloquant pour le workflow

| Element | Effort | Description | Phase |
|---------|--------|-------------|-------|
| **Block `parallel` dans EntryPointExecutor** | Moyen | `ExecuteParallelNodeAsync` — lance les children en parallele, attend tous ou premier completion | 34-B |
| **State manager (tool block)** | Moyen | Operations get/set/pause/resume/rewind/inject via session variables + mutex | 34-B |
| **Checkpointing dans EntryPointExecutor** | Moyen | A chaque noeud, verifier `state.status` avant execution (poll si "paused") | 34-B |

### IMPORTANT — Necessaire pour les fonctionnalites cles

| Element | Effort | Description | Phase |
|---------|--------|-------------|-------|
| **Playwright tool blocks** (3 blocs) | Moyen | screenshot, accessibility, interact — scripts Node.js wrapping Playwright | 34-B |
| **Web search tool block** | Faible | Recherche web via SearXNG API ou Playwright scraping | 34-B |
| **Memory tool blocks** (2 blocs) | Faible | read/write dans .maestro/memory/ — simple file I/O | 34-B |
| **Compilation check tool block** | Faible | Auto-detect build command + execute + parse | 34-B |
| **21 blocs specialistes** | Eleve | Agents et inference blocks avec system prompts complets | 34-C |
| **Workflow orchestrateur v4** | Eleve | config.nodes complet avec while, for-each, decision, parallel | 34-C |

### SOUHAITABLE — Pour l'experience complete

| Element | Effort | Description | Phase |
|---------|--------|-------------|-------|
| **Widget protocol dans maestro code** | Moyen | Rendre les widgets (option-select, confirmation, progress, etc.) dans le TUI | 34-D |
| **Interaction-handler (agent composite)** | Eleve | 4 noeuds internes + integration avec state-manager + parallel block | 34-D |
| **Vision model support dans blocks inference** | Faible | S'assurer que les images peuvent etre envoyees au LLM via LLM-Provider | 34-B |
| **Decision block branches multiples** | Faible | Le decision block actuel supporte ifTrue/ifFalse. V4 a besoin de `branches` (multi-way) | 34-B |

---

## Modifications au backend (C#)

### EntryPointExecutor.cs

1. **Ajouter `ExecuteParallelNodeAsync`** :
   ```
   - Detecter le type de noeud "parallel"
   - Lancer tous les children en parallele (Task.WhenAll)
   - L'interaction-handler est un des children
   - Quand le workflow principal termine, canceler l'interaction-handler
   ```

2. **Ajouter la verification de pause** :
   ```
   A chaque debut de noeud:
   - Lire state.status via session variable
   - Si "paused", attendre en polling (1s interval)
   - Si "running", continuer
   ```

3. **Ajouter le support `branches` dans decision** :
   ```
   Actuellement: condition → ifTrue | ifFalse (binaire)
   V4: condition → branches["value1"], branches["value2"], etc. (multi-way)
   ```

### Aucune autre modification C# necessaire

Les tool blocks, agents, et workflows sont des fichiers JSON + prompts. Le backend ne change pas pour les ajouter — c'est le principe "generic infrastructure, specific content".

---

## Modifications au CLI

### Aucune modification structurelle necessaire

Les nouveaux tool blocks s'executent via la commande existante `run <block-id>`. Le CLI n'a pas besoin de nouvelles commandes pour v4.

### Potentielle amelioration

- `maestro code` pourrait afficher les widgets de l'interaction-handler dans le TUI. Cela necessite un polling de `_widgetRequest` et un rendu Ink. → Phase 34-D.

---

## Modifications a maestro code

### Phase 34-D — Widget rendering

1. **Poller `_widgetRequest`** : toutes les 500ms, lire la session variable
2. **Rendre le widget** : selon le type (message, option-select, confirmation, etc.)
3. **Capturer l'input** : pour les widgets interactifs, ecrire dans `_widgetResponse`
4. **Nettoyer** : effacer `_widgetRequest` apres affichage

### Composants Ink a creer

| Composant | Widget type | Description |
|-----------|------------|-------------|
| `WidgetMessage` | message | Affiche un message texte |
| `WidgetOptionSelect` | option-select | Liste de choix avec fleches |
| `WidgetConfirmation` | confirmation | Oui/Non avec description de l'action |
| `WidgetProgress` | progress | Barres de progression par phase |
| `WidgetPlanView` | plan-view | Liste de steps avec statuts |
| `WidgetDiffView` | diff-view | Diff code syntaxe coloree |
| `WidgetTestResults` | test-results | Tableau pass/fail par suite |

---

## Prerequis externes

### Playwright

| Composant | Installation | Verification |
|-----------|-------------|-------------|
| playwright npm package | `npm install playwright` | `npx playwright --version` |
| Chromium browser | `npx playwright install chromium` | `npx playwright install --dry-run` |

Playwright est necessaire pour :
- `playwright-screenshot` (tool block)
- `playwright-accessibility` (tool block)
- `playwright-interact` (tool block)
- `e2e-tester` (agent, utilise les tool blocks ci-dessus)

### SearXNG (optionnel)

Pour le `web-search` tool block, deux options :
1. **SearXNG** (self-hosted) : `docker run -p 8888:8080 searxng/searxng` — API REST sans rate limiting
2. **Playwright scraping** : pas de dependance supplementaire, mais plus lent et fragile

### .maestro/ directory

L'agent v4 cree `.maestro/memory/` dans le projet cible. Cela necessite :
- Permission d'ecriture dans le repertoire du projet
- Le repertoire `.maestro/` devrait etre ajoute au `.gitignore` du projet cible

---

## Matrice de dependance entre sous-phases

```
34-A (Design Spec) ← CETTE PHASE
  |
  ├──> 34-B (Infrastructure)
  |     - Implementer ExecuteParallelNodeAsync
  |     - Creer les 8 tool blocks
  |     - Ajouter le checkpointing (pause polling)
  |     - Ajouter le support decision branches multiples
  |     - Ajouter le vision model support
  |
  ├──> 34-C (Agents + Workflow) — depend de 34-B
  |     - Creer les 21 blocs specialistes (block.json + system-prompt.md)
  |     - Creer le workflow orchestrateur (config.nodes complet)
  |     - Creer le session template v4
  |     - Tester chaque bloc en foundry
  |
  ├──> 34-D (Interaction Handler) — depend de 34-B
  |     - Creer l'interaction-handler (agent composite)
  |     - Implementer les widgets dans maestro code
  |     - Tester les 4 scenarios d'interaction
  |
  ├──> 34-E (Integration + Fitness) — depend de 34-B + 34-C + 34-D
  |     - Integrer tous les composants
  |     - Mesurer le fitness Tier 1
  |     - Comparer avec Claude Code brut sur 5 taches
  |
  └──> 34-F (Degradation) — depend de 34-E
        - Substituer bloc par bloc
        - Mesurer la baisse de fitness par palier de 5%
        - Publier chaque tier avec manifeste
```
