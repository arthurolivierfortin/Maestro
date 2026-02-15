# Phase 26-B : Plan d'Implementation Definitif — ClaudeCode Provider + Connexion Maestro

> Date : 2026-02-15
> Status : **Plan** (remplace tous les plans precedents)
> Prerequis : Lire `ANALYSIS-FINAL.md`

---

## Principe Directeur

**LLM-Provider .NET possede deja 90% de l'infrastructure multi-provider.** Ce plan ajoute le provider ClaudeCode et connecte Maestro au gateway .NET existant.

---

## Partie A : Creer ClaudeCodeProvider dans LLM-Provider .NET

Cible : `C:\LLM-Provider\dotnet\src\LLMProvider.ClaudeCodeProvider\`

### A1 : Creer le projet

```bash
cd C:\LLM-Provider\dotnet
dotnet new classlib -n LLMProvider.ClaudeCodeProvider -f net10.0
dotnet sln add src/LLMProvider.ClaudeCodeProvider/LLMProvider.ClaudeCodeProvider.csproj
```

References :
- `LLMProvider.Application` (pour ILLMProvider, LLMRequest, LLMResponse, etc.)
- `LLMProvider.Domain` (pour ProviderType, ModelId, etc.)

### A2 : ClaudeCodeProviderOptions.cs

```csharp
namespace LLMProvider.ClaudeCodeProvider;

public sealed class ClaudeCodeProviderOptions
{
    public const string SectionName = "Providers:ClaudeCode";

    /// <summary>Path to claude CLI. Null = "claude" from PATH.</summary>
    public string CliPath { get; set; } = "claude";

    /// <summary>Default model alias (sonnet, opus, haiku).</summary>
    public string DefaultModel { get; set; } = "sonnet";

    /// <summary>Timeout in seconds for CLI execution.</summary>
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>Max agent turns (1 = stateless single-shot).</summary>
    public int MaxTurns { get; set; } = 1;

    /// <summary>Available models with metadata.</summary>
    public List<ClaudeModelConfig> Models { get; set; } = new()
    {
        new() { ModelId = "claude-sonnet", Alias = "sonnet", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "claude-opus", Alias = "opus", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "claude-haiku", Alias = "haiku", ContextLength = 200000, Capabilities = ["chat", "code"] },
        new() { ModelId = "sonnet", Alias = "sonnet", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "opus", Alias = "opus", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "haiku", Alias = "haiku", ContextLength = 200000, Capabilities = ["chat", "code"] }
    };
}

public sealed class ClaudeModelConfig
{
    public string ModelId { get; set; } = "";
    public string Alias { get; set; } = "";
    public int ContextLength { get; set; } = 200000;
    public List<string> Capabilities { get; set; } = [];
}
```

### A3 : ClaudeCodeLLMProvider.cs

```csharp
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.ClaudeCodeProvider;

public sealed class ClaudeCodeLLMProvider : ILLMProvider
{
    private readonly ClaudeCodeProviderOptions _options;
    private readonly ILogger<ClaudeCodeLLMProvider> _logger;

    public ProviderType ProviderType => ProviderType.Anthropic;  // Uses existing enum slot
    public string Name => "claude-code";

