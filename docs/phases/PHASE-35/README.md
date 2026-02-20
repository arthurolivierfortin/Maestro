# Phase 35 : Contexte et Conversation comme Blocs

**Statut** : A faire
**Prerequis** : Phase 34-E COMPLETE (workflow v4 fonctionnel avec messages structures)
**Objectif** : Formaliser la conversation, le contexte et la memoire comme des blocs first-class, observables et composables.

---

## Probleme

Aujourd'hui, la gestion du contexte viole la philosophie Maestro "Everything is a block" :

- La **conversation** est une `List<ChatMessage>` ephemere dans une variable locale de `AgentBlockExecutor` — invisible, non-composable, non-persistante
- Le **contexte** est un service interne (`IContextProcessor`) appele dans l'executor — pas un bloc configurable
- La **memoire** n'existe pas cote Maestro — aucun mecanisme de connaissances persistantes entre executions

L'optimisation du contexte est une des cles de performance de Maestro : un petit LLM avec le bon contexte bat un gros LLM avec un contexte pollue. Sans blocs formels, cette optimisation est impossible a observer, configurer, et ameliorer.

---

## Architecture cible

```
Memory Block(s)     ──┐
  (connaissances       │
   persistantes)       │
                       ├──→  Context Block  ──→  Inference Block
Conversation Block  ──┘     (assembleur          (appel LLM)
  (historique de             final)
   messages)
```

### 3 types de blocs

| Bloc | Type | Etat | Responsabilite |
|------|------|------|---------------|
| Conversation | Stateful | Messages organises en sections | Stocker, organiser, persister les messages d'une execution |
| Context | Stateless | Transformateur pur | Assembler et optimiser le contexte final pour le LLM (depuis conversation + memories) |
| Memory | Stateful | Connaissances persistantes | Stocker des connaissances durables (comme memory.md mais structure) |

### Flux dans la boucle agentique

```
Agent Executor (boucle mecanique) :

  conversation = ConversationBlock.Create(systemPrompt)
  conversation.AddMessage(user, taskDescription)
  memories = MemoryBlock.Load(agentId)

  while (not done):
    messages = conversation.GetMessages()
    knowledge = memories.GetRelevant(context)
    optimized = ContextBlock.Assemble(messages, knowledge, config)
    response = InferenceBlock.Send(optimized)

    toolCall = parse(response)
    toolResult = executeTool(toolCall)

    conversation.AddMessage(assistant, response)
    conversation.AddMessage(user, toolResult)
```

L'executor reste du plumbing mecanique. Les 3 blocs sont configurables, observables, composables.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 35-A | Conversation Block — extraction de AgentBlockExecutor | 3-5 jours |
| 35-B | Context Block — formalisation du context processor | 2-3 jours |
| 35-C | Memory Block — connaissances persistantes | 5-8 jours |
| 35-D | TUI Context Panel — observabilite en temps reel | 3-5 jours |
| 35-E | Orchestration avancee — selection de contexte par l'orchestrateur | 5-8 jours |

---

## 35-A : Conversation Block

### Ce que cette sous-phase fait

1. Creer l'entite `Conversation` dans `Maestro.Domain` avec sections (system, history)
2. Creer le service `IConversationManager` dans `Maestro.Application`
3. Creer l'implementation `InMemoryConversationManager` dans `Maestro.Infrastructure`
4. Refactorer `AgentBlockExecutor` : remplacer `List<ChatMessage>` par `IConversationManager`
5. Exposer l'etat via session variable `_conversation_{id}` (observable par le monitor)
6. Creer le `ConversationBlockExecutor` dans `BlockExecutors/`

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Maestro.Domain/Entities/Conversation.cs` | Creer — entite avec sections, messages, token counts |
| `Maestro.Application/Interfaces/IConversationManager.cs` | Creer — Create, AddMessage, GetMessages, GetState, Cleanup |
| `Maestro.Infrastructure/Context/InMemoryConversationManager.cs` | Creer — implementation ConcurrentDictionary |
| `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — utiliser IConversationManager au lieu de List<ChatMessage> |
| `Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs` | Modifier — connecter au IConversationManager |
| `Maestro.Api/Program.cs` | Modifier — enregistrer IConversationManager en DI |

