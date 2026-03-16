# 59-PRE-G : Authentification provider en C# — .env loader + AuthStatus

**But** : Deplacer la gestion de l'authentification des providers du script PowerShell vers le code C#. Chaque provider est responsable de sa propre authentification. Le `.env` est charge au boot de l'application .NET.

---

## Probleme actuel

`dev-start.ps1` tente de passer les tokens aux child processes via des scripts PowerShell generes dynamiquement. C'est fragile (problemes d'echappement), non-portable, et place la responsabilite d'authentification dans un script au lieu du code applicatif.

## Solution

### 1. DotEnv loader dans les apps .NET

Au demarrage de `LLMProvider.Web` et `Maestro.Api`, charger le fichier `.env` du `MAESTRO_ROOT` (ou du repertoire courant). Chaque ligne `KEY=VALUE` est injectee dans `Environment.SetEnvironmentVariable()`. `IConfiguration` de .NET lit automatiquement les env vars et les mappe vers les options des providers.

### 2. `GetAuthStatus()` sur `ILLMProvider`

Nouvelle methode sur l'interface qui retourne l'etat d'authentification du provider :
- `IsConfigured` : le provider a des credentials configurees
- `Method` : type d'auth ("api-key", "token", "managed-identity", "none")
- `MaskedCredential` : credential masquee pour affichage ("****ghp_ab12", null si managed identity)

Pas de `GetKey()` — l'abstraction ne suppose pas que tous les providers utilisent une cle.

### 3. Nettoyage de dev-start.ps1

Supprimer tout le code de propagation d'env vars (`Get-EnvLines`, `set-env.ps1`, `$envSource`). Le script revient a sa forme simple : `dotnet run` dans un nouveau terminal. Les apps .NET chargent elles-memes leur `.env`.

---

## Lecture obligatoire

- `llm-provider/dotnet/src/LLMProvider.Web/Program.cs` — point d'entree LLM-Provider
- `apps/backend/src/Maestro.Api/Program.cs` — point d'entree backend
- `llm-provider/dotnet/src/LLMProvider.Application/Interfaces/Providers/ILLMProvider.cs` — interface provider
- `llm-provider/dotnet/src/LLMProvider.GitHubModelsProvider/GitHubModelsLLMProvider.cs` — provider a verifier
- `llm-provider/dotnet/src/LLMProvider.AnthropicProvider/AnthropicLLMProvider.cs` — provider a verifier
- `dev-scripts/dev-start.ps1` — script a nettoyer

## Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `llm-provider/dotnet/src/LLMProvider.Web/DotEnvLoader.cs` | Classe statique : `Load(string path)` — lit `.env`, set env vars. Ignore commentaires (#), lignes vides, gere les guillemets |

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `llm-provider/dotnet/src/LLMProvider.Application/Interfaces/Providers/ILLMProvider.cs` | Ajouter `AuthStatus GetAuthStatus()` (methode non-async, sync) |
| `llm-provider/dotnet/src/LLMProvider.Application/DTOs/AuthStatus.cs` | Creer record : IsConfigured, Method, MaskedCredential |
| `llm-provider/dotnet/src/LLMProvider.Web/Program.cs` | Appeler `DotEnvLoader.Load()` au demarrage, AVANT la construction de la config |
| `apps/backend/src/Maestro.Api/Program.cs` | Meme chose : `DotEnvLoader.Load()` au demarrage |
| `llm-provider/dotnet/src/LLMProvider.GitHubModelsProvider/GitHubModelsLLMProvider.cs` | Implementer `GetAuthStatus()` — method "token", masquer sauf 4 derniers chars |
| `llm-provider/dotnet/src/LLMProvider.AnthropicProvider/AnthropicLLMProvider.cs` | Implementer `GetAuthStatus()` — method "api-key", masquer sauf 4 derniers chars |
| `llm-provider/dotnet/src/LLMProvider.AzureInferenceProvider/AzureInferenceLLMProvider.cs` | Implementer `GetAuthStatus()` — method "api-key" ou "managed-identity" |
| `llm-provider/dotnet/src/LLMProvider.AzureProvider/AzureOpenAIProvider.cs` | Implementer `GetAuthStatus()` |
| `llm-provider/dotnet/src/LLMProvider.LocalProvider/LocalLLMProvider.cs` | Implementer `GetAuthStatus()` — method "none", toujours configure |
| `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` | Implementer `GetAuthStatus()` — method "cli", verifie si claude est installe |
| `dev-scripts/dev-start.ps1` | Supprimer : `$envVars`, `$envScript`, `Get-EnvLines`/`set-env.ps1`, `$envSource`, `$dotEnvBlock`. Revenir a des `Start-Process` simples |

## DotEnvLoader — specification

```csharp
public static class DotEnvLoader
{
    public static void Load(string? filePath = null)
    {
        // Default: chercher .env dans MAESTRO_ROOT ou current directory
        // Parcourir chaque ligne :
        //   - Ignorer lignes vides et commentaires (#)
        //   - Splitter sur le premier '='
        //   - Trim key et value
        //   - Retirer guillemets autour de la value si presents
        //   - Ne PAS overrider une env var deja definie (env var explicite > .env)
        //   - SetEnvironmentVariable(key, value, EnvironmentVariableTarget.Process)
    }
}
```

**Regle importante** : les env vars deja definies dans le process NE SONT PAS ecrasees par le `.env`. Ceci permet de faire `PROVIDERS__GITHUBMODELS__TOKEN=xxx dotnet run` et que ca prenne priorite sur le `.env`.

## AuthStatus — specification

```csharp
public record AuthStatus(
    bool IsConfigured,
    string Method,       // "api-key", "token", "managed-identity", "cli", "none"
    string? MaskedCredential  // "****ab12" ou null
);
```

## Verification

```bash
# Build LLM-Provider
dotnet build C:\Meastro\llm-provider\dotnet\src\LLMProvider.Web\LLMProvider.Web.csproj
# 0 erreurs

# Build backend
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

# Restart services
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1

# Verifier que GitHub Models est available
curl http://localhost:5010/api/v1/health/
# GitHubModels: isAvailable: true

# Tester GitHub Models
curl -s http://localhost:5010/api/v1/completions -H "Content-Type: application/json" -d '{"model":"DeepSeek-V3","messages":[{"role":"user","content":"Say hello in one word"}],"maxTokens":10}'
# Resultat : reponse avec content + token usage
```

## Anti-patterns

- Ne PAS ajouter de dependance NuGet pour le .env loading — c'est 20 lignes de code, pas besoin d'un package
- Ne PAS exposer `GetKey()` ou `GetToken()` — l'abstraction est `AuthStatus`, pas le credential brut
- Ne PAS overrider les env vars existantes depuis le `.env` — les env vars explicites ont priorite
- Ne PAS mettre `DotEnvLoader` dans un projet partage — le dupliquer dans les deux apps (LLMProvider.Web et Maestro.Api) est acceptable pour V1

## Checkpoint

```markdown
## 59-PRE-G : Auth provider C#
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**DotEnvLoader** : fonctionne dans LLM-Provider + Backend
**GitHub Models isAvailable** : true / false
**curl DeepSeek-V3** : reponse OK / erreur
**AuthStatus** : implemente sur X/6 providers
**dev-start.ps1 nettoye** : OUI / NON
```

## Effort

~1 heure (DotEnvLoader + AuthStatus sur 6 providers + nettoyage dev-start.ps1 + verification)
