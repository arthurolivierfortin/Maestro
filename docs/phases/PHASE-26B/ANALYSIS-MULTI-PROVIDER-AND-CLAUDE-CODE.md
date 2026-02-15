# Phase 26-B : Analyse Multi-Provider et Claude Code Provider

> Date : 2026-02-15
> Status : Analyse & Suggestions
> Contexte : Suite a `request2.md` — clarification du besoin reel

---

## 1. Resume du Besoin (Ce que l'utilisateur veut)

L'utilisateur a clarifie son intention :

1. **Pas d'API payante pour l'instant** — L'app n'est pas prete. Pas de depenses Azure/Anthropic API tant que l'infrastructure n'est pas validee.
2. **Claude Max subscription deja payee** — Autant l'exploiter pour tester des usages avances en attendant.
3. **Multiple providers actifs** — Le systeme actuel n'a qu'un seul provider actif, ce qui est un defaut architectural.
4. **Models differents par block** — La feature existe (node-level model selection) mais ne fonctionne qu'au sein d'un seul provider.
5. **Claude Code comme provider gratuit** — Si `claude -p` fonctionne en mode stateless (prompt in → response out, sans memoire), l'utiliser comme gateway LLM sans cout additionnel.

---

## 2. Reponse Directe aux Questions

### 2.1 Claude Code supporte-t-il un mode prompt stateless ?

**OUI. Exactement ce qui est demande.**

```bash
# Mode stateless — chaque appel est independant, zero memoire
claude -p "Votre prompt ici"

# Avec system prompt custom et output JSON structure
claude -p "Votre prompt" \
  --system-prompt "Vous etes un assistant specialise..." \
  --output-format json \
  --model sonnet \
  --max-turns 1

# Output JSON structure :
# { "result": "...", "session_id": "...", "usage": {...}, "total_cost_usd": 0.00 }
```

**Caracteristiques cles :**

| Aspect | Comportement |
|--------|-------------|
| Memoire entre appels | **Aucune** — chaque `claude -p` est independant |
| Authentification | **Login Max subscription** (`claude login`) — pas d'API key |
| Cout supplementaire | **$0** — inclus dans l'abonnement Max |
| System prompt | `--system-prompt "..."` — controle total |
| Model | `--model sonnet/opus/haiku` |
| Output format | `--output-format json` — parseable par Maestro |
| Outils | `--allowedTools ""` ou pas specifie = inference pure |
| Max turns | `--max-turns 1` = une seule inference, pas de boucle agent |
| Session persistence | `--no-session-persistence` = pas de sauvegarde |

### 2.2 Erreur dans l'analyse precedente

L'analyse `ANALYSIS-CLI-AGENT-PROVIDERS.md` contenait une erreur importante :

> *"Prix identique (API key = memes tarifs)"*

**C'est FAUX dans le contexte de l'utilisateur.** La distinction cruciale :

| Methode | Cout |
|---------|------|
| `claude -p` avec login Max ($200/mois) | **$0 supplementaire** — deja paye |
| API Anthropic (`@anthropic-ai/sdk`) | **Pay-per-token** — $3-75 par million de tokens selon le modele |
| Agent SDK (`@anthropic-ai/claude-agent-sdk`) | **Requiert API key** — pay-per-token |