    public ClaudeCodeLLMProvider(
        IOptions<ClaudeCodeProviderOptions> options,
        ILogger<ClaudeCodeLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            using var process = new Process();
            process.StartInfo = new ProcessStartInfo
            {
                FileName = _options.CliPath,
                Arguments = "--version",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            process.Start();
            await process.WaitForExitAsync(ct);
            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    public Task<IReadOnlyList<ModelInfo>> GetAvailableModelsAsync(CancellationToken ct = default)
    {
        var models = _options.Models.Select(m => new ModelInfo
        {
            Id = new ModelId(m.ModelId),
            Provider = ProviderType.Anthropic,
            ContextLength = m.ContextLength,
            Capabilities = m.Capabilities.AsReadOnly()
        }).ToList();

        return Task.FromResult<IReadOnlyList<ModelInfo>>(models);
    }

    public async Task<LLMResponse> CompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        CancellationToken ct = default)
    {
        var prompt = request.Prompt;
        // If conversation history exists, build a combined prompt
        if (conversationHistory?.Count > 0)
        {
            prompt = string.Join("\n\n", conversationHistory
                .Where(m => m.Role != "system")
                .Select(m => $"{m.Role}: {m.Content}"));
            if (!string.IsNullOrEmpty(request.Prompt))
                prompt += $"\n\nuser: {request.Prompt}";
        }

        var model = ResolveModel(request.ModelId.Value);
        var sw = Stopwatch.StartNew();

        var args = BuildArguments(prompt, model, request.SystemPrompt, request.MaxTokens);
        _logger.LogDebug("Executing claude CLI: {CliPath} {Args}", _options.CliPath, string.Join(" ", args));

        var (stdout, stderr, exitCode) = await RunProcessAsync(args, ct);
        sw.Stop();

        if (exitCode != 0)
        {
            _logger.LogError("claude CLI failed (exit {ExitCode}): {Stderr}", exitCode, stderr);
            throw new InvalidOperationException($"claude CLI failed (exit {exitCode}): {stderr}");
        }

        return ParseResponse(stdout, model, sw.Elapsed);
    }

    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        // Claude Code CLI does not support streaming — fallback to full response
        var response = await CompleteAsync(request, conversationHistory, ct);
        yield return new LLMStreamChunk
        {
            Content = response.Content,
            IsComplete = true,
            ModelUsed = response.ModelUsed,
            Provider = response.Provider,
            TokenUsage = response.TokenUsage,
            FinishReason = response.FinishReason
        };
    }

    private List<string> BuildArguments(string prompt, string model, string? systemPrompt, int? maxTokens)
    {
        var args = new List<string>
        {
            "-p", prompt,
            "--output-format", "json",
            "--model", model,
            "--max-turns", _options.MaxTurns.ToString(),
            "--no-session-persistence"
        };

        if (!string.IsNullOrEmpty(systemPrompt))
        {
            args.Add("--system-prompt");
            args.Add(systemPrompt);
        }

        return args;
    }

    private async Task<(string stdout, string stderr, int exitCode)> RunProcessAsync(
        List<string> args, CancellationToken ct)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = _options.CliPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var arg in args)
            process.StartInfo.ArgumentList.Add(arg);

        process.Start();

        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = process.StandardError.ReadToEndAsync(ct);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException($"claude CLI timed out after {_options.TimeoutSeconds}s");
        }

        return (await stdoutTask, await stderrTask, process.ExitCode);
    }

    private LLMResponse ParseResponse(string stdout, string model, TimeSpan duration)
    {
        try
        {
            using var doc = JsonDocument.Parse(stdout);
            var root = doc.RootElement;

            var content = root.TryGetProperty("result", out var r) ? r.GetString() ?? "" : "";
            var actualModel = root.TryGetProperty("model", out var m) ? m.GetString() ?? model : model;

            int promptTokens = 0, completionTokens = 0;
            if (root.TryGetProperty("usage", out var usage))
            {
                promptTokens = usage.TryGetProperty("input_tokens", out var it) ? it.GetInt32() : 0;
                completionTokens = usage.TryGetProperty("output_tokens", out var ot) ? ot.GetInt32() : 0;
            }

            return new LLMResponse
            {
                Content = content,
                ModelUsed = new ModelId(actualModel),
                Provider = ProviderType.Anthropic,
                TokenUsage = new TokenUsage(promptTokens, completionTokens),
                Duration = duration,
                FinishReason = "stop"
            };
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse claude CLI JSON output, using raw text");
            return new LLMResponse
            {
                Content = stdout.Trim(),
                ModelUsed = new ModelId(model),
                Provider = ProviderType.Anthropic,
                TokenUsage = new TokenUsage(0, 0),
                Duration = duration,
                FinishReason = "stop"
            };
        }
    }

    private string ResolveModel(string modelId)
    {
        // Map full names to CLI aliases
        var mapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["claude-sonnet"] = "sonnet",
            ["claude-opus"] = "opus",
            ["claude-haiku"] = "haiku"
        };

        return mapping.TryGetValue(modelId, out var alias) ? alias : modelId ?? _options.DefaultModel;
    }
}
```

### A4 : DependencyInjection.cs

```csharp
using LLMProvider.Application.Interfaces.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.ClaudeCodeProvider;

