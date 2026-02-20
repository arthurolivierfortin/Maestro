# Phase 35-PRE : Analyse architecturale — Le modele d'agent Maestro

**Date** : 2026-02-20
**Contexte** : Retour d'experience Phase 34-E, feedback utilisateur sur les suggestions de correction
**Objectif** : Definir l'architecture d'agent qui respecte la philosophie Maestro tout en rendant l'execution fiable

---

## 1. Le probleme central, bien diagnostique

Le workflow v4 `autonomous-development` echoue a ecrire des fichiers. Le diagnostic est :

```
LLM genere JSON tool call
    ↓ args.command = "run file-write --input-json {\"path\":\"...\",\"content\":\"...\"}"
    ↓ ← Le contenu est CORRECT ici (System.Text.Json a parse le JSON)
    ↓
ExecuteToolCall() extrait args.command comme STRING
    ↓ ← Le contenu est TOUJOURS correct (c'est un string)
    ↓
CliParser.Parse(command) TOKENISE PAR ESPACES
    ↓ ← *** ICI le contenu est DETRUIT ***
    ↓ espaces dans le code = nouveaux tokens
    ↓ guillemets = confusion delimiteurs
    ↓ newlines = troncature
    ↓
RunCommandHandler recoit des fragments casses
    ↓
file-write recoit "content" incomplet ou manquant
```

Le probleme n'est pas que le JSON est mal parse. Le JSON EST bien parse. Le probleme est que le contenu est **re-serialise en string CLI** puis **re-parse par un tokenizer** qui ne comprend pas le contenu.

---

## 2. Reponse au feedback utilisateur

### 2.1 "Le bloc agent devrait laisser en JSON la sortie — pas la mettre en string"

**Exactement.** Le contenu du fichier est JSON-safe quand il sort de `System.Text.Json`. Le perdre en le serialisant en commande CLI est une erreur d'architecture, pas un bug de parsing.

La correction architecturalement propre est :

**Changer le format de tool call pour que les inputs restent en JSON structuree, pas en string CLI.**

#### Format actuel (casse)

```json
{
  "tool": "maestro_cli",
  "args": {
    "command": "run file-write --input-json {\"path\":\"/x/y.ts\",\"content\":\"export interface...\"}"
  }
}
```

`args.command` est un **string**. Le contenu du fichier est aplati DANS le string. Pour l'extraire, il faut re-parser le string (CliParser) → casse.

#### Format corrige (JSON bout en bout)

```json
{
  "tool": "file-write",
  "args": {
    "path": "/x/y.ts",
    "content": "export interface User {\n  id: string;\n  email: string;\n}"
  }
}
```

`args.path` et `args.content` sont des **proprietes JSON**. `System.Text.Json` les parse correctement. Les newlines sont de vrais `\n`, les guillemets sont de vrais `"`. Aucun re-parsing necessaire.

#### Comment implementer sans violer la philosophie

Le changement est dans `AgentBlockExecutor.ExecuteToolCall()` (lignes 501-557). Actuellement :

```
si tool == "maestro_cli" → extraire command string → CliParser → RunCommandHandler → bloc
si tool == "done" → terminer
sinon → erreur
```

Propose :

```
si tool == "step-complete" → terminer la boucle agentique
si tool == "maestro_cli" → chemin existant (pour backward compat temporaire)
sinon → tool = block-id, args = inputs JSON → appeler le bloc directement
```

Le "sinon" est le nouveau chemin : l'executor traite tout nom de tool inconnu comme un **block-id** et passe les `args` comme inputs JSON au bloc, via le `IBlockExecutorRegistry` existant. C'est du plumbing mecanique — l'executor ne sait pas QUEL bloc est appele, il dispatch generiquement.