**Conclusion : L'intuition de l'utilisateur etait correcte.** Un `ClaudeCodeGateway` qui spawn `claude -p` utilise l'abonnement Max sans cout supplementaire. C'est la meilleure option pour la phase pre-V3 (tester sans payer d'API).

### 2.3 Peut-on avoir plusieurs providers actifs ?

**Non actuellement. Oui architecturalement — c'est un refactoring a faire.**

Code actuel dans `Program.cs` :
```csharp
// UN SEUL provider — choix exclusif
if (useAzure)
    builder.Services.AddScoped<ILLMGateway>(sp => sp.GetRequiredService<AzureOpenAIGateway>());
else
    builder.Services.AddScoped<ILLMGateway>(sp => sp.GetRequiredService<LLMProviderGateway>());
```

Le fix est un `MultiProviderGateway` (router) qui delegue aux providers selon le `ModelId` de la requete.

### 2.4 Model selection par block — fonctionne-t-elle ?

**Partiellement.** La selection par node existe (`config.nodes[].inputs.model`) mais :
- Elle appelle `SwitchModelAsync()` sur le **meme provider**
- Un model local (SmolLM2) et un model cloud (claude-sonnet) ne peuvent pas coexister
- Avec le `MultiProviderGateway`, le `ModelId` routerait vers le bon provider automatiquement

---

## 3. Architecture Proposee

### 3.1 Vue d'ensemble

```
ILLMGateway (interface — inchangee)
│
└── MultiProviderGateway (NEW — router par ModelId)
    │
    ├── "local"     → LLMProviderGateway        (Python service, GPU local)
    ├── "azure"     → AzureOpenAIGateway         (Azure OpenAI, si configure)
    └── "claude"    → ClaudeCodeCliGateway (NEW)  (claude -p, Max subscription)
```

### 3.2 MultiProviderGateway (router)

```csharp
public class MultiProviderGateway : ILLMGateway
{
    private readonly Dictionary<string, ILLMGateway> _providers;
    private readonly Dictionary<string, string> _modelRoutes;  // model → provider
    private readonly string _defaultProvider;

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken ct)
    {
        var provider = ResolveProvider(request.ModelId);
        return await provider.SendAsync(request, ct);
    }

    private ILLMGateway ResolveProvider(string? modelId)
    {
        // 1. Route explicite (model → provider)
        if (modelId != null && _modelRoutes.TryGetValue(modelId, out var providerName))
            return _providers[providerName];

        // 2. Pattern matching ("claude-*" → "claude", "gpt-*" → "azure")
        if (modelId != null)
        {
            if (modelId.StartsWith("claude-")) return _providers.GetValueOrDefault("claude", _providers[_defaultProvider]);
            if (modelId.StartsWith("gpt-")) return _providers.GetValueOrDefault("azure", _providers[_defaultProvider]);
        }

        // 3. Default
        return _providers[_defaultProvider];
    }

    public IAsyncEnumerable<string> StreamAsync(LLMRequest request, CancellationToken ct)
    {
        var provider = ResolveProvider(request.ModelId);
        return provider.StreamAsync(request, ct);
    }

    public async Task SwitchModelAsync(string modelId, CancellationToken ct)
    {
        // Pour les providers qui supportent le switch (local GPU)
        var provider = ResolveProvider(modelId);
        await provider.SwitchModelAsync(modelId, ct);
    }
}
```

### 3.3 ClaudeCodeCliGateway

```csharp
public class ClaudeCodeCliGateway : ILLMGateway
{
    private readonly ClaudeCodeSettings _settings;
    private readonly ILogger<ClaudeCodeCliGateway> _logger;

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken ct)
    {
        // Construire le prompt complet
        var prompt = BuildPrompt(request);

        // Arguments CLI
        var args = new List<string>
        {
            "-p", prompt,
            "--output-format", "json",
            "--max-turns", "1",
            "--no-session-persistence"
        };

        // Model
        var model = request.ModelId ?? _settings.DefaultModel ?? "sonnet";
        args.AddRange(new[] { "--model", MapModelId(model) });

        // System prompt (du block, pas de Claude Code)
        if (!string.IsNullOrEmpty(request.SystemPrompt))
            args.AddRange(new[] { "--system-prompt", request.SystemPrompt });

        // Executer
        var jsonOutput = await ExecuteClaudeAsync(args, ct);
        return ParseResponse(jsonOutput, model);
    }

    private string BuildPrompt(LLMRequest request)
    {
        // Si Messages[] fournis, construire un prompt textuel
        if (request.Messages?.Any() == true)
        {
            var sb = new StringBuilder();
            foreach (var msg in request.Messages.Where(m => m.Role != "system"))
            {
                sb.AppendLine($"[{msg.Role}]: {msg.Content}");
            }
            return sb.ToString();
        }
        return request.Prompt ?? "";
    }

    private string MapModelId(string maestroModelId)
    {
        // Mapper les IDs Maestro vers les IDs Claude Code
        return maestroModelId switch
        {
            "claude-opus" => "opus",
            "claude-sonnet" => "sonnet",
            "claude-haiku" => "haiku",
            _ => maestroModelId  // Passer tel quel
        };
    }

    private LLMResponse ParseResponse(string jsonOutput, string model)
    {
        var doc = JsonDocument.Parse(jsonOutput);
        var root = doc.RootElement;

        var content = root.GetProperty("result").GetString() ?? "";
        var usage = root.TryGetProperty("usage", out var usageEl) ? usageEl : default;

        return new LLMResponse
        {
            Content = content,
            Model = model,
            PromptTokens = usage.ValueKind != JsonValueKind.Undefined
                ? usage.TryGetProperty("input_tokens", out var inp) ? inp.GetInt32() : 0
                : 0,
            CompletionTokens = usage.ValueKind != JsonValueKind.Undefined
                ? usage.TryGetProperty("output_tokens", out var outp) ? outp.GetInt32() : 0
                : 0,
            TotalTokens = 0  // Calcule a partir des deux precedents
        };
    }

    private async Task<string> ExecuteClaudeAsync(List<string> args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "claude",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in args)
            psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start claude CLI");

        var output = await process.StandardOutput.ReadToEndAsync(ct);
        var error = await process.StandardError.ReadToEndAsync(ct);

        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
            throw new LLMProviderUnavailableException(
                $"Claude CLI failed (exit {process.ExitCode}): {error}");

        return output;
    }

    // Streaming — non supporte via CLI (ou utiliser --output-format stream-json)
    public IAsyncEnumerable<string> StreamAsync(LLMRequest request, CancellationToken ct)
        => throw new NotSupportedException("ClaudeCodeCliGateway ne supporte pas le streaming.");

    // Model switch — no-op (le model est passe par argument a chaque appel)
    public Task SwitchModelAsync(string modelId, CancellationToken ct) => Task.CompletedTask;
}
```

### 3.4 Configuration (`appsettings.json`)

```json
{
  "LLMProviders": {
    "Default": "local",
    "Providers": {
      "local": {
        "Type": "LLMProvider",
        "BaseUrl": "http://localhost:8000"
      },
      "claude": {
        "Type": "ClaudeCodeCli",
        "DefaultModel": "sonnet",
        "TimeoutSeconds": 120
      }
    },
    "ModelRoutes": {
      "claude-opus": "claude",
      "claude-sonnet": "claude",
      "claude-haiku": "claude",
      "SmolLM2-1.7B-Instruct": "local",
      "Qwen2.5-Coder-1.5B-Instruct": "local"
    }
  }
}
```

### 3.5 Utilisation dans un block

```json
{
  "config": {
    "nodes": [
      {
        "id": "complex-reasoning",
        "blockRef": "system:inference",
        "inputs": {
          "model": "claude-sonnet",
          "systemPrompt": "You are a code reviewer...",
          "temperature": 0.3
        }
      },
      {
        "id": "simple-generation",
        "blockRef": "system:inference",
        "inputs": {
          "model": "SmolLM2-1.7B-Instruct",
          "systemPrompt": "Generate a JSON object...",
          "temperature": 0.5
        }
      }
    ]
  }
}
```

Le `MultiProviderGateway` route `claude-sonnet` vers le CLI Claude, et `SmolLM2` vers le provider local. Meme session, meme workflow.

---

## 4. Priorite d'Implementation Revisee

L'analyse precedente recommandait `AnthropicApiGateway` en Tier 1. **Dans le contexte de l'utilisateur, c'est faux.** L'API Anthropic coute de l'argent. Claude Code CLI est gratuit (subscription deja payee).

### Nouvelle priorite :

```
Etape 1: MultiProviderGateway (router)           ← Prerequis pour tout le reste
Etape 2: ClaudeCodeCliGateway                    ← $0 supplementaire, teste l'infra multi-provider
Etape 3: (Futur V3) AnthropicApiGateway          ← Quand l'app est prete pour la production
Etape 4: (Futur) CliAgentGateway abstrait        ← Quand OpenCode ou d'autres CLI arrivent
```

### Effort estime :

| Etape | Effort | Impact |
|-------|--------|--------|
| MultiProviderGateway | 3-4h | **Critique** — debloque tout le multi-provider |
| ClaudeCodeCliGateway | 2-3h | **Eleve** — acces gratuit a Opus/Sonnet/Haiku |
| DI refactoring (Program.cs) | 1-2h | Necessaire pour registrer les providers |
| Config (appsettings.json) | 30min | Nouvelle section LLMProviders |
| **Total** | **7-10h** | Multi-provider fonctionnel |

---

## 5. Risques et Mitigations

### 5.1 Latence du CLI

| Risque | Mitigation |
|--------|------------|
| Spawn de process a chaque requete | Overhead ~200ms par appel (acceptable pour des requetes de 2-30s) |
| Cold start de claude CLI | Premier appel plus lent (~1-2s), les suivants plus rapides |
| Timeout sur prompts complexes | TimeoutSeconds configurable (defaut 120s) |

### 5.2 Rate limiting Max subscription

| Risque | Mitigation |
|--------|------------|
| Limite de requetes par minute | Retry avec backoff exponentiel |
| "You've reached your usage limit" | Detecter l'erreur, remonter proprement |
| Throttling sur usage intensif | Configurer des pauses entre requetes si necessaire |

### 5.3 Parsing de la sortie CLI

| Risque | Mitigation |
|--------|------------|
| Format JSON qui change | `--output-format json` est documente et stable |
| Erreurs non-JSON sur stderr | Capturer stderr, l'inclure dans l'exception |
| Output truncation (grande reponse) | Tester avec des reponses longues pendant le dev |

### 5.4 Dependance a l'installation de Claude Code

| Risque | Mitigation |
|--------|------------|
| `claude` pas installe | Verifier a la registration DI, log un warning |
| Version incompatible | Tester avec `claude --version` au demarrage |
| Login expire | Detecter l'erreur, demander re-login |

---

## 6. Ce qui ne change PAS

| Principe Maestro | Impact du ClaudeCodeCliGateway |
|-----------------|-------------------------------|
| **Agent = Block** | Inchange — Maestro controle la boucle agent |
| **System prompt dans le block** | Inchange — le prompt vient du block config, passe via `--system-prompt` |
| **ILLMGateway interface** | Inchange — le gateway implemente la meme interface |
| **Fitness/Metrics** | Inchange — la reponse est evaluee par Maestro |
| **CLI-First** | Inchange — les agents Maestro utilisent `maestro_cli` |
| **No fallback** | Inchange — si `claude` echoue, erreur visible |
| **BlockDefinition unique** | Inchange — pas de `ClaudeCodeBlockDefinition` |

---

## 7. Bonus : Modes d'utilisation possible de Claude via Max

Au-dela de l'inference pure, le mode `-p` permet aussi :

### 7.1 JSON Schema valide

```bash
claude -p "Extract the function names" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}}}'
```

Maestro pourrait utiliser `--json-schema` pour forcer des outputs structures sans parsing fragile.

### 7.2 Piping de contexte

```bash
cat large-file.txt | claude -p "Summarize this code" --output-format json
```

Pour les blocks qui ont besoin de contexte large (code review, refactoring), on peut piper du contenu directement.

### 7.3 Budget control

```bash
claude -p "Complex analysis" --max-budget-usd 0.50
```

Meme si l'abonnement Max couvre le cout, `--max-budget-usd` agit comme un circuit breaker pour eviter les prompts qui tournent en boucle.

---

## 8. Suggestions Supplementaires

### 8.1 Health check pour ClaudeCodeCliGateway

Ajouter un health check dans `ILLMProviderService` (ou un equivalent) qui verifie :
- `claude --version` fonctionne
- `claude -p "test" --output-format json --max-turns 1` retourne un JSON valide
- Le login est actif (pas d'erreur d'authentification)

### 8.2 Metriques de cout

Meme si le cout est $0 avec Max, le JSON output de Claude Code inclut `total_cost_usd` et `usage`. Stocker ces metriques permet de :
- Estimer le cout si on passait a l'API
- Suivre la consommation de tokens par block/session
- Planifier le budget V3

### 8.3 Configuration par environnement

```json
{
  "LLMProviders": {
    "Default": "local",
    "Profiles": {
      "development": {
        "Default": "claude",
        "Comment": "Dev = Claude Max subscription, $0 supplementaire"
      },
      "production": {
        "Default": "local",
        "Fallback": "azure",
        "Comment": "Prod = local d'abord, Azure en fallback"
      }
    }
  }
}
```

---

## 9. Reponse aux Questions Ouvertes de l'Analyse Precedente

| Question | Reponse |
|----------|---------|
| Avez-vous une API key Anthropic ? | **Non pertinent pour l'instant** — Max subscription + CLI suffit |
| Voulez-vous le routing multi-model ? | **Oui** — c'est le besoin #1 (MultiProviderGateway) |
| Le cas avance (tool block) vous interesse ? | **Non pour l'instant** — inference pure suffit |
| Budget ? | **$0 supplementaire** — Claude Max deja paye. API quand l'app sera prete. |
| OpenCode ? | **Garder la porte ouverte** — l'abstraction CliAgentGateway le permettra plus tard |

---

## 10. Plan d'Action

### Phase 1 : MultiProviderGateway + ClaudeCodeCliGateway

```
1. Creer MultiProviderGateway (router par ModelId)
2. Creer ClaudeCodeCliGateway (claude -p)
3. Creer ClaudeCodeSettings (config)
4. Refactorer Program.cs pour enregistrer le multi-provider
5. Ajouter la section LLMProviders dans appsettings.json
6. Tester : SmolLM2 (local) + claude-sonnet (CLI) dans la meme session
7. Verifier : metriques de tokens/cout remontes correctement
```

### Phase 2 : Validation end-to-end

```
1. Creer un workflow avec un node local + un node Claude
2. Verifier que le routing fonctionne
3. Verifier que les erreurs sont proprement remontees
4. Verifier que le monitor affiche les infos correctement
5. Tester les edge cases (timeout, rate limit, login expire)
```

---

## Annexe A : Commande Claude Code pour Inference Pure

```bash
# Inference pure — zero overhead, zero memoire, output JSON
claude -p "VOTRE_PROMPT" \
  --system-prompt "SYSTEM_PROMPT_DU_BLOCK" \
  --model sonnet \
  --output-format json \
  --max-turns 1 \
  --no-session-persistence

# Exemple de sortie :
{
  "result": "La reponse du modele...",
  "session_id": "abc-123",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 500
  },
  "total_cost_usd": 0.00,
  "model": "claude-sonnet-4-5-20250929"
}
```

## Annexe B : Comparaison des Approches (Revisee)

```
                ┌──────────────────────────────────────────────────┐
                │              Contexte Pre-V3                      │
                │   App pas prete → pas de depenses API             │
                │   Max subscription deja payee                     │
                └──────────────────┬───────────────────────────────┘
                                   │
         ┌────────────────────────┼──────────────────────────────┐
         │                        │                               │
┌────────▼────────────┐  ┌───────▼──────────────┐  ┌────────────▼──────────────┐
│   Option A:          │  │   Option B:           │  │   Option C:               │
│   Claude CLI (-p)    │  │   Anthropic API       │  │   Rester local seul       │
│                      │  │                       │  │                           │
│  Cout: $0 (Max)      │  │  Cout: pay-per-token  │  │  Cout: $0 (GPU local)     │
│  Modeles: Opus/Son   │  │  Modeles: Opus/Son    │  │  Modeles: SmolLM2/Qwen    │
│  Latence: ~1-5s      │  │  Latence: ~0.5-3s     │  │  Latence: ~0.2-2s         │
│  Capacite: 200k ctx  │  │  Capacite: 200k ctx   │  │  Capacite: 2-8k ctx       │
│  Overhead: Process    │  │  Overhead: Minimal    │  │  Overhead: Aucun          │
│                      │  │                       │  │                           │
│  ★ RECOMMANDE (Pre-V3)│ │  Recommande (V3+)     │  │  Insuffisant seul         │
└──────────────────────┘  └───────────────────────┘  └───────────────────────────┘
```
