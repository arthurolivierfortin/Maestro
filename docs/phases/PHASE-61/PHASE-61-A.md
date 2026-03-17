# 61-A : Provider Setup + Verification des Fixes

**Effort** : 0.5 jour
**Prerequis** : Rien (premiere etape)
**Critere de passage** : Provider Anthropic verifie, 3 fixes confirmes par build + test

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` — lignes 229-244 : injection `config.maxIterations` comme variable session (deja code)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ConversationReadBlockExecutor.cs` — lignes 50-73 : support `keepLastN` (deja code)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolDispatcherBlockExecutor.cs` — lignes 143-149 : propagation couts sous-blocs (deja code)
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — `AccumulateCosts()` : verifier si les couts child → parent fonctionnent
- `content/system/blocks/agents/agent-creator/agent-creator.agent.block.json` — `config.maxIterations: 12`, le while node `"maxIterations": "{{maxIterations}}"`

---

## Etape 0 — Configurer et verifier le provider Anthropic (BLOQUANT)

**Aucun workflow LLM ne doit etre lance sans cette verification.**

1. **Verifier la configuration** :
   ```bash
   # Verifier que la cle API est configuree
   grep -r "Anthropic" llm-provider/dotnet/src/LLMProvider.Web/appsettings.json
   # Verifier que claude-sonnet-4-6 est dans les modeles configures
   ```

2. **Tester un appel direct** :
   ```bash
   curl http://localhost:5010/api/v1/inference \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Reply with just OK"}],"maxTokens":10}'
   ```

3. **Critere** : Reponse en < 5 secondes, contenu "OK" ou similaire.
   - Si echec → diagnostiquer (cle manquante? modele pas dans la liste? mauvais provider routing?)
   - Si > 10s → le routing passe probablement par Claude Code CLI au lieu de l'API directe

4. **Mesurer la latence** : Chrono l'appel. La latence Anthropic API directe est ~1-3s. Si > 10s, c'est Claude Code CLI.

**NE PAS CONTINUER SANS CETTE ETAPE. C'est l'erreur #1 de la session de nuit.**

---

## Tache 1 — Verifier le fix maxIterations

Le code est deja ecrit dans `MultiNodeBlockExecutor.cs:229-244`. Verifier qu'il fonctionne.

### Verification

1. **Build** : `dotnet build` → 0 erreurs
2. **Log check** : Lancer un agent (meme sans workflow complet) et chercher dans les logs :
   ```
   Pre-flight: block 'agent-creator' (type: agent), model=claude-sonnet-4-6, maxIterations=12
   Entering while loop 'agent-while' (max: 12)
   ```
   Si les logs montrent `max: 50` → le fix ne marche pas.

3. **Code review** : Verifier que l'injection respecte la priorite :
   ```csharp
   // Ligne 239: && session.GetVariable(key) == null
   ```
   Ceci evite d'ecraser une valeur explicitement passee par le workflow.

### Bug potentiel

`block.Config` est un `Dictionary<string, object>` mais les valeurs peuvent etre `JsonElement`. Le `val.ToString()` sur un `JsonElement` de type Number retourne `"12"` — OK. Mais verifier que `TryGetValue` fonctionne bien (Newtonsoft vs System.Text.Json mixing).

---

## Tache 2 — Verifier le fix keepLastN

Le code est dans `ConversationReadBlockExecutor.cs:50-73`.

### Verification

1. Les agents ont `keepLastN: 8` dans leur config et dans le node input :
   ```json
   "inputs": { "conversationId": "{{_conversationId}}", "keepLastN": "8" }
   ```
2. Log attendu apres 10+ messages : `ConversationRead '...': truncated 15 -> 9 messages (keepLastN=8)`
3. Si pas de log de truncation → verifier que l'input `keepLastN` arrive bien dans le `inputs` dict du `ConversationReadBlockExecutor`

---

## Tache 3 — Verifier la propagation des couts

Le code est dans `ToolDispatcherBlockExecutor.cs:143-149`.

### Verification

1. Apres une execution agent, verifier `_accumulatedCost` sur la session parent :
   ```bash
   curl http://localhost:5000/api/sessions/{parent-id}/variables/_accumulatedCost
   ```
   Doit etre > $0.

2. **Bug potentiel non couvert** : Le `BlockRefHandler` accumule les couts via `AccumulateCosts(session, result)` avec `result = BlockExecutionResult` de l'executor. Mais pour les agents en child session, les couts des tool calls internes (file-read, contract-test) s'accumulent sur la **child session** via `_accumulatedCost`, pas dans le `BlockExecutionResult`. Verifier si `AgentBlockExecutor.ExtractResultAsync()` lit `_accumulatedCost` de la child session et le met dans le result.

   Si ce n'est pas le cas → ajouter dans `BlockRefHandler` apres execution d'un agent child :
   ```csharp
   // Read accumulated costs from child session and add to parent
   if (childSession != null)
   {
       var childCost = /* read _accumulatedCost from childSession */;
       // Add to parent session's _accumulatedCost
   }
   ```

---

## Verification finale 61-A

- [ ] Provider Anthropic : appel reussi en < 5s
- [ ] `dotnet build` : 0 erreurs
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] Logs montrent `maxIterations=12` (pas 50)
- [ ] `keepLastN` fonctionne (log de truncation visible)
- [ ] Couts propagent vers le parent (> $0)

**Si des fixes additionnels sont necessaires** : les coder, tester, committer AVANT de passer a 61-B.

---

## Anti-patterns

- Ne PAS hardcoder `maxIterations = 12` dans le code C# — le fix doit etre generique
- Ne PAS modifier `NodeExecutionEngine.ExecuteWhileAsync()` pour lire depuis le block config — le engine ne connait que les nodes JSON et la session
- Ne PAS condenser le system prompt dans cette sous-phase — attendre les resultats de 61-C
- Ne PAS lancer un workflow E2E complet pour verifier — un test minimal (1-2 iterations) suffit

---

## Checkpoint

```markdown
## 61-A : Provider Setup + Verification des Fixes
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Provider Anthropic** : OK / ECHEC (latence: Xs)
**Build** : 0 erreurs
**Tests** : tous passent (0 regressions)
**maxIterations fix** : while loop log montre "max: 12" (pas 50) — copier la ligne de log
**keepLastN fix** : truncation log visible — copier la ligne de log
**Cout parent** : _accumulatedCost = $X.XX sur la session parent
**Fixes additionnels** : [liste si applicable]
```
