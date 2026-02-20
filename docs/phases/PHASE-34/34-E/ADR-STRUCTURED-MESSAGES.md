# ADR : Messages Structurés et Gestion Multi-Turn pour Agents

**Phase** : 34-E (sous-phase corrective)
**Date** : 2026-02-20
**Statut** : APPROUVÉ

---

## 1. Contexte et Problème

Le workflow `maestro-agent-v4` a échoué ("Zero implementation after 3 iterations") parce que la chaîne de communication Maestro → LLM-Provider → Claude Code CLI détruit la structure conversationnelle multi-turn.

### Chaîne actuelle (cassée)

```
AgentBlockExecutor                LLMProviderGateway           LLM-Provider API        ClaudeCodeLLMProvider
───────────────────               ──────────────────           ────────────────         ─────────────────────
List<ChatMessage>                 Aplatit tout en              Reçoit un flat           Reçoit un flat
[sys, user, asst, user, ...]  →   string.Join("\n\n")    →     Prompt string    →       prompt string
                                  PERD les rôles                                        claude -p "blob"
                                                                                        = 1 seul message user
```

**Résultat** : Après l'itération 1, Claude reçoit un blob de texte où il ne peut pas distinguer ses propres réponses des messages utilisateur. La boucle agentique est non-fonctionnelle.

### 5 bugs supplémentaires identifiés

| Bug | Fichier | Impact |
|-----|---------|--------|
| for-each marque "done" inconditionnellement | `EntryPointExecutor.cs:1359` | Cache les échecs |
| Guard "done with 0 tool calls" contournable | `AgentBlockExecutor.cs:212` | Agent sort sans travailler |
| `ResolveTemplate` retourne `"0"` pour null | `EntryPointExecutor.cs:2956` | Corrompt les chemins |
| Phases `_phases` pas mises à jour pour nœuds imbriqués | `EntryPointExecutor.cs` | Monitor incorrect |
| Interaction handler "no executor for workflow" | `BlockExecutorRegistry` | Handler absent |

Voir `POST-MORTEM-V4-WORKFLOW.md` pour l'analyse complète.

---

## 2. Décision

### Principe directeur

```
MAESTRO contrôle QUOI envoyer (orchestrateur)
LLM-PROVIDER contrôle COMMENT envoyer (exécuteur)
```

- **Maestro** gère l'historique de conversation, décide du contexte, choisit la stratégie de troncation. C'est le cerveau.
- **LLM-Provider** reçoit les messages structurés et les traduit en appel natif pour chaque provider. C'est le bras.
- Chaque **provider** gère la mécanique spécifique (Claude Code → `--resume`, Azure → `messages[]` API, etc.)

### Architecture cible

```
AgentBlockExecutor                LLMProviderGateway           LLM-Provider API        ClaudeCodeLLMProvider
───────────────────               ──────────────────           ────────────────         ─────────────────────
List<ChatMessage>                 Sérialise les messages       Reçoit Messages[]       Reçoit Messages[]
[sys, user, asst, user, ...]  →   AVEC rôles préservés    →    + ConversationId   →    + ConversationId
+ ConversationId (GUID)           + ConversationId
                                                                                       Itération 1:
                                                                                         claude -p "msg"
                                                                                         → capture sessionId
                                                                                         → cache {convId → sessionId}

                                                                                       Itération 2+:
                                                                                         diff messages (quoi de nouveau?)
                                                                                         claude -p "nouveau msg" --resume sessionId
```

### Responsabilités

| Composant | Responsabilité | Ce qu'il NE fait PAS |
|-----------|---------------|---------------------|
| `AgentBlockExecutor` | Accumule les messages, applique le contexte (via config bloc), génère le `ConversationId`, envoie les messages structurés | Ne connaît pas `--resume`, ne sait pas quel provider est utilisé |
| `LLMProviderGateway` | Sérialise les messages avec rôles, passe le `ConversationId` | Ne tronque pas, ne modifie pas les messages |
| `LLMOrchestrationService` | Route vers le bon provider, passe les messages | Ne transforme pas les messages |
| `ClaudeCodeLLMProvider` | Traduit les messages en appels `claude -p` / `--resume`, gère le mapping `ConversationId → sessionId`, fait le diff des messages | Ne décide pas du contexte, ne tronque pas |
| `AzureLLMProvider` | Envoie `messages[]` à l'API Azure OpenAI | Idem |