```csharp
// Pseudo-code dans ExecuteToolCall()
if (toolId == "step-complete") { /* terminaison */ }
else if (toolId == "maestro_cli" || toolId == "maestro-cli") { /* existant */ }
else
{
    // Nouveau chemin : tool name = block-id, args = inputs JSON
    var inputs = new Dictionary<string, object>();
    foreach (var prop in args.EnumerateObject())
    {
        inputs[prop.Name] = DeserializeJsonElement(prop.Value);
    }
    var result = await _blockExecutorRegistry.ExecuteAsync(toolId, inputs, context, ct);
    return result.Success
        ? (result.Outputs.TryGetValue("result", out var r) ? r.ToString() : "Success")
        : $"Error: {result.Logs.LastOrDefault()}";
}
```

**Pourquoi ca ne viole pas la philosophie** :

| Regle | Respect |
|-------|---------|
| Executor = plumbing mecanique | Oui — il dispatch par nom de bloc, ne sait pas quoi est ecrit |
| Everything is a block | Oui — file-write, file-read, shell-execute sont des blocs existants |
| Tools decrits dans le prompt | Oui — le system prompt du bloc definit quels tools sont disponibles |
| Pas de contenu dans le code C# | Oui — aucun nom de bloc hardcode, dispatch generique |
| CLI-first | Le CLI reste utilisable par les humains. Les agents ont un chemin optimise |

**Ce qui change dans le system prompt** :

```markdown
## Available tools

You call tools by outputting a JSON object as your ENTIRE response:

- **Read file**: `{"tool":"file-read","args":{"path":"/absolute/path"}}`
- **Write file**: `{"tool":"file-write","args":{"path":"/absolute/path","content":"file content here"}}`
- **List directory**: `{"tool":"directory-list","args":{"path":"/absolute/path"}}`
- **Run shell**: `{"tool":"shell-execute","args":{"command":"npm install express"}}`
- **Run any block**: `{"tool":"<block-id>","args":{"input1":"value1","input2":"value2"}}`
- **Finish**: `{"tool":"step-complete","args":{"summary":"what was accomplished"}}`
```

Plus propre, plus simple, et surtout : le contenu reste en JSON.

#### Bloc ou pas bloc pour file-write ?

Question legitime : est-ce que `file-write` doit etre un bloc ou une operation I/O directe ?

**Reponse : Bloc.** `file-write` est deja un tool block existant dans `content/system/blocks/tools/`. Le nouveau chemin dispatch vers ce bloc exactement comme l'ancien chemin le faisait, mais sans passer par le CLI parser. Le bloc `file-write` recoit ses inputs en JSON (propre) au lieu de recevoir des fragments de string CLI (casse).

Si demain on veut ajouter de la validation (permission check, path sanitization, git tracking), on modifie le bloc — pas l'executor.

---

### 2.2 "Fix B + C plutot que fallback intelligent — le fallback est specifique au provider"

**D'accord.** Un fallback qui reconnait des noms specifiques est du contenu dans l'executor — violation claire.

**Mise a jour** : Suite au feedback, le tool de terminaison est renomme de `done` a `step-complete`. C'est le nom que les agents essayaient DEJA naturellement — on travaille avec le modele au lieu de contre lui. "step-complete" est aussi semantiquement plus precis : l'agent complete un step dans un pipeline plus large.

#### Fix B : Exemples negatifs dans le system prompt

Ajouter au `system-prompt.md` de chaque bloc agent :

```markdown
## CRITICAL — Finishing your work

When you have completed your work, your response MUST be:
{"tool":"step-complete","args":{"summary":"description of what was accomplished"}}

These tool names DO NOT EXIST — never use them:
- `done` — DOES NOT EXIST
- `output` — DOES NOT EXIST
- `complete` — DOES NOT EXIST
- `log-result` — DOES NOT EXIST
- `finish` — DOES NOT EXIST

If you use any of these, the system will report an error and waste an iteration.
```

#### Fix C : Simplifier le format step-complete

Le format actuel demande un JSON dans un JSON :

```json
{"tool":"step-complete","args":{"summary":"{\"stepId\":1,\"action\":\"create\",\"target\":\"...\",\"success\":true}"}}
```

Le `summary` est un **string qui contient du JSON**. L'agent doit encoder du JSON dans du JSON. C'est une source d'erreurs.

Format simplifie :

```json
{"tool":"step-complete","args":{"stepId":1,"success":true,"target":"src/types.ts","notes":"Created file"}}
```

