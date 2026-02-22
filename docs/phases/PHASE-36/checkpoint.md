# Phase 36 : Checkpoint

**Derniere mise a jour** : 2026-02-21
**Sous-phase en cours** : AUCUNE — Phase 36 TERMINEE
**Agent** : Claude Code session

---

## 36-A : Conversation Block
**Statut** : DONE
**Date** : 2026-02-21
**Bloc cree** : conversation.block.json
**Executor** : ConversationBlockExecutor.cs (operations: create, add-message, get-state, get-messages, cleanup)
**Real-time state** : AgentBlockExecutor publie _conversationState_{blockId} toutes les 5 iterations
**DI** : Enregistre dans Program.cs

## 36-B : Context Block
**Statut** : DONE
**Date** : 2026-02-21
**Bloc cree** : context.block.json
**Executor** : ContextBlockExecutor existait deja (ContextProcessorFactory)
**Sources supportees** : conversation, memory (via ContextAssembler)

## 36-C : Memory Block
**Statut** : DONE
**Date** : 2026-02-21
**Persistence** : disque (*.memory.json via FileSystemMemoryManager)
**Integration context block** : OUI (ContextAssembler injecte les entries relevantes dans le system prompt)
**Agents peuvent ecrire** : OUI (via MemoryBlockExecutor operation add-entry)
**Fichiers crees** :
- `Maestro.Domain/Entities/MemoryStore.cs` — MemoryStore + MemoryEntry entities
- `Maestro.Application/Interfaces/IMemoryManager.cs` — CRUD + search + relevance
- `Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs` — ConcurrentDictionary + SemaphoreSlim + JSON persistence
- `Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs` — 6 operations
- `content/system/blocks/infrastructure/memory.block.json` — block definition
- `ContextAssembler.cs` — modified to accept IMemoryManager, injects relevant entries
- `Program.cs` — DI for IMemoryManager + MemoryBlockExecutor
**Build** : 0 errors

## 36-D : Documentation attachee
**Statut** : DONE
**Date** : 2026-02-21
**metadata.docs dans BlockDefinition** : OUI (computed property Docs + SetDocs + GetMetadataDocs)
**Companion files scannes** : OUI (ScanCompanionDocs dans FileSystemBlockDiscoveryService)
**API endpoint** : GET /api/blocks/{id}/docs et GET /api/blocks/{id}/docs/{docName}
**CLI** : `block docs <id>` et `block docs <id> <docName>`
**BlockDto** : Docs property mappee dans FromDomain
**Build** : 0 errors
**Fichiers modifies** :
- `Maestro.Domain/Entities/BlockDefinition.cs` — Docs property, SetDocs, GetMetadataDocs
- `Maestro.Application/DTOs/BlockDto.cs` — Docs property + mapping
- `Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` — ScanCompanionDocs
- `Maestro.Api/Controllers/BlocksController.cs` — GetBlockDoc + ListBlockDocs endpoints
- `packages/maestro-cli/cli.ts` — listBlockDocs + showBlockDoc functions + block docs subcommand

## 36-E : TUI Context Panel
**Statut** : DONE
**Date** : 2026-02-21
**Widget cree** : OUI (context-panel dans WidgetsPanel.ts)
**Conversation affichee** : OUI (conversationId, iteration, messageCount)
**Token usage** : OUI (estimated tokens avec progress bar, system/history breakdown)
**Auto-detection** : OUI (DefaultWidgets scanne _conversationState_* variables)
**Tests** : 4 passed (0 regressions)
**Fichier modifie** :
- `packages/maestro-monitor/components/WidgetsPanel.ts` — ContextPanelWidget + renderWidget case + DefaultWidgets auto-detect
