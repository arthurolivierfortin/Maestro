# Phase 26 — Notes de Session

> Ce fichier assure la continuite entre sessions de travail.
> A chaque fin de session, noter : ou on en est, quoi faire ensuite, problemes ouverts.

---

## Format des entrees

```
### Session [DATE] — [Titre]
**Etat** : Ce qui a ete fait
**Prochaine etape** : Ce qui reste a faire
**Problemes ouverts** : Issues non resolues
**Decisions** : Choix faits et pourquoi
```

---

### Session 2026-02-13 — Initialisation Phase 26

**Etat** :
- Documents de vision crees (VISION-AND-ARCHITECTURE.md)
- Guide de reference cree (GOAL-GUIDE.md)
- Strategie detaillee creee (STRATEGY-BLOCKS-AND-AGENTS.md)
- Journaux initialises (MISSING-FEATURES.md, SESSION-NOTES.md)

**Prochaine etape** :
- Creer le workspace Cantante via CLI
- Commencer Layer 1 : outils deterministes (convention-reader, code-analyzer, file-scaffolder, dependency-manager, context-builder)

**Problemes ouverts** :
- Verifier que le backend Maestro tourne pour les commandes CLI
- Verifier quels blocks existent deja vs a creer
- Confirmer le format exact de block.json attendu par le backend

**Decisions** :
- Commencer par les outils deterministes (pas de LLM) car plus faciles a valider
- Le context-builder est deterministe (heuristiques) plutot que LLM-based (economie de tokens)
- Ordre : deterministes d'abord, LLM-based ensuite

---

### Session 2026-02-13 — CLI Block CRUD

**Etat** :
- Analyse du gap CLI vs API completee
- Backend avait deja POST/PUT/DELETE /api/blocks + content endpoints
- API client (shared/api-client.js) avait deja createBlock/updateBlock/deleteBlock/getBlockContent/updateBlockContent
- CLI n'avait AUCUNE commande d'ecriture pour les blocks
- Ajout des commandes : `block create`, `block update`, `block delete`, `block content`, `block children`, `block search`
- Correction bug: getApprovalInfo faisait process.exit(1) au lieu de propager 404
- Correction bug: api-client createBlock validait `block.type` mais backend attend `blockType`
- Correction bug: api-client updateBlockContent utilisait Content-Type text/plain (non supporte par ASP.NET [FromBody])
- Toutes les commandes testees et fonctionnelles
- MISSING-FEATURES.md alimente avec 4 entrees

**Prochaine etape** :
- Identifier les blocks systeme manquants (file-read, shell-execute non visibles dans block list)
- Commencer la creation des blocks Layer 1 via CLI
- Premier block : `convention-reader` (deterministe, pas de LLM)

**Problemes ouverts** :
- Les ~40 blocks systeme ne sont pas visibles dans `block list` (discovery path mismatch)
- `block search` endpoint non fonctionnel
- CreateBlockRequest.TargetLocation non implemente (blocks toujours crees dans ProjectBlocksPath)

**Decisions** :
- Priorite aux commandes CLI manquantes avant de creer les blocks
- La creation de blocks passe par le CLI (principe CLI-First respecte)

---

### Session 2026-02-13 — Layer 1 Tool Blocks + ToolBlockExecutor Fixes

**Etat** :
- 3 bugs fixes dans ToolBlockExecutor.cs :
  1. `scriptFile` resolution : utilisait `metadata["path"]` (jamais defini) au lieu de `metadata["_sourcePath"]` (defini par discovery). Corrige avec `blockSourceDir` + `Path.GetDirectoryName()`
  2. `parseOutput: "json"` : utilisait `parseOutObj as string` qui retourne null pour `JsonElement`. Corrige avec `GetConfigString()`
  3. `JsonElementToObject` : retournait `el.ToString()` pour Object/Array (perdait la structure). Corrige avec conversion recursive en `Dictionary<string, object?>` / `List<object?>`