### Anti-patterns
- Ne PAS persister les conversations sur disque dans cette sous-phase — en memoire suffit
- Ne PAS ajouter de logique de truncation dans la conversation — c'est le role du context block
- Ne PAS hardcoder des sections specifiques — le systeme de sections doit etre generique

---

## 35-B : Context Block

### Ce que cette sous-phase fait

1. Transformer `IContextProcessor` en bloc formel (`blockType: "context"`)
2. Le context block prend en entree : messages de conversation + config
3. Il produit en sortie : messages optimises prets pour le LLM
4. L'interface est concue pour accepter des sources multiples (conversation + memory dans 35-C)
5. Refactorer `AgentBlockExecutor` : utiliser le context block au lieu de `contextProcessor.ProcessAsync()`

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Maestro.Application/Interfaces/IContextAssembler.cs` | Creer — interface pour l'assembleur de contexte |
| `Maestro.Infrastructure/Context/ContextAssembler.cs` | Creer — implementation qui delegue aux strategies |
| `Maestro.Infrastructure/BlockExecutors/ContextBlockExecutor.cs` | Modifier — connecter a IContextAssembler |
| `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — utiliser IContextAssembler |

### Anti-patterns
- Ne PAS supprimer IContextProcessor — le context block l'utilise en interne
- Ne PAS hardcoder les sources (conversation only) — l'interface doit supporter N sources

---

## 35-C : Memory Block

### Ce que cette sous-phase fait

1. Creer l'entite `MemoryStore` — connaissances persistantes organisees par categorie
2. Creer `IMemoryManager` — CRUD sur les memories
3. Creer `MemoryBlockExecutor` (`blockType: "memory"`)
4. Les memories sont persistees sur disque (comme les blocks)
5. Integrer les memories dans le context block (source additionnelle)
6. Les agents peuvent ecrire dans leurs memories (apprentissage)

### Structure d'une memory

```json
{
  "id": "agent-implement-step-memory",
  "category": "coding-patterns",
  "entries": [
    {
      "key": "typescript-imports",
      "content": "Always use named imports, never default imports",
      "confidence": 0.95,
      "source": "foundry-session-abc123",
      "lastUsed": "2026-02-20T10:00:00Z"
    }
  ]
}
```

### Anti-patterns
- Ne PAS implementer de RAG/embeddings dans cette sous-phase — recherche par categorie/cle suffit
- Ne PAS coupler les memories a un agent specifique — elles sont des blocs reutilisables

---

## 35-D : TUI Context Panel

### Ce que cette sous-phase fait

1. Widget `context-panel` dans le monitor
2. Affiche en temps reel : sections de la conversation, token counts, strategie, truncation
3. Affiche les memories actives pour l'agent en cours
4. Utilise les session variables `_conversation_{id}` et `_contextState`

### Anti-patterns
- Ne PAS ajouter de logique metier dans le TUI — lecture seule des session variables
- Ne PAS creer un nouveau endpoint API — utiliser les variables de session existantes

---

## 35-E : Orchestration avancee

### Ce que cette sous-phase fait

1. Un orchestrateur peut configurer quel contexte chaque sous-agent recoit
2. Le context block supporte les filtres de sections
3. Plusieurs conversations peuvent coexister dans une session
4. L'orchestrateur peut injecter des memories specifiques par agent

### Anti-patterns
- Ne PAS hardcoder les regles de selection dans l'executor — tout en config bloc
- Ne PAS creer un nouveau type de bloc pour l'orchestration — utiliser la composition de blocs existants

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-35/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 35 : Conversation, Context et Memory sont des blocs first-class. IConversationManager, IContextAssembler, IMemoryManager dans Application/Interfaces/"
- Ajouter : "TUI context-panel widget disponible"
- Retirer : "Context = IContextProcessor interne a AgentBlockExecutor"

---

## Criteres de completion

- [ ] La conversation est une entite observable (pas une List<ChatMessage> locale)
- [ ] Le context block assemble depuis conversation + memories
- [ ] Les memories sont persistees et reutilisables entre sessions
- [ ] Le TUI panel montre le contexte en temps reel
- [ ] Un orchestrateur peut choisir quel contexte passer a quel agent
- [ ] Aucun code de gestion de messages dans AgentBlockExecutor — tout delegue aux blocs
