# Plan : Phase 28-INFRA — Infrastructure critique

> Prérequis : V1 ✅ V2 ✅ Phase 26-B ✅
> Effort estimé : ~4 heures
> Fichiers cibles : EntryPointExecutor.cs, AgentBlockExecutor.cs, CLI

---

## INFRA-1 : BlockRef dispatch dans ExecuteRegularNodeAsync

**Problème** : `ExecuteRegularNodeAsync` (EntryPointExecutor.cs:1033-1103) dispatch par pattern-matching sur nodeId. Si un node a `blockRef: "my-agent"`, c'est ignoré — le node est un passthrough.

**Fix** : Avant le pattern-matching, vérifier `blockRef` sur le nodeConfig et dispatcher via `ExecuteBlockRefAsync`.

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Lire `ExecuteRegularNodeAsync` et `ExecuteBlockRefAsync` | Read EntryPointExecutor.cs lignes 964-1103 et 852-958 | Comprendre les deux chemins | ⬜ |
| 2 | Ajouter check `blockRef` au début de `ExecuteRegularNodeAsync` | Edit : si `nodeConfig.TryGetProperty("blockRef", out var blockRefEl)` → construire un phase node wrapper et appeler `ExecuteBlockRefAsync` | Code compile | ⬜ |
| 3 | Passer les inputs du node au bloc dispatché | Les `inputs` du nodeConfig doivent être passés comme variables de session ou inputs du bloc | Le bloc reçoit ses inputs | ⬜ |
| 4 | Test : créer un workflow JSON minimal avec blockRef | Workflow avec un node `{"id":"test","blockRef":"commit-message-generator","inputs":{"diff":"test diff"}}` | Le bloc est exécuté, pas un passthrough | ⬜ |
| 5 | Vérifier dans le monitor | Lancer le monitor, invoquer le workflow | Le node apparaît avec le résultat du bloc, pas "passthrough" | ⬜ |
| 6 | Build + tests | `dotnet build && dotnet test` | 0 erreurs, 93+ tests pass | ⬜ |

---

## INFRA-2 : Agent wall-clock timeout

**Problème** : `AgentBlockExecutor` a un max iterations (défaut 5), mais pas de timeout wall-clock. Si le LLM hang indéfiniment, la session hang.

**Fix** : Ajouter un `CancellationTokenSource` avec timeout configurable.

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Lire le loop agent | Read AgentBlockExecutor.cs lignes 76-200 | Comprendre le flow | ⬜ |
| 2 | Ajouter config.timeoutSeconds | Lire depuis `block.Config["timeoutSeconds"]`, défaut 300 (5 min) | Config lue | ⬜ |
| 3 | Créer LinkedTokenSource avec timeout | `CancellationTokenSource.CreateLinkedTokenSource(ct)` + `CancelAfter(timeout)` | Compile | ⬜ |
| 4 | Catcher OperationCanceledException | Si timeout → retourner résultat partiel avec erreur "Agent timed out after Xs" | Message d'erreur clair | ⬜ |
| 5 | Build + tests | `dotnet build && dotnet test` | 0 erreurs | ⬜ |

---

## INFRA-3 : Agent loop detection

**Problème** : Si un agent appelle le même outil avec les mêmes arguments 3 fois de suite, il est probablement bloqué.

**Fix** : Tracker les 3 derniers appels. Si identiques → break avec warning.

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Ajouter historique d'appels | `List<(string toolId, string args)>` dans le loop | Compile | ⬜ |
| 2 | Après chaque tool call, vérifier les 3 derniers | Si lastN.All(same) → `_logger.LogWarning("Loop detected")` + break | Log visible | ⬜ |
| 3 | Config : `config.loopDetectionThreshold` (défaut 3) | Configurable par bloc | Config lue | ⬜ |
| 4 | Build + tests | `dotnet build && dotnet test` | 0 erreurs | ⬜ |

---

## INFRA-4 : Test E2E ClaudeCodeProvider

**Problème** : Le ClaudeCodeProvider est créé mais jamais testé de bout en bout via Maestro.

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Démarrer LLM-Provider .NET | `dev-scripts/dev-start.ps1` ou `dotnet run` dans LLMProvider.Web | Port 5010 répond à /api/v1/health/ | ⬜ |
| 2 | Vérifier que Claude est listé | `curl http://localhost:5010/api/v1/models/` | claude-sonnet, claude-opus, claude-haiku dans la liste | ⬜ |
| 3 | Démarrer Maestro Backend | `dotnet run` dans Maestro.Api | Port 5000 répond | ⬜ |
| 4 | Tester via API directe | `curl -X POST http://localhost:5000/api/chat/completions -d '{"messages":[{"role":"user","content":"Say hello"}],"model":"claude-sonnet"}'` | Réponse de Claude, pas d'erreur | ⬜ |
| 5 | Tester via CLI | `node index.js chat --model claude-sonnet` + envoyer "Hello" | Réponse interactive de Claude | ⬜ |
| 6 | Tester un bloc inference | Créer un bloc inference minimal avec `model: claude-sonnet`, exécuter via `node index.js run <block-id>` | Le bloc retourne la réponse de Claude | ⬜ |

---

## INFRA-5 : Tool `model-detector`

**Problème** : Aucun bloc système ne permet de connaître les modèles disponibles. Nécessaire pour `check`, `adapt`, sélection de tier.

**Fix** : Créer un tool block qui appelle `GET /api/v1/models/` et retourne la liste structurée.

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer `model-detector.tool.block.json` | Dans `content/system/blocks/system/tools/` | Fichier valide | ⬜ |
| 2 | Script `detect-models.js` | Appelle l'API, retourne `{ models: [{id, provider, capabilities}], providers: [...] }` | JSON structuré | ⬜ |
| 3 | Tester | `node index.js run model-detector` | Liste les modèles disponibles | ⬜ |
| 4 | Ajouter commande CLI | `maestro models` comme alias de `run model-detector --format table` | Affichage tableau | ⬜ |

---

## Gate INFRA

| Critère | Vérification |
|---------|--------------|
| BlockRef dispatch fonctionne | Workflow JSON avec blockRef → bloc exécuté, résultat dans _executionTree |
| Agent timeout fonctionne | Agent avec timeoutSeconds=5 et LLM lent → "timed out" dans les logs |
| Loop detection fonctionne | Agent qui boucle → "Loop detected" et arrêt propre |
| Claude accessible via Maestro | `maestro chat --model claude-sonnet` → réponse de Claude |
| Model detector fonctionne | `maestro models` → liste des modèles avec providers |