Les args sont des proprietes JSON directes. L'executor les serialise si besoin pour le `result.Outputs["result"]`.

#### Mais : un guard minimal dans l'executor reste necessaire

Meme avec un prompt parfait, les LLM hallucinent. Si l'agent appelle un bloc qui n'existe pas, l'executor actuel leve une exception et le step echoue completement. On perd toutes les iterations precedentes.

Proposition minimale (pas un fallback, mais de l'error handling) :

```csharp
// Si le bloc n'existe pas dans le registry
if (!_blockRegistry.Exists(toolId))
{
    return $"Error: Tool '{toolId}' does not exist. Available tools: file-read, file-write, directory-list, shell-execute, step-complete. To finish, use: {{\"tool\":\"step-complete\",\"args\":{{...}}}}";
}
```

Ce n'est pas un fallback (on ne DEVINE pas ce que l'agent voulait). C'est un message d'erreur informatif qui renvoie l'agent vers les bons outils. C'est ce que fait un terminal quand vous tapez une commande inexistante.

---

### 2.3 "L'agent orchestrateur devrait decider des etapes — pas un workflow rigide"

C'est le point le plus strategique. Reformulons le probleme :

**Le workflow v4 `autonomous-development` est un plan d'execution FIXE** :

```
prepare → plan → validate-plan → for-each(implement → validate → test → review → commit)
```

Chaque tache passe par les 7 phases, meme si c'est un one-liner. C'est l'inverse de la philosophie Maestro : un petit LLM avec le BON contexte bat un gros LLM. Ici, on force un gros pipeline sur toutes les taches.

#### Le modele propose : Agent orchestrateur intelligent

```
                    ┌─────────────────────┐
                    │  Orchestrateur      │
                    │  (agent, sonnet)    │
                    │                     │
                    │  Decide:            │
                    │  - Simple → direct  │
                    │  - Complexe → plan  │
                    │  - Frontend → agent │
                    │  - Backend → agent  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐  ┌─────▼──────┐  ┌──────▼────────┐
     │ Directement   │  │ Planifier  │  │ Deleguer      │
     │ (tool calls)  │  │ (planner)  │  │ (sub-agent)   │
     │               │  │ puis impl. │  │               │
     └───────────────┘  └────────────┘  └───────────────┘
```

L'orchestrateur est un **agent** (pas un workflow) qui a acces a :

1. **Tools I/O** : file-read, file-write, directory-list, shell-execute
2. **Tools de validation** : step-validator, code-reviewer, test-executor (blocs existants)
3. **Tools de planification** : task-planner (bloc existant)
4. **Sub-agents** : agents specialises (frontend, backend, etc.) qu'il peut invoquer comme des blocs
5. **Memoire** : acces a des connaissances persistantes du projet

Pour une tache simple ("ajouter une fonction formatDate") :
- L'orchestrateur lit le fichier cible, ecrit la fonction, verifie le build. 3 tool calls. Pas de plan.

Pour une tache complexe ("implementer un systeme d'auth JWT") :
- L'orchestrateur appelle le planner pour decomposer en steps
- Pour chaque step, il decide : est-ce que je le fais moi-meme ou je delegue ?
- Il peut appeler le code-reviewer a la fin pour valider

Pour une tache inconnue :
- L'orchestrateur explore d'abord (file-read, directory-list) puis decide de l'approche

#### Pourquoi c'est meilleur que le workflow rigide

| Workflow rigide | Orchestrateur intelligent |
|----------------|--------------------------|
| 7 phases obligatoires | L'agent decide du nombre d'etapes |
| ~100-170 appels LLM | 3-30 appels selon la complexite |
| $10-15 par tache | $0.50-3 par tache |
| Un seul modele d'execution | Adaptatif par tache |
| Pas de raccourci possible | Tache simple = execution directe |
| for-each sequentiel | Peut paralleliser si necessaire (futur) |

#### Pourquoi c'est mieux que Claude CLI natif

Le user a dit : "meilleur que Claude CLI pas parce qu'il a plein de steps internes mais parce qu'on lui donne des outils et quelques steps de validation."