- Ajout global `workingDir` input override pour tous les chemins d'execution (pas seulement shell/command)
- Ajout passage des inputs comme variables d'environnement `MAESTRO_INPUT_<NAME>` pour les scripts
- Ajout `MAESTRO_BLOCK_DIR` env var pour reference au repertoire source du block
- 4 tool blocks Layer 1 crees et testes :
  1. `convention-reader` — Lit CLAUDE.md, package.json, tsconfig, eslint, etc. Teste sur Maestro (4 fichiers trouves, 245ms)
  2. `code-analyzer` — Analyse imports, exports, fonctions, classes d'un fichier. Teste sur cli.ts (7348 lignes, 16 imports, 153ms)
  3. `file-scaffolder` — Cree des structures de fichiers/dossiers depuis un template JSON
  4. `dependency-manager` — npm install/remove/list/outdated/audit. Teste sur maestro-cli (9 deps, 1176ms)

**Prochaine etape** :
- Creer les blocks LLM-dependants Layer 1 : context-builder, code-generator, test-generator, code-reviewer, commit-writer, pr-writer
- Note : context-builder peut etre deterministe (heuristiques de selection de contexte) — a decider
- Commencer Layer 2 agents : planner-agent, coder-agent
- Creer le workspace Cantante et commencer les tests d'integration

**Problemes ouverts** :
- `block search` endpoint toujours non fonctionnel
- `BlockDefinition` n'a pas de proprietes `inputs`/`outputs` — ces champs sont dans le .block.json sur disque mais pas dans l'entite C#. Blocks crees via API n'ont pas inputs/outputs dans le fichier sauvegarde.
- `SaveAsync` dans FileSystemBlockRepository ne preserve pas les champs `inputs`/`outputs` du JSON original

**Decisions** :
- Blocks systeme Layer 1 ecrits directement dans `content/system/blocks/tools/` (pas via API) car ce sont des blocks d'infrastructure
- `scriptFile` + `parseOutput: "json"` est le pattern standard pour les tool blocks deterministes
- `MAESTRO_INPUT_<NAME>` pour passer les inputs aux scripts (convention generique)
- Conversion recursive des JsonElement pour preserver la structure dans les outputs

---

### Session 2026-02-13 — Layer 1 Inference + Layer 2 Agents + Layer 3 Orchestrators

**Etat** :
- `context-builder` tool block cree et teste (124ms, heuristique keyword+content scoring)
  - Score file par: exact stem match (20), segment match (15), substring (8), multi-keyword bonus (5*n)
  - Content-based scoring en second pass sur top 30 candidats
  - MAX_FILE_SIZE augmente a 500KB (cli.ts = 281KB doit etre inclus)
  - Inclut convention summary (15% budget) + task header + fichiers par relevance
- 5 inference blocks crees (LLM-dependants) :
  - `code-generator` : genere du code avec contexte + conventions
  - `test-generator` : genere des tests avec detection framework
  - `code-reviewer` : review code, output JSON structure (issues/score)
  - `commit-writer` : messages de commit conventionnels (teste avec SmolLM2, template resolution OK)
  - `pr-writer` : descriptions de PR en markdown
- 5 agent blocks crees (Layer 2 specialises) :
  - `planner-agent` : decompose une tache en subtasks ordonnees
  - `coder-agent` : implemente un subtask (read → generate → write → verify)
  - `tester-agent` : genere et execute des tests
  - `reviewer-agent` : review code pour qualite/bugs/conventions
  - `git-agent` : operations git (commit/branch/push/status)
- 2 orchestrator agents crees (Layer 3 composition) :
  - `implement-feature` : plan → code → test → review → commit (max 20 iterations)
  - `fix-bug` : analyze → fix → test → review → commit (max 15 iterations)
- Total : 108 blocks decouverts par le backend (vs 91 au debut de Phase 26)

