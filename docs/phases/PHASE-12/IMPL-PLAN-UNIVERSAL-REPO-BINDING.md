# Plan d'implémentation : Universal Repository Binding

**Phase**: 12.5 - 12.7
**Effort estimé**: 4-5 jours
**Fichiers impactés**: 12 fichiers modifiés, 1 fichier créé

---

## Objectif

Permettre à tout enfant de `ContainerSession` (Workspace, ProjectSession, FoundrySession, futurs types) de se binder à un repository. Monter `RepositoryPath` dans la classe de base et standardiser la structure `.maestro/` dans le repo bindé.

---

## Analyse de l'existant

### Propriétés liées au binding par entité

| Entité | RepositoryPath | ContainerBinding | Config Source |
|--------|---------------|-----------------|---------------|
| `ContainerSession` | NON (absent) | `Binding` (propriété) | — |
| `ProjectSession` | OUI (propriété directe, ligne 19) | Via `Binding` hérité | `Config.Access.Level` |
| `FoundrySession` | NON (via `Config.RepositoryConfig.RepositoryPath`) | Via `Binding` hérité | `Config.Source` enum + `Config.RepositoryConfig` |
| `Workspace` | NON | Hardcodé `ContainerBinding.None` (ligne 129) | — |

### Sérialisation actuelle

| Repository | Stockage | Comment RepositoryPath est persisté |
|-----------|---------|--------------------------------------|
| `FileSystemProjectSessionRepository` | `{project}/.maestro/sessions/{id}.json` | `SessionJsonDto.RepositoryPath` directement |
| `FileSystemFoundrySessionRepository` | `data/foundry/sessions/{id}.session.json` | `BindingJsonDto.RepositoryPath` via `MapBindingToDto` |
| `FileSystemWorkspaceRepository` | `{storagePath}/{id}.json` | PAS persisté (binding = None) |

### Factory methods (Reconstitute)

| Entité | Paramètre `binding` | Paramètre `repositoryPath` |
|--------|---------------------|---------------------------|
| `ProjectSession.Reconstitute` | Oui (ligne 166) | Oui (ligne 148) — les deux séparément |
| `FoundrySession.Reconstitute` | Oui (ligne 175) | Non — extrait du binding |
| `Workspace.Reconstitute` | Non — hardcodé None | Non |

---

## Work Packages

### WP1 : Monter RepositoryPath dans ContainerSession

**Fichier** : `backend/src/Maestro.Domain/Entities/ContainerSession.cs`

**Changements** :

1. Ajouter la propriété `RepositoryPath` (nullable) :

```csharp
// Après la ligne 71 (Binding property)
/// <summary>
/// Chemin du repository bindé. Null si la session est en mode sandbox.
/// La valeur est la source de vérité — le Binding est dérivé de cette propriété.
/// </summary>
public string? RepositoryPath { get; protected set; }
```

2. Ajouter une méthode `BindToRepository` :

```csharp
/// <summary>
/// Binde cette session à un repository local.
/// Doit être appelé à la création uniquement (avant Start).
/// </summary>
public void BindToRepository(
    string repositoryPath,
    RepositoryAccessLevel accessLevel = RepositoryAccessLevel.Controlled)
{
    if (Status != ContainerSessionStatus.Created)
        throw new InvalidOperationException("Cannot bind after session has started");

    if (string.IsNullOrWhiteSpace(repositoryPath))
        throw new ArgumentException("Repository path cannot be empty", nameof(repositoryPath));

    RepositoryPath = Path.GetFullPath(repositoryPath);
    Binding = ContainerBinding.CreateRepositoryBound(RepositoryPath, accessLevel);
}
```

3. Ajouter une propriété calculée :

```csharp
/// <summary>
/// True si cette session est bindée à un repository.
/// </summary>
public bool IsBoundToRepository => RepositoryPath != null && Binding.Type == ContainerBindingType.Repository;

/// <summary>
/// Chemin du dossier .maestro dans le repo bindé. Null si pas bindé.
/// </summary>
public string? MaestroDataPath => RepositoryPath != null
    ? Path.Combine(RepositoryPath, ".maestro")
    : null;
```

---

### WP2 : Simplifier ProjectSession

**Fichier** : `backend/src/Maestro.Domain/Entities/ProjectSession.cs`

**Changements** :

1. **Retirer** la propriété `RepositoryPath` (ligne 19) — elle est maintenant dans `ContainerSession`

2. **Modifier** `Create` (ligne 87-117) : utiliser `BindToRepository` du parent

