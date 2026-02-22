# Phase 36 : Checkpoint

**Derniere mise a jour** : 2026-02-22
**Sous-phase en cours** : AUCUNE — Phase 36 TERMINEE + Dogfooding VALIDE
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

## Dogfooding : Memory Integration (Option B)
**Statut** : DONE
**Date** : 2026-02-22
**Sessions** : 7 dogfooding sessions on Cantante

### What works
- **Memory READ** : Both project-preparer and task-planner correctly call `memory` with `get-relevant` on iteration 1
- **Memory STORE (workflow-level)** : `cache-context` workflow node stores project-preparer output in memory after completion
- **Memory persistence across sessions** : Session 7 read cached context from session 6, completing in 2 iterations instead of 5+
- **Plan validation loop** : While loop + json-validator correctly retries on prose output, producing valid JSON array on retry
- **End-to-end pipeline** : Files created correctly on Cantante (formatDuration, clamp)
- **file-edit tool** : ToolBlockExecutor properly handles old_string/new_string replacement (memory note was outdated)

### What doesn't work (known limitations)
- **Agent tool name compliance** : claude-sonnet-4-6 frequently uses Claude Code tool names (Bash, Glob, Read) instead of Maestro tool names (directory-list, file-read). NormalizeToolId maps them, but args don't always match.
- **Agent format compliance** : Agents often output prose text before/after JSON, or use XML tags. This wastes iterations on retries.
- **shell-execute on Windows** : Agents send Unix commands (ls, head) to cmd.exe which fails. Need PowerShell wrapper or WSL detection.
- **Agent memory store via tool call** : Agents never successfully called `memory` with `add-entry` directly. Solved by moving storage to workflow level.

### Architecture decision
**Workflow-level memory store** > **Agent-level memory store**. The `cache-context` node guarantees storage without relying on agent compliance. Agents only need to READ memory (which they do reliably). Storage is orchestrated by the workflow.

### Files modified
- `content/system/blocks/agents/project-preparer/system-prompt.md` — Simplified (4 tools, memory read only)
- `content/system/blocks/agents/project-preparer/project-preparer.agent.block.json` — maxIterations 6
- `content/system/blocks/agents/task-planner/system-prompt.md` — Added memory read + validation error recovery
- `content/system/blocks/agents/task-planner/task-planner.agent.block.json` — maxIterations 7, validationError input
- `content/system/blocks/agents/implement-single-step/system-prompt.md` — Optional memory write for patterns
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` — Added cache-context node, descriptive task for project-preparer
- `apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs` — Auto-create stores in AddEntryAsync