public static class DependencyInjection
{
    public static IServiceCollection AddClaudeCodeProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<ClaudeCodeProviderOptions>(
            configuration.GetSection(ClaudeCodeProviderOptions.SectionName));

        // No HttpClient needed — this provider spawns CLI processes
        services.AddSingleton<ILLMProvider, ClaudeCodeLLMProvider>();

        return services;
    }
}
```

### A5 : Enregistrer dans Program.cs

**Fichier** : `C:\LLM-Provider\dotnet\src\LLMProvider.Web\Program.cs`

Ajouter apres les providers existants :

```csharp
using LLMProvider.ClaudeCodeProvider;
// ...
builder.Services.AddClaudeCodeProvider(builder.Configuration);
```

### A6 : Configuration dans appsettings.json

**Fichier** : `C:\LLM-Provider\dotnet\src\LLMProvider.Web\appsettings.json`

Ajouter dans la section `Providers` :

```json
"ClaudeCode": {
    "CliPath": "claude",
    "DefaultModel": "sonnet",
    "TimeoutSeconds": 120,
    "MaxTurns": 1,
    "Models": [
        {
            "ModelId": "claude-sonnet",
            "Alias": "sonnet",
            "ContextLength": 200000,
            "Capabilities": ["chat", "code", "reasoning"]
        },
        {
            "ModelId": "claude-opus",
            "Alias": "opus",
            "ContextLength": 200000,
            "Capabilities": ["chat", "code", "reasoning"]
        },
        {
            "ModelId": "claude-haiku",
            "Alias": "haiku",
            "ContextLength": 200000,
            "Capabilities": ["chat", "code"]
        },
        {
            "ModelId": "sonnet",
            "Alias": "sonnet",
            "ContextLength": 200000,
            "Capabilities": ["chat", "code", "reasoning"]
        },
        {
            "ModelId": "opus",
            "Alias": "opus",
            "ContextLength": 200000,
            "Capabilities": ["chat", "code", "reasoning"]
        },
        {
            "ModelId": "haiku",
            "Alias": "haiku",
            "ContextLength": 200000,
            "Capabilities": ["chat", "code"]
        }
    ]
}
```

### A7 : Changer le port de LLM-Provider .NET

**Fichier** : `C:\LLM-Provider\dotnet\src\LLMProvider.Web\appsettings.json`

Changer :
```json
"Server": {
    "BindAddress": "127.0.0.1",
    "Port": 5010
}
```

Et le monitor :
```json
"Monitor": {
    "BackendUrl": "http://localhost:5010"
}
```

### A8 : Build + verification

```bash
cd C:\LLM-Provider\dotnet
dotnet build
dotnet run --project src/LLMProvider.Web --urls=http://localhost:5010
# Verify:
curl http://localhost:5010/api/v1/health
curl http://localhost:5010/api/v1/models
```

---

## Partie B : Connecter Maestro au gateway .NET de LLM-Provider

### B1 : Adapter LLMProviderGateway pour le nouveau contrat API

**Fichier** : `C:\Meastro\backend\src\Maestro.Infrastructure\LLMGateway\LLMProviderGateway.cs`

Le contrat change de snake_case Python a camelCase .NET :

**Avant (Python /v1/generate) :**
```json
POST /v1/generate
Request:  { "prompt": "...", "model_id": "...", "max_new_tokens": 512 }
Response: { "generated_text": "...", "prompt_tokens": 50, "completion_tokens": 100 }
```

**Apres (.NET /api/v1/llm/complete) :**
```json
POST /api/v1/llm/complete
Request:  { "prompt": "...", "model": "...", "maxTokens": 512 }
Response: { "content": "...", "tokenUsage": { "promptTokens": 50, "completionTokens": 100 } }
```

Changements dans `LLMProviderGateway` :
1. Endpoint : `/v1/generate` → `/api/v1/llm/complete`
2. Request DTO : `LLMProviderRequest` (snake_case) → `LLMProviderCompleteRequest` (camelCase)
3. Response DTO : `LLMProviderResponse` (snake_case) → `LLMProviderCompleteResponse` (camelCase)
4. JSON options : `SnakeCaseLower` → `CamelCase`
5. Streaming : `/api/v1/llm/stream` avec SSE (meme format que le .NET gateway)

### B2 : Adapter LLMProviderService pour le nouveau contrat

**Fichier** : `C:\Meastro\backend\src\Maestro.Infrastructure\LLMGateway\LLMProviderService.cs`

Endpoints a adapter :
- `/health` → `/api/v1/health`
- `/v1/models` → `/api/v1/models`
- `/v1/switch-model` → Plus necessaire (model passe dans chaque requete)
- `/v1/models/compatible` → `/api/v1/models` avec filtres

### B3 : Changer BaseUrl dans appsettings.json

**Fichier** : `C:\Meastro\backend\src\Maestro.Api\appsettings.json`

```json
"LLMProvider": {
    "BaseUrl": "http://localhost:5010",
    "DefaultModel": "Qwen2.5-Coder-1.5B-Instruct"
}
```

### B4 : Supprimer AzureOpenAIGateway de Maestro

C'est un duplicata de `AzureLLMProvider` dans LLM-Provider .NET.

**Supprimer :**
- `backend/src/Maestro.Infrastructure/LLMGateway/AzureOpenAIGateway.cs`
- `backend/src/Maestro.Infrastructure/LLMGateway/AzureOpenAISettings.cs`
- Section `AzureOpenAI` de `appsettings.json`

### B5 : Simplifier Program.cs

**Fichier** : `backend/src/Maestro.Api/Program.cs`

Remplacer le `if (useAzure) ... else ...` par un seul enregistrement :

```csharp
// === LLM Gateway (single gateway to LLM-Provider service) ===
builder.Services.Configure<LLMProviderSettings>(
    builder.Configuration.GetSection(LLMProviderSettings.SectionName));
