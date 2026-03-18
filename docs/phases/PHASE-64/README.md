# Phase 62 : Agents Fonctionnels + Optimisation

**Statut** : A faire
**Prerequis** : Phase 61 COMPLETE (block-forge fiable, contracts valides empiriquement)
**Objectif** : Implementer `_toolMapping` + mock blocks pour que les contract tests puissent verifier le travail reel des agents, resoudre les conflits de providers, condenser le system prompt, creer 2 agents fonctionnels via foundry, et ajouter une live execution view.
**Duree estimee** : 3-4 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire `docs/phases/PHASE-61/contract-validation-results.md`** — donnees empiriques de 61-C
3. **Lire `memory/contract-testing.md`** — design decisions : tout est un block, pas de logique dans AgentBlockExecutor
4. **Ecrire dans `PHASE-62/checkpoint.md`** apres chaque sous-phase
5. **Ne PAS modifier AgentBlockExecutor** pour capturer les tool calls — tout passe par les blocks (tool-dispatcher, mock blocks)
6. **Ne PAS augmenter maxIterations** — si l'agent echoue en 12, le system prompt est le probleme
7. **Utiliser le pipeline Maestro** — foundry sessions, contract tests, publish
8. **Documenter chaque iteration** — model, fitness, cout, diagnostic

---

## Contexte

### Phase 61 a rendu l'infrastructure fiable
- Provider Anthropic direct fonctionnel (cle API dans .env)
- ProviderType collision corrigee (ClaudeCode=8, Anthropic=4)
- maxIterations fixe a 12 (pas 50)
- Loop detection active (warn@3, stop@5)
- Pre-flight bloquant si config invalide
- Couts propagent vers le parent
- Contracts analyses empiriquement (resultats dans `contract-validation-results.md`)

### Le bloqueur identifie en 61-C
Les contract tests pour les agents (agent-creator, test-designer) echouent a 50-56% parce que le ContractTestRunner verifie le resume step-complete, pas le contenu reel que l'agent ecrit via ses tool calls.

**La solution** : `_toolMapping` dans `ToolDispatcherBlockExecutor`. Quand le ContractTestRunner teste un agent, il injecte un mapping qui redirige `file-write` vers `capture-file-write`. L'agent ne sait pas qu'il parle a un mock. Le mock capture le contenu. L'evaluateur verifie le contenu capture.

Ce mecanisme etait planifie en Phase 54 et discute en Phase 53-F. Il est architecturalement coherent : tout est un block, rien ne change dans AgentBlockExecutor.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 62-A | `_toolMapping` + mock blocks (fondation) | 1 jour |
| 62-B | Resolution conflits providers (detection + choix utilisateur) | 0.5 jour |
| 62-C | Condenser system prompt + creer agents via foundry | 1.5-2 jours |
| 62-D | Live execution view dans le TUI | 1 jour |
| 62-T | Tests + validation | 0.5 jour |

**Ordre d'execution** : A → B → C → D → T

62-A est le fondement — sans mock blocks, les contract tests ne peuvent pas verifier les agents. 62-B permet de s'assurer que le bon provider est utilise pour 62-C.

---

## 62-A : `_toolMapping` + Mock Blocks

### Principe architectural

```
Agent pense appeler "file-write"
    |
    v
response-parser extrait {toolId: "file-write", args: {path: "x.json", content: "{...}"}}
    |
    v
tool-dispatcher recoit toolId="file-write"
    |  <-- _toolMapping = {"file-write": "capture-file-write"}
    |  tool-dispatcher resout "capture-file-write" au lieu de "file-write"
    v
capture-file-write (mock block) :
    - Enregistre {toolId: "file-write", path, content} dans _capturedToolCalls (variable session)
    - Retourne "File written successfully" (l'agent pense que c'est fait)
    |
    v
L'agent continue ses iterations normalement
    |
    v
step-complete → l'evaluateur lit _capturedToolCalls
    → Verifie que le JSON ecrit est valide
    → Verifie que les champs requis sont presents
    → Calcule le fitness
```

### Tache 1 : Ajouter `_toolMapping` dans ToolDispatcherBlockExecutor

Dans `ToolDispatcherBlockExecutor.ExecuteAsync()`, APRES `NormalizeToolId()` et AVANT la resolution du block :

```csharp
// Check for tool mapping in execution context (Phase 62-A)
// Allows contract tests and sandboxed execution to redirect tools to mock blocks.
// The agent doesn't know it's talking to a mock — same interface, different implementation.
if (context.Variables.TryGetValue("_toolMapping", out var mappingObj) && mappingObj != null)
{
    var mappedId = ResolveMappedToolId(mappingObj, toolId);
    if (mappedId != null)
    {
        result.Logs.Add($"Tool '{toolId}' mapped to '{mappedId}' via _toolMapping");
        toolId = mappedId;
    }
}
```

