# Plan d'implémentation : Renforcement du ProcessContainerRuntime

**Phase**: 12.1
**Effort estimé**: 2-3 jours
**Fichiers impactés**: 4 fichiers modifiés, 1 fichier créé

---

## Objectif

Renforcer `ProcessContainerRuntime` pour qu'il soit sécuritaire comme mode d'exécution par défaut. Actuellement, il n'a aucune protection contre les traversals de chemins, les fuites de variables d'environnement, ou la saturation mémoire par stdout/stderr.

---

## Analyse de l'existant

### ProcessContainerRuntime.cs (343 lignes)

**Lacunes de sécurité identifiées :**

| Lacune | Localisation | Risque |
|--------|-------------|--------|
| Pas de validation de chemins | `ExecuteAsync` ligne 117 : `workDir = request.WorkingDirectory ?? ...` | Traversal `../../etc/passwd` |
| Toutes les env vars exposées | `ExecuteAsync` lignes 134-143 : copie directe des env vars | Fuite de secrets backend |
| Working directory non borné | `ExecuteAsync` ligne 117 : accepte n'importe quel chemin | Accès hors repo |
| stdout/stderr non bornés | `ExecuteAsync` lignes 149-188 : `ReadToEndAsync()` sans limite | OOM si processus produit des GB |
| Pas de restriction d'exécutables | `ExecuteAsync` ligne 121 : `FileName = request.Command` | Exécution de n'importe quel binaire |
| `EscapeArg` insuffisant | Lignes 324-330 : simple wrapping en guillemets | Injection possible avec chars spéciaux |
| Pas de validation dans CopyTo | Lignes 252-282 : `File.Copy` sans vérification de chemin | Copie hors repo |

---

## Work Packages

### WP1 : Path Validation Helper

**Fichier** : `backend/src/Maestro.Infrastructure/Containers/PathValidator.cs` (NOUVEAU)

Créer une classe utilitaire `PathValidator` :

```csharp
internal static class PathValidator
{
    /// <summary>
    /// Vérifie que resolvedPath est sous allowedRoot.
    /// Résout les symlinks et les .. avant comparaison.
    /// </summary>
    public static bool IsPathUnderRoot(string resolvedPath, string allowedRoot)

    /// <summary>
    /// Résout le chemin complet (Path.GetFullPath) et vérifie qu'il est sous la racine.
    /// Lance PathAccessDeniedException si violation.
    /// </summary>
    public static string ValidateAndResolve(string requestedPath, string allowedRoot)
}
```

