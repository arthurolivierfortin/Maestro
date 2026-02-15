# Phase 26-B : Plan d'Implementation — Multi-Provider LLM Gateway

> Date : 2026-02-15
> Status : **SUPERSEDED** — Ce plan etait architecturalement faux. Il placait la logique multi-provider dans Maestro C# au lieu de LLM-Provider Python.
> Remplace par : `IMPLEMENTATION-MULTI-PROVIDER-CORRECTED.md`
> Analyse de l'erreur : `ANALYSIS-CORRECTED-MULTI-PROVIDER.md`
> Auteur : Claude

---

## Contexte

Maestro ne supporte qu'un seul provider LLM a la fois (local OU Azure), choisi au demarrage. C'est un defaut architectural. Les utilisateurs doivent pouvoir :
- Utiliser plusieurs providers simultanement (local + cloud)
- Router les requetes par model (SmolLM2 → local, claude-sonnet → Claude Code CLI)
- Ajouter de nouveaux providers sans modifier le code existant

L'utilisateur a un abonnement Claude Max. `claude -p` en mode stateless = $0 supplementaire.

**Pas de legacy.** L'ancien systeme single-provider (`if (useAzure) ... else ...`) est remplace entierement.

---

## Architecture Cible

```
ILLMGateway (interface — inchangee)
│
├── MultiProviderGateway (NEW — router par ModelId)
│   │
│   ├── LLMProviderGateway         (existant — local GPU, SmolLM2, Qwen, etc.)
│   ├── AzureOpenAIGateway         (existant — Azure OpenAI)
│   ├── AnthropicApiGateway        (NEW — API directe Anthropic, pour quand API key dispo)
│   └── CliAgentGateway (abstract) (NEW — providers CLI)
│       ├── ClaudeCodeGateway      (NEW — via claude -p)
│       └── OpenCodeGateway        (FUTUR — via opencode CLI)
```

---

## Etapes d'Implementation

### Etape 0 : CLAUDE.md — Regle anti-legacy

Ajouter dans `CLAUDE.md` :
> **No legacy support.** When a system is replaced, remove the old code entirely. Never maintain deprecated code alongside new implementations. Clean break, no backward compatibility shims.

### Etape 1 : MultiProviderSettings.cs (NEW)

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/MultiProviderSettings.cs`

```csharp
public class MultiProviderSettings
{
    public const string SectionName = "LLMProviders";
    public string Default { get; set; } = "local";
    public Dictionary<string, ProviderConfig> Providers { get; set; } = new();
    public Dictionary<string, string> ModelRoutes { get; set; } = new();
    public Dictionary<string, string> ModelPatterns { get; set; } = new();
}

public class ProviderConfig
{
    public string Type { get; set; } = "";  // "LLMProvider", "AzureOpenAI", "ClaudeCode", "AnthropicApi"

    // LLMProvider
    public string? BaseUrl { get; set; }
    public string? DefaultModel { get; set; }
    public int TimeoutSeconds { get; set; } = 300;
    public int MaxRetries { get; set; } = 3;
    public int InitialRetryDelayMs { get; set; } = 200;
    public int MaxNewTokens { get; set; } = 512;
    public float Temperature { get; set; } = 0.7f;
    public bool DoSample { get; set; } = true;
    public float TopP { get; set; } = 0.95f;
    public string? SystemPrompt { get; set; }

    // AzureOpenAI
    public string? Endpoint { get; set; }
    public string? ApiKey { get; set; }
    public string? DeploymentName { get; set; }
    public string? ApiVersion { get; set; }
    public int MaxTokens { get; set; } = 1024;

    // AnthropicApi
    public string? AnthropicApiKey { get; set; }
    public string? AnthropicApiVersion { get; set; }

    // ClaudeCode (CliAgent)
    public string? CliPath { get; set; }        // null = "claude" from PATH
    public string? Model { get; set; }           // "sonnet", "opus", "haiku"
    public int CliTimeoutSeconds { get; set; } = 120;
    public bool NoSessionPersistence { get; set; } = true;
    public int MaxTurns { get; set; } = 1;
}
```

### Etape 2 : CliAgentGateway.cs (NEW — abstract)

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/CliAgentGateway.cs`