---

## 3. Changements détaillés

### 3.1. Maestro — `LLMRequest` (Application/Interfaces/ILLMGateway.cs)

Ajouter `ConversationId` au `LLMRequest` existant :

```csharp
public class LLMRequest
{
    public string? Prompt { get; init; }
    public List<ChatMessage>? Messages { get; init; }
    public string? SystemPrompt { get; init; }
    public string? ModelId { get; init; }
    public int? MaxNewTokens { get; init; }
    public float? Temperature { get; init; }

    /// <summary>
    /// Correlation ID for multi-turn conversations.
    /// Generated by AgentBlockExecutor at the start of the agentic loop.
    /// Allows providers to track their internal session state.
    /// </summary>
    public string? ConversationId { get; init; }
}
```

### 3.2. Maestro — `AgentBlockExecutor` (BlockExecutors/AgentBlockExecutor.cs)

Changements dans la méthode `ExecuteAsync` :

1. Générer un `ConversationId` au début de la boucle :
   ```csharp
   var conversationId = Guid.NewGuid().ToString("N");
   ```

2. Passer le `ConversationId` dans chaque `LLMRequest` :
   ```csharp
   var request = new LLMRequest
   {
       Messages = contextResult.Messages,
       ModelId = modelId,
       MaxNewTokens = maxTokens,
       Temperature = temperature,
       ConversationId = conversationId
   };
   ```

### 3.3. Maestro — `LLMProviderGateway` (LLMGateway/LLMProviderGateway.cs)

Envoyer les messages structurés (rôles préservés) au lieu du flat prompt :

- Si `request.Messages` est non-null : sérialiser chaque message avec `{role, content}` dans le champ `Messages` de la requête HTTP
- Extraire le system prompt des messages
- Passer `ConversationId` dans la requête HTTP
- Le flat `Prompt` reste comme fallback pour les blocs inference (single-turn)

### 3.4. LLM-Provider — `CompleteRequest` (Web/Endpoints/LLMEndpoints.cs)

Le `ConversationId` existant dans `CompleteRequest` est réutilisé pour passer l'identifiant de corrélation Maestro. Pas besoin d'un nouveau champ.

Les `Messages[]` structurés sont ajoutés via `ChatMessageDto` :

```csharp
public record ChatMessageDto
{
    public required string Role { get; init; }
    public required string Content { get; init; }
}
```

### 3.5. LLM-Provider — `LLMOrchestrationService` (Application/Services/LLMOrchestrationService.cs)

Dans `CompleteAsync`, si des messages inline sont fournis et qu'il n'y a pas d'historique persistant, les convertir en `Message` entities et les passer au provider via le paramètre `conversationHistory` existant.

### 3.6. LLM-Provider — `ClaudeCodeLLMProvider` (ClaudeCodeProvider/ClaudeCodeLLMProvider.cs)

C'est le changement le plus significatif côté provider. Remplacement de l'approche flat-prompt par le vrai multi-turn via `--resume`.

**État interne** :

```csharp
private sealed class ConversationState
{
    public string CliSessionId { get; set; } = "";
    public int SentMessageCount { get; set; }
    public DateTime LastUsed { get; set; } = DateTime.UtcNow;
}

private readonly ConcurrentDictionary<string, ConversationState> _sessions = new();
```

**Logique** :

```
CompleteAsync(request, conversationHistory):
  conversationId = request.ConversationId

  SI conversationId est null OU pas de sessions[conversationId]:
    // Premier appel — nouvelle session
    prompt = dernier message user de conversationHistory (ou request.Prompt)
    args = ["-p", prompt, "--output-format", "json", "--model", model]
    // PAS de --no-session-persistence (on a besoin de la session)
    result = RunProcess(args)
    sessionId = ParseSessionId(result)  // extraire de la sortie JSON
    _sessions[conversationId] = { sessionId, SentMessageCount = count }
    return ParseResponse(result)

  SINON:
    // Appel suivant — reprendre la session
    state = _sessions[conversationId]
    nouveauxMessages = conversationHistory[state.SentMessageCount..]
    dernierUserMsg = nouveauxMessages.LastOrDefault(m => m.Role == User)
    args = ["-p", dernierUserMsg.Content, "--resume", state.CliSessionId, ...]
    result = RunProcess(args)
    state.SentMessageCount = conversationHistory.Count
    return ParseResponse(result)
```