```csharp
public static ProjectSession Create(
    string name,
    Authority authority,
    ProjectSessionConfig config,
    string? repositoryPath = null,
    ContextPermissions? permissions = null)
{
    var session = new ProjectSession
    {
        Id = $"session-{Guid.NewGuid():N}",
        Name = name,
        Authority = authority,
        Config = config ?? throw new ArgumentNullException(nameof(config)),
        Status = ContainerSessionStatus.Created,
        CreatedAt = DateTimeOffset.UtcNow,
        Permissions = permissions ?? ContextPermissions.Full,
        // NE PLUS setter Binding ici — on utilise BindToRepository
    };

    if (repositoryPath != null)
    {
        var accessLevel = MapAccessLevel(config.Access.Level);
        session.BindToRepository(repositoryPath, accessLevel);
    }
    else
    {
        session.Binding = ContainerBinding.CreateSandbox();
    }

    return session;
}
```

3. **Modifier** `Reconstitute` (ligne 138-216) : retirer `repositoryPath` comme paramètre séparé, le lire depuis le binding ou le passer au parent

```csharp
public static ProjectSession Reconstitute(
    string id,
    string name,
    Authority authority,
    ProjectSessionConfig config,
    ContainerSessionStatus status,
    SessionTerminalReason terminalReason,
    string? repositoryPath,           // Garde pour compatibilité, mais assigne au parent
    string? parentWorkspaceId,
    string? parentSessionId,
    string workingDirectory,
    ContextPermissions permissions,
    ContainerBinding binding,
    // ... reste inchangé
{
    return new ProjectSession
    {
        Id = id,
        Name = name,
        RepositoryPath = repositoryPath,  // Assigne au parent (ContainerSession)
        // ... reste inchangé
    };
}
```

---

### WP3 : Simplifier FoundrySession

**Fichier** : `backend/src/Maestro.Domain/Entities/FoundrySession.cs`

**Changements** :

1. **Modifier** `Create` (ligne 83-123) : accepter `repositoryPath` directement au lieu de passer par `Config.Source`

```csharp
public static FoundrySession Create(
    string name,
    Authority authority,
    FoundrySessionConfig? config = null,
    string? repositoryPath = null,        // NOUVEAU paramètre
    ContextPermissions? permissions = null)
{
    config ??= new FoundrySessionConfig();

    var session = new FoundrySession
    {
        Id = $"foundry-{Guid.NewGuid():N}",
        Name = name,
        Authority = authority,
        Config = config,
        Status = ContainerSessionStatus.Created,
        CreatedAt = DateTimeOffset.UtcNow,
        Permissions = permissions ?? ContextPermissions.Full,
    };

    if (repositoryPath != null)
    {
        var accessLevel = config.RepositoryConfig?.AccessLevel ?? RepositoryAccessLevel.Controlled;
        session.BindToRepository(repositoryPath, MapAccessLevel(accessLevel));
    }
    else if (config.Source == SessionSource.Repository && config.RepositoryConfig != null)
    {
        // Rétrocompatibilité : si Config.Source est Repository, utiliser le chemin du config
        session.BindToRepository(
            config.RepositoryConfig.RepositoryPath,
            MapAccessLevel(config.RepositoryConfig.AccessLevel));
    }
    else
    {
        session.Binding = ContainerBinding.CreateSandbox();
    }

    return session;
}
```

2. **Modifier** `Reconstitute` (ligne 143-214) : ajouter `repositoryPath` comme paramètre

```csharp
public static FoundrySession Reconstitute(
    // ... paramètres existants
    string? repositoryPath = null,    // NOUVEAU, nullable pour rétrocompatibilité
    // ...
{
    var session = new FoundrySession
    {
        // ...
        RepositoryPath = repositoryPath     // Assigne au parent
              ?? binding?.RepositoryPath,   // Fallback : extraire du binding
        // ...
    };
}
```

**Note** : on garde `Config.Source` et `Config.RepositoryConfig` pour la rétrocompatibilité de la désérialisation. Le code existant qui crée des sessions via config continue de fonctionner. Le nouveau chemin (`repositoryPath` paramètre direct) est le chemin préféré.

---

### WP4 : Permettre Workspace de se binder

**Fichier** : `backend/src/Maestro.Domain/Entities/Workspace.cs`

**Changements** :

1. **Modifier** les factory methods pour accepter `repositoryPath` :

