# Phase 26-B : Plan d'Implementation Corrige — Multi-Provider in LLM-Provider

> Date : 2026-02-15
> Status : **SUPERSEDED** — Ce plan proposait d'ajouter le multi-provider en Python. En realite, LLM-Provider a deja une architecture .NET multi-provider complete.
> Remplace par : `IMPLEMENTATION-FINAL.md`
> Prerequis : Lire `ANALYSIS-FINAL.md`

---

## Principe Directeur

**Maestro ne connait pas la logique des providers.** Toute logique multi-provider est dans LLM-Provider (Python). Maestro a UN gateway (`LLMProviderGateway`).

---

## Partie A : LLM-Provider Python (changements principaux)

Le service Python (C:\LLM-Provider) passe de "serveur GPU local" a "routeur multi-provider".

### A1 : Abstraction Provider (`src/providers/base.py`)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class GenerateResult:
    generated_text: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    finish_reason: str = "stop"

@dataclass
class ProviderModelInfo:
    model_id: str
    provider: str
    context_length: int
    capabilities: List[str]
    is_local: bool  # True = loaded in VRAM, False = cloud API

@dataclass
class ProviderHealth:
    name: str
    status: str  # "healthy", "degraded", "unavailable"
    detail: Optional[str] = None

class LLMProvider(ABC):
    """Base class for all LLM providers."""

    @abstractmethod
    async def generate(self, prompt: str, model_id: str, *,
                       messages=None, system_prompt=None,
                       max_new_tokens=256, temperature=0.7,
                       do_sample=True, top_p=0.95) -> GenerateResult:
        ...

    @abstractmethod
    async def list_models(self) -> List[ProviderModelInfo]:
        ...

    @abstractmethod
    async def health(self) -> ProviderHealth:
        ...

    async def switch_model(self, model_id: str, use_8bit: bool = False):
        """No-op for cloud providers. Override for local GPU."""
        pass
```

### A2 : LocalGPUProvider (`src/providers/local_gpu.py`)

Wrap du `ModelManager` existant. L'implementation actuelle de `server.py` (generate, switch-model, etc.) est extraite dans ce provider.

```python
class LocalGPUProvider(LLMProvider):
    def __init__(self, manager: ModelManager):
        self._manager = manager

    async def generate(self, prompt, model_id, **kwargs) -> GenerateResult:
        # Reprend la logique actuelle de /v1/generate:
        # - format_chat_prompt si messages fournis
        # - manager.generate()
        # - strip du prompt de l'output
        ...

    async def list_models(self) -> List[ProviderModelInfo]:
        # Retourne les modeles charges + ceux du cache local
        ...

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            name="local",
            status="healthy" if self._manager.current() else "no_model",
            detail=f"active: {self._manager.current()}"
        )

    async def switch_model(self, model_id, use_8bit=False):
        self._manager.switch(model_id, use_8bit=use_8bit)
```

### A3 : ClaudeCodeProvider (`src/providers/claude_code.py`)

Spawn `claude -p` en mode stateless.

```python
import asyncio
import json

