# Phase 34-E-PRE : Extraction Conversation + Context comme entites

**Statut** : A faire
**Prerequis** : Phase 34-D COMPLETE
**Objectif** : Extraire la gestion de conversation et de contexte de AgentBlockExecutor vers des services formels, preparant la fondation pour les fixes 34-E et la Phase 35.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-34/34-E-PRE/checkpoint.md`** apres chaque sous-phase
4. Ne PAS ajouter de bloc `memory` — c'est le scope de la Phase 35
5. Ne PAS modifier les block JSON existants — cette phase change l'infrastructure, pas le contenu
6. Ne PAS supprimer IContextProcessor — il est reutilise en interne par le nouveau service

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 34-E-PRE-A | Entite Conversation + IConversationManager | 2-3h |
| 34-E-PRE-B | Refactoring AgentBlockExecutor → IConversationManager | 2-3h |
| 34-E-PRE-C | Formalisation du Context Assembler | 1-2h |

---

## 34-E-PRE-A : Entite Conversation + IConversationManager

### Lecture obligatoire

- `apps/backend/src/Maestro.Application/Interfaces/IContextProcessor.cs` — comprendre ContextInput, ContextConfig, ContextResult
- `apps/backend/src/Maestro.Application/Interfaces/ILLMGateway.cs` — comprendre ChatMessage, LLMRequest
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comprendre comment les messages sont accumules (lignes 63-68, 250-252)
- `apps/backend/src/Maestro.Infrastructure/Context/ContextProcessorFactory.cs` — comprendre les strategies existantes

### Ce que cette sous-phase fait

1. Creer l'entite `Conversation` dans `Maestro.Domain/Entities/` avec :
   - `ConversationId` (string, GUID)
   - Sections : `system` (system prompt), `history` (messages user/assistant/tool)
   - `AddMessage(role, content)`, `GetMessages(section?)`, `GetAllMessages()`
   - `GetState()` retourne un snapshot observable (token counts, message counts par section)

2. Creer l'interface `IConversationManager` dans `Maestro.Application/Interfaces/` :
   - `CreateConversation(systemPrompt?) → ConversationId`
   - `AddMessage(conversationId, role, content)`
   - `GetMessages(conversationId) → List<ChatMessage>`
   - `GetState(conversationId) → ConversationState`
   - `CleanupConversation(conversationId)`

3. Creer l'implementation `InMemoryConversationManager` dans `Maestro.Infrastructure/Context/` :
   - `ConcurrentDictionary<string, Conversation>` en memoire
   - Thread-safe
   - Pas de persistance disque (en memoire suffit pour la boucle agentique)

4. Enregistrer `IConversationManager` en DI dans `Program.cs` (singleton)

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Maestro.Domain/Entities/Conversation.cs` | Creer — entite avec sections, messages, token count |
| `Maestro.Application/Interfaces/IConversationManager.cs` | Creer — interface CRUD conversations |
| `Maestro.Infrastructure/Context/InMemoryConversationManager.cs` | Creer — implementation ConcurrentDictionary |
| `Maestro.Api/Program.cs` | Modifier — enregistrer IConversationManager singleton |

### Verification

```bash
# Build doit passer
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# Tests existants doivent passer (aucun test ne casse car rien n'est modifie encore)
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : tous les tests passent
```

### Anti-patterns

- Ne PAS persister sur disque — la conversation vit le temps de la boucle agentique
- Ne PAS ajouter de logique de truncation — c'est la responsabilite du context (34-E-PRE-C)
- Ne PAS coupler a un bloc specifique — l'interface est generique

### Checkpoint

```markdown
## 34-E-PRE-A : Entite Conversation + IConversationManager
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers crees** : [liste]
**Build** : [success/fail]
**Tests** : [nombre passes / total]
```

---

## 34-E-PRE-B : Refactoring AgentBlockExecutor

### Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comprendre le flow complet (lignes 55-310)
- `Maestro.Application/Interfaces/IConversationManager.cs` — l'interface creee en A

### Ce que cette sous-phase fait

1. Injecter `IConversationManager` dans `AgentBlockExecutor` via le constructeur

2. Au debut de `ExecuteAsync`, creer une conversation :
   ```csharp
   var conversationId = _conversationManager.CreateConversation(systemPrompt);
   _conversationManager.AddMessage(conversationId, "user", userContent);
   ```

3. Dans la boucle agentique, remplacer les `messages.Add(...)` par :
   ```csharp
   _conversationManager.AddMessage(conversationId, "assistant", jsonContent);
   _conversationManager.AddMessage(conversationId, "user", toolOutput);
   ```