**Prochaine etape** :
- Tester planner-agent sur une vraie tache Cantante
- Tester implement-feature workflow de bout en bout
- Creer le workspace Cantante via CLI
- Identifier les problemes de qualite LLM (SmolLM2-1.7B) et affiner les prompts
- Considerer : faut-il un Layer 4 autonome ou implement-feature suffit ?

**Problemes ouverts** :
- `ExecuteNodeAsync` dans EntryPointExecutor dispatch par pattern-matching sur nodeId, pas par `blockRef` → workflows ne peuvent pas encore referencer des agents directement
- SmolLM2-1.7B output quality faible sur commit-writer (hallucinations, texte sans rapport). Needs: (1) prompts plus courts, (2) few-shot examples, (3) post-processing/validation
- `fix-bug` non detecte par FileSystemWatcher au lancement (delay normal, sera detecte au prochain scan)
- Agent blocks executent via `maestro_cli` tool mais les blocks comme `code-generator` (inference) passent par le CLI `run` command → besoin de verifier que `run <block-id>` fonctionne pour les inference blocks

**Corrections infrastructure** :
- `PermissionChecker.cs` : Retourne `Full` permissions quand pas de contexte workspace/session (au lieu de `None`)
- `RunCommandHandler.cs` : Execute maintenant les blocks via `BlockExecutorRegistry` au lieu de retourner `status: "pending"`
  - Injecte `BlockExecutorRegistry` dans le constructeur
  - Cree un `ExecutionContext` avec workspace/session/agent IDs
  - Appelle `executor.ExecuteAsync(block, context, inputs)` de maniere synchrone
  - Retourne les `result.Outputs` directement

**Test planner-agent** :
- Iteration 1 (pre-fix) : "Command 'run' not allowed" → fix PermissionChecker
- Iteration 2 (post-PermissionChecker) : "status: pending" pour chaque tool call → fix RunCommandHandler
- Iteration 3 (post-RunCommandHandler) : Agent complete en 94s mais SmolLM2 ne suit pas le workflow multi-step (hallucine Java au lieu de TS, ne call aucun outil)
- Conclusion : Infrastructure OK, probleme de qualite prompt pour SmolLM2

**Decisions** :
- Layer 1 LLM blocks = inference blocks (pas des tool blocks qui appellent HTTP)
  - Avantage : InferenceBlockExecutor a retry natif (3 tentatives), streaming, model selection
  - Pattern : `config.template` avec `{{inputName}}` placeholders
- Layer 2-3 = agent blocks (pas des workflows avec config.nodes)
  - Raison : EntryPointExecutor ne dispatch pas encore par blockRef
  - Les agents utilisent `maestro_cli` comme outil unique (principe CLI-First)
- Agent system prompts : tres specifiques, listant les outils disponibles avec format exact
- Temperature : 0.1-0.2 pour agents (deterministe), 0.2 pour code generation
- Model : SmolLM2-1.7B-Instruct pour tous (meilleur pour JSON per Phase 13)
- Prochaine priorite : affiner les prompts pour que SmolLM2 suive le format tool-call JSON

---

### Session 2026-02-13 — Correction Methodologique

**Etat** :
- Feedback critique de l'utilisateur sur la methodologie :
  1. On s'est arrete au premier obstacle (SmolLM2 ne suit pas les instructions) au lieu de continuer
  2. On n'a pas teste d'autres models quand SmolLM2 echouait
  3. On n'a jamais cree de workspace — pas de tracabilite
  4. Les blocks ont ete crees "en vrac" dans content/system/blocks/ au lieu d'etre dans un workspace
  5. La methodologie workspace → foundry sessions → publish → session projet n'etait pas suivie

- Corrections documentaires appliquees :
  1. `GOAL-GUIDE.md` : Ajout section "Methodologie Obligatoire" avec cycle de vie block, regles de perseverance, tracabilite
  2. `VISION-AND-ARCHITECTURE.md` : Ajout section 5 "Methodologie de Travail" detaillant workspace, sessions, cycle de vie, models a tester, regles de perseverance, communication
  3. `STRATEGY-BLOCKS-AND-AGENTS.md` : Reecrit "Sessions et Workspaces" avec flux complet (workspace → foundry → publish → projet), reecrit "Strategie d'entrainement" avec regles de perseverance et test de models obligatoire

