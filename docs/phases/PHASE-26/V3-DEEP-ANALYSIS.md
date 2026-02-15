# Analyse Approfondie — V3 : Agent Autonome

> Date : 2026-02-14
> Contexte : V1 (Phases 19-22) et V2 (Phases 23-25) terminées. Phase 26 démarrée.

---

## 1. État des Lieux — Ce que V1 + V2 ont construit

### Infrastructure Backend (solide)

| Composant | État | Détail |
|-----------|------|--------|
| **29 API Controllers** | Fonctionnel | Sessions, Blocks, Workflows, Training, Fitness, Foundry, Experiments, Research, Auth, Chat, LLM Provider |
| **6 SignalR Hubs** | Fonctionnel | Sessions, Blocks, Execution, Workspaces, Projects, Terminal (partiel) |
| **70+ services DI** | Fonctionnel | Zero TODO dans Program.cs, tous les paths résolus |
| **10 Block Executors** | Fonctionnel | Agent, Tool, Inference, Composite, Context, Decision, Prompt, Trigger, Validator + Registry |
| **Execution Engine** | Fonctionnel | for-each, while, conditional, phase nodes — data-driven, zero C# hardcodé |
| **LLM Gateway** | Fonctionnel | Dual provider (Local LLM-Provider + Azure OpenAI), streaming, retry |
| **Sécurité** | Fonctionnel | API keys, audit logging, path validation, permission checker |
| **Session Recovery** | Fonctionnel | Zombie session detection, error catalog |

### Infrastructure Frontend (professionnelle)

| Composant | État | Détail |
|-----------|------|--------|
| **32 pages** | Complet | Sessions, Projects, Workflows, Blocks, Training, Foundry, Monitoring, Testing, Chat, Settings |
| **Design System** | Complet | Button, Tabs, Modal, Progress, Badge, Card, StatusIndicator, StateDisplays, Breadcrumb |
| **CSS tokens** | Complet | 100+ variables (colors, spacing, radius, shadows, z-index, transitions, dark theme) |
| **Responsive** | Complet | Auto-fill grids, media queries, max-width containers |
| **Animations** | Complet | page-enter, fadeIn, stagger-children, hover/active states |
| **Session Detail** | Complet | Tabs (overview/execution/logs/metrics), phases stepper, auto-refresh |
| **Loading/Error/Empty states** | Complet | Intégrés dans toutes les pages clés |

### Infrastructure Partagée (unifiée)

