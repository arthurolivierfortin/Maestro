# Plan — IMemoryProvider rename (Issue #56)

> **Linked spec:** `docs/phases/PHASE-65/specs/2026-05-22-memory-provider-rename-design.md`
> **Linked checklist:** `docs/phases/PHASE-65/specs/2026-05-22-memory-provider-rename-checklist.md`
> **Issue:** #56 — Phase 65-G-prep: Rename IMemoryManager -> IMemoryProvider (no Brain yet)
> **Tags:** [sdk]
> **Scope** : rename mecanique pur. Aucune impl Brain. Aucun changement de comportement.

## Resume executif

Ce cycle est un **pur rename de symboles**. 6 SPECs, 6 TESTs, 3 GATEs. Pas de design decision. Tous les call sites sont identifies (grep complet ci-dessous). Le builder doit :

1. Renommer 2 fichiers source (interface + impl)
2. Rafraichir les references dans 4 fichiers consumer (3 refactors + 1 DI registration)
3. Ajouter 6 tests qui verifient le comportement post-rename
4. Confirmer GATE-3 : `grep "IMemoryManager\|FileSystemMemoryManager"` retourne 0 dans `apps/backend/`

## Call sites inventory (grep `IMemoryManager|FileSystemMemoryManager`)

Verifie via `Grep` sur `C:\Meastro\apps\backend\` + `Glob *.cs` sur tout le repo (aucun match hors backend) :

| Fichier | Lignes | Type |
|---------|--------|------|
| `apps/backend/src/Maestro.Application/Interfaces/IMemoryManager.cs` | 9 | declaration interface |
| `apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs` | 15, 18, 30 | declaration classe + champ logger + ctor |
| `apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs` | 13 (commentaire), 20, 25 | champ `_memoryManager`, ctor param |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs` | 11 (commentaire), 16, 18 | champ + ctor param |
| `apps/backend/src/Maestro.Api/Configuration/MemoryPreloaderService.cs` | 11, 14 | champ + ctor param |
| `apps/backend/src/Maestro.Api/Program.cs` | 116, 143, 144, 146, 150 | 1 registration + 2 resolves (factory ContextAssembler L116, factory MemoryBlockExecutor L150) + 1 logger generic L146 |

**Aucun test existant** ne reference ces symboles (verifie via grep sur `apps/backend/tests/`).

**Aucun usage hors backend** (verifie via grep `*.cs` sur tout le repo).

## Tests project layout — decision pragmatique

Constat baseline :
- `apps/backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj` **existe** et reference `Maestro.Infrastructure.csproj` + `Maestro.Api.csproj`. Il est **hors `Maestro.sln`** (build via `dotnet build apps/backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj`). Build verifie OK (68 warnings preexistants, 0 error).
- `apps/backend/tests/Maestro.Api.Tests/` n'a **PAS de .csproj** — seul un fichier orphelin (`Controllers/DiscoveryControllerIntegrationTests.cs`) y traine, jamais compile.

**Decision builder** : placer TOUS les 6 nouveaux tests dans `Maestro.Infrastructure.Tests/` (qui peut deja resoudre `Maestro.Api.*` via ProjectReference). Adapter les paths declares dans la checklist :
- TEST-1 et TEST-2 : `apps/backend/tests/Maestro.Infrastructure.Tests/Memory/MemoryProviderContractTests.cs` + `FileSystemMemoryProviderTests.cs` (creer le sous-dossier `Memory/`)
- TEST-3 : `apps/backend/tests/Maestro.Infrastructure.Tests/Context/ContextAssemblerMemoryInjectionTests.cs` (creer sous-dossier `Context/`)
- TEST-4 : `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/MemoryBlockExecutorTests.cs` (sous-dossier deja existant)
- TEST-5 : **deplacer** `MemoryPreloaderServiceTests.cs` dans `Maestro.Infrastructure.Tests/Api/` (creer sous-dossier `Api/`) — pas de projet `Maestro.Api.Tests.csproj` disponible. Le csproj de Infrastructure.Tests reference `Maestro.Api.csproj` donc resolution OK.
- TEST-6 : idem, dans `Maestro.Infrastructure.Tests/Api/MemoryProviderDIRegistrationTests.cs`.