Exactement. Les avantages de l'orchestrateur Maestro sur Claude CLI natif :

1. **Outils de validation a la demande** : L'orchestrateur PEUT appeler code-reviewer, test-executor, step-validator — mais seulement quand il juge ca necessaire. Claude CLI n'a rien de tout ca.

2. **Memoire projet** : L'orchestrateur a acces aux connaissances persistantes du projet (conventions, patterns, decisions architecturales). Claude CLI repart de zero a chaque invocation.

3. **Multi-modele** : L'orchestrateur (sonnet) peut deleguer a un sub-agent (haiku) pour des taches simples, ou a un reviewer (opus) pour du feedback de qualite. Claude CLI est mono-modele.

4. **Specialisation des sub-agents** : Un agent "frontend" connait React, les patterns CSS, les composants existants. Un agent "backend" connait l'API, les middlewares, la base de donnees. Claude CLI est generaliste.

5. **Observabilite** : Chaque tool call est trace dans le monitor TUI. L'utilisateur voit en temps reel ce que fait l'agent, peut interrompre, peut reprendre. Claude CLI est une boite noire.

6. **Cout controle** : L'orchestrateur peut decider de faire simple quand c'est simple. Claude CLI utilise toujours le meme modele au meme cout.

#### Ce que Claude CLI fait mieux aujourd'hui

Soyons honnetes :

1. **Acces direct au filesystem** : Claude CLI ecrit des fichiers nativement. Maestro passe par une chaine de blocks.
2. **Zero overhead** : 1 appel = 1 resultat. Pas de LLM-Provider, pas de CliParser, pas de RunCommandHandler.
3. **Contexte complet** : Claude CLI voit tout le projet en un seul contexte window. Maestro decoupe et potentiellement perd des informations.

Le point 1 est resolu par le nouveau format tool call (section 2.1). Le point 2 est un trade-off : l'overhead Maestro achete de l'observabilite et de la composabilite. Le point 3 est resolu par le context block + memory (Phase 35).

---

## 3. Architecture proposee pour le nouvel agent

### 3.1 L'agent orchestrateur

Un **bloc agent composite** (`isAtomic: false`). Comme un workflow, son implementation interne est une boite noire definie par ses `config.nodes`. De l'exterieur, il a la meme interface qu'un inference block : prompt in → response out. Mais a l'interieur, il peut contenir n'importe quoi — 0, 1 ou N blocs inference, des tools, des validators, d'autres agents.

```json
{
  "id": "dev-orchestrator",
  "type": "agent",
  "metadata": {
    "name": "Development Orchestrator",
    "description": "Intelligent orchestrator for development tasks",
    "designation": "agent",
    "model": "claude-sonnet-4-6"
  },
  "config": {
    "maxIterations": 30,
    "wallClockTimeout": 600,
    "systemPromptFile": "system-prompt.md",
    "nodes": [
      {
        "id": "reasoning",
        "blockRef": "inference",
        "config": { "model": "claude-sonnet-4-6" }
      }
    ]
  }
}
```

L'`AgentBlockExecutor` orchestre les noeuds enfants definis dans `config.nodes`. L'executor est du plumbing mecanique — il ne sait pas ce que contiennent les enfants. Toute l'intelligence est dans le system prompt et la composition des enfants.

Le system prompt definit :
- Les outils disponibles (file ops, shell, validation blocks, sub-agents)
- Les strategies selon la complexite de la tache
- Les regles de delegation
- Le format de terminaison (`step-complete`)

**Dette technique** : L'`AgentBlockExecutor` actuel appelle `_llmGateway.SendAsync()` directement et hardcode la boucle agentique en C#. L'agent n'est pas encore un vrai bloc composite — son implementation est prescrite par le code C#, pas par ses `config.nodes`. Correction planifiee dans Phase 35-PRE (voir plan).

### 3.2 Tools disponibles pour l'orchestrateur