**`Create`** (ajouter paramètre optionnel) :
```csharp
public static Workspace Create(
    string name,
    WorkspaceType type = WorkspaceType.Custom,
    string? description = null,
    string? createdBy = null,
    string? repositoryPath = null)    // NOUVEAU
{
    var ws = new Workspace
    {
        Id = $"ws-{Guid.NewGuid():N}",
        Name = name,
        Type = type,
        Description = description,
        Status = ContainerSessionStatus.Created,
        CreatedAt = DateTimeOffset.UtcNow,
        CreatedBy = createdBy,
        Binding = ContainerBinding.None,  // Défaut
        Permissions = ContextPermissions.Full,
    };

    if (repositoryPath != null)
    {
        ws.BindToRepository(repositoryPath, RepositoryAccessLevel.Full);
    }

    return ws;
}
```

2. **Modifier** `CreateWithPath` (ligne ~177) : vérifier si `path` devrait impliquer un binding

3. **Modifier** `Reconstitute` (ligne ~202) : ajouter `repositoryPath` et `binding` optionnels

```csharp
public static Workspace Reconstitute(
    // ... params existants
    string? repositoryPath = null,
    ContainerBinding? binding = null)
{
    var ws = new Workspace { /* ... existant */ };

    if (repositoryPath != null)
    {
        ws.RepositoryPath = repositoryPath;
        ws.Binding = binding ?? ContainerBinding.CreateRepositoryBound(repositoryPath);
    }

    return ws;
}
```

---

### WP5 : Mettre à jour la persistance

#### 5a. FileSystemProjectSessionRepository

**Fichier** : `backend/src/Maestro.Infrastructure/Sessions/FileSystemProjectSessionRepository.cs`

**Changements** :
- `SerializeSession` (ligne ~230) : `RepositoryPath` est maintenant lu depuis `session.RepositoryPath` (hérité du parent) — **aucun changement nécessaire** car le code lit déjà `session.RepositoryPath`
- `DeserializeSession` (ligne ~316) : idem, passe déjà `dto.RepositoryPath` au `Reconstitute` — **aucun changement**

**Impact** : nul. La propriété a juste changé de classe (ProjectSession → ContainerSession) mais le nom et le type sont identiques.

#### 5b. FileSystemFoundrySessionRepository

**Fichier** : `backend/src/Maestro.Infrastructure/Sessions/FileSystemFoundrySessionRepository.cs`

**Changements** :

1. **Sérialisation** (`MapSessionToDto`, ligne ~350) : ajouter `RepositoryPath` au DTO

```csharp
// Dans FoundrySessionJsonDto, ajouter :
public string? RepositoryPath { get; set; }

// Dans MapSessionToDto :
RepositoryPath = session.RepositoryPath,
```

2. **Désérialisation** (`ReconstitueFromDto`, ligne ~242) : passer `repositoryPath` au Reconstitute

```csharp
return FoundrySession.Reconstitute(
    // ... params existants
    repositoryPath: dto.RepositoryPath ?? dto.Binding?.RepositoryPath,
    // ...
);
```

Le fallback `dto.Binding?.RepositoryPath` assure la rétrocompatibilité avec les sessions sauvegardées avant ce changement.

#### 5c. FileSystemWorkspaceRepository

**Fichier** : `backend/src/Maestro.Infrastructure/Sessions/FileSystemWorkspaceRepository.cs`

**Changements** :

1. **Sérialisation** (dans `WorkspaceData` inner class) : ajouter

```csharp
public string? RepositoryPath { get; set; }
public BindingData? Binding { get; set; }

public class BindingData
{
    public string Type { get; set; }
    public string? RepositoryPath { get; set; }
    public string? AccessLevel { get; set; }
}
```

2. **ToData** (mapping entity → DTO) : ajouter

```csharp
RepositoryPath = workspace.RepositoryPath,
Binding = workspace.IsBoundToRepository ? new BindingData
{
    Type = workspace.Binding.Type.ToString(),
    RepositoryPath = workspace.Binding.RepositoryPath,
    AccessLevel = workspace.Binding.AccessLevel.ToString()
} : null,
```

3. **ToDomain** (mapping DTO → entity via Reconstitute) : passer les nouveaux params

```csharp
return Workspace.Reconstitute(
    // ... params existants
    repositoryPath: data.RepositoryPath,
    binding: data.Binding != null
        ? ContainerBinding.CreateRepositoryBound(data.Binding.RepositoryPath, ...)
        : null
);
```

---

### WP6 : Structure .maestro/ automatique

**Fichier** : `backend/src/Maestro.Infrastructure/Sessions/MaestroDirectoryInitializer.cs` (NOUVEAU)

