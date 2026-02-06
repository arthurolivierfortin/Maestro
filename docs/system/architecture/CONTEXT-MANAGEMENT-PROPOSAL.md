# Proposition : Gestion du Contexte dans Maestro

## Problème Actuel

L'`AgentBlockExecutor` accumule les messages sans limite :
```csharp
var messages = new List<ChatMessage>();
// Chaque tool call ajoute 2 messages (assistant + user result)
// Tout est envoyé au LLM à chaque itération
// Aucun contrôle sur la taille du contexte
```

**Conséquences :**
- Dépassement de la fenêtre de contexte du modèle
- Coût en tokens inutile
- Pas de possibilité d'optimiser le contexte

---

## Proposition : Block Type `context`

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT EXECUTION                             │
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │ Raw Messages │ ──▶ │Context Block │ ──▶ │ LLM Request  │        │
│  │ (historique) │     │ (optimise)   │     │ (optimisé)   │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                             │
│                    │ Stratégies:      │                             │
│                    │ - sliding-window │                             │
│                    │ - summarize      │                             │
│                    │ - rag            │                             │
│                    │ - hybrid         │                             │
│                    └──────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Définition du Block

```json
{
  "id": "sliding-window-context",
  "name": "Sliding Window Context",
  "blockType": "context",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Gère le contexte avec une fenêtre glissante",

  "inputs": [
    {
      "id": "messages",
      "type": "array",
      "description": "Historique complet des messages"
    },
    {
      "id": "newMessage",
      "type": "object",
      "description": "Nouveau message à ajouter"
    }
  ],

  "outputs": [
    {
      "id": "optimizedMessages",
      "type": "array",
      "description": "Messages optimisés pour le LLM"
    },
    {
      "id": "tokenCount",
      "type": "number",
      "description": "Nombre de tokens estimé"
    },
    {
      "id": "truncated",
      "type": "boolean",
      "description": "Si le contexte a été tronqué"
    }
  ],

  "config": {
    "strategy": "sliding-window",
    "maxTokens": 4096,
    "reserveForResponse": 512,
    "keepSystemPrompt": true,
    "keepLastN": 10,
    "tokenizer": "cl100k_base"
  }
}
```

### Utilisation dans un Agent

```json
{
  "id": "smart-task-executor",
  "blockType": "agent",
  "config": {
    "model": "SmolLM2-1.7B",
    "contextBlock": "sliding-window-context",
    "maxIterations": 10,
    "systemPrompt": "..."
  }
}
```

### Stratégies de Contexte

#### 1. Sliding Window (Simple)
```json
{
  "strategy": "sliding-window",
  "maxTokens": 4096,
  "keepSystemPrompt": true,
  "keepLastN": 10
}
```
- Garde le system prompt
- Garde les N derniers messages
- Supprime les plus anciens

#### 2. Summarize (Intermédiaire)
```json
{
  "strategy": "summarize",
  "maxTokens": 4096,
  "summarizeAfter": 8,
  "summaryModel": "SmolLM2-360M",
  "summaryMaxTokens": 200
}
```
- Résume les messages anciens
- Garde le résumé + messages récents
- Utilise un petit modèle pour résumer

#### 3. RAG (Avancé)
```json
{
  "strategy": "rag",
  "maxTokens": 4096,
  "embeddingModel": "all-MiniLM-L6-v2",
  "topK": 5,
  "vectorStore": "in-memory"
}
```
- Vectorise tous les messages
- Récupère les plus pertinents pour la tâche courante

#### 4. Hybrid
```json
{
  "strategy": "hybrid",
  "maxTokens": 4096,
  "recentCount": 5,
  "summarizeOlder": true,
  "ragForTools": true
}
```
- Messages récents en entier
- Résumé des anciens
- RAG pour résultats d'outils pertinents

---

## Implémentation Backend

### 1. Interface IContextProcessor

```csharp
public interface IContextProcessor
{
    Task<ContextResult> ProcessAsync(
        List<ChatMessage> messages,
        ChatMessage? newMessage,
        ContextConfig config,
        CancellationToken ct);
}

public class ContextResult
{
    public List<ChatMessage> OptimizedMessages { get; init; }
    public int EstimatedTokens { get; init; }
    public bool WasTruncated { get; init; }
    public string? Summary { get; init; }
}

public class ContextConfig
{
    public string Strategy { get; init; } = "sliding-window";
    public int MaxTokens { get; init; } = 4096;
    public int ReserveForResponse { get; init; } = 512;
    public bool KeepSystemPrompt { get; init; } = true;
    public int KeepLastN { get; init; } = 10;
}
```