**Flags modifiés** :

- `--no-session-persistence` **retiré** : nécessaire pour que `--resume` fonctionne. Les sessions CLI sont stockées par Claude Code dans `~/.claude/`.
- `--tools ""` **gardé** : les outils restent désactivés dans Claude Code CLI. C'est Maestro qui gère les tool calls via `AgentBlockExecutor`.
- `--max-turns` **reste à 1** : Maestro contrôle la boucle agentique, un seul tour par appel CLI.

**Nettoyage** :

- `CleanupConversation(string conversationId)` — supprime de `_sessions`, appelé en fin de boucle agentique
- Timer TTL (1h) comme safety net pour les sessions orphelines
- Le scope du `ConversationId` est par exécution d'agent (une boucle agentique = un ID)

**Fallback si `--resume` échoue** :

Si le processus échoue avec `--resume` (session CLI expirée/corrompue) :
1. Retirer la session du cache
2. Relancer un appel neuf avec tout le contexte formaté (markers `[user]`/`[assistant]`) dans un flat prompt
3. Logger un warning

### 3.7. Maestro — `EntryPointExecutor.cs` (fixes 2, 4, 5)

**Fix #2 — for-each propagation statut** (ligne 1359) :
Tracker les échecs des enfants et propager le bon statut au lieu de `"done"` inconditionnel.

**Fix #4 — ResolveTemplate retourne `""`** (ligne 2956) :
```csharp
// AVANT : if (value == null) return "0";
// APRÈS : if (value == null) return "";
```

**Fix #5 — Phases mises à jour dans les nœuds imbriqués** :
`UpdatePhaseStatus` existe déjà (lignes 3235-3260) et est appelé pour les nœuds de premier niveau (lignes 546/620). Étendre aux nœuds imbriqués dans `for-each`/`phase`/`while` qui ont un `phaseId` explicite.

**Fix #6 — Interaction handler** :
Pas de changement nécessaire. L'exécution de workflow imbriqué fonctionne déjà via `ExecuteBlockRefAsync` (ligne 1512) qui vérifie `config.nodes` sur le bloc référencé.

---

## 4. Ce qui ne change PAS

| Composant | Pourquoi il reste inchangé |
|-----------|---------------------------|
| `AgentBlockExecutor` boucle agentique | Plumbing mécanique correct — accumule les messages, Maestro contrôle |
| `ContextProcessorFactory` | Troncation côté Maestro correcte (`sliding-window`, `passthrough`) |
| `ILLMGateway` interface | `SendAsync(LLMRequest)` reste — on enrichit `LLMRequest` |
| Blocs inference (single-turn) | Pas de `ConversationId`, pas de `Messages`, juste `Prompt` |
| `ILLMProvider` interface côté LLM-Provider | Le paramètre `conversationHistory` existe déjà |
| Blocs agent existants (JSON) | Aucun changement de config nécessaire |

---

## 5. Conformité avec la philosophie Maestro

### Règle cardinale : Infrastructure générique, contenu spécifique

- **Aucun code spécifique** n'est ajouté côté Maestro. `ConversationId` et `Messages[]` sont génériques.
- **Le choix de `--resume`** est entièrement dans `ClaudeCodeLLMProvider` (LLM-Provider), conformément à la règle "LLM-Provider owns all provider logic".
- **Test** : Un nouveau provider (ex: Ollama) peut être ajouté sans modifier Maestro. Il recevra les mêmes `Messages[]` et `ConversationId`, et les traitera à sa façon.

### Agent = Inference Block

- L'`AgentBlockExecutor` reste mécanique. Il génère un GUID et le passe. Il ne sait rien de `--resume`.
- Tout le contenu (system prompts, tool descriptions) reste dans les block configs.

### CLI-First

- Aucun nouveau script. Tout passe par les commandes CLI existantes.

---

## 6. Décisions clarifiées

| Question | Décision |
|----------|----------|
| Session cleanup | TTL 1h (safety net) + cleanup explicite en fin de boucle agentique |
| ConversationId scope | Un par exécution d'agent (boucle agentique) |
| Fallback si --resume échoue | Nouvelle session avec tout le contexte en flat prompt (markers) |
| --max-turns | Reste à 1 (Maestro contrôle la boucle) |
| Fix #6 (interaction handler) | Inclus — pas de changement nécessaire (déjà fonctionnel via `ExecuteBlockRefAsync`) |