Service qui crée la structure `.maestro/` quand une session se binde à un repo :

```csharp
public class MaestroDirectoryInitializer
{
    private readonly ILogger<MaestroDirectoryInitializer> _logger;

    /// <summary>
    /// Crée la structure .maestro/ dans le repo bindé.
    /// Idempotent — ne casse rien si déjà existant.
    /// </summary>
    public async Task InitializeAsync(ContainerSession session)
    {
        if (!session.IsBoundToRepository || session.MaestroDataPath == null)
            return;

        var basePath = session.MaestroDataPath;

        // Créer les dossiers
        var dirs = new[]
        {
            basePath,
            Path.Combine(basePath, "docs"),
            Path.Combine(basePath, "logs"),
            Path.Combine(basePath, "logs", "executions"),
            Path.Combine(basePath, "artifacts"),
            Path.Combine(basePath, "metrics")
        };

        foreach (var dir in dirs)
        {
            Directory.CreateDirectory(dir);
        }

        // Écrire session.json (fichier de liaison)
        var sessionInfoPath = Path.Combine(basePath, "session.json");
        if (!File.Exists(sessionInfoPath))
        {
            var sessionInfo = new
            {
                sessionId = session.Id,
                sessionType = session.GetType().Name,
                name = session.Name,
                createdAt = session.CreatedAt,
                boundAt = DateTimeOffset.UtcNow
            };
            var json = JsonSerializer.Serialize(sessionInfo, new JsonSerializerOptions
            {
                WriteIndented = true
            });
            await File.WriteAllTextAsync(sessionInfoPath, json);
        }

        // Créer .gitignore dans .maestro/logs/ (les logs ne devraient pas être commités par défaut)
        var logsGitignore = Path.Combine(basePath, "logs", ".gitignore");
        if (!File.Exists(logsGitignore))
        {
            await File.WriteAllTextAsync(logsGitignore, "# Execution logs — high volume, not for version control\n*.json\n*.jsonl\n");
        }

        _logger.LogInformation(
            "Initialized .maestro/ structure in {Path} for session {Id}",
            basePath, session.Id);
    }
}
```

**Intégration** : appeler `InitializeAsync` dans `ProjectSessionServer.CreateSessionAsync` (ou équivalent) juste après la création de la session, si bindée.

**DI** : enregistrer dans `Program.cs` :
```csharp
builder.Services.AddSingleton<MaestroDirectoryInitializer>();
```

---

### WP7 : Mise à jour du CLI

**Fichier** : `tools/maestro-cli/index.js`

#### 7a. Flag `--repo-path` générique sur `session create`

**Localisation** : `createSession()` (ligne ~818) et son dispatch (ligne ~4756)

**Changement** :

```javascript
// Dans createSession(), ajouter :
const request = {
  // ... existant
  repositoryPath: options.repoPath || options['repo-path'],  // NOUVEAU
};
```

**Mapping dans le dispatch** :
```javascript
if (subCmd === 'create') {
  return await createSession({
    // ... existant
    repoPath: argv['repo-path'],       // NOUVEAU
  }, formatter);
}
```

#### 7b. Flag `--repo-path` sur `workspace create`

**Localisation** : section workspace du dispatch (ligne ~4950+)

```javascript
if (subCmd === 'create') {
  const name = argv._[2];
  const response = await client.post('/api/workspaces', {
    name,
    type: argv.type || 'Custom',
    description: argv.description,
    repositoryPath: argv['repo-path'],   // NOUVEAU
  });
  // ...
}
```

#### 7c. Ajouter `--repo-path` au minimist string list

**Localisation** : parsing minimist (ligne 4075-4078)

Ajouter `'repo-path'` à la liste `string:` :
```javascript
string: ['api-url', /* ... existant ... */, 'repo-path']
```

---

### WP8 : Mise à jour de l'API Backend

**Fichier** : `backend/src/Maestro.Api/Controllers/SessionsController.cs`

#### 8a. Ajouter `RepositoryPath` au DTO de création

**Localisation** : `CreateInteractiveSessionRequest` (inner class, après ligne ~600)

```csharp
public class CreateInteractiveSessionRequest
{
    // ... existant
    public string? RepositoryPath { get; set; }    // NOUVEAU
}
```

#### 8b. Passer à la factory method

**Localisation** : `CreateSession` endpoint (POST `/api/sessions`)

```csharp
// Dans le code de création, passer le repositoryPath :
var session = ProjectSession.Create(
    name: request.Name,
    authority: authority,
    config: config,
    repositoryPath: request.RepositoryPath    // NOUVEAU
);
```