Ce n'est **pas un changement de scope** : la spec dit "tests unitaires de regression". Le projet ou ils vivent est un detail d'implementation. Builder note ce shift dans son commit message.

## Cardinal Rule check

PASS. Rename de symboles backend. Aucun ajout de logique session-specific. Apres le rename, creer un nouveau session type reste un changement JSON only.

## No Legacy Support check

STRICT. Tout `IMemoryManager` / `FileSystemMemoryManager` doit disparaitre. Aucun alias, aucun `[Obsolete]`, aucun typedef. GATE-3 enforce ca.

## Common pitfalls checked

- **JsonElement corruption** : N/A (aucun nouveau code de serialisation, juste rename)
- **DI circular** : N/A (pas de changement de graphe DI, juste renommage du symbole)
- **God class pattern** : N/A (rename pur)
- **`@ts-nocheck`** : N/A (zero TS touche)
- **AgentBlockExecutor tool dispatch** : N/A
- **SDK/backend mismatch** : N/A (aucune route API ne expose ce type — Memory*Service est interne)
- **Session-specific logic in infra** : N/A
- **Backend file locked** : `taskkill /F /IM Maestro.Api.exe` avant build si necessaire

---

## SPEC-1 — Create IMemoryProvider.cs, delete IMemoryManager.cs

**Tag:** [sdk]
**File a creer:** `apps/backend/src/Maestro.Application/Interfaces/IMemoryProvider.cs`
**File a supprimer:** `apps/backend/src/Maestro.Application/Interfaces/IMemoryManager.cs`
**Existing pattern:** L'interface est deja parfaitement formee — copy-paste du contenu en remplacant le nom de type.
**Pitfalls:** Garder le namespace `Maestro.Application.Interfaces`. Garder les XML docs.

### Step 1.1 — RED
TEST-1 (voir plus bas) compile-fail tant que `IMemoryProvider` n'existe pas.

### Step 1.2 — GREEN
1. Creer `IMemoryProvider.cs` avec contenu identique a `IMemoryManager.cs` mais `public interface IMemoryProvider` au lieu de `public interface IMemoryManager`. **10 methodes inchangees** (signatures, default params, retours, CT params).
2. Supprimer `IMemoryManager.cs`.

### Step 1.3 — Verification
```bash
test -f apps/backend/src/Maestro.Application/Interfaces/IMemoryProvider.cs
test ! -f apps/backend/src/Maestro.Application/Interfaces/IMemoryManager.cs
grep -c "public interface IMemoryProvider" apps/backend/src/Maestro.Application/Interfaces/IMemoryProvider.cs  # == 1
```

---

## SPEC-2 — Create FileSystemMemoryProvider.cs, delete FileSystemMemoryManager.cs

**Tag:** [sdk]
**File a creer:** `apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryProvider.cs`
**File a supprimer:** `apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs`
**Existing pattern:** Copy contenu integral, rename 3 occurrences locales : `class FileSystemMemoryManager : IMemoryManager` → `class FileSystemMemoryProvider : IMemoryProvider`, `ILogger<FileSystemMemoryManager>` → `ILogger<FileSystemMemoryProvider>` (2 lignes : champ + ctor param).
**Pitfalls:**
- Namespace `Maestro.Infrastructure.Memory` reste.
- `using Maestro.Application.Interfaces` (deja present, pointe vers IMemoryProvider apres SPEC-1).
- Aucune modif a la logique : cache `ConcurrentDictionary`, `JsonOptions`, `SemaphoreSlim`, `EnsureLoadedAsync`, formula `confidence * recency * (1 + log(1+useCount))` toutes identiques.

### Step 2.1 — RED
TEST-2 (voir plus bas) compile-fail tant que `FileSystemMemoryProvider` n'existe pas.

### Step 2.2 — GREEN
1. Creer `FileSystemMemoryProvider.cs` avec contenu de l'ancien fichier, 3 rename internes (class decl, ILogger generic param x2).
2. Supprimer `FileSystemMemoryManager.cs`.