Base abstraite pour les providers CLI (Claude Code, OpenCode, etc.) :

```csharp
public abstract class CliAgentGateway : ILLMGateway
{
    protected abstract string GetExecutable();
    protected abstract List<string> BuildArguments(LLMRequest request);
    protected abstract LLMResponse ParseOutput(string jsonOutput, string model);
    protected abstract int GetTimeoutSeconds();

    // Methode partagee : spawn process, capture stdout/stderr, timeout, error handling
    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken ct)
    {
        var args = BuildArguments(request);
        var (stdout, stderr, exitCode) = await RunProcessAsync(GetExecutable(), args, GetTimeoutSeconds(), ct);
        if (exitCode != 0) HandleError(stderr, exitCode);
        return ParseOutput(stdout, request.ModelId ?? "unknown");
    }

    // StreamAsync : fallback to SendAsync + yield single chunk
    // SwitchModelAsync : no-op (model passed per-request)
    // RunProcessAsync : shared process execution with timeout + cancellation
    // HandleError : shared error classification (auth, rate-limit, not-found)
}
```

### Etape 3 : ClaudeCodeGateway.cs (NEW)

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/ClaudeCodeGateway.cs`

Herite de `CliAgentGateway`. Implementation :

- `GetExecutable()` → `config.CliPath ?? "claude"`
- `BuildArguments()` → `["-p", prompt, "--output-format", "json", "--model", model, "--max-turns", "1", "--system-prompt", systemPrompt, "--no-session-persistence"]`
- `ParseOutput()` → parse `{ "result": "...", "usage": { "input_tokens": N, "output_tokens": N }, "model": "..." }`
- `BuildPrompt()` : Si Messages[] fournis → concatener (skip system role). Si Prompt → utiliser tel quel.

### Etape 4 : AnthropicApiGateway.cs (NEW)

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/AnthropicApiGateway.cs`

API REST directe vers `https://api.anthropic.com/v1/messages` :
- Headers : `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Body : `{ model, messages: [{role, content}], max_tokens, temperature, system }`
- Response : `{ content: [{type:"text", text:"..."}], usage: {input_tokens, output_tokens}, model }`
- Meme pattern que `AzureOpenAIGateway` — REST, JSON, HttpClient
- Streaming via SSE optionnel (stream: true, event parsing)
- Si pas d'API key configuree → throw a l'instantiation avec message clair

### Etape 5 : MultiProviderGateway.cs (NEW)

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/MultiProviderGateway.cs`

Router transparent :
- Recoit `Dictionary<string, ILLMGateway>` (providers) + `MultiProviderSettings` (routes)
- `SendAsync/StreamAsync/SwitchModelAsync` → resolve provider → delegate
- Resolution : exact ModelRoutes → pattern ModelPatterns → default
- Pattern matching glob : `"claude-*"` match `"claude-sonnet"` via Regex
- Expose `ProviderNames`, `DefaultProviderName`, `GetProvider(name)` pour le controller

### Etape 6 : Program.cs — Refactoring DI complet

**Fichier** : `backend/src/Maestro.Api/Program.cs` (lignes 62-95)

**Remplacer entierement** par :

