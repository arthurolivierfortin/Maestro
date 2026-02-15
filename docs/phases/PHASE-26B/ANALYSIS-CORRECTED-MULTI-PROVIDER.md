# Phase 26-B : Analyse Corrigee — Multi-Provider Architecture

> Date : 2026-02-15
> Status : **SUPERSEDED** — Cette analyse supposait a tort que LLM-Provider etait Python uniquement. LLM-Provider est une solution .NET Clean Architecture complete.
> Remplace par : `ANALYSIS-FINAL.md`
> Contexte : L'implementation precedente violait l'architecture en placant la logique multi-provider DANS Maestro.

---

## 1. L'Erreur Fondamentale

L'implementation precedente creait `MultiProviderGateway`, `ClaudeCodeGateway`, `AnthropicApiGateway`, `CliAgentGateway` **dans le backend C# de Maestro**. C'etait architecturalement faux.

### Pourquoi c'etait faux

| Principe | Violation |
|----------|-----------|
| **Maestro est agnostique aux providers** | Maestro contenait la logique de routing par model ID, des patterns glob, du spawn de process `claude -p`, des appels REST Anthropic |
| **LLM-Provider est LE service LLM** | LLM-Provider etait reduit a un simple backend local pendant que Maestro dupliquait la logique de routage |
| **Separation des responsabilites** | Maestro connaissait Claude Code, Anthropic API, Azure — il ne devrait connaitre que "envoyer un prompt, recevoir une reponse" |
| **Ajout de provider = zero changement Maestro** | Ajouter un nouveau provider (OpenAI, Ollama, etc.) aurait necessite des changements C# |

### L'architecture correcte

```
Maestro C# Backend
  └── LLMProviderGateway (HTTP client — UN SEUL gateway)
        └── POST /v1/generate { model_id: "claude-sonnet", prompt: "..." }
              └── LLM-Provider Python Service (port 8000)
                    └── Provider Router (NEW)
                          ├── LocalGPUProvider    (existant — ModelManager, PyTorch)
                          ├── ClaudeCodeProvider  (NEW — spawn `claude -p`)
                          ├── AnthropicAPIProvider(FUTUR — REST api.anthropic.com)
                          └── AzureOpenAIProvider (FUTUR — REST Azure endpoint)
```

**Maestro ne connait PAS la logique des providers.** Il envoie un `model_id` avec sa requete. LLM-Provider route la requete vers le bon backend. C'est tout.

---

## 2. Etat Actuel

### LLM-Provider (Python, port 8000)

- **LocalGPU UNIQUEMENT** — charge des modeles HuggingFace en VRAM, genere via PyTorch
- **ModelManager** (singleton) — load/switch/generate/unload, CUDA recovery
- **API** : `/v1/generate`, `/v1/switch-model`, `/v1/models/*`, `/health`
- **Pas d'abstraction provider** — le `generate()` endpoint appelle directement `manager.generate()`
- **`model_id`** dans `/v1/generate` — utilise le modele actif ou charge le modele demande

### Maestro (C#, port 5000)

- **`ILLMGateway`** — interface avec `SendAsync`, `StreamAsync`, `SwitchModelAsync`
- **`LLMProviderGateway`** — HTTP client vers le Python service (`POST /v1/generate`)
- **`AzureOpenAIGateway`** — HTTP client direct vers Azure OpenAI REST API
- **`Program.cs`** — choix binaire au demarrage : Azure OU local, jamais les deux
- **`LLMProviderService`** — admin (health, models, switch) — parle UNIQUEMENT au Python service

### Le probleme existant (avant ma tentative)

1. **Un seul provider actif** — `if (useAzure) ... else ...` dans Program.cs
2. **AzureOpenAIGateway dans Maestro** — la logique Azure est dans le C#, pas dans LLM-Provider
3. **Pas de routing par model** — impossible d'utiliser SmolLM2 (local) + claude-sonnet (cloud) dans le meme workflow

---

## 3. Ce Qui Doit Changer

### 3.1 Dans LLM-Provider (Python) — Les changements principaux

Le Python service doit evoluer d'un "serveur GPU local" vers un "routeur multi-provider":

#### a) Abstraction Provider

