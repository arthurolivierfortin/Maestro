# Phase 36 : Contexte, Memoire et Documentation — CHANGELOG

**Statut** : TERMINEE
**Date** : 2026-02-21
**Sous-phases** : 5 (36-A through 36-E)

---

## 36-A : Conversation Block

| Action | Fichier |
|--------|---------|
| Cree | `content/system/blocks/infrastructure/conversation.block.json` |
| Cree | `Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs` |
| Modifie | `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — publie `_conversationState_{blockId}` |
| Modifie | `Maestro.Api/Program.cs` — DI ConversationBlockExecutor |

## 36-B : Context Block

| Action | Fichier |
|--------|---------|
| Cree | `content/system/blocks/infrastructure/context.block.json` |

ContextBlockExecutor existait deja. Le block JSON formalise la definition pour la discoverabilite.

## 36-C : Memory Block

| Action | Fichier |
|--------|---------|
| Cree | `Maestro.Domain/Entities/MemoryStore.cs` |
| Cree | `Maestro.Application/Interfaces/IMemoryManager.cs` |
| Cree | `Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs` |
| Cree | `Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs` |
| Cree | `content/system/blocks/infrastructure/memory.block.json` |
| Modifie | `Maestro.Infrastructure/Context/ContextAssembler.cs` — injecte memoire |
| Modifie | `Maestro.Api/Program.cs` — DI IMemoryManager + MemoryBlockExecutor |

### Architecture memoire

- **Persistence** : JSON files (`*.memory.json`) dans `memory-stores/`
- **Cache** : `ConcurrentDictionary` en memoire, lazy loading
- **Thread safety** : `SemaphoreSlim` pour les ecritures disque
- **Scoring** : `confidence * recency * (1 + log(useCount))` pour le tri par relevance
- **Integration** : `ContextAssembler` injecte les top-5 entries dans le system prompt
- **Operations** : create-store, add-entry, search, get-relevant, remove-entry, delete-store

## 36-D : Documentation attachee

| Action | Fichier |
|--------|---------|
| Modifie | `Maestro.Domain/Entities/BlockDefinition.cs` — Docs, SetDocs, GetMetadataDocs |
| Modifie | `Maestro.Application/DTOs/BlockDto.cs` — Docs property |
| Modifie | `Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` — ScanCompanionDocs |
| Modifie | `Maestro.Api/Controllers/BlocksController.cs` — GET docs endpoints |
| Modifie | `packages/maestro-cli/cli.ts` — block docs commands |

### API endpoints

- `GET /api/blocks/{id}/docs` — liste tous les docs compagnons
- `GET /api/blocks/{id}/docs/{docName}` — retourne le contenu d'un doc

### CLI commands

- `maestro block docs <id>` — liste les docs d'un bloc
- `maestro block docs <id> <docName>` — affiche un doc

### Companion doc scanning

`FileSystemBlockDiscoveryService.ScanCompanionDocs()` scanne automatiquement les dossiers `docs/` adjacents aux blocs. Les fichiers `.md` sont auto-mappes : `README.md` → `readme`, `RESEARCH.md` → `research`, etc.

## 36-E : TUI Context Panel

| Action | Fichier |
|--------|---------|
| Modifie | `packages/maestro-monitor/components/WidgetsPanel.ts` |

### Widget context-panel

Nouveau type de widget `context-panel` dans WidgetsPanel :
- Affiche : conversationId, iteration, messageCount, token usage (progress bar), system/history breakdown
- Auto-detection : `DefaultWidgets` scanne les variables `_conversationState_*` et affiche un panel par agent actif
- Configurable via `monitorWidgets` dans le template de session

---

## Resume des fichiers

### Crees (10)
- `content/system/blocks/infrastructure/conversation.block.json`
- `content/system/blocks/infrastructure/context.block.json`
- `content/system/blocks/infrastructure/memory.block.json`
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs`
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs`
- `apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs`
- `apps/backend/src/Maestro.Application/Interfaces/IMemoryManager.cs`
- `apps/backend/src/Maestro.Domain/Entities/MemoryStore.cs`
- `docs/phases/PHASE-36/checkpoint.md`
- `docs/phases/PHASE-36/CHANGELOG.md`

### Modifies (8)
- `apps/backend/src/Maestro.Api/Program.cs`
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs`
- `apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs`
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs`
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs`
- `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs`
- `apps/backend/src/Maestro.Application/DTOs/BlockDto.cs`
- `packages/maestro-cli/cli.ts`
- `packages/maestro-monitor/components/WidgetsPanel.ts`

### Build
- Backend : 0 errors, 102 warnings (pre-existants)
- Monitor tests : 4/4 passed