class ClaudeCodeProvider(LLMProvider):
    def __init__(self, config: dict):
        self._cli_path = config.get("cli_path", "claude")
        self._default_model = config.get("default_model", "sonnet")
        self._timeout = config.get("timeout_seconds", 120)

    async def generate(self, prompt, model_id, *,
                       messages=None, system_prompt=None,
                       max_new_tokens=256, temperature=0.7, **kwargs) -> GenerateResult:
        # Build prompt from messages if provided
        if messages:
            prompt = "\n\n".join(m["content"] for m in messages if m["role"] != "system")

        model = self._resolve_model(model_id)
        args = [self._cli_path, "-p", prompt, "--output-format", "json",
                "--model", model, "--max-turns", "1", "--no-session-persistence"]

        if system_prompt:
            args.extend(["--system-prompt", system_prompt])

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=self._timeout
        )

        if proc.returncode != 0:
            raise RuntimeError(f"claude CLI failed (exit {proc.returncode}): {stderr.decode()}")

        data = json.loads(stdout.decode())
        usage = data.get("usage", {})

        return GenerateResult(
            generated_text=data.get("result", ""),
            model=data.get("model", model),
            prompt_tokens=usage.get("input_tokens", 0),
            completion_tokens=usage.get("output_tokens", 0),
            total_tokens=usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        )

    async def list_models(self) -> List[ProviderModelInfo]:
        return [
            ProviderModelInfo("claude-sonnet", "claude-code", 200000, ["chat", "code", "reasoning"], False),
            ProviderModelInfo("claude-opus", "claude-code", 200000, ["chat", "code", "reasoning"], False),
            ProviderModelInfo("claude-haiku", "claude-code", 200000, ["chat", "code"], False),
            # Aliases
            ProviderModelInfo("sonnet", "claude-code", 200000, ["chat", "code", "reasoning"], False),
            ProviderModelInfo("opus", "claude-code", 200000, ["chat", "code", "reasoning"], False),
            ProviderModelInfo("haiku", "claude-code", 200000, ["chat", "code"], False),
        ]

    async def health(self) -> ProviderHealth:
        try:
            proc = await asyncio.create_subprocess_exec(
                self._cli_path, "--version",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            if proc.returncode == 0:
                return ProviderHealth("claude-code", "healthy", stdout.decode().strip())
            return ProviderHealth("claude-code", "unavailable", "claude CLI returned non-zero")
        except Exception as e:
            return ProviderHealth("claude-code", "unavailable", str(e))

    def _resolve_model(self, model_id: str) -> str:
        mapping = {"claude-sonnet": "sonnet", "claude-opus": "opus", "claude-haiku": "haiku"}
        return mapping.get(model_id, model_id or self._default_model)
```

### A4 : ProviderRouter (`src/providers/router.py`)

Routing par model_id. Config-driven.

```python
import re

class ProviderRouter:
    def __init__(self, providers: dict[str, LLMProvider], config: dict):
        self._providers = providers
        self._default = config.get("default_provider", "local")
        self._routes = config.get("model_routes", {})
        self._patterns = [
            (re.compile(p.replace("*", ".*")), name)
            for p, name in config.get("model_patterns", {}).items()
        ]

    def resolve(self, model_id: str | None) -> tuple[str, LLMProvider]:
        if model_id:
            # Exact match
            if model_id in self._routes:
                name = self._routes[model_id]
                return name, self._providers[name]
            # Pattern match
            for pattern, name in self._patterns:
                if pattern.fullmatch(model_id):
                    return name, self._providers[name]
        # Default
        return self._default, self._providers[self._default]

    @property
    def provider_names(self) -> list[str]:
        return list(self._providers.keys())
```

### A5 : Configuration (`providers.json`)

Fichier a la racine de LLM-Provider :

```json
{
  "default_provider": "local",
  "providers": {
    "local": {
      "type": "local_gpu"
    },
    "claude-code": {
      "type": "claude_code",
      "default_model": "sonnet",
      "timeout_seconds": 120
    }
  },
  "model_routes": {
    "claude-sonnet": "claude-code",
    "claude-opus": "claude-code",
    "claude-haiku": "claude-code",
    "sonnet": "claude-code",
    "opus": "claude-code",
    "haiku": "claude-code"
  },
  "model_patterns": {
    "claude-*": "claude-code"
  }
}
```

### A6 : Modifier `api/server.py`

Le `/v1/generate` endpoint delegue au router au lieu d'appeler directement `manager.generate()`.

```python
# Au demarrage: charger providers.json et creer le router
router = load_router("providers.json", manager)

@app.post("/v1/generate")
async def generate(req: GenerateRequest):
    provider_name, provider = router.resolve(req.model_id)
    result = await provider.generate(
        prompt=req.prompt,
        model_id=req.model_id,
        messages=[m.dict() for m in req.messages] if req.messages else None,
        system_prompt=req.system_prompt,
        max_new_tokens=req.max_new_tokens,
        temperature=req.temperature,
        do_sample=req.do_sample,
        top_p=req.top_p
    )
    return GenerateResponse(
        generated_text=result.generated_text,
        model=result.model,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        total_tokens=result.total_tokens,
        finish_reason=result.finish_reason
    )
```

**Note** : Le endpoint `generate` actuel est `def` (sync). Il faudra le passer en `async def` pour supporter les providers cloud (qui font des I/O async). Pour `LocalGPUProvider`, on wrap le generate sync dans `asyncio.to_thread()`.

### A7 : Nouvel endpoint `GET /v1/providers`

```python
@app.get("/v1/providers")
async def list_providers():
    results = {}
    for name, provider in router._providers.items():
        health = await provider.health()
        models = await provider.list_models()
        results[name] = {
            "status": health.status,
            "detail": health.detail,
            "model_count": len(models),
            "models": [m.model_id for m in models]
        }
    return {
        "default": router._default,
        "providers": results
    }
```

### A8 : Enrichir `GET /v1/models`

Retourner les modeles de TOUS les providers (locaux charges + cloud disponibles).

### A9 : Enrichir `GET /health`

Inclure le statut de chaque provider dans la reponse health.

### A10 : Tests

- Requete avec `model_id=null` → route vers local (defaut)
- Requete avec `model_id="SmolLM2-1.7B-Instruct"` → route vers local
- Requete avec `model_id="claude-sonnet"` → route vers claude-code
- Requete avec `model_id="sonnet"` → route vers claude-code (alias)
- Provider health quand `claude` n'est pas installe → status "unavailable"
- Fallback au defaut quand un model_id inconnu est demande

---

## Partie B : Maestro C# (simplification)

Ces changements sont OPTIONNELS dans un premier temps. Ils peuvent attendre que LLM-Provider soit stable.

### B1-B4 : Nettoyage Azure (peut attendre)

- Supprimer `AzureOpenAIGateway.cs` et `AzureOpenAISettings`
- Supprimer le `if (useAzure)` dans Program.cs
- Supprimer les endpoints `/api/provider/azure/*` dans ProviderController
- Simplifier `appsettings.json`

**Pourquoi ca peut attendre** : Azure fonctionne actuellement. Le deplacer dans LLM-Provider est un refactoring de confort, pas une urgence. On peut le marquer `@deprecated` et le migrer plus tard.

### B5 : Adapter `GetActiveProvider()` (apres A7)

```csharp
[HttpGet("active")]
public async Task<ActionResult> GetActiveProvider(CancellationToken ct)
{
    // Deleguer au Python service
    try
    {
        // Appeler GET /v1/providers via LLMProviderService (a enrichir)
        var health = await _llmService.GetHealthAsync(ct);
        return Ok(new { provider = "llm-provider", health });
    }
    catch (LLMProviderUnavailableException ex)
    {
        return StatusCode(503, new { error = "LLM Provider unavailable", details = ex.Message });
    }
}
```

### B6 : Supprimer `LLMGateway.cs` (placeholder)

Dead code, jamais enregistre dans le DI. A supprimer.

### B7 : Build + tests

`dotnet build` + `dotnet test` — zero regression.

---

## Ordre d'Execution

```
Phase 1 (obligatoire):
  A1 → A2 → A3 → A4 → A5 → A6 → A10
  (Provider abstraction + LocalGPU + ClaudeCode + Router + Config + Tests)

Phase 2 (enrichissement):
  A7 → A8 → A9
  (Endpoints /v1/providers, /v1/models enrichi, /health enrichi)

Phase 3 (nettoyage Maestro, optionnel):
  B1 → B2 → B3 → B4 → B5 → B6 → B7
  (Supprimer Azure du C#, adapter controller)
```

---

## Verification

1. LLM-Provider demarre avec providers.json → log `[Startup] Providers: local, claude-code`
2. `GET /health` → inclut le statut de chaque provider
3. `POST /v1/generate {"model_id": "SmolLM2-1.7B-Instruct", "prompt": "..."}` → local GPU
4. `POST /v1/generate {"model_id": "claude-sonnet", "prompt": "..."}` → claude CLI
5. `GET /v1/providers` → `{"default": "local", "providers": {"local": {...}, "claude-code": {...}}}`
6. Maestro inchange — les memes `curl` qui fonctionnaient avant fonctionnent toujours
7. Un workflow Maestro avec `model: "SmolLM2"` sur un node et `model: "claude-sonnet"` sur un autre → les deux fonctionnent

---

## Fichiers Modifies/Crees dans LLM-Provider

| Action | Fichier |
|--------|---------|
| **CREER** | `src/providers/__init__.py` |
| **CREER** | `src/providers/base.py` |
| **CREER** | `src/providers/local_gpu.py` |
| **CREER** | `src/providers/claude_code.py` |
| **CREER** | `src/providers/router.py` |
| **CREER** | `providers.json` |
| **MODIFIER** | `api/server.py` (deleguer au router) |
| **MODIFIER** | `requirements.txt` (si dependances ajoutees) |

## Fichiers Modifies dans Maestro (Phase 3 seulement)

| Action | Fichier |
|--------|---------|
| **MODIFIER** | `CLAUDE.md` (regle LLM-Provider, pitfall) — DEJA FAIT |
| **SUPPRIMER** | `Infrastructure/LLMGateway/LLMGateway.cs` (placeholder) |
| **SUPPRIMER** | `Infrastructure/LLMGateway/AzureOpenAIGateway.cs` (a migrer vers Python) |
| **MODIFIER** | `Api/Program.cs` (simplifier DI) |
| **MODIFIER** | `Api/Controllers/ProviderController.cs` (supprimer Azure endpoints) |
| **MODIFIER** | `Api/appsettings.json` (supprimer section AzureOpenAI) |
