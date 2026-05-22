# Checklist — IMemoryProvider rename

**Linked spec:** [2026-05-22-memory-provider-rename-design.md](2026-05-22-memory-provider-rename-design.md)
**Tags:** [sdk]
**Phase:** Phase-65 (sub-phase 65-G-prep)

## Code

- [x] [SPEC-1] [sdk] Create `IMemoryProvider.cs` with identical contract (10 methodes, signatures inchangees, namespace `Maestro.Application.Interfaces`). Delete `IMemoryManager.cs` — `apps/backend/src/Maestro.Application/Interfaces/IMemoryProvider.cs`
- [x] [SPEC-2] [sdk] Create `FileSystemMemoryProvider.cs` implementing `IMemoryProvider` with identical logic (cache `ConcurrentDictionary`, persist JSON, GetRelevant scoring `confidence * recency * useCount`). Delete `FileSystemMemoryManager.cs` — `apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryProvider.cs`
- [x] [SPEC-3] [sdk] Refactor `ContextAssembler` : field `_memoryManager` -> `_memoryProvider`, ctor param `IMemoryManager?` -> `IMemoryProvider?`. Aucun changement de comportement (call `GetRelevantEntriesAsync` reste identique) — `apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs`
- [x] [SPEC-4] [sdk] Refactor `MemoryBlockExecutor` : field `_memoryManager` -> `_memoryProvider`, ctor param `IMemoryManager` -> `IMemoryProvider`. Aucun changement aux 6 operations de block (create-store, add-entry, search, get-relevant, remove-entry, delete-store) — `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs`
- [x] [SPEC-5] [sdk] Refactor `MemoryPreloaderService` : ctor param `IMemoryManager` -> `IMemoryProvider`. Aucun changement de logique startup (continue d'appeler `ListStoresAsync`) — `apps/backend/src/Maestro.Api/Configuration/MemoryPreloaderService.cs`
- [x] [SPEC-6] [sdk] Update DI registrations dans `Program.cs` : 3 lignes a editer (registration `AddSingleton<IMemoryManager, FileSystemMemoryManager>` -> `AddSingleton<IMemoryProvider, FileSystemMemoryProvider>`, et resolution `GetRequiredService<IMemoryManager>()` / `GetService<IMemoryManager>()` dans les 2 factory delegates de `ContextAssembler` et `MemoryBlockExecutor`) — `apps/backend/src/Maestro.Api/Program.cs`

## Tests

- [x] [TEST-1] [sdk] Verifier que `IMemoryProvider` est resolvable depuis DI et expose les 10 methodes du contrat identique a feu `IMemoryManager` (compile-check + reflection assert sur les noms de methodes : `CreateStoreAsync`, `GetStoreAsync`, `ListStoresAsync`, `AddEntryAsync`, `GetEntriesAsync`, `SearchAsync`, `RemoveEntryAsync`, `DeleteStoreAsync`, `TouchEntryAsync`, `GetRelevantEntriesAsync`). Verifie SPEC-1 — `apps/backend/tests/Maestro.Infrastructure.Tests/Memory/MemoryProviderContractTests.cs::IMemoryProvider_ExposesTenMethods`
- [x] [TEST-2] [sdk] Round-trip Create -> Add -> GetEntries -> Touch -> Remove -> Delete sur `FileSystemMemoryProvider` : verifie persistence JSON sur disque, cache ConcurrentDictionary repris au reload, scoring `GetRelevantEntriesAsync` identique a l'ancien `FileSystemMemoryManager`. Utiliser dir temporaire (`Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString())`). Verifie SPEC-2 — `apps/backend/tests/Maestro.Infrastructure.Tests/Memory/FileSystemMemoryProviderTests.cs::FileSystemMemoryProvider_RoundTrip_PreservesBehavior`
- [x] [TEST-3] [sdk] Verifier que `ContextAssembler` injecte les memory entries dans le system prompt quand `IMemoryProvider` retourne >=1 entry (provider mocke via Moq, asserter contenu du prompt assemble). Verifie SPEC-3 — `apps/backend/tests/Maestro.Infrastructure.Tests/Context/ContextAssemblerMemoryInjectionTests.cs::ContextAssembler_InjectsMemoryEntries_IntoSystemPrompt`
- [x] [TEST-4] [sdk] Verifier que `MemoryBlockExecutor` route les 6 operations vers les bonnes methodes `IMemoryProvider` (mock Moq, assert calls). Cas tests : `create-store` -> `CreateStoreAsync`, `add-entry` -> `AddEntryAsync`, `search` -> `SearchAsync`, `get-relevant` -> `GetRelevantEntriesAsync`, `remove-entry` -> `RemoveEntryAsync`, `delete-store` -> `DeleteStoreAsync`. Verifie SPEC-4 — `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/MemoryBlockExecutorTests.cs::MemoryBlockExecutor_RoutesAllSixOperations`
- [x] [TEST-5] [sdk] Verifier que `MemoryPreloaderService.StartAsync` appelle `IMemoryProvider.ListStoresAsync` et logue le count (assertion sur logger mocke). Verifie SPEC-5 — `apps/backend/tests/Maestro.Api.Tests/MemoryPreloaderServiceTests.cs::MemoryPreloaderService_StartAsync_ListsStores`
- [x] [TEST-6] [sdk] DI integration : resolve `IMemoryProvider` depuis le `IServiceProvider` configure par `Program.cs`, asserter type concret = `FileSystemMemoryProvider`. Verifier que `MemoryBlockExecutor` et `ContextAssembler` factories resolvent correctement (pas de `null`, pas d'exception). Verifie SPEC-6 — `apps/backend/tests/Maestro.Api.Tests/MemoryProviderDIRegistrationTests.cs::MemoryProvider_DI_ResolvesAsFileSystemProvider`

## Database / Migrations

- [x] [DB-0] None — pas de schema relationnel impacte. Le store FileSystem reste sur disque JSON, structure inchangee.

## Block / Contract changes

- [x] [BLOCK-0] None — le block `memory` continue d'utiliser `MemoryBlockExecutor` qui consomme l'interface renommee. Aucun changement a `content/system/blocks/` ni `content/system/contracts/`.

## Verification gates

- [x] [GATE-1] Layer 1 Type Check : `dotnet build apps/backend/Maestro.sln` PASS, 0 warning, 0 error.
- [x] [GATE-2] Layer 2 Unit Tests : `dotnet test apps/backend/tests/` PASS, et les 6 nouveaux `[TEST-N]` apparaissent dans le run output.
- [x] [GATE-3] No Legacy check : `grep -rn "IMemoryManager\|FileSystemMemoryManager" apps/backend/` retourne 0 match (ni source, ni tests, ni commentaires, ni docs). Aucun `[Obsolete]`, aucun `// legacy`, aucun typedef.