```python
# Nouveau : src/providers/base.py
class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt, model_id, messages, system_prompt,
                       max_new_tokens, temperature, ...) -> GenerateResult:
        ...

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """Modeles disponibles via ce provider."""
        ...

    @abstractmethod
    async def health(self) -> ProviderHealth:
        ...
```

#### b) Providers concrets

```
src/providers/
├── base.py              # LLMProvider ABC
├── local_gpu.py         # Wrap de ModelManager existant (PyTorch/HuggingFace)
├── claude_code.py       # Spawn `claude -p`, parse JSON output
└── (futur) anthropic_api.py, azure_openai.py, ollama.py
```

#### c) Routeur (dans server.py ou module dedie)

```python
# Le generate endpoint devient :
@app.post("/v1/generate")
async def generate(req: GenerateRequest):
    provider = router.resolve(req.model_id)  # "local", "claude-code", etc.
    return await provider.generate(...)
```

Le routeur utilise une config (fichier JSON ou env vars) :

```json
{
  "default_provider": "local",
  "providers": {
    "local": { "type": "local_gpu" },
    "claude-code": { "type": "claude_code", "default_model": "sonnet" }
  },
  "model_routes": {
    "claude-sonnet": "claude-code",
    "claude-opus": "claude-code",
    "sonnet": "claude-code",
    "opus": "claude-code"
  },
  "model_patterns": {
    "claude-*": "claude-code"
  }
}
```

#### d) Endpoints enrichis

- `GET /v1/models` — retourne les modeles de TOUS les providers (locaux + cloud)
- `GET /v1/providers` — NEW — liste les providers actifs et leur statut
- `GET /health` — inclut le statut de chaque provider

### 3.2 Dans Maestro (C#) — Simplification

| Action | Detail |
|--------|--------|
| **SUPPRIMER** `AzureOpenAIGateway.cs` | La logique Azure va dans LLM-Provider |
| **SUPPRIMER** `AzureOpenAISettings.cs` | Plus besoin dans Maestro |
| **SUPPRIMER** `if (useAzure)` dans Program.cs | Un seul gateway : `LLMProviderGateway` |
| **SUPPRIMER** les endpoints Azure dans ProviderController | `/api/provider/azure/*` — plus pertinent |
| **SIMPLIFIER** `appsettings.json` | Juste `LLMProvider.BaseUrl` — pas de config par provider |
| **GARDER** `LLMProviderGateway` tel quel | Il passe deja `model_id` dans les requetes |
| **GARDER** `LLMProviderService` | Il parle deja au Python service pour les admin ops |
| **ADAPTER** `ProviderController.GetActiveProvider` | Appeler un nouvel endpoint `/v1/providers` |

### 3.3 Ce qui ne change PAS du tout

| Element | Raison |
|---------|--------|
| `ILLMGateway` interface | Inchangee — Maestro reste agnostique |
| `LLMRequest` / `LLMResponse` | Inchanges — le contrat est stable |
| `InferenceBlockExecutor` | Transparent — appelle `ILLMGateway.SendAsync` |
| `AgentBlockExecutor` | Transparent — appelle `ILLMGateway.SendAsync` |
| `EntryPointExecutor` | Continue a passer `model_id` sur les requetes |
| Node-level model selection | `config.nodes[].inputs.model` fonctionne deja |
| Block configs, session templates | Aucun changement |

---

## 4. Flux End-to-End (Apres)

### Scenario : Workflow avec SmolLM2 (local) + Claude Sonnet (cloud)

```
1. EntryPointExecutor lit le node: { "inputs": { "model": "SmolLM2-1.7B-Instruct" } }
2. → LLMProviderGateway.SendAsync({ ModelId: "SmolLM2-1.7B-Instruct", Prompt: "..." })
3. → HTTP POST http://localhost:8000/v1/generate { "model_id": "SmolLM2-1.7B-Instruct", ... }
4. → LLM-Provider router: "SmolLM2-1.7B-Instruct" → provider "local"
5. → LocalGPUProvider.generate() → ModelManager.generate() → PyTorch inference
6. → Response: { "generated_text": "...", "model": "SmolLM2-1.7B-Instruct" }

7. EntryPointExecutor lit le node suivant: { "inputs": { "model": "claude-sonnet" } }
8. → LLMProviderGateway.SendAsync({ ModelId: "claude-sonnet", Prompt: "..." })
9. → HTTP POST http://localhost:8000/v1/generate { "model_id": "claude-sonnet", ... }
10. → LLM-Provider router: "claude-sonnet" → provider "claude-code"
11. → ClaudeCodeProvider.generate() → subprocess `claude -p "..." --model sonnet --output-format json`
12. → Response: { "generated_text": "...", "model": "claude-sonnet-4-5-20250929" }
```