### Step 2.3 — Verification
```bash
test -f apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryProvider.cs
test ! -f apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryManager.cs
grep -c "FileSystemMemoryProvider : IMemoryProvider" apps/backend/src/Maestro.Infrastructure/Memory/FileSystemMemoryProvider.cs  # == 1
```

---

## SPEC-3 — Refactor ContextAssembler

**Tag:** [sdk]
**File:** `apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs`
**Lignes a editer:**
- L13 : commentaire `Phase 36-C: Also reads from IMemoryManager` → `IMemoryProvider`
- L20 : `private readonly IMemoryManager? _memoryManager;` → `private readonly IMemoryProvider? _memoryProvider;`
- L25 : `IMemoryManager? memoryManager = null)` → `IMemoryProvider? memoryProvider = null)`
- L29 : `_memoryManager = memoryManager;` → `_memoryProvider = memoryProvider;`
- L52 : `if (_memoryManager != null)` → `if (_memoryProvider != null)`
- L54 : `_memoryManager.GetRelevantEntriesAsync(...)` → `_memoryProvider.GetRelevantEntriesAsync(...)`

**Existing pattern:** Aucun. Rename mecanique de champ.
**Pitfalls:**
- Aucun changement de comportement attendu sur la methode `AssembleAsync`. Verifier que la signature publique reste identique (TEST-3 le verifie).

### Step 3.1 — RED
TEST-3 inject `IMemoryProvider` mocke et asserter contenu de prompt. Sans le rename, l'injection Moq fail (type mismatch).

### Step 3.2 — GREEN
Sed-style replace dans `ContextAssembler.cs` : 6 lignes editees, comportement identique.

### Step 3.3 — Verification
```bash
grep -c "IMemoryProvider\|_memoryProvider" apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs  # >= 6
grep -c "IMemoryManager\|_memoryManager" apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs  # == 0
```

---

## SPEC-4 — Refactor MemoryBlockExecutor

**Tag:** [sdk]
**File:** `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs`
**Lignes a editer:**
- L11 : commentaire `Wraps IMemoryManager as a composable block.` → `Wraps IMemoryProvider as a composable block.`
- L16 : `private readonly IMemoryManager _memoryManager;` → `private readonly IMemoryProvider _memoryProvider;`
- L18 : `public MemoryBlockExecutor(IMemoryManager memoryManager)` → `public MemoryBlockExecutor(IMemoryProvider memoryProvider)`
- L20 : `_memoryManager = memoryManager;` → `_memoryProvider = memoryProvider;`
- L91, L125, L141, L166, L192, L206 : `_memoryManager.*Async(...)` → `_memoryProvider.*Async(...)`

**Existing pattern:** Aucun. Rename de field + 6 call sites.
**Pitfalls:**
- Aucun changement aux 6 operations (`create-store`, `add-entry`, `search`, `get-relevant`, `remove-entry`, `delete-store`).
- Conserver la helper `GetString/GetDouble/GetInt/GetStringList` strictement inchangee.

### Step 4.1 — RED
TEST-4 mocke `IMemoryProvider` et asserter routing 6 ops. Sans rename, mock Moq impossible (type mismatch).

### Step 4.2 — GREEN
Sed-style replace : ~10 lignes editees.

### Step 4.3 — Verification
```bash
grep -c "IMemoryProvider\|_memoryProvider" apps/backend/src/Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs  # >= 10
grep -c "IMemoryManager\|_memoryManager" apps/backend/src/Maestro.Infrastructure/BlockExecutors/MemoryBlockExecutor.cs  # == 0
```

---

## SPEC-5 — Refactor MemoryPreloaderService

**Tag:** [sdk]
**File:** `apps/backend/src/Maestro.Api/Configuration/MemoryPreloaderService.cs`
**Lignes a editer:**
- L11 : `private readonly IMemoryManager _memoryManager;` → `private readonly IMemoryProvider _memoryProvider;`
- L14 : `public MemoryPreloaderService(IMemoryManager memoryManager, ...)` → `public MemoryPreloaderService(IMemoryProvider memoryProvider, ...)`
- L16 : `_memoryManager = memoryManager;` → `_memoryProvider = memoryProvider;`
- L24 : `await _memoryManager.ListStoresAsync(...)` → `await _memoryProvider.ListStoresAsync(...)`

