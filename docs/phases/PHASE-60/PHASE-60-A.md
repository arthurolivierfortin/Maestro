# 60-A : Backend — Endpoint playground + capability tests

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Api/Controllers/` — pattern des controllers existants
- `apps/backend/src/Maestro.Application/Interfaces/ILLMProviderService.cs` — interface gateway LLM
- `llm-provider/dotnet/src/LLMProvider.Web/Endpoints/LLMEndpoints.cs` — endpoint `/api/v1/llm/complete`
- `content/system/contracts/` — pattern des contracts existants (pour s'inspirer des tests de capability)

---

## Ce que cette sous-phase fait

### 1. PlaygroundController

`POST /api/playground` — envoie un prompt a un modele et retourne la reponse + metriques.

Request :
```json
{
  "modelId": "gpt-4o",
  "prompt": "Explain fibonacci",
  "systemPrompt": "You are a helpful assistant",
  "maxTokens": 500,
  "temperature": 0.7
}
```

Response :
```json
{
  "content": "A Fibonacci sequence is...",
  "modelId": "gpt-4o",
  "provider": "GitHubModels",
  "promptTokens": 42,
  "completionTokens": 28,
  "totalTokens": 70,
  "costUsd": 0.0003,
  "latencyMs": 1200
}
```

Le controller delegue au LLM-Provider via le gateway existant (`ILLMProviderService`). Pas de session, pas de block — un appel direct.

### 2. Capability test definitions

`GET /api/playground/tests` — retourne la liste des tests de capability pre-configures.

Chaque test a :
- `id` : identifiant unique (ex: `structured-output`)
- `name` : nom affichable (ex: "Structured Output (JSON)")
- `description` : ce que le test verifie
- `systemPrompt` : le system prompt du test
- `userPrompt` : le prompt utilisateur
- `validator` : type de validation (`json`, `contains`, `regex`, `tool-call`)
- `validatorConfig` : config specifique au validator (ex: champs JSON requis)

Tests pre-configures :

| # | ID | Nom | Valide |
|---|-----|------|--------|
| 1 | `structured-output` | Structured Output (JSON) | Reponse est du JSON valide avec les champs demandes |
| 2 | `tool-calling` | Tool Calling | Reponse contient un appel d'outil au format `{"tool":"...","args":{...}}` |
| 3 | `long-context` | Long Context | Reponse mentionne un detail specifique d'un prompt de 2000+ tokens |
| 4 | `code-generation` | Code Generation | Reponse contient un bloc de code syntaxiquement valide |
| 5 | `instruction-following` | Instruction Following | Reponse respecte des contraintes specifiques (ex: exactement 3 bullet points) |
| 6 | `multi-language` | Multi-Language | Reponse est dans la langue demandee (pas en anglais) |

### 3. Capability test execution

`POST /api/playground/test` — execute un test de capability et retourne le resultat + validation.

Request :
```json
{
  "modelId": "gpt-4o",
  "testId": "structured-output"
}
```

Response :
```json
{
  "testId": "structured-output",
  "testName": "Structured Output (JSON)",
  "passed": true,
  "content": "{\"name\":\"Alex\",\"age\":25,\"hobbies\":[\"coding\"]}",
  "validationDetails": "Valid JSON. All required fields present: name, age, hobbies.",
  "promptTokens": 52,
  "completionTokens": 18,
  "costUsd": 0.0002,
  "latencyMs": 800
}
```

La validation est faite cote backend — le controller parse la reponse et verifie selon le type de validator.

---

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Application/DTOs/PlaygroundDtos.cs` | Creer — PlaygroundRequestDto, PlaygroundResponseDto, CapabilityTestDto, CapabilityTestResultDto |
| `apps/backend/src/Maestro.Api/Controllers/PlaygroundController.cs` | Creer — POST /api/playground, GET /api/playground/tests, POST /api/playground/test |
| `apps/backend/src/Maestro.Infrastructure/Playground/CapabilityTestDefinitions.cs` | Creer — definitions statiques des 6 tests |
| `apps/backend/src/Maestro.Infrastructure/Playground/CapabilityTestValidator.cs` | Creer — logique de validation (JSON, contains, regex, tool-call) |

---

## Verification

```bash
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

# Test custom prompt
curl -X POST http://localhost:5000/api/playground -H "Content-Type: application/json" \
  -d '{"modelId":"gpt-4o","prompt":"Say hello"}'
# Resultat : JSON avec content, tokens, cost, latency

# Test capability
curl http://localhost:5000/api/playground/tests
# Resultat : 6 tests

curl -X POST http://localhost:5000/api/playground/test -H "Content-Type: application/json" \
  -d '{"modelId":"gpt-4o","testId":"structured-output"}'
# Resultat : passed: true/false avec details
```

---

## Anti-patterns

- Ne PAS creer de session pour le playground — c'est un appel LLM direct, pas un workflow
- Ne PAS hardcoder les modeles — lire la liste depuis LLM-Provider `/api/v1/models`
- Ne PAS faire de streaming — V1 = reponse complete seulement
- Ne PAS ignorer les couts — enregistrer dans cost-history.jsonl comme tout autre appel

---

## Checkpoint

```markdown
## 60-A : Backend playground
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**POST /api/playground** : fonctionne avec au moins 1 modele
**GET /api/playground/tests** : retourne 6 tests
**POST /api/playground/test** : execute un test et retourne pass/fail
```