```csharp
// === LLM Providers (Multi-Provider) ===
builder.Services.Configure<MultiProviderSettings>(
    builder.Configuration.GetSection(MultiProviderSettings.SectionName));

// Provider-specific settings (populated from ProviderConfig in LLMProviders section)
// LLMProviderGateway still reads LLMProviderSettings for HttpClient config
// We bind from the ProviderConfig in LLMProviders.Providers.local
var multiSettings = builder.Configuration.GetSection("LLMProviders").Get<MultiProviderSettings>();
if (multiSettings?.Providers.TryGetValue("local", out var localCfg) == true && localCfg.Type == "LLMProvider")
{
    builder.Services.Configure<LLMProviderSettings>(options =>
    {
        options.BaseUrl = localCfg.BaseUrl ?? "http://localhost:8000";
        options.DefaultModel = localCfg.DefaultModel ?? "Qwen2.5-Coder-1.5B-Instruct";
        options.TimeoutSeconds = localCfg.TimeoutSeconds;
        options.MaxRetries = localCfg.MaxRetries;
        options.InitialRetryDelayMs = localCfg.InitialRetryDelayMs;
        options.MaxNewTokens = localCfg.MaxNewTokens;
        options.Temperature = localCfg.Temperature;
        options.DoSample = localCfg.DoSample;
        options.TopP = localCfg.TopP;
        options.SystemPrompt = localCfg.SystemPrompt;
    });
}
// Idem pour Azure si present
if (multiSettings?.Providers.TryGetValue("azure", out var azureCfg) == true && azureCfg.Type == "AzureOpenAI")
{
    builder.Services.Configure<AzureOpenAISettings>(options =>
    {
        options.Endpoint = azureCfg.Endpoint ?? "";
        options.ApiKey = azureCfg.ApiKey ?? "";
        options.DeploymentName = azureCfg.DeploymentName ?? "";
        options.ApiVersion = azureCfg.ApiVersion ?? "2024-06-01";
        options.MaxTokens = azureCfg.MaxTokens;
        options.Temperature = azureCfg.Temperature;
        options.TimeoutSeconds = azureCfg.TimeoutSeconds;
    });
}

// Register HttpClients
builder.Services.AddHttpClient<LLMProviderGateway>(...);
builder.Services.AddHttpClient<AzureOpenAIGateway>();
builder.Services.AddHttpClient<AnthropicApiGateway>();

// Register MultiProviderGateway as ILLMGateway
builder.Services.AddScoped<ILLMGateway>(sp => {
    var settings = sp.GetRequiredService<IOptions<MultiProviderSettings>>().Value;
    var providers = new Dictionary<string, ILLMGateway>();
    foreach (var (name, config) in settings.Providers)
    {
        providers[name] = config.Type switch
        {
            "LLMProvider" => sp.GetRequiredService<LLMProviderGateway>(),
            "AzureOpenAI" => sp.GetRequiredService<AzureOpenAIGateway>(),
            "AnthropicApi" => new AnthropicApiGateway(config, sp.GetService<ILogger<AnthropicApiGateway>>()),
            "ClaudeCode" => new ClaudeCodeGateway(config, sp.GetService<ILogger<ClaudeCodeGateway>>()),
            _ => throw new InvalidOperationException($"Unknown provider type: '{config.Type}'")
        };
    }
    return new MultiProviderGateway(providers, settings, sp.GetService<ILogger<MultiProviderGateway>>());
});
```

**Supprimer** : l'ancien code `if (useAzure) ... else ...`, les anciens `Configure<LLMProviderSettings>` depuis la section `LLMProvider`.

### Etape 7 : ProviderController.cs — GetActiveProvider()

**Fichier** : `backend/src/Maestro.Api/Controllers/ProviderController.cs` (lignes 286-296)

Remplacer :
```csharp
[HttpGet("active")]
public ActionResult GetActiveProvider()
{
    if (_llmGateway is MultiProviderGateway multi)
    {
        return Ok(new
        {
            provider = "multi",
            defaultProvider = multi.DefaultProviderName,
            availableProviders = multi.ProviderNames
        });
    }
    return Ok(new { provider = "unknown", gatewayType = _llmGateway.GetType().Name });
}
```

### Etape 8 : appsettings.json — Nouvelle config

**Fichier** : `backend/src/Maestro.Api/appsettings.json`

**Supprimer** les sections `LLMProvider` et `AzureOpenAI`. **Ajouter** :