```markdown
## Your tools

### Direct I/O
- file-read, file-write, directory-list, shell-execute

### Validation (use when you need quality assurance)
- step-validator: verify an implementation step produced expected results
- code-reviewer: get structured quality feedback (score, issues, suggestions)
- test-executor: run tests and get results

### Planning (use for complex tasks only)
- task-planner: decompose a large task into atomic steps

### Delegation (use when specialized knowledge helps)
- implement-frontend: specialized for React/CSS/UI implementation
- implement-backend: specialized for API/DB/middleware implementation
- git-committer: stage and commit changes

### Memory
- project-memory: read/write persistent project knowledge
```

### 3.3 Exemple de decision de l'orchestrateur

**Tache simple** : "Add a formatDate utility function"
```
1. {"tool":"file-read","args":{"path":"src/utils/"}}           → voir la structure
2. {"tool":"file-write","args":{"path":"src/utils/formatDate.ts","content":"..."}} → ecrire
3. {"tool":"step-complete","args":{"summary":"Created formatDate utility"}}
```
3 appels. ~$0.05.

**Tache moyenne** : "Add user CRUD with forms and API"
```
1. {"tool":"file-read","args":{"path":"src/"}}                  → structure
2. {"tool":"file-read","args":{"path":"src/App.tsx"}}            → conventions
3-8. {"tool":"file-write","args":{...}}                          → ecrire les fichiers
9. {"tool":"shell-execute","args":{"command":"npm run build"}}   → verifier
10. {"tool":"code-reviewer","args":{"implementedSteps":[...]}}   → review
11. {"tool":"git-committer","args":{...}}                        → commit
12. {"tool":"step-complete","args":{...}}
```
12 appels. ~$0.50-1.00.

**Tache complexe** : "Implement full JWT auth system with middleware, routes, tests"
```
1. {"tool":"file-read","args":{"path":"."}}                      → explorer
2-3. Lecture des fichiers existants
4. {"tool":"task-planner","args":{"task":"...","context":"..."}} → planner
5-25. Implementation step by step avec file-write
26. {"tool":"test-executor","args":{...}}                        → tests
27. {"tool":"code-reviewer","args":{...}}                        → review
28-29. Corrections basees sur le review
30. {"tool":"git-committer","args":{...}}                        → commit
```
30 appels. ~$2-5.

**L'orchestrateur DECIDE** combien de structure il a besoin. C'est ca la cle.

### 3.4 Hierarchie de delegation

```
Orchestrateur (sonnet)
  ├── Peut faire directement : file ops, shell, simple edits
  ├── Peut deleguer au planner : decomposition complexe
  ├── Peut deleguer a un sub-agent frontend : composants React, CSS, layouts
  ├── Peut deleguer a un sub-agent backend : API, middleware, DB
  ├── Peut valider via : code-reviewer, test-executor, step-validator
  └── Peut memoriser via : project-memory
```

Chaque sub-agent est un bloc agent avec son propre system prompt specialise. L'orchestrateur l'appelle comme n'importe quel bloc : `{"tool":"implement-frontend","args":{"task":"...","context":"..."}}`.

Le sub-agent recoit un contexte FOCUSE (juste le frontend, pas tout le backend). C'est la philosophie Maestro : specialisation + petit contexte > generaliste + gros contexte.

---

## 4. Plan d'implementation

### Phase 35-PRE-A : Tool call JSON direct (PREREQUIS — debloque tout)

**Changement** : Dans `AgentBlockExecutor.ExecuteToolCall()`, renommer `done` en `step-complete` et ajouter un chemin de dispatch generique pour les noms de tools qui ne sont pas `maestro_cli` ou `step-complete`.

**Fichiers** :
| Fichier | Changement |
|---------|------------|
| `AgentBlockExecutor.cs` | `ExecuteToolCall()` : nouveau `else` pour dispatch bloc generique |
| Aucun autre fichier backend | Le dispatch utilise `IBlockExecutorRegistry` existant |

**Effort** : ~30 lignes C#.

**Validation** : Tester `file-write` avec du contenu multi-ligne + caracteres speciaux.

### Phase 35-PRE-B : Prompt improvements (Fix B + Fix C)

**Changement** : Ameliorer les system prompts des blocs agents existants.

