# 59-PRE-E : Provider GitHub Models

**But** : Ajouter un provider GitHub Models standalone (meme pattern qu'Anthropic : HttpClient brut, zero dependance Azure).

---

## Design

Provider autonome, meme architecture qu'`AnthropicLLMProvider` :

```
ILLMProvider
    ├── AzureInferenceLLMProvider (SDK Azure.AI.Inference — inchange)
    ├── AnthropicLLMProvider (HttpClient + /v1/messages)
    └── GitHubModelsLLMProvider (HttpClient + /v1/chat/completions)  ← NOUVEAU
```

### Format API

GitHub Models parle le format OpenAI-compatible :

```
POST https://models.inference.ai.azure.com/chat/completions
Authorization: Bearer {github_token}
Content-Type: application/json

{
  "model": "DeepSeek-V3",
  "messages": [{"role": "user", "content": "hello"}],
  "max_tokens": 100,
  "temperature": 0.7
}
```

Response :
```json
{
  "choices": [{"message": {"content": "..."}, "finish_reason": "stop"}],
  "usage": {"prompt_tokens": 10, "completion_tokens": 20}
}
```

---

## Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `llm-provider/dotnet/src/LLMProvider.GitHubModelsProvider/LLMProvider.GitHubModelsProvider.csproj` | Projet : reference Application, HTTP, DI, Options (pas Azure SDK) |
| `llm-provider/dotnet/src/LLMProvider.GitHubModelsProvider/GitHubModelsLLMProvider.cs` | ILLMProvider via HttpClient : CompleteAsync, StreamCompleteAsync, GetAvailableModelsAsync, IsAvailableAsync |
| `llm-provider/dotnet/src/LLMProvider.GitHubModelsProvider/GitHubModelsOptions.cs` | Token, Endpoint (default models.inference.ai.azure.com), Models list, Timeout, MaxRetries |
| `llm-provider/dotnet/src/LLMProvider.GitHubModelsProvider/DependencyInjection.cs` | AddGitHubModelsProvider() |

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `llm-provider/dotnet/src/LLMProvider.Domain/Enums/ProviderType.cs` | Ajouter `GitHubModels = 7` |
| `llm-provider/dotnet/src/LLMProvider.Web/LLMProvider.Web.csproj` | Reference GitHubModelsProvider |
| `llm-provider/dotnet/src/LLMProvider.Web/Program.cs` | Enregistrer GitHubModelsProvider |
| `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` | Section GitHubModels avec modeles + pricing |
| `packages/maestro-code/components/ProviderSetupScreen.ts` | Option "GitHub Models" |
| `packages/maestro-cli/config.ts` | `githubModels` dans ProviderConfigs |
| `packages/maestro-code/tests/LocalSetup.test.ts` | Ajuster numeros de touches si decales |

---

## Configuration

```json
"GitHubModels": {
    "Endpoint": "https://models.inference.ai.azure.com",
    "Token": "",
    "TimeoutSeconds": 120,
    "MaxRetries": 3,
    "Models": [
        {
            "ModelId": "DeepSeek-V3",
            "ContextLength": 65536,
            "MaxOutputTokens": 8192,
            "InputTokenPrice": 0.00027,
            "OutputTokenPrice": 0.0011,
            "Capabilities": ["chat"],
            "ModelFamily": "deepseek",
            "ParametersBillions": 685
        },
        {
            "ModelId": "Meta-Llama-3.3-70B-Instruct",
            "ContextLength": 131072,
            "MaxOutputTokens": 4096,
            "InputTokenPrice": 0.00071,
            "OutputTokenPrice": 0.00071,
            "Capabilities": ["chat"],
            "ModelFamily": "llama",
            "ParametersBillions": 70
        }
    ]
}
```

---

## Verification

```bash
dotnet build C:\Meastro\llm-provider\dotnet\src\LLMProvider.Web\LLMProvider.Web.csproj
# 0 erreurs

cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

cd C:\Meastro\packages\maestro-code && npx vitest run
# 154/156 (memes 2 pre-existants)
```

---

## Anti-patterns

- Ne PAS utiliser le SDK Azure.AI.Inference — HttpClient brut suffit, zero dependance Azure
- Ne PAS creer de classe parent partagee — pas de code commun significatif avec les autres providers
- Ne PAS copier-coller AnthropicLLMProvider — le format est different (/v1/messages vs /v1/chat/completions), ecrire le code specifique

---

## Effort

~0.5 jour