**Existing pattern:** Aucun. Rename ctor param + 1 call site.
**Pitfalls:**
- `StartAsync` reste try/catch + log `non-fatal`. Aucun changement de comportement.

### Step 5.1 — RED
TEST-5 mocke `IMemoryProvider`, instancie `MemoryPreloaderService`, call `StartAsync`, verifie call `ListStoresAsync` + log info. Compile-fail sans rename.

### Step 5.2 — GREEN
Sed-style replace : 4 lignes.

### Step 5.3 — Verification
```bash
grep -c "IMemoryProvider\|_memoryProvider" apps/backend/src/Maestro.Api/Configuration/MemoryPreloaderService.cs  # >= 4
grep -c "IMemoryManager\|_memoryManager" apps/backend/src/Maestro.Api/Configuration/MemoryPreloaderService.cs  # == 0
```

---

## SPEC-6 — Update DI registrations in Program.cs

**Tag:** [sdk]
**File:** `apps/backend/src/Maestro.Api/Program.cs`
**Lignes EXACTES a editer (5 occurrences sur 4 sites logiques) :**

- **L116** (factory ContextAssembler) :
  - Avant : `sp.GetService<IMemoryManager>()));`
  - Apres : `sp.GetService<IMemoryProvider>()));`
- **L143** (registration singleton) :
  - Avant : `builder.Services.AddSingleton<IMemoryManager>(sp =>`
  - Apres : `builder.Services.AddSingleton<IMemoryProvider>(sp =>`
- **L144** (factory body — new instance) :
  - Avant : `    new FileSystemMemoryManager(`
  - Apres : `    new FileSystemMemoryProvider(`
- **L146** (logger generic param) :
  - Avant : `        sp.GetService<ILogger<FileSystemMemoryManager>>()));`
  - Apres : `        sp.GetService<ILogger<FileSystemMemoryProvider>>()));`
- **L150** (factory MemoryBlockExecutor) :
  - Avant : `        sp.GetRequiredService<IMemoryManager>()));`
  - Apres : `        sp.GetRequiredService<IMemoryProvider>()));`

**Note** : le commentaire `// Phase 36-C: Memory Manager (persistent knowledge stores)` L141 — peut etre laisse tel quel OU update vers "Memory Provider" pour coherence. **Decision** : le mettre a jour vers `// Phase 36-C: Memory Provider (persistent knowledge stores)`. C'est un commentaire descriptif, pas un alias legacy.

**Existing pattern:** Aucun changement de structure DI — meme singleton, meme factory pattern.
**Pitfalls:**
- **DI circular** : N/A. Aucune nouvelle dependance. Le graphe DI reste identique (juste les symboles renommes).
- **File locked** : si `Maestro.Api.exe` tourne, kill avant build (`taskkill /F /IM Maestro.Api.exe`).

### Step 6.1 — RED
TEST-6 verifie resolution DI. Tant que Program.cs n'est pas update, `sp.GetService<IMemoryProvider>()` retourne `null` et le test fail.

### Step 6.2 — GREEN
5 edits dans Program.cs aux lignes ci-dessus.

### Step 6.3 — Verification
```bash
grep -c "IMemoryProvider\|FileSystemMemoryProvider" apps/backend/src/Maestro.Api/Program.cs  # >= 5
grep -c "IMemoryManager\|FileSystemMemoryManager" apps/backend/src/Maestro.Api/Program.cs  # == 0
dotnet build apps/backend/Maestro.sln  # 0 error
```

---

## TEST-1 — IMemoryProvider exposes 10 methods (compile + reflection)

**Tag:** [sdk]
**File:** `apps/backend/tests/Maestro.Infrastructure.Tests/Memory/MemoryProviderContractTests.cs`
**Verifie:** SPEC-1
**Pattern:** Tests existants `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/PreFlightCheckTests.cs` pour xunit + Moq.