```json
{
  "LLMProviders": {
    "Default": "local",
    "Providers": {
      "local": {
        "Type": "LLMProvider",
        "BaseUrl": "http://localhost:8000",
        "DefaultModel": "Qwen2.5-Coder-1.5B-Instruct",
        "TimeoutSeconds": 300,
        "MaxRetries": 3,
        "InitialRetryDelayMs": 200,
        "MaxNewTokens": 512,
        "Temperature": 0.7,
        "DoSample": true,
        "TopP": 0.95
      },
      "claude-code": {
        "Type": "ClaudeCode",
        "Model": "sonnet",
        "CliTimeoutSeconds": 120,
        "NoSessionPersistence": true,
        "MaxTurns": 1
      }
    },
    "ModelRoutes": {
      "claude-sonnet": "claude-code",
      "claude-opus": "claude-code",
      "claude-haiku": "claude-code",
      "sonnet": "claude-code",
      "opus": "claude-code",
      "haiku": "claude-code"
    },
    "ModelPatterns": {
      "claude-*": "claude-code"
    }
  }
}
```

### Etape 9 : Supprimer le dead code

- **Supprimer** `backend/src/Maestro.Infrastructure/LLMGateway/LLMGateway.cs` (placeholder mort)
- **Supprimer** les sections `LLMProvider` et `AzureOpenAI` de `appsettings.json`
- **Nettoyer** toute reference a l'ancien pattern single-provider

### Etape 10 : LLMProviderService — adapter la source de config

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/LLMProviderService.cs`

Le constructeur lit `IOptions<LLMProviderSettings>`. Comme on alimente `LLMProviderSettings` depuis `ProviderConfig` dans Program.cs, ca continue de fonctionner. Aucun changement requis si l'etape 6 est bien faite.

---

## Ce qui ne change PAS

| Element | Raison |
|---------|--------|
| `ILLMGateway` interface | Les callers sont inconscients du multi-provider |
| `LLMRequest` / `LLMResponse` / `ChatMessage` | Contract stable |
| `InferenceBlockExecutor` | Transparent via ILLMGateway |
| `AgentBlockExecutor` | Transparent via ILLMGateway |
| `EntryPointExecutor` | Transparent via ILLMGateway |
| `LLMProviderGateway` (core logic) | Toujours connecte au service Python |
| `AzureOpenAIGateway` (core logic) | Toujours connecte a Azure REST |
| `LLMProviderSettings` / `AzureOpenAISettings` (classes) | Gardees — alimentees depuis ProviderConfig |
| `LLMProviderService` | Admin operations, lit LLMProviderSettings |

---

## Fichiers — Resume

| Action | Fichier |
|--------|---------|
| **CREER** | `Infrastructure/LLMGateway/MultiProviderSettings.cs` |
| **CREER** | `Infrastructure/LLMGateway/CliAgentGateway.cs` |
| **CREER** | `Infrastructure/LLMGateway/ClaudeCodeGateway.cs` |
| **CREER** | `Infrastructure/LLMGateway/AnthropicApiGateway.cs` |
| **CREER** | `Infrastructure/LLMGateway/MultiProviderGateway.cs` |
| **MODIFIER** | `Api/Program.cs` (DI — remplacer single-provider par multi-provider) |
| **MODIFIER** | `Api/Controllers/ProviderController.cs` (GetActiveProvider) |
| **MODIFIER** | `Api/appsettings.json` (nouvelle section LLMProviders) |
| **MODIFIER** | `CLAUDE.md` (regle no-legacy) |
| **SUPPRIMER** | `Infrastructure/LLMGateway/LLMGateway.cs` (placeholder) |

---

## Verification

1. `dotnet build` — compile sans erreur
2. Startup logs → `[Maestro] LLM Gateway: Multi-provider (local, claude-code)`
3. `curl /api/provider/active` → `{ provider: "multi", defaultProvider: "local", availableProviders: ["local", "claude-code"] }`
4. `dotnet test` — pas de regressions
5. Si `claude` installe : requete avec `ModelId = "sonnet"` → routed via ClaudeCodeGateway