builder.Services.AddHttpClient<ILLMGateway, LLMProviderGateway>((sp, client) =>
{
    var settings = builder.Configuration.GetSection(LLMProviderSettings.SectionName)
        .Get<LLMProviderSettings>() ?? new LLMProviderSettings();
    client.BaseAddress = new Uri(settings.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);
});
```

### B6 : Nettoyer ProviderController.cs

**Fichier** : `backend/src/Maestro.Api/Controllers/ProviderController.cs`

- **Supprimer** : `GetAzureConfig()`, `SaveAzureConfig()`, `TestAzureConnection()` (lignes 149-284)
- **Supprimer** : `AzureConfigRequest`, `AzureTestRequest` records
- **Simplifier** : `GetActiveProvider()` — plus besoin de `is AzureOpenAIGateway`

```csharp
[HttpGet("active")]
public async Task<ActionResult> GetActiveProvider(CancellationToken ct)
{
    try
    {
        var health = await _llmService.GetHealthAsync(ct);
        return Ok(new { provider = "llm-provider", health });
    }
    catch (LLMProviderUnavailableException ex)
    {
        return StatusCode(503, new { error = "LLM Provider unavailable", details = ex.Message });
    }
}
```

### B7 : Supprimer le placeholder LLMGateway.cs

**Fichier** : `backend/src/Maestro.Infrastructure/LLMGateway/LLMGateway.cs`

Dead code. Supprimer.

### B8 : Adapter dev-start.ps1

**Fichier** : `dev-scripts/dev-start.ps1`

Ajouter le demarrage du .NET API de LLM-Provider entre Python et Maestro :

```powershell
# 1. Python service (port 8000) — inference locale
# 2. LLM-Provider .NET API (port 5010) — multi-provider gateway (NEW)
# 3. Maestro backend (port 5000)
# 4. Maestro frontend (port 5173)
```

### B9 : Build + tests Maestro

```bash
cd C:\Meastro\backend
dotnet build
dotnet test
```

---

## Ordre d'Execution

```
Phase 1 — LLM-Provider (ne casse rien dans Maestro) :
  A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8
  (Creer ClaudeCodeProvider, changer port, build, verifier)