### 2. ContextBlockExecutor

```csharp
public class ContextBlockExecutor : IBlockExecutor
{
    public string SupportedType => "context";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct)
    {
        var messages = inputs["messages"] as List<ChatMessage>;
        var config = MapConfig(block.Config);

        var processor = GetProcessor(config.Strategy);
        var result = await processor.ProcessAsync(messages, null, config, ct);

        return new BlockExecutionResult
        {
            Outputs = {
                ["optimizedMessages"] = result.OptimizedMessages,
                ["tokenCount"] = result.EstimatedTokens,
                ["truncated"] = result.WasTruncated
            }
        };
    }
}
```

### 3. Modification AgentBlockExecutor

```csharp
// Dans la boucle d'itération
var contextBlock = GetContextBlock(block.Config);
if (contextBlock != null)
{
    var contextResult = await ExecuteContextBlock(
        contextBlock,
        messages,
        ct);

    // Utiliser les messages optimisés
    request.Messages = contextResult.OptimizedMessages;
    result.Logs.Add($"Context: {contextResult.EstimatedTokens} tokens");
}
else
{
    // Comportement actuel (pas de limite)
    request.Messages = messages;
}
```

---

## Token Counting

### Option A : Estimation Simple
```csharp
// ~4 caractères par token pour l'anglais
int EstimateTokens(string text) => text.Length / 4;
```

### Option B : Tokenizer Local
Utiliser `tiktoken` (Python) ou `SharpToken` (C#) pour un comptage exact.

### Option C : Via LLM-Provider
Ajouter endpoint `/v1/tokenize` qui retourne le compte de tokens.

**Recommandation :** Commencer avec estimation simple, ajouter précision plus tard.

---

## Plan d'Implémentation

### Phase 1 : Foundation (Priorité Haute)
1. Créer interface `IContextProcessor`
2. Implémenter `SlidingWindowContextProcessor`
3. Ajouter support dans `AgentBlockExecutor`
4. Créer block `sliding-window-context`

### Phase 2 : Amélioration (Priorité Moyenne)
1. Ajouter comptage de tokens précis
2. Implémenter `SummarizingContextProcessor`
3. CLI pour tester/visualiser le contexte

### Phase 3 : Avancé (Priorité Basse)
1. Implémenter RAG context
2. Support mémoire persistante entre sessions
3. Métriques et optimisation automatique

---

## Avantages de cette Approche

1. **Philosophie Maestro** : Tout est block, composable, testable
2. **Entraînable** : On peut entraîner/optimiser les strategies de contexte
3. **Flexible** : Différents agents peuvent utiliser différentes stratégies
4. **Observable** : Logs indiquent combien de tokens utilisés
5. **Évolutif** : Facile d'ajouter nouvelles stratégies

---

## Alternative : Tout dans Config Agent

Si créer un nouveau type de block semble trop lourd, on peut mettre la config directement dans l'agent :

```json
{
  "id": "my-agent",
  "blockType": "agent",
  "config": {
    "model": "SmolLM2-1.7B",
    "context": {
      "enabled": true,
      "strategy": "sliding-window",
      "maxTokens": 4096,
      "keepLastN": 10
    }
  }
}
```

C'est plus simple mais moins flexible (pas de composition, pas de réutilisation).

---

## Questions Ouvertes

1. **Mémoire inter-sessions** : Doit-on persister le contexte entre exécutions d'agent ?
2. **Partage de mémoire** : Plusieurs agents peuvent-ils partager un contexte ?
3. **Tokenizer** : Quel niveau de précision pour le comptage de tokens ?

---

## Recommandation Finale

**Commencer avec l'Option Hybride :**
1. Ajouter `context` config à l'agent (built-in strategies)
2. Permettre `contextBlock` pour strategies custom
3. Implémenter `sliding-window` d'abord (le plus utile)

Ceci donne :
- Résultats rapides (stratégie simple built-in)
- Flexibilité future (blocks custom)
- Rétro-compatibilité (agents sans config context fonctionnent comme avant)