`ResolveMappedToolId` parse le mapping (JSON object ou Dictionary) et retourne le block ID mappe, ou null si pas de mapping pour ce toolId.

### Tache 2 : Creer les mock blocks

Chaque mock block est un **vrai block** : un `block.json` + son propre executor C# dedie. Pas un type generique — chaque block a un comportement specifique adapte au tool qu'il mock. L'utilisateur peut les inspecter dans le catalogue, les modifier, ou creer les siens.

Creer dans `content/system/blocks/tools/` :

#### `capture-file-write`
- **block.json** : `capture-file-write.tool.block.json`
- **Executor** : `CaptureFileWriteBlockExecutor.cs` (implements `IBlockExecutor`, `SupportedType = "capture-file-write"`)
- **Inputs** : `path`, `content` (memes inputs que `file-write`)
- **Comportement** :
  - Enregistre `{toolId: "file-write", path, content, timestamp}` dans la variable session `_capturedToolCalls` (append a une liste JSON)
  - Retourne un message realiste : `"File written to {path} (247 bytes)"`
- **Pourquoi un block dedie** : le message de retour simule la reponse reelle de file-write, ce qui evite de confondre l'agent

#### `capture-file-read`
- **block.json** : `capture-file-read.tool.block.json`
- **Executor** : `CaptureFileReadBlockExecutor.cs`
- **Inputs** : `path`
- **Comportement** :
  - Cherche dans `_capturedToolCalls` si un write precedent a ecrit a ce path → retourne le contenu capture
  - Sinon, delegue au vrai `file-read` (lecture reelle du disque) — les agents ont souvent besoin de lire des fichiers existants (contracts, blocks existants)
- **Pourquoi un block dedie** : le read-after-write est un pattern fondamental des agents (ecrire un fichier puis le relire pour verifier). Le mock doit gerer ce cas specifiquement.

#### `capture-shell-execute`
- **block.json** : `capture-shell-execute.tool.block.json`
- **Executor** : `CaptureShellExecuteBlockExecutor.cs`
- **Inputs** : `command`, `workingDir` (memes inputs que `shell-execute`)
- **Comportement** : Enregistre la commande dans `_capturedToolCalls`, retourne un output simule
- **Output** : `"$ {command}\n(captured — not executed)"`
- **Pourquoi un block dedie** : l'output simule le format d'un terminal, l'agent peut parser le resultat comme il le ferait normalement

#### `capture-file-edit`
- **block.json** : `capture-file-edit.tool.block.json`
- **Executor** : `CaptureFileEditBlockExecutor.cs`
- **Inputs** : `path`, `old_string`, `new_string` (memes inputs que `file-edit`)
- **Comportement** :
  - Si un write precedent existe dans `_capturedToolCalls` pour ce path : applique le remplacement sur le contenu capture
  - Sinon : enregistre l'edit tel quel dans `_capturedToolCalls`
- **Output** : `"File edited: {path} (replacement applied)"`

### Extensibilite

L'utilisateur peut creer ses propres mock blocks pour n'importe quel tool :
- Un `sandbox-shell-execute` qui execute dans un container Docker
- Un `log-file-write` qui ecrit reellement ET capture
- Un `dry-run-file-write` qui valide le contenu sans ecrire

Il suffit de creer le block.json + executor et de configurer `_toolMapping`. Aucune modification du moteur.

### Tache 3 : Configurer le ContractTestRunner pour utiliser `_toolMapping`

Dans `ContractTestRunner.SendPromptToBlockAsync()`, quand on cree le `ExecutionContext` pour tester un agent :

```csharp
// Inject tool mapping for agent testing — capture tool calls instead of executing them
context.Variables["_toolMapping"] = JsonSerializer.Serialize(new Dictionary<string, string>
{
    ["file-write"] = "capture-file-write",
    ["file-read"] = "capture-file-read",
    ["shell-execute"] = "capture-shell-execute"
});
```

### Tache 4 : Mettre a jour le check type `tool-call`

Le check `tool-call` dans ContractTestRunner doit aussi lire `_capturedToolCalls` :