| Composant | État | Détail |
|-----------|------|--------|
| **shared/types/** | 9 fichiers | Session, Block, Workspace, Project, LLM, Widget, Page, API Client |
| **shared/theme/** | 5 fichiers | Colors, Brand, Tokens, Terminal — source unique pour CLI + TUI + Frontend |
| **shared/tui/** | 35+ fichiers | Hooks (keyboard, scroll, focus, mouse), Components (Panel, NavBar, StatusBar, Breadcrumb, WidgetRenderer) |
| **shared/data/** | 3 fichiers | Data source resolver, SignalR client avec auto-reconnect |
| **shared/registry/** | 3 fichiers | Page registry (5 pages), Widget registry (13 widgets) |
| **shared/utils/** | 8 fichiers | Status, format, progress, resolve, tree, cli-colors |

### CLI (complet)

- **90+ commandes** couvrant sessions, blocks, projects, workspaces, training, testing, foundry, LLM, docs, catalog, auth, monitor
- **TypeScript migration complète** — cli.ts (7628 lignes), output-formatter.ts, json-parser.ts, shell.ts
- **JSON mode** — `--json` flag pour output structuré
- **Schema command** — `maestro schema` retourne toute la surface CLI en JSON

### Block System

- **95 blocks système** : 16 agents, 20 workflows, 16 tools, 6 inference, 9 strategies, 15+ system, 1 context
- **6 session templates** : foundry-default, foundry-training, foundry-sandbox, compliance-tester, doc-generator, agent-dev
- **Fitness model** : `ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ`
- **9 training strategies** : SFT, RL-Fitness, Preference, Execution-based, Evolutionary, Distillation, Curriculum, Self-play, Neuro-symbolic

---

## 2. Ce que Phase 26 a accompli et identifié

### Blocks créés (17 nouveaux)

**Layer 1 — Tools atomiques (10)** :
- `convention-reader` — Lit conventions du projet (CLAUDE.md, tsconfig, eslint, etc.)
- `code-analyzer` — Analyse imports, exports, fonctions, classes
- `file-scaffolder` — Crée des structures de fichiers depuis un template
- `dependency-manager` — npm install/remove/list/outdated/audit
- `context-builder` — Construit un contexte focalisé par heuristique (keyword + content scoring)
- `code-generator` (inference) — Génère du code avec contexte + conventions
- `test-generator` (inference) — Génère des tests
- `code-reviewer` (inference) — Review code, output JSON (issues/score)
- `commit-writer` (inference) — Messages de commit conventionnels
- `pr-writer` (inference) — Descriptions de PR markdown

**Layer 2 — Agents spécialisés (5)** :
- `planner-agent` — Décompose une tâche en subtasks ordonnées
- `coder-agent` — Implémente un subtask (read → generate → write → verify)
- `tester-agent` — Génère et exécute des tests
- `reviewer-agent` — Review code pour qualité/bugs/conventions
- `git-agent` — Opérations git (commit/branch/push/status)

**Layer 3 — Orchestrateurs (2)** :
- `implement-feature` — plan → code → test → review → commit
- `fix-bug` — analyze → fix → test → review → commit

### Bugs d'infrastructure corrigés (14)

| Bug | Impact | État |
|-----|--------|------|
| CLI block CRUD manquant | Critique | **FIXÉ** |
| Blocks système non visibles (path) | Critique | **FIXÉ** |
| PermissionChecker retourne None sans contexte | Critique | **FIXÉ** |
| RunCommandHandler ne execute pas blocks | Critique | **FIXÉ** |
| LLM Provider CUDA crash multi-turn | Critique | **FIXÉ** |
| CliParser strip guillemets JSON | Critique | **FIXÉ** |
| file-write rejette JsonElement | Critique | **FIXÉ** |
| CLI workspace delete --force | Faible | **FIXÉ** |
| JSON avec newlines littéraux | Moyen | **FIXÉ** |
| RunCommandHandler erreurs vagues | Moyen | **FIXÉ** |
| API block create sans designation | Faible | Contourné |
| Block search non fonctionnel | Moyen | Contourné |
| Workspace create --repo flag | Moyen | Contourné |
| EntryPointExecutor pas de blockRef dispatch | Élevé | Contourné |

### Découverte modèle

| Modèle | Rôle | Verdict |
|--------|------|---------|
| **Qwen2.5-Coder-1.5B-Instruct** | Agents (tool-call protocol) | **LE BON CHOIX** — suit le format tool-call JSON |
| **SmolLM2-1.7B-Instruct** | Inference simple (code-gen, tests) | OK pour tâches simples, ne suit pas le protocole agent |
| **DeepSeek-R1-1.5B** | Raisonnement | À tester |
| **deepseek-coder-1.3b** | — | CUDA error — NE PAS UTILISER |

### Premiers succès

- **coder-agent FONCTIONNE** : convention-reader → file-write → done en 3 itérations (14s)
- **planner-agent FONCTIONNE** : convention-reader → done avec plan structuré
- **Infrastructure agent loop stable** : multi-turn, tool-call, file-write, error recovery
- **Workspace cantante-dev créé** : ID 0c0e7a40, lié à C:\Cantante

---

## 3. Gaps Critiques Identifiés

### 3.1 — Agent Feedback Loop (PARTIELLEMENT MANQUANT)

L'agent loop basique fonctionne (LLM → tool call → execute → feed back), mais :

- **Pas de conversation state management** : chaque appel LLM est indépendant dans `InferenceBlockExecutor`. L'agent `AgentBlockExecutor` a une boucle, mais la mémoire conversationnelle est limitée.
- **Tool discovery statique** : `AgentBlockExecutor` a une liste hardcodée de 5 tools (`file-read`, `file-write`, `shell-execute`, `git-status`, `git-diff`). La découverte dynamique depuis la config du block n'est pas implémentée.
- **Pas de limites de budget** : un agent peut boucler indéfiniment si le LLM ne dit jamais "done".

**Impact** : Les agents fonctionnent pour des tâches simples (1-3 iterations), mais échouent sur des tâches complexes nécessitant 10+ iterations avec mémoire.

### 3.2 — BlockRef Dispatch dans EntryPointExecutor (NON RÉSOLU)

`ExecuteRegularNodeAsync` dans `EntryPointExecutor` dispatch par pattern-matching sur le `nodeId` (contains "generate", "write", etc.), pas par `blockRef` dans `config.nodes`.

**Impact** : Les workflows JSON ne peuvent pas référencer des agents directement. Contournement actuel : les agents sont des orchestrateurs eux-mêmes (agent blocks qui appellent d'autres agents via maestro_cli).

**Ce qui existe** : `ExecuteBlockRefAsync` (ligne 852-958) résout correctement les block IDs via `IBlockDiscoveryService`, mais n'est pas appelé par le chemin `config.nodes` régulier.

### 3.3 — Services Orchestration Stubbed

| Service | État | Impact |
|---------|------|--------|
| `ResearchTeamService` | 6 TODOs, stubs | Pas de coordination multi-agent |
| `OrchestratorService` | 3 TODOs, stubs | Pas de fitness-based orchestration |
| `WorkspaceGateway.PromoteAgent` | TODO | Pas de promotion automatique |

### 3.4 — Terminal Hub Incomplet

`TerminalHub.cs` a des TODOs pour l'input et le resize PTY. Impact : pas de debugging interactif des agents via TUI.

### 3.5 — Qualité des Prompts

Les prompts des agents (Layer 2) produisent :
- Des descriptions de subtasks trop vagues
- Des imports inutiles dans le code généré
- Du code hors-sujet (Java au lieu de TypeScript avec SmolLM2)

**Root cause** : les prompts ne sont pas assez spécifiques pour les petits modèles. Besoin de few-shot examples, format exact, et contraintes explicites.

---

## 4. Stratégie Recommandée pour V3

### Principes directeurs

1. **Réaligner le code avec l'ADR Phase 18 AVANT tout** — l'agent = inference block, pas d'executor séparé
2. **Résoudre les gaps d'infrastructure AVANT de construire plus d'agents** — sinon chaque agent sera limité par les mêmes problèmes
3. **Itérer sur les prompts avec le bon modèle** — Qwen2.5-Coder pour agents, SmolLM2 pour inference simple
4. **Suivre la méthodologie** — Workspace → Foundry sessions → Publish → Project session
5. **Mesurer** — Fitness scores sur chaque block, pas de "ça marche je pense"
6. **Documenter** — SESSION-NOTES.md et MISSING-FEATURES.md à chaque session

### Phase 0 : Refactoring Agent = Inference Block (COMPLÉTÉ)

> **Ce refactoring a été complété le 2026-02-14.** L'architecture violée a été corrigée.

Architecture choisie : **Base class + 2 subclasses thin**.

```
LLMBlockExecutorBase (abstract — plomberie LLM partagée)
├── InferenceBlockExecutor (~120 lignes — single call)
└── AgentBlockExecutor (~310 lignes — boucle agentic, sans contenu hardcodé)
```

| Tâche | Statut | Résultat |
|-------|--------|----------|
| **Créer LLMBlockExecutorBase** | Fait | Mock loading, model resolution, template resolution, output parsing, JSON extraction |
| **Réécrire InferenceBlockExecutor** | Fait | 213 → ~120 lignes, hérite de la base |
| **Réécrire AgentBlockExecutor** | Fait | 652 → ~310 lignes, sans system prompt hardcodé, sans tool list, sans contenu C# |
| **Supprimer les tool lists hardcodées** | Fait | `availableTools` supprimé. `LegacyToolMapping` marqué `[Obsolete]` (compat) |
| **Supprimer tools.json loading** | Fait | `AgentBlockHandler` ne charge plus `tools.json` |
| **Supprimer AgentDefinition et ToolDefinition** | Fait | 396 lignes supprimées. Une seule entité : `BlockDefinition` |
| **System prompt requis, pas de fallback** | Fait | Si `config.systemPrompt` ou `system-prompt.md` absent → erreur |
| **DI simplifié dans Program.cs** | Fait | Registration directe avec IExecutionMonitor |

ADR : `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md`

### Phase A : Infrastructure Complémentaire (après Phase 0)

| Tâche | Effort | Impact | Description |
|-------|--------|--------|-------------|
| **BlockRef dispatch** | 2-3h | Critique | Ajouter un chemin de dispatch par `blockRef` dans `ExecuteRegularNodeAsync`. Quand un node a `blockRef: "some-block-id"`, utiliser `BlockExecutorRegistry` pour exécuter le block. C'est LE gap le plus important — il permet aux workflows JSON de composer des agents. |
| **Conversation state** | 2h | Élevé | Ajouter `conversationHistory` dans l'executor unifié. L'historique complet (messages + tool results) est passé au LLM à chaque tour de boucle agentic. |
| **Agent budget/limits** | 1h | Moyen | Max iterations configurable par block config. Timeout global. Détection de boucle (même outil appelé 3x avec mêmes params). |

### Phase B : Prompts & Fitness (itératif)

| Tâche | Effort | Impact | Description |
|-------|--------|--------|-------------|
| **Prompt engineering agents** | Continu | Critique | Réécrire les system prompts des 5 agents avec : (1) few-shot examples, (2) format exact de sortie, (3) constraints explicites ("TypeScript only", "no unused imports"), (4) format tool-call JSON exact pour Qwen2.5-Coder |
| **Foundry sessions pour chaque agent** | 2h/agent | Élevé | Créer une foundry session par agent, itérer via foundry workflow (create → optimize → validate → publish) |
| **Test blocks via test framework** | 1h/block | Élevé | `test create --block <id>`, `test start <run-id>` — mesurer le fitness réel, pas l'impression |
| **Comparer modèles** | 3h | Élevé | Pour chaque agent : tester Qwen2.5-Coder vs SmolLM2 vs DeepSeek-R1. Documenter les résultats dans SESSION-NOTES. |

### Phase C : Composition & Workflows (après A + B)

| Tâche | Effort | Impact | Description |
|-------|--------|--------|-------------|
| **implement-feature workflow JSON** | 3h | Critique | Avec blockRef dispatch fonctionnel : créer un vrai workflow JSON avec config.nodes qui orchestre planner → coder → tester → reviewer → git. Plus besoin d'agent orchestrateur hardcodé. |
| **fix-bug workflow JSON** | 2h | Élevé | Même pattern que implement-feature |
| **setup-project workflow** | 1h | Moyen | convention-reader → dependency-manager → file-scaffolder → typescript-check |
| **Validation inter-agent** | 2h | Élevé | reviewer-agent vérifie le code de coder-agent. Si score < seuil → retry. Condition dans workflow JSON. |

### Phase D : Agent Autonome (après C)

| Tâche | Effort | Impact | Description |
|-------|--------|--------|-------------|
| **autonomous-developer agent** | 5h | Le but | Prend une tâche en texte libre, orchestre tout : comprendre le projet → planifier → exécuter features → valider → livrer PR |
| **Context management avancé** | 3h | Critique | L'orchestrateur doit gérer le contexte : résumés des résultats intermédiaires, pas le contenu brut. Sliding window du context-builder. |
| **Error recovery** | 2h | Élevé | Si un agent échoue : reformuler la tâche, changer de modèle, retry avec plus de contexte. Pas de fail silencieux. |
| **PR delivery** | 1h | Moyen | git-agent crée une branche, commit les changements, génère la description PR, ouvre la PR via CLI/API |

### Phase E : Cantante (terrain d'épreuve, continu)

| Feature | Difficulté | Agent(s) impliqué(s) |
|---------|------------|---------------------|
| `npm install` + fix package.json | Facile | dependency-manager |
| Fix renderer.ts imports/types | Facile | coder-agent |
| Module file-tree basique | Moyen | implement-feature |
| Module éditeur de code | Élevé | implement-feature |
| Module accessibilité TTS | Élevé | implement-feature |
| Tests unitaires | Moyen | tester-agent |
| Chaque feature = commit propre | — | git-agent |

---

## 5. Ordre d'Exécution Recommandé

```
 0. [REFACTORING]    Fusionner AgentBlockExecutor + InferenceBlockExecutor ← AVANT TOUT
 0b.[REFACTORING]    Supprimer AgentDefinition/ToolDefinition entities     ← Aligner avec ADR
 0c.[REFACTORING]    System prompts dans les blocks, pas dans le C#        ← Contenu ≠ infra
 1. [Infrastructure] BlockRef dispatch dans EntryPointExecutor             ← Débloque workflows
 2. [Infrastructure] Conversation state dans executor unifié               ← Agents intelligents
 3. [Prompts]        Réécrire planner-agent prompt (few-shot, format)      ← Premier agent fiable
 4. [Prompts]        Réécrire coder-agent prompt (TS-only, conventions)    ← Deuxième agent fiable
 5. [Test]           Foundry session pour planner-agent                    ← Mesurer le fitness
 6. [Test]           Foundry session pour coder-agent                      ← Mesurer le fitness
 7. [Cantante]       npm install + fix renderer.ts                         ← Première victoire
 8. [Workflow]       implement-feature workflow JSON                        ← Composition
 9. [Prompts]        tester-agent + reviewer-agent prompts                 ← Pipeline complet
10. [Cantante]       Module file-tree                                      ← Feature réelle
11. [Orchestrator]   autonomous-developer agent                            ← L'objectif final
12. [Cantante]       Module éditeur + TTS                                 ← Validation autonomie
```

---

## 6. Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Petits modèles ne suivent pas les prompts complexes | Élevée | Bloquant | Few-shot examples, format exact, validation post-LLM, retry avec modèle différent |
| Context overflow avec fichiers larges | Moyenne | Élevé | context-builder avec sliding window, résumés intermédiaires, budget tokens par agent |
| Boucle infinie d'agent | Moyenne | Moyen | Max iterations configurables, timeout, détection de boucle |
| BlockRef dispatch casse l'existant | Faible | Élevé | Ajouter le chemin sans casser le pattern-matching existant (fallback) |
| Qualité de code généré insuffisante | Élevée | Moyen | reviewer-agent valide, retry si score bas, few-shot conventions |
| LLM Provider crash (CUDA) | Faible (fixé) | Bloquant | Auto-recovery CUDA déjà implémenté |

---

## 7. Métriques de Succès V3

| Métrique | Cible | Comment mesurer |
|----------|-------|-----------------|
| **Agents fonctionnels** | 5/5 agents Layer 2 produisent des résultats utilisables | Foundry sessions, fitness > 0.7 |
| **Workflow end-to-end** | implement-feature prend une issue → produit un PR | Test sur Cantante, succès > 50% |
| **Cantante features** | 3+ features livrées par agent | Commits dans le repo Cantante |
| **Autonomous developer** | Prend une description textuelle → PR fonctionnel | Test sur issues Cantante de difficulté croissante |
| **Bugs infrastructure** | 0 bugs critiques bloquants | MISSING-FEATURES.md vide de critiques |
| **Fitness scores** | Tous les blocks Layer 1+ ont un fitness mesurable | test framework + foundry sessions |

---

## 8. Ce qui est BIEN et ne doit PAS changer

1. **Architecture générique** — Tout est un block, pas de logique spécifique dans le C#
2. **CLI-First** — Les agents utilisent `maestro-cli` comme outil unique
3. **Self-describing sessions** — Le comportement est dans les variables JSON
4. **Template-driven** — Nouveau type de session = nouveau JSON, zero C#
5. **Execution engine data-driven** — for-each, while, conditional, phase dans le JSON
6. **Fitness model** — Métriques sur chaque block, pas juste les agents
7. **Workspace tracabilité** — Tout le travail visible dans un workspace
8. **14 bugs fixés** — L'infrastructure agent est maintenant stable
9. **Qwen2.5-Coder validé** — On sait quel modèle utiliser pour les agents

---

## Conclusion

La V3 est dans une position excellente. L'infrastructure est solide (29 controllers, 95 blocks, 90+ CLI commands, 6 SignalR hubs, design system complet). Phase 26 a déjà :
- Créé 17 blocks (tools + agents + orchestrateurs)
- Fixé 14 bugs d'infrastructure
- Validé le modèle agent (Qwen2.5-Coder)
- Prouvé que l'agent loop fonctionne (coder-agent et planner-agent testés)

**Le gap principal est le BlockRef dispatch** — une fois résolu, les workflows JSON peuvent composer des agents, et tout le pipeline se débloque. Ensuite c'est itération de prompts et tests sur Cantante.

L'estimation totale pour arriver à l'agent autonome : **~30-40 heures de travail** réparties sur les 5 phases (A → E).