Phase 2 — Maestro (adapter le gateway) :
  B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9
  (Adapter contrat, supprimer Azure, simplifier, tester)
```

**Phase 1 est independante.** Maestro continue de fonctionner avec Python directement pendant que le .NET gateway est prepare. Phase 2 bascule Maestro vers le .NET gateway.

---

## Verification End-to-End

1. **LLM-Provider .NET (port 5010)** :
   - `GET /api/v1/health` → statut de chaque provider
   - `GET /api/v1/models` → modeles local + claude-code
   - `POST /api/v1/llm/complete {"prompt":"Hi","model":"SmolLM2-1.7B-Instruct"}` → local GPU
   - `POST /api/v1/llm/complete {"prompt":"Hi","model":"sonnet"}` → claude CLI

2. **Maestro (port 5000)** :
   - `GET /api/provider/health` → delegue au .NET gateway
   - `GET /api/provider/active` → `{ provider: "llm-provider" }`
   - Session avec `model: "SmolLM2"` sur un node → local GPU via .NET gateway
   - Session avec `model: "sonnet"` sur un autre → claude via .NET gateway

3. **Workflow complet** :
   - Creer une session avec 2 nodes (SmolLM2 + sonnet)
   - Les deux fonctionnent dans le meme workflow

---

## Fichiers — Resume

### LLM-Provider .NET (C:\LLM-Provider\dotnet\)

| Action | Fichier |
|--------|---------|
| **CREER** | `src/LLMProvider.ClaudeCodeProvider/ClaudeCodeProviderOptions.cs` |
| **CREER** | `src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` |
| **CREER** | `src/LLMProvider.ClaudeCodeProvider/DependencyInjection.cs` |
| **CREER** | `src/LLMProvider.ClaudeCodeProvider/LLMProvider.ClaudeCodeProvider.csproj` |
| **MODIFIER** | `src/LLMProvider.Web/Program.cs` (ajouter `AddClaudeCodeProvider`) |
| **MODIFIER** | `src/LLMProvider.Web/appsettings.json` (ajouter section ClaudeCode, changer port) |
| **MODIFIER** | `LLMProvider.sln` (ajouter le projet) |

### Maestro (C:\Meastro\)

| Action | Fichier |
|--------|---------|
| **MODIFIER** | `Infrastructure/LLMGateway/LLMProviderGateway.cs` (nouveau contrat API) |
| **MODIFIER** | `Infrastructure/LLMGateway/LLMProviderService.cs` (nouveaux endpoints) |
| **MODIFIER** | `Api/appsettings.json` (BaseUrl → 5010, supprimer AzureOpenAI) |
| **MODIFIER** | `Api/Program.cs` (supprimer if/else Azure, un seul gateway) |
| **MODIFIER** | `Api/Controllers/ProviderController.cs` (supprimer endpoints Azure) |
| **MODIFIER** | `dev-scripts/dev-start.ps1` (demarrer le .NET API) |
| **SUPPRIMER** | `Infrastructure/LLMGateway/AzureOpenAIGateway.cs` |
| **SUPPRIMER** | `Infrastructure/LLMGateway/AzureOpenAISettings.cs` |
| **SUPPRIMER** | `Infrastructure/LLMGateway/LLMGateway.cs` (placeholder) |