4. Avant chaque appel LLM, lire les messages depuis le manager :
   ```csharp
   var messages = _conversationManager.GetMessages(conversationId);
   ```

5. Publier l'etat de la conversation dans la session variable `_conversationState` pour observabilite :
   ```csharp
   var state = _conversationManager.GetState(conversationId);
   // Stocker dans le result ou le context pour que le monitor puisse le voir
   ```

6. En fin de boucle, cleanup :
   ```csharp
   _conversationManager.CleanupConversation(conversationId);
   ```

7. Le `conversationId` est passe dans le `LLMRequest` (preparation pour 34-E) :
   ```csharp
   ConversationId = conversationId
   ```

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — remplacer List<ChatMessage> par IConversationManager |
| `Maestro.Api/Program.cs` | Modifier — injection DI (si pas deja fait en A) |

### Verification

```bash
# Build doit passer
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# Tests existants doivent passer
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : tous les tests passent

# Test fonctionnel : executer un bloc agent en isolation
# (necessite les services demarres)
# Verifier que le comportement est identique a avant le refactoring
```

### Anti-patterns

- Ne PAS changer le comportement de la boucle agentique — meme logique, juste delegation au manager
- Ne PAS ajouter de features (ConversationId dans LLMRequest, etc.) — c'est le scope de 34-E
- Ne PAS casser la signature de ExecuteAsync — meme interface, implementation interne change

### Checkpoint

```markdown
## 34-E-PRE-B : Refactoring AgentBlockExecutor
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**List<ChatMessage> supprime** : oui/non
**Build** : [success/fail]
**Tests** : [nombre passes / total]
**Comportement identique** : [verification manuelle]
```

---

## 34-E-PRE-C : Formalisation du Context Assembler

### Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/Context/ContextProcessorFactory.cs` — comprendre les strategies
- `apps/backend/src/Maestro.Infrastructure/Context/SlidingWindowContextProcessor.cs` — comprendre l'implementation
- `apps/backend/src/Maestro.Application/Interfaces/IContextProcessor.cs` — comprendre ContextInput/Config/Result

### Ce que cette sous-phase fait

1. Creer l'interface `IContextAssembler` dans `Maestro.Application/Interfaces/` :
   ```csharp
   public interface IContextAssembler
   {
       Task<ContextResult> AssembleAsync(
           string conversationId,
           ContextConfig config,
           CancellationToken ct = default);
       // Futur (Phase 35) : sources additionnelles (memories, RAG, etc.)
   }
   ```

2. Creer l'implementation `ContextAssembler` dans `Maestro.Infrastructure/Context/` :
   - Lit les messages depuis `IConversationManager`
   - Delegue a `IContextProcessor` (sliding-window, passthrough) pour l'optimisation
   - Retourne le `ContextResult` existant (meme format)

3. Refactorer `AgentBlockExecutor` : remplacer l'appel direct a `contextProcessor.ProcessAsync()` par `contextAssembler.AssembleAsync(conversationId, config)`

4. Enregistrer `IContextAssembler` en DI dans `Program.cs`

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Maestro.Application/Interfaces/IContextAssembler.cs` | Creer — interface assembleur de contexte |
| `Maestro.Infrastructure/Context/ContextAssembler.cs` | Creer — implementation (conversation → processor → result) |
| `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — utiliser IContextAssembler au lieu de IContextProcessor direct |
| `Maestro.Api/Program.cs` | Modifier — enregistrer IContextAssembler |

### Verification

```bash
# Build doit passer
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# Tests existants doivent passer
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : tous les tests passent
```

### Anti-patterns

- Ne PAS supprimer IContextProcessor ou les implementations — le context assembler les utilise en interne
- Ne PAS ajouter de source memory/RAG — c'est le scope de la Phase 35
- Ne PAS changer la logique de truncation — meme sliding-window, juste indirection supplementaire

### Checkpoint

```markdown
## 34-E-PRE-C : Context Assembler
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**IContextAssembler cree** : oui/non
**AgentBlockExecutor utilise IContextAssembler** : oui/non
**Build** : [success/fail]
**Tests** : [nombre passes / total]
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-34/34-E-PRE/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Conversation geree par IConversationManager (Maestro.Application/Interfaces/), implementation InMemoryConversationManager"
- Ajouter : "Contexte assemble par IContextAssembler, delegue a IContextProcessor pour les strategies"
- Retirer : "Conversation = List<ChatMessage> locale dans AgentBlockExecutor"