```csharp
case "tool-call":
{
    var toolName = check.GetProperty("toolName").GetString() ?? "";
    var passed = response.Contains(toolName, StringComparison.OrdinalIgnoreCase);

    // Check in captured tool calls (from mock blocks via _toolMapping)
    if (!passed && blockOutputs != null &&
        blockOutputs.TryGetValue("_capturedToolCalls", out var captured))
    {
        passed = captured?.ToString()?.Contains(toolName, StringComparison.OrdinalIgnoreCase) ?? false;
    }

    // Original: check _toolCalls
    if (!passed && blockOutputs != null &&
        blockOutputs.TryGetValue("_toolCalls", out var tc))
    {
        passed = tc?.ToString()?.Contains(toolName, StringComparison.OrdinalIgnoreCase) ?? false;
    }

    // Check requiredArgs in captured tool calls if specified
    // ...
}
```

### Tache 5 : Ajouter un check type `captured-content`

Nouveau check type pour verifier le contenu capture par les mock blocks :

```json
{
  "type": "captured-content",
  "toolName": "file-write",
  "pathContains": "block.json",
  "contentCheck": "json-parseable"
}
```

Ce check :
1. Cherche dans `_capturedToolCalls` un appel a `file-write` dont le `path` contient "block.json"
2. Extrait le `content` de cet appel
3. Applique le check `json-parseable` (ou `contains`, `contains-all`, etc.) sur le contenu

Ceci permet de verifier que l'agent a ecrit un JSON valide sans modifier l'agent.

### Verification 62-A

- [ ] `_toolMapping` fonctionne : tool-dispatcher redirige vers le mock block
- [ ] `capture-file-write` capture les appels et retourne un succes simule
- [ ] `capture-file-read` retourne le contenu capture si un write precedent existe
- [ ] ContractTestRunner injecte `_toolMapping` pour les agents
- [ ] Le check `tool-call` lit `_capturedToolCalls`
- [ ] Le check `captured-content` verifie le contenu des fichiers captures
- [ ] `dotnet build` : 0 erreurs
- [ ] Tests unitaires pour chaque mock block
- [ ] Tests unitaires pour `_toolMapping` dans tool-dispatcher

---

## 62-B : Resolution Conflits Providers

### Probleme

Quand plusieurs providers supportent le meme modele (ex: ClaudeCode et Anthropic supportent tous les deux `claude-sonnet-4-6`), le systeme doit :
1. **Detecter** le conflit au demarrage ou quand un provider devient disponible
2. **Informer** l'utilisateur qu'il y a un conflit
3. **Demander** quel provider il prefere pour chaque modele en conflit
4. **Sauvegarder** la preference (persistee dans la config)
5. **Permettre** de changer la preference a tout moment

### Implementation

#### Backend (LLM-Provider)

1. **Detection des conflits** dans `LLMProviderFactory` :
   - Apres enregistrement de tous les providers, scanner `GetAvailableModelsAsync` pour chaque provider
   - Si un modelId apparait dans 2+ providers → conflit
   - Stocker les conflits dans une structure accessible via API

2. **API endpoint** : `GET /api/v1/providers/conflicts`
   ```json
   {
     "conflicts": [
       {
         "modelId": "claude-sonnet-4-6",
         "providers": ["Anthropic", "ClaudeCode"],
         "preferred": "Anthropic",
         "reason": "user-configured"
       }
     ]
   }
   ```

3. **API endpoint** : `PUT /api/v1/providers/priority`
   ```json
   { "modelId": "claude-sonnet-4-6", "preferredProvider": "Anthropic" }
   ```

4. **Config persistee** : `Providers:Priority` dans appsettings ou .env
   ```json
   {
     "Providers": {
       "Priority": {
         "claude-sonnet-4-6": "Anthropic",
         "claude-haiku-4-5-20251001": "Anthropic"
       }
     }
   }
   ```

5. **`GetProviderForModelAsync`** verifie d'abord la preference :
   ```csharp
   // Check configured priority first
   if (_priorityConfig.TryGetValue(modelId, out var preferredType))
   {
       var preferred = availableProviders.FirstOrDefault(p => p.ProviderType == preferredType);
       if (preferred != null) return preferred;
   }
   // Fallback: first available
   ```

#### TUI (maestro-code)

- Au setup ou quand un conflit est detecte, afficher un choix :
  ```
  Multiple providers support claude-sonnet-4-6:
    > Anthropic (direct API, ~2s/call, $3/$15 per MTok)
      ClaudeCode (CLI wrapper, ~8s/call, subscription)

  [j/k] Navigate  [Enter] Select
  ```
- Page Models : montrer le provider actif pour chaque modele, permettre de changer

### Verification 62-B

- [ ] Conflits detectes au demarrage
- [ ] API `GET /api/v1/providers/conflicts` retourne les conflits
- [ ] API `PUT /api/v1/providers/priority` sauvegarde la preference
- [ ] `GetProviderForModelAsync` utilise la preference configuree
- [ ] L'utilisateur peut changer la preference (TUI ou config)

