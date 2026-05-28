# IMemoryProvider rename — Design

**Goal:** Renommer l'interface memoire pour s'aligner avec le vocabulaire "provider" (preparation Hermes-better : plugin layer). Pas d'impl Brain dans ce cycle.

**Roadmap phase:** Phase-65 (sub-phase 65-G-prep)

**Tags:** [sdk]

**Scope (in):**
- Rename `IMemoryManager` -> `IMemoryProvider` (interface only)
- Rename `FileSystemMemoryManager` -> `FileSystemMemoryProvider` (impl only)
- Update toutes les references dans le backend C# (4 fichiers + Program.cs DI)
- Tests unitaires de regression (round-trip + DI resolve)
- GATE No Legacy : `grep -r "IMemoryManager\|FileSystemMemoryManager"` = 0

**Scope (out — YAGNI explicite):**
- BrainMemoryProvider impl -> cycle ulterieur (necessite redesign spec API Brain reelle)
- Config section `Maestro:Memory:Provider` -> cycle ulterieur (besoin uniquement quand 2+ providers)
- Env var override -> cycle ulterieur
- DI factory pattern -> cycle ulterieur (un seul provider = registration directe)
- Health check Brain -> cycle ulterieur

**Constraints:**
- No Legacy Support : aucun alias, aucun `[Obsolete]`, aucun typedef de transition
- Cardinal Rule : changement purement nominal, aucun changement de comportement runtime attendu
- Tous les tests existants doivent rester verts apres rename

## Cardinal Rule check

**Respecte sans question.** Le rename ne touche AUCUN code de session-type-specifique. La logique runtime reste identique. Litmus test PASS : un nouveau session type peut etre cree par JSON only apres ce changement.

## No Legacy Support check

**Strict.** Les 2 fichiers `IMemoryManager.cs` et `FileSystemMemoryManager.cs` sont supprimes. Aucun marker deprecated. Aucun typedef `using IMemoryManager = IMemoryProvider`. Aucun commentaire `// renamed from`. Si du code de test references l'ancien nom, il est mis a jour dans le meme cycle.

## Architecture

```
apps/backend/src/
  Maestro.Application/Interfaces/
    IMemoryProvider.cs                   (NEW — moved from IMemoryManager.cs, identical contract)
  Maestro.Domain/Entities/
    MemoryStore.cs                       (unchanged — keeps MemoryStore + MemoryEntry classes)
  Maestro.Infrastructure/Memory/
    FileSystemMemoryProvider.cs          (NEW — moved from FileSystemMemoryManager.cs, identical impl)
  Maestro.Infrastructure/Context/
    ContextAssembler.cs                  (MODIFIED — field/param renames only)
  Maestro.Infrastructure/BlockExecutors/
    MemoryBlockExecutor.cs               (MODIFIED — field/param renames only)
  Maestro.Api/Configuration/
    MemoryPreloaderService.cs            (MODIFIED — ctor param rename only)
  Maestro.Api/
    Program.cs                           (MODIFIED — DI registration: IMemoryManager -> IMemoryProvider, FileSystemMemoryManager -> FileSystemMemoryProvider)
```

Suppressions :
```
apps/backend/src/
  Maestro.Application/Interfaces/IMemoryManager.cs            (DELETE)
  Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs    (DELETE)
```

## Affected systems

- Backend C# uniquement
- LLM-Provider : non touche
- TUI (`packages/maestro-code`) : non touche
- CLI (`packages/maestro-cli`) : non touche
- Blocks (`content/system/blocks/`) : non touche (`MemoryBlockExecutor` consomme l'interface renomme, comportement identique)
- Contracts (`content/system/contracts/`) : non touche
- Tests existants : a auditer pour references `IMemoryManager`/`FileSystemMemoryManager`, mettre a jour si trouve

## Risks

- **Compilation downstream** : si des projets de test ou des packages externes referencent `IMemoryManager` via reflexion ou nom string, le rename peut casser silencieusement. **Mitigation** : GATE-3 `grep -r` exhaustif au repo (`apps/backend/` + `apps/backend/tests/`).
- **Tests `IMemoryManager` existants** : possibles tests qui referencent l'ancien nom via reflection ou casting. **Mitigation** : researcher fait un `grep -rn "IMemoryManager\|FileSystemMemoryManager"` complet AVANT planification, liste tous les call sites dans le plan.
- **Cas oublies dans Program.cs** : 3+ lignes de DI a editer (`AddSingleton<IMemoryManager, FileSystemMemoryManager>`, `MemoryBlockExecutor` resolution, `ContextAssembler` resolution). **Mitigation** : researcher liste les lignes exactes dans le plan.