**Maestro ne sait jamais comment la requete est servie.** Il envoie un model_id, il recoit une reponse.

---

## 5. Plan d'Implementation (2 parties)

### Partie A : LLM-Provider Python (changements principaux)

```
A1. Creer src/providers/base.py — ABC LLMProvider
A2. Creer src/providers/local_gpu.py — wrap ModelManager existant
A3. Creer src/providers/claude_code.py — spawn `claude -p`, parse JSON
A4. Creer src/providers/router.py — routing par model_id (exact + patterns)
A5. Creer providers.json — config des providers et routes
A6. Modifier api/server.py — /v1/generate delegue au router
A7. Ajouter GET /v1/providers — liste des providers actifs
A8. Enrichir GET /v1/models — inclure les modeles cloud
A9. Enrichir GET /health — statut par provider
A10. Tests : local + claude-code dans la meme requete sequence
```

### Partie B : Maestro C# (simplification)

```
B1. Supprimer AzureOpenAIGateway.cs
B2. Supprimer la section AzureOpenAI de appsettings.json
B3. Supprimer le if (useAzure) dans Program.cs — garder seulement LLMProviderGateway
B4. Supprimer les endpoints /api/provider/azure/* dans ProviderController
B5. Adapter GetActiveProvider() — appeler GET /v1/providers du Python
B6. Supprimer le placeholder LLMGateway.cs (dead code)
B7. Build + tests — verifier zero regression
```

### Ordre d'execution

**A avant B.** LLM-Provider doit supporter le multi-provider avant que Maestro puisse simplifier.

---

## 6. Avantages de l'Architecture Correcte

| Aspect | Ancienne approche (fausse) | Nouvelle approche (correcte) |
|--------|---------------------------|------------------------------|
| Ajouter un provider | Modifier C# + rebuild + redeploy Maestro | Ajouter un fichier Python + redemarrer LLM-Provider |
| Code provider-specifique | Disperse dans 2 codebases (C# + Python) | Concentre dans LLM-Provider uniquement |
| Tests de providers | Tester le backend C# entier | Tester le Python service isole |
| Config | appsettings.json C# complexe | providers.json Python simple |
| Separation des responsabilites | Maestro connait Claude, Anthropic, Azure | Maestro connait "envoyer prompt, recevoir reponse" |
| Docker deployment | Chaque provider = changement dans le Dockerfile Maestro | Chaque provider = changement dans LLM-Provider seulement |

---

## 7. Risques

| Risque | Mitigation |
|--------|------------|
| LLM-Provider down = tout down | C'etait deja le cas — le service Python est un SPOF |
| Latence supplementaire (HTTP hop) | ~1ms de latence HTTP locale — negligeable vs 1-30s d'inference |
| ClaudeCodeProvider dans Python = spawn process | Meme pattern que dans C# mais en Python (asyncio.subprocess) |
| Migration AzureOpenAI du C# vers Python | Pas urgente — on peut garder Azure dans C# temporairement et migrer plus tard |

---

## 8. Questions Ouvertes

1. **Faut-il migrer AzureOpenAI vers LLM-Provider immediatement ?** Suggestion : non. Le garder dans Maestro temporairement, le marquer `@deprecated`, le migrer quand on ajoutera Azure a LLM-Provider.

2. **Config providers.json ou env vars ?** Suggestion : fichier JSON dans LLM-Provider (plus lisible qu'env vars pour des routes complexes).

3. **Le Python service doit-il devenir async ?** Le `/v1/generate` actuel est synchrone (FastAPI + sync def). Pour les providers cloud (HTTP calls), il faudra des endpoints `async def`. Le refactoring est necessaire.