**Fichiers** :
| Fichier | Changement |
|---------|------------|
| `content/system/blocks/agents/implement-single-step/system-prompt.md` | Nouveau format tools + exemples negatifs + `step-complete` |
| `content/system/blocks/agents/*/system-prompt.md` | Meme pattern pour tous les agents |

**Effort** : ~1h de travail prompt.

### Phase 35-PRE-C : Dev orchestrator (NOUVEAU BLOC)

**Changement** : Creer le bloc `dev-orchestrator` avec un system prompt intelligent.

**Fichiers** :
| Fichier | Changement |
|---------|------------|
| `content/system/blocks/agents/dev-orchestrator/dev-orchestrator.block.json` | Config bloc |
| `content/system/blocks/agents/dev-orchestrator/system-prompt.md` | Prompt orchestrateur |

**Effort** : ~2-4h de travail prompt + tests.

### Phase 35-PRE-D : Test & comparaison

**Changement** : Tester l'orchestrateur sur les 5 repos de test et comparer avec Claude CLI.

**Effort** : ~$2-10 en couts LLM.

---

## 5. Ce qui ne change PAS

- **L'executor reste mecanique** : dispatch par tool name, pas de logique metier
- **Everything is a block** : file-write, code-reviewer, sub-agents sont tous des blocs
- **Tools decrits dans le prompt** : le system prompt definit les outils disponibles
- **CLI-first pour les humains** : la CLI reste l'interface humaine. Le chemin JSON direct est pour les agents
- **LLM-Provider isole** : Maestro ne sait pas quel provider sert le modele
- **Phase 35 (Conversation/Context/Memory)** reste valide — l'orchestrateur en beneficiera

---

## 6. Risques et mitigations

| Risque | Probabilite | Mitigation |
|--------|------------|------------|
| L'orchestrateur sur-planifie (appelle toujours le planner) | Moyenne | Prompt explicite : "Pour les taches simples, agis directement" |
| L'orchestrateur sous-planifie (ne planifie jamais) | Basse | Prompt explicite : "Pour les taches > 5 fichiers, planifie d'abord" |
| Les sub-agents ont les memes problemes de tool calling | Basse | Le nouveau format JSON resout le parsing — s'applique a tous les agents |
| Cout plus eleve que Claude CLI | Haute | C'est le trade-off : observabilite + validation + multi-modele coute plus |
| Le dispatch generique permet d'appeler n'importe quel bloc | Moyenne | Permission system dans `CliExecutionContext` — limiter les blocs accessibles |

---

## 7. Vision a long terme

L'orchestrateur est le premier pas vers la vision Maestro V2 :

```
Phase 35-PRE : Agent orchestrateur avec outils + validation + delegation
    ↓
Phase 35 : + Conversation + Context + Memory comme blocs
    ↓
Phase 36 : + Foundry (entrainer/optimiser l'orchestrateur)
    ↓
Phase 37+ : + Multi-modele adaptatif (haiku pour simple, sonnet pour moyen, opus pour review)
    ↓
Vision finale : Reseau d'agents specialises, auto-ameliorant, avec memoire persistante
```

L'orchestrateur intelligent EST la vision Maestro. Pas un workflow rigide avec 7 phases fixes, mais un agent qui sait quand planifier, quand agir, quand deleguer, et quand s'arreter.

---

## 8. Resume des decisions

| Point | Decision |
|-------|----------|
| File-write casse | Dispatch JSON direct vers blocs — pas de CLI string parsing |
| Terminaison agent | Renommer `done` → `step-complete` (nom naturel pour le LLM) + Fix B (exemples negatifs) + Fix C (format simplifie) |
| Agent = bloc composite | L'agent contient des blocs enfants (minimum 1 inference). L'executor orchestre, pas execute |
| Trop de couches | Agent orchestrateur intelligent au lieu de workflow rigide |
| Philosophie | Tout reste conforme : executor mecanique, everything is a block, tools dans le prompt |
| Prochaine etape | Phase 35-PRE-A (dispatch JSON + step-complete) → 35-PRE-B (prompts) → 35-PRE-C (orchestrateur) → 35-PRE-D (test) |