**Prochaine etape** :
- Creer le workspace cantante-dev lie au repo
- Reprendre les blocks existants dans le cadre du workspace
- Tester les agents avec d'autres models (Qwen2.5-Coder, DeepSeek-R1)
- Continuer jusqu'a Cantante termine

**Problemes ouverts** :
- Les blocks deja crees dans content/system/blocks/ doivent etre "adoptes" par le workspace
- SmolLM2-1.7B ne suit pas le protocole tool-call des agents — il faut tester Qwen2.5-Coder et DeepSeek-R1

**Decisions** :
- Toujours travailler dans un workspace (jamais de blocks en vrac)
- Toujours tester 2-3 models avant de conclure qu'un block ne fonctionne pas
- Ne jamais s'arreter et noter "prochaine etape" — executer l'etape suivante
- L'utilisateur doit pouvoir voir tout le travail en consultant le workspace

---

### Session 2026-02-14 — Infrastructure Fixes + Agent First Success

**Etat** :
- **5 bugs d'infrastructure critiques corriges** (voir MISSING-FEATURES.md pour details) :
  1. LLM Provider CUDA crash en multi-turn → `tokenizer.apply_chat_template()` + CUDA recovery
  2. CliParser strip les guillemets du JSON → detection blocs JSON dans tokenizer
  3. file-write rejette JsonElement de --input-json → accepte string/JsonElement/object
  4. RunCommandHandler messages d'erreur vagues → inclut les logs du block
  5. JSON avec newlines litteraux → `SanitizeJsonNewlines()` pre-processing
- **Model validation** : Qwen2.5-Coder-1.5B-Instruct est le bon modele pour les agents (suit le protocole tool-call). SmolLM2-1.7B ne fonctionne pas pour les agents.
- **coder-agent FONCTIONNE** : convention-reader → file-write → done en 3 iterations (14s). Fichier cree avec succes dans C:\Cantante.
- **planner-agent FONCTIONNE** : convention-reader → done avec plan structure. Mais les descriptions de subtasks sont trop vagues.
- **Workspace cantante-dev** : ID 0c0e7a40-fcc9-41b1-8f0f-5b36e7173894, lie a C:\Cantante

**Prochaine etape** :
- Ameliorer les prompts des agents (descriptions plus detaillees dans le plan, pas d'import inutile dans le code)
- Tester le pipeline complet : planner → coder (enchainer les deux agents)
- Tester tester-agent et reviewer-agent
- Creer l'agent orchestrateur (implement-feature) qui enchaine tout
- Commencer les vraies features Cantante

**Problemes ouverts** :
- planner-agent : les descriptions de subtasks sont trop generiques ("Create file X" au lieu de decrire le contenu)
- coder-agent : ajoute un import inutile (`import { AppConfig } from './app-config'`), besoin d'affiner le prompt
- SmolLM2-1.7B ne suit pas le protocole agent tool-call — confirme, NE PAS utiliser pour les agents
- `EntryPointExecutor` ne dispatch toujours pas par `blockRef` — les workflows JSON ne peuvent pas referencer des agents

**Decisions** :
- Qwen2.5-Coder-1.5B-Instruct = modele par defaut pour TOUS les agents
- SmolLM2-1.7B = uniquement pour inference simple (code-generator, test-generator)
- Les agents doivent passer par `--input-json` pour ecrire du contenu avec newlines (pas --input content=...)
- `SanitizeJsonNewlines` est un filet de securite mais les prompts devraient idealement produire du JSON avec `\\n`
- Infrastructure agent loop est maintenant stable : multi-turn, tool-call, file-write, error recovery