**Logique** :
1. `Path.GetFullPath()` sur les deux chemins pour résoudre les `..`
2. Normaliser les séparateurs (`/` vs `\`)
3. Vérifier que le chemin résolu commence par la racine résolue
4. Lancer une exception typée `PathAccessDeniedException` si violation

**Tests** :
- Chemin valide sous la racine → OK
- Traversal `../../etc` → Exception
- Symlink hors racine → Exception (si détectable)
- Chemin avec `./` redondant → OK (normalisé)
- Chemin Windows vs Unix → OK (normalisation cross-platform)

---

### WP2 : Environment Variable Whitelist

**Fichier modifié** : `backend/src/Maestro.Infrastructure/Containers/ProcessContainerRuntime.cs`

**Localisation** : `ExecuteAsync`, lignes 134-143

**Actuellement** :
```csharp
// Adds ALL container config env vars
foreach (var env in container.Config.Environment)
    process.StartInfo.Environment[env.Key] = env.Value;

// Adds ALL request env vars
if (request.Environment != null)
    foreach (var env in request.Environment)
        process.StartInfo.Environment[env.Key] = env.Value;
```

**Changement** :
1. Avant d'ajouter les env vars, appeler `process.StartInfo.Environment.Clear()` pour ne PAS hériter des env vars du processus backend
2. Ajouter uniquement les env vars de la configuration du container (celles-ci sont définies explicitement dans `RuntimeConfiguration`)
3. Ajouter uniquement les env vars de la request
4. Ajouter un set minimal requis : `PATH`, `HOME`/`USERPROFILE`, `TEMP`/`TMP`
5. Exclure explicitement les variables dangereuses : `ASPNETCORE_*`, `DOTNET_*`, `ConnectionStrings__*`, `LLM_*`, `API_KEY*`

**Nouvelle méthode privée** :
```csharp
private static readonly HashSet<string> BlockedEnvPrefixes = new(StringComparer.OrdinalIgnoreCase)
{
    "ASPNETCORE_", "DOTNET_", "ConnectionStrings__",
    "LLM_", "API_KEY", "SECRET_", "MAESTRO_INTERNAL_"
};

private static readonly HashSet<string> RequiredEnvKeys = new(StringComparer.OrdinalIgnoreCase)
{
    "PATH", "HOME", "USERPROFILE", "TEMP", "TMP", "LANG", "LC_ALL"
};

private void ConfigureEnvironment(ProcessStartInfo startInfo,
    RuntimeConfiguration config, ContainerExecRequest request)
```

---

### WP3 : Working Directory Enforcement

**Fichier modifié** : `backend/src/Maestro.Infrastructure/Containers/ProcessContainerRuntime.cs`

**Localisation** : `ExecuteAsync`, ligne 117

**Actuellement** :
```csharp
var workDir = request.WorkingDirectory
    ?? container.Config.WorkDir
    ?? Directory.GetCurrentDirectory();
```

**Changement** :
1. Définir la racine autorisée comme `container.Config.WorkDir` (le WorkDir du container est la "racine" de la session)
2. Si `request.WorkingDirectory` est fourni, le valider avec `PathValidator.ValidateAndResolve(request.WorkingDirectory, rootDir)`
3. Si `container.Config.WorkDir` est null, utiliser un dossier temporaire dédié (PAS `Directory.GetCurrentDirectory()` qui est le dossier du backend)
4. Si la validation échoue, retourner un `ContainerExecResult` avec `ExitCode = -1` et un message d'erreur clair

**Idem pour `CopyToContainerAsync`** (lignes 252-282) et `CopyFromContainerAsync` (lignes 285-292) :
- Valider que les chemins source/destination sont sous la racine autorisée

---

### WP4 : Output Size Limiting

**Fichier modifié** : `backend/src/Maestro.Infrastructure/Containers/ProcessContainerRuntime.cs`

**Localisation** : `ExecuteAsync`, lignes 149-188

**Actuellement** :
```csharp
var stdoutTask = process.StandardOutput.ReadToEndAsync();
var stderrTask = process.StandardError.ReadToEndAsync();
```

**Changement** :
Remplacer `ReadToEndAsync()` par un reader borné :

```csharp
private static async Task<string> ReadBoundedAsync(
    StreamReader reader,
    int maxBytes = 1_048_576, // 1 MB par défaut
    CancellationToken ct = default)
```

**Logique** :
1. Lire par blocs de 4096 chars
2. Accumuler dans un `StringBuilder`
3. Si la taille dépasse `maxBytes`, arrêter de lire et ajouter `\n--- OUTPUT TRUNCATED (exceeded {maxBytes} bytes) ---`
4. Respecter le `CancellationToken`

**Constante configurable** : `MaxOutputBytes = 1_048_576` (1 MB). Suffisant pour la grande majorité des cas, évite l'OOM.

---

### WP5 : Tests unitaires

**Fichier** : `backend/tests/Maestro.Infrastructure.Tests/Containers/ProcessContainerRuntimeTests.cs` (NOUVEAU)

**Tests à écrire** :

```
PathValidator Tests:
├── IsPathUnderRoot_ValidSubpath_ReturnsTrue
├── IsPathUnderRoot_TraversalAttack_ReturnsFalse
├── IsPathUnderRoot_ExactRoot_ReturnsTrue
├── IsPathUnderRoot_NormalizedSlashes_ReturnsTrue
├── ValidateAndResolve_ValidPath_ReturnsResolved
├── ValidateAndResolve_TraversalPath_ThrowsException

ProcessContainerRuntime Tests:
├── ExecuteAsync_ValidWorkDir_Succeeds
├── ExecuteAsync_TraversalWorkDir_ReturnsError
├── ExecuteAsync_NullWorkDir_UsesContainerDefault
├── ExecuteAsync_EnvVarsFiltered_NoSecrets
├── ExecuteAsync_RequiredEnvVarsPresent
├── ExecuteAsync_BlockedEnvPrefix_NotExposed
├── ExecuteAsync_LargeOutput_Truncated
├── ExecuteAsync_Timeout_KillsProcess
├── CopyToAsync_PathOutsideRoot_ThrowsException
├── CopyToAsync_ValidPath_Copies
```

**Pattern de test** (basé sur le pattern xUnit existant du projet) :
```csharp
public class ProcessContainerRuntimeTests
{
    private readonly ProcessContainerRuntime _runtime;

    public ProcessContainerRuntimeTests()
    {
        var logger = new Mock<ILogger<ProcessContainerRuntime>>();
        _runtime = new ProcessContainerRuntime(logger.Object);
    }

    [Fact]
    public async Task ExecuteAsync_WithTraversalPath_ReturnsError()
    {
        // Arrange
        var containerId = await _runtime.CreateContainerAsync(
            RuntimeConfiguration.Process("/safe/root"));
        await _runtime.StartContainerAsync(containerId);

        var request = new ContainerExecRequest
        {
            Command = "echo",
            Arguments = new[] { "test" },
            WorkingDirectory = "/safe/root/../../etc"
        };

        // Act
        var result = await _runtime.ExecuteAsync(containerId, request);

        // Assert
        Assert.Equal(-1, result.ExitCode);
        Assert.Contains("denied", result.StandardError, StringComparison.OrdinalIgnoreCase);
    }
}
```

---

## Ordre d'implémentation

```
WP1 (PathValidator)
  └──> WP3 (Working Directory Enforcement) ─┐
  └──> WP2 (Env Var Whitelist)              ├──> WP5 (Tests)
       WP4 (Output Limiting) ───────────────┘
```

WP1 d'abord car WP3 en dépend. WP2 et WP4 sont indépendants. WP5 en dernier.

---

## Critères de succès

- [ ] Aucun chemin hors de `Config.WorkDir` n'est accessible via `ExecuteAsync`
- [ ] Les variables d'environnement du backend ne fuient pas dans les sous-processus
- [ ] Un processus produisant >1MB de sortie est tronqué sans crash
- [ ] Tous les tests existants du backend passent toujours (`dotnet test`)
- [ ] Les nouveaux tests couvrent chaque cas de sécurité