---

## 62-C : Condenser System Prompt + Creer Agents via Foundry

### Prerequis

- 62-A DONE (mock blocks fonctionnels → contract tests fiables)
- 62-B DONE (provider Anthropic direct utilise → tests rapides)

### Etape 1 : Condenser le system prompt

Reduire de 994 → ~400-500 lignes. Strategie guidee par les donnees de 61-C.

**Garder** :
- Role et objectif (~20L)
- Tools JSON schema (obligatoire pour tool-calling, ~80L)
- step-complete format et champs requis (~20L)
- Iteration budget et strategie (~10L)
- Un exemple minimal de block.json (~30L)

**Condenser** :
- Anatomy of block.json → schema annote
- System prompt writing rules → 3 regles essentielles

**Retirer** :
- Exemples de block.json complets (sauf 1 court)
- Anti-patterns detailles
- Model tier guidelines
- Documentation des champs optionnels

**Verification** : re-tester le contract avec mock blocks pour confirmer 0 regression.

### Etape 2 : Creer agents via foundry

Pour chaque agent (agent-creator, test-designer) :

1. Baseline : tester le contract avec mock blocks → noter le fitness
2. Iterer le system prompt (max 5 iterations)
3. Tester avec 2+ modeles
4. Publier si fitness > 0.5

Documenter dans `foundry-iterations.md` et `benchmark-results.md`.

### Criteres de succes

- System prompt < 500 lignes, 0 regression
- agent-creator : fitness >= 0.5
- test-designer : fitness >= 0.5
- Au moins 2 modeles testes
- Cout total documente

---

## 62-D : Live Execution View dans le TUI

### Objectif

Quand block-forge tourne via `/create-agent`, le TUI montre en temps reel :
- L'agent actif et son iteration
- Les tool calls au fur et a mesure
- Le cout cumule
- Cancel via Esc

### Mockup

```
Creating agent via block-forge workflow...
  Description: An agent that reviews TypeScript code
  Contract:    code-reviewer

  -- test-designer ----------- iter 2/12 --- $0.012 --
  [ok] directory-list content/system/contracts/
  [ok] file-read code-reviewer.contract.json
  [->] file-write test-suite.json

  -- agent-creator ----------- iter 5/12 --- $0.048 --
  [ok] file-read code-reviewer.contract.json
  [ok] file-write code-reviewer.agent.block.json
  [ok] contract-test code-reviewer -> fitness: 0.35
  [->] contract-test code-reviewer...

  Cost: $0.060 | Time: 2m 15s
  [Esc to cancel]
```

### Implementation

1. Copier resume structure child → parent dans `BlockRefHandler`
2. TUI poll la session parent, lit `_childLog_{nodeId}` et `_childIteration_{nodeId}`
3. Cancel via `useInput` handler → `POST /api/sessions/<id>/stop`

---

## 62-T : Tests + Validation

### Tests unitaires
- `_toolMapping` dans ToolDispatcherBlockExecutor (3+ tests)
- Mock blocks : capture-file-write, capture-file-read (4+ tests)
- `captured-content` check type (2+ tests)
- Provider conflict detection (2+ tests)
- TUI polling enrichi (2+ tests)

### Tests d'integration
- Contract test avec mock blocks : agent-creator fitness verifie
- Block-forge E2E via CLI ou TUI
- Provider priority appliquee

### Dogfooding
- `/create-agent` dans le TUI avec live view
- Verifier fitness > 0.5

---

## Definition of Done

- [ ] `_toolMapping` fonctionne dans ToolDispatcherBlockExecutor
- [ ] 3 mock blocks crees et testes (capture-file-write, capture-file-read, capture-shell-execute)
- [ ] ContractTestRunner injecte `_toolMapping` pour les agents
- [ ] Check type `captured-content` fonctionne
- [ ] Conflits de providers detectes et resolvables par l'utilisateur
- [ ] System prompt condense : < 500 lignes, 0 regression
- [ ] agent-creator : fitness >= 0.5 (avec mock blocks)
- [ ] test-designer : fitness >= 0.5 (avec mock blocks)
- [ ] Live execution view fonctionnelle
- [ ] Cancel (Esc) fonctionne
- [ ] Tous les tests passent, 0 regression
- [ ] `dotnet build` : 0 erreurs
- [ ] `npx tsc --noEmit` : 0 erreurs

### NOT in scope

- /adapt workflow (Phase 63)
- Production de ~30 variantes (Phase 64)
- Nouveaux contracts
- Modification de AgentBlockExecutor (tout passe par les blocks)