### Code (squelette pour builder)
```csharp
using System.Reflection;
using Maestro.Application.Interfaces;
using Xunit;

namespace Maestro.Infrastructure.Tests.Memory;

public class MemoryProviderContractTests
{
    [Fact]
    public void IMemoryProvider_ExposesTenMethods()
    {
        var iface = typeof(IMemoryProvider);
        var expected = new[]
        {
            "CreateStoreAsync", "GetStoreAsync", "ListStoresAsync",
            "AddEntryAsync", "GetEntriesAsync", "SearchAsync",
            "RemoveEntryAsync", "DeleteStoreAsync", "TouchEntryAsync",
            "GetRelevantEntriesAsync"
        };
        var actual = iface.GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Select(m => m.Name).OrderBy(n => n).ToArray();
        Assert.Equal(expected.OrderBy(n => n).ToArray(), actual);
    }
}
```

### Verification
```bash
dotnet test apps/backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj --filter "IMemoryProvider_ExposesTenMethods"
```
Expected: 1 passed, 0 failed.

---

## TEST-2 — FileSystemMemoryProvider round-trip preserves behavior

**Tag:** [sdk]
**File:** `apps/backend/tests/Maestro.Infrastructure.Tests/Memory/FileSystemMemoryProviderTests.cs`
**Verifie:** SPEC-2

### Code (squelette)
```csharp
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Memory;
using Xunit;

namespace Maestro.Infrastructure.Tests.Memory;

public class FileSystemMemoryProviderTests : IDisposable
{
    private readonly string _tempDir;

    public FileSystemMemoryProviderTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"memprov-{Guid.NewGuid()}");
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir)) Directory.Delete(_tempDir, true);
    }

    [Fact]
    public async Task FileSystemMemoryProvider_RoundTrip_PreservesBehavior()
    {
        var provider = new FileSystemMemoryProvider(_tempDir);
        var store = await provider.CreateStoreAsync("s1", "Store 1", "general");
        var entry = new MemoryEntry
        {
            Key = "k1", Content = "hello world",
            Confidence = 0.9, Tags = new() { "test" },
            CreatedAt = DateTimeOffset.UtcNow, LastUsedAt = DateTimeOffset.UtcNow
        };
        await provider.AddEntryAsync("s1", entry);

        // Reload via fresh instance
        var fresh = new FileSystemMemoryProvider(_tempDir);
        var entries = await fresh.GetEntriesAsync("s1");
        Assert.Single(entries);
        Assert.Equal("k1", entries[0].Key);

        // Touch + relevance
        await fresh.TouchEntryAsync("s1", "k1");
        var relevant = await fresh.GetRelevantEntriesAsync(maxEntries: 5);
        Assert.Single(relevant);

        await fresh.RemoveEntryAsync("s1", "k1");
        await fresh.DeleteStoreAsync("s1");
        var afterDelete = await fresh.GetStoreAsync("s1");
        Assert.Null(afterDelete);
    }
}
```

### Verification
```bash
dotnet test ... --filter "FileSystemMemoryProvider_RoundTrip_PreservesBehavior"
```
Expected: 1 passed.

---

## TEST-3 — ContextAssembler injects memory entries

**Tag:** [sdk]
**File:** `apps/backend/tests/Maestro.Infrastructure.Tests/Context/ContextAssemblerMemoryInjectionTests.cs`
**Verifie:** SPEC-3

### Code (squelette)
```csharp
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Context;
using Moq;
using Xunit;

namespace Maestro.Infrastructure.Tests.Context;

public class ContextAssemblerMemoryInjectionTests
{
    [Fact]
    public async Task ContextAssembler_InjectsMemoryEntries_IntoSystemPrompt()
    {
        var convMgr = new Mock<IConversationManager>();
        convMgr.Setup(c => c.GetMessages(It.IsAny<string>())).Returns(new List<Message>
        {
            new() { Role = "system", Content = "Base prompt" }
        });

        var memProv = new Mock<IMemoryProvider>();
        memProv.Setup(m => m.GetRelevantEntriesAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MemoryEntry>
            {
                new() { Key = "fact1", Content = "Sky is blue", Confidence = 1.0 }
            });

        var factory = new ContextProcessorFactory(/* sp */ null!); // builder: use minimal real factory
        var assembler = new ContextAssembler(convMgr.Object, factory, memProv.Object);

        var result = await assembler.AssembleAsync("conv1", new ContextConfig { Strategy = "passthrough" });

        Assert.Contains("Relevant Knowledge", result.SystemPrompt);
        Assert.Contains("Sky is blue", result.SystemPrompt);
    }
}
```