#### 8c. API Workspace — ajouter RepositoryPath

Vérifier si l'API de création de workspace existe et ajouter `RepositoryPath` au DTO de création.

---

### WP9 : Tests

**Fichiers** :
- `backend/tests/Maestro.Domain.Tests/ContainerSessionTests.cs` — ajouter tests
- `backend/tests/Maestro.Domain.Tests/ProjectSessionTests.cs` — modifier tests existants
- `backend/tests/Maestro.Domain.Tests/FoundrySessionTests.cs` — ajouter tests
- `backend/tests/Maestro.Domain.Tests/WorkspaceTests.cs` — ajouter tests

**Tests à ajouter** :

```
ContainerSession Tests:
├── BindToRepository_ValidPath_SetsRepositoryPathAndBinding
├── BindToRepository_AfterStart_ThrowsInvalidOperation
├── BindToRepository_EmptyPath_ThrowsArgument
├── IsBoundToRepository_WhenBound_ReturnsTrue
├── IsBoundToRepository_WhenSandbox_ReturnsFalse
├── MaestroDataPath_WhenBound_ReturnsCorrectPath
├── MaestroDataPath_WhenNotBound_ReturnsNull

ProjectSession Tests (modifier existants):
├── Create_WithRepoPath_SetsOnContainerSession
├── Create_WithoutRepoPath_SetsSandboxBinding
├── Reconstitute_WithRepoPath_RestoresCorrectly

FoundrySession Tests:
├── Create_WithRepoPath_BindsToRepo
├── Create_WithConfigSource_StillWorks (rétrocompatibilité)
├── Create_WithBothRepoPathAndConfig_RepoPathWins

Workspace Tests:
├── Create_WithRepoPath_BindsToRepo
├── Create_WithoutRepoPath_BindingIsNone
├── Reconstitute_WithRepoPath_RestoresBinding

Persistence Tests (infrastructure):
├── FoundryRepo_SaveAndLoad_PreservesRepoPath
├── WorkspaceRepo_SaveAndLoad_PreservesRepoPath
├── WorkspaceRepo_LoadLegacy_WithoutRepoPath_Works
```

---

## Ordre d'implémentation

```
WP1 (ContainerSession.RepositoryPath) ──┐
                                         ├──> WP5 (Persistance)
WP2 (ProjectSession simplifié) ─────────┤
WP3 (FoundrySession simplifié) ─────────┤    WP6 (.maestro/ init) ──┐
WP4 (Workspace bindable) ───────────────┘                           │
                                                                     ├──> WP9 (Tests)
WP7 (CLI --repo-path) ──────────────────────────────────────────────┤
WP8 (API backend DTO) ──────────────────────────────────────────────┘
```

WP1 en premier (tout le reste en dépend). WP2-4 en parallèle. WP5 après WP2-4. WP6-8 peuvent avancer en parallèle avec WP5. WP9 en dernier.

---

## Rétrocompatibilité

| Scénario | Impact |
|----------|--------|
| Sessions ProjectSession existantes en JSON | Aucun — `RepositoryPath` est toujours dans le même champ JSON |
| Sessions FoundrySession existantes en JSON | Aucun — fallback `dto.Binding?.RepositoryPath` lit l'ancien format |
| Workspaces existants en JSON | Aucun — `RepositoryPath` null par défaut, `Binding` null → None |
| CLI `session create --source repository --repository-path` | Continue de fonctionner (les flags sont toujours parsés) |
| CLI `session create --repo-path` | NOUVEAU — raccourci qui fonctionne pour tout type |
| API `POST /api/sessions` sans `repositoryPath` | Aucun changement — sandbox par défaut |

---

## Critères de succès

- [ ] `ContainerSession` a `RepositoryPath` et `BindToRepository()`
- [ ] `ProjectSession.RepositoryPath` n'existe plus comme propriété propre (héritée du parent)
- [ ] `FoundrySession.Create(repositoryPath: "/path")` fonctionne
- [ ] `Workspace.Create(repositoryPath: "/path")` fonctionne
- [ ] Les sessions existantes se chargent correctement (rétrocompatibilité)
- [ ] Le CLI `session create --repo-path /path --type foundry` fonctionne
- [ ] Le CLI `workspace create "Mon WS" --repo-path /path` fonctionne
- [ ] La structure `.maestro/` est créée automatiquement dans le repo
- [ ] `dotnet test` passe avec les nouveaux tests