**Note builder** : `ContextProcessorFactory` ctor signature a verifier. Si construction non triviale, mocker `IContextAssembler` differemment ou utiliser un fake processor. Le but du test est de prouver que la branche `if (_memoryProvider != null)` injecte bien dans le prompt — passer un `Message` system + memory >=1 et asserter sur le SystemPrompt resultant suffit.

### Verification
```bash
dotnet test ... --filter "ContextAssembler_InjectsMemoryEntries_IntoSystemPrompt"
```

---

## TEST-4 — MemoryBlockExecutor routes 6 operations

**Tag:** [sdk]
**File:** `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/MemoryBlockExecutorTests.cs`
**Verifie:** SPEC-4

### Code (squelette)
```csharp
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.BlockExecutors;
using Moq;
using Xunit;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.Tests.BlockExecutors;

public class MemoryBlockExecutorTests
{
    private static (MemoryBlockExecutor exec, Mock<IMemoryProvider> mock) Build()
    {
        var mock = new Mock<IMemoryProvider>(MockBehavior.Strict);
        return (new MemoryBlockExecutor(mock.Object), mock);
    }

    [Theory]
    [InlineData("create-store", nameof(IMemoryProvider.CreateStoreAsync))]
    [InlineData("add-entry", nameof(IMemoryProvider.AddEntryAsync))]
    [InlineData("search", nameof(IMemoryProvider.SearchAsync))]
    [InlineData("get-relevant", nameof(IMemoryProvider.GetRelevantEntriesAsync))]
    [InlineData("remove-entry", nameof(IMemoryProvider.RemoveEntryAsync))]
    [InlineData("delete-store", nameof(IMemoryProvider.DeleteStoreAsync))]
    public async Task MemoryBlockExecutor_RoutesAllSixOperations(string operation, string expectedMethod)
    {
        // Builder: Setup mock for each operation with minimal valid inputs,
        // call ExecuteAsync, Verify the right method was called.
        // Example pour 'add-entry': storeId + key + content required.
        // ... full inputs construction per op (see MemoryBlockExecutor.cs lines 81-211).
    }
}
```

**Note builder** : decomposer en 6 `[Fact]` separes peut etre plus lisible que `[Theory]`. Chacun setup un mock minimal, construit `inputs` selon le contrat de chaque op (cf. SPEC-4 lignes referencees), execute, et `mock.Verify(m => m.CreateStoreAsync(...), Times.Once)` etc.

### Verification
```bash
dotnet test ... --filter "MemoryBlockExecutor_RoutesAllSixOperations"
```

---

## TEST-5 — MemoryPreloaderService starts and lists stores

**Tag:** [sdk]
**File:** `apps/backend/tests/Maestro.Infrastructure.Tests/Api/MemoryPreloaderServiceTests.cs` (deplace depuis le path declare — voir section "Tests project layout")
**Verifie:** SPEC-5

### Code (squelette)
```csharp
using Maestro.Api.Configuration;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Maestro.Infrastructure.Tests.Api;

public class MemoryPreloaderServiceTests
{
    [Fact]
    public async Task MemoryPreloaderService_StartAsync_ListsStores()
    {
        var prov = new Mock<IMemoryProvider>();
        prov.Setup(p => p.ListStoresAsync(null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MemoryStore> { new() { Id = "s1", Name = "Store" } });

        var svc = new MemoryPreloaderService(prov.Object, NullLogger<MemoryPreloaderService>.Instance);
        await svc.StartAsync(CancellationToken.None);

        prov.Verify(p => p.ListStoresAsync(null, null, It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

### Verification
```bash
dotnet test ... --filter "MemoryPreloaderService_StartAsync_ListsStores"
```

---

## TEST-6 — DI integration : IMemoryProvider resolves as FileSystemMemoryProvider

**Tag:** [sdk]
**File:** `apps/backend/tests/Maestro.Infrastructure.Tests/Api/MemoryProviderDIRegistrationTests.cs` (deplace — voir section "Tests project layout")
**Verifie:** SPEC-6

### Code (squelette)
```csharp
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Memory;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Maestro.Infrastructure.Tests.Api;

public class MemoryProviderDIRegistrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public MemoryProviderDIRegistrationTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public void MemoryProvider_DI_ResolvesAsFileSystemProvider()
    {
        using var scope = _factory.Services.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<IMemoryProvider>();
        Assert.NotNull(provider);
        Assert.IsType<FileSystemMemoryProvider>(provider);
    }
}
```

**Note builder** : `WebApplicationFactory<Program>` requiert `Program` accessible. Si `Program.cs` n'est pas une partial class publique, ajouter `public partial class Program {}` en fin de Program.cs (pattern .NET 6+ minimal API). C'est probablement deja le cas — verifier sinon ajouter cette ligne.

### Verification
```bash
dotnet test ... --filter "MemoryProvider_DI_ResolvesAsFileSystemProvider"
```

---

## GATE-1 — Type check

```bash
dotnet build apps/backend/Maestro.sln
```
Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`.

**Baseline verifie** (avant ce cycle) : 0 warning, 0 error. Aucun warning autorise apres le rename.

## GATE-2 — Unit tests

```bash
dotnet test apps/backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj
dotnet test apps/backend/tests/Maestro.Domain.Tests/Maestro.Domain.Tests.csproj
dotnet test apps/backend/tests/Maestro.Execution.Tests/Maestro.Execution.Tests.csproj
```
Expected: tous pass. Les 6 nouveaux tests visibles dans le output. Aucune regression (les tests existants restent green).

## GATE-3 — No Legacy check (MANDATORY)

```bash
grep -rn "IMemoryManager\|FileSystemMemoryManager" apps/backend/
```
Expected: **0 match.** Aucun code, aucun commentaire, aucun .csproj, aucun .md.

Note builder : verifier aussi les `bin/` et `obj/` ne sont pas trompeurs — la commande `grep -rn` les inclura, donc soit nettoyer `dotnet clean apps/backend/Maestro.sln` avant le check, soit ajouter `--exclude-dir={bin,obj}`.

---

## Cross-cutting concerns

1. **DI registration in Program.cs** : 5 edits sur 4 sites logiques (cf. SPEC-6). Pas d'ajout/suppression de service, juste renommage symbole.
2. **Aucune migration** : MemoryStore reste sur disque, fichier JSON identique. Pas de migration runtime — le file format n'inclut pas le nom de l'impl.
3. **Aucun changement de block.json** : MemoryBlockExecutor cible toujours le block type "memory".
4. **Aucun changement de contracts/** : meme contrat de capacite.
5. **Test projects hors sln** : `Maestro.Infrastructure.Tests` doit etre build separement. Builder doit lancer `dotnet test apps/backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj`.
6. **`Maestro.Api.Tests/Controllers/DiscoveryControllerIntegrationTests.cs`** est un fichier orphelin (pas de csproj). Ne pas le toucher dans ce cycle — c'est du baseline pre-existant. Hors scope.

---

## Risks identifies (re-confirmes)

- **Build downstream** : zero risque hors backend (grep `*.cs` repo-wide = aucun match hors `apps/backend/`).
- **WebApplicationFactory<Program>** : depend de `Program` accessible. Si non publique, le builder doit ajouter `public partial class Program {}` (1 ligne en fin de Program.cs).
- **`Maestro.Infrastructure.Tests` hors sln** : confirmer que le `csproj` reference bien les bons packages (Moq present : OUI, ligne 19 du csproj).

## Status pre-build

Tout est mecanique. Aucune decision de design en suspens. Le seul shift par rapport a la checklist : placement des tests (5 et 6 du projet Api.Tests inexistant — deplaces vers Infrastructure.Tests). Note dans le commit pour transparence.
