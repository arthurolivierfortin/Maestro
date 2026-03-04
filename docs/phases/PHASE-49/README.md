# Phase 49 : Hardware-Aware Setup, Agent Capabilities & Provider Metrics

**Statut** : A faire
**Prerequis** : Phase 48 COMPLETE (dynamic blockRef, maestro-assistant-compact, /agent command)
**Objectif** : Un utilisateur arrive pour la premiere fois, voit les capacites de sa machine, telecharge un modele local gratuit, et commence a utiliser Maestro en 5 minutes. Les capacites de chaque agent sont claires. La page Models retrouve la richesse du provider-monitor.

**Analyse detaillee** : `docs/phases/PHASE-49/analysis.md`

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire `docs/phases/PHASE-49/analysis.md`** — contient l'etat actuel complet de chaque composant
3. **Ecrire dans `PHASE-49/checkpoint.md`** apres chaque sous-phase
4. Ne PAS refactorer du code non lie aux taches identifiees
5. Ne PAS creer de framework de benchmark generique — 3-5 tests simples par capacite
6. Tester chaque livrable individuellement avant de passer au suivant
7. **Max 3 jours par sous-phase** — si depasse, livrer l'etat actuel et passer a la suivante

---

## Architecture existante a connaitre

### Chaine de demarrage (DEJA FONCTIONNELLE)

```
maestro code (CLI)
  └─ ensureBackend()
       └─ MaestroSidecar.start()
            ├─ 1. spawn LLM-Provider .NET
            │       └─ PythonServerHostedService (AutoStart=true)
            │               └─ python -m uvicorn api.server:app --port 8000
            │                  (echec = non-fatal, les providers cloud continuent)
            ├─ wait: LLM-Provider health OK
            ├─ 2. spawn Backend .NET
            └─ wait: Backend health OK
```

### Endpoints Python existants (port 8000)

| Endpoint | Description | Utile pour |
|----------|-------------|------------|
| `GET /v1/system/capabilities` | **Hardware complet** : GPU (name, VRAM total/free/used), CPU (name, cores), RAM (total/available), CUDA version, torch version | 49-A : detection hardware |
| `GET /v1/models/recommended` | Modeles recommandes filtres par VRAM disponible, avec `recommendation_note` | 49-A : selection modele |
| `GET /v1/models/compatible` | Modeles compatibles avec le hardware (filtre par VRAM) | 49-A : filtrage |
| `POST /v1/models/load` | Telecharger + charger un modele HuggingFace (`model_id`, `use_8bit`, `set_active`) | 49-A : download |
| `GET /health` | Status minimal (cuda_available, device, active_model) | Deja utilise |

### Endpoints LLM-Provider .NET existants (port dynamique)

| Endpoint | Description | Utile pour |
|----------|-------------|------------|
| `GET /api/v1/stats` | StatisticsSnapshot (requests, tokens, latency) | 49-C : metriques |
| `GET /api/v1/stats/queue` | QueueStatistics (depth, avg wait, depth-by-model) | 49-C : queue |
| `GET /api/v1/stats/performance` | PerformanceProfile[] par modele | 49-C : perf |
| `GET /api/v1/stats/switching/decisions` | SwitchEvent[] (10 dernieres decisions) | 49-C : switch |
| `GET /api/v1/models` | Modeles disponibles avec capabilities[], isAvailable | 49-C : liste |

### Ce qui MANQUE

La chaine `TUI → Backend → LLM-Provider .NET → Python` existe deja. `LocalLLMProvider` parle deja au Python server. Ce qui manque :

| Manque | Ou | Detail |
|--------|----|--------|
| Endpoint .NET pour hardware capabilities | `LLM-Provider .NET` | `LocalLLMProvider` ne call pas encore `/v1/system/capabilities` du Python — ajouter une methode + un endpoint dans `ModelsEndpoints.cs` ou similaire |
| Endpoint .NET pour modeles recommandes | `LLM-Provider .NET` | Idem — `LocalLLMProvider` ne call pas encore `/v1/models/recommended` |
| Verifier que `LoadModelAsync` est expose via endpoint | `LLM-Provider .NET` | `LocalLLMProvider.LoadModelAsync` existe mais verifier qu'un endpoint API le rend accessible |
| Fix `use_system_ram=True` quand pas de GPU | Python server | `get_compatible_models()` retourne 0 modeles sans GPU |
| Fix `/v1/available-models` (statique, obsolete) | Python server | Utiliser `/v1/models/recommended` a la place |
| Methodes SDK cote client | `@maestro/client` | Ajouter `getHardwareCapabilities()`, `getRecommendedModels()`, `downloadModel()` |

### Bugs Python connus a fixer

1. **CPU-only = 0 modeles recommandes** : `get_available_vram()` retourne `0.0` sans GPU → `get_compatible_models(0.0)` retourne rien. Fix : utiliser `use_system_ram=True` quand `gpu.available == False`.
2. **`/v1/available-models` est obsolete** : endpoint statique hardcode, ignore le hardware. Utiliser `/v1/models/recommended` a la place.
3. **`/v1/models/load` est synchrone** : bloque jusqu'a download complet. Pour un modele de 13GB, ca peut prendre 10+ minutes. Pas de progress. Fix minimum : ajouter un endpoint de status ou documenter le timeout.

---

## Sous-phases

| Phase | Titre | Effort | Dependances |
|-------|-------|--------|-------------|
| 49-A | First-Run Hardware-Aware + Model Download | 3-4 jours | Aucune |
| 49-B | Modele de capacites agent | 2-3 jours | 49-A (modeles telechargeables) |
| 49-C | Restauration metriques provider | 2-3 jours | Aucune (parallele a 49-A) |

**Ordre recommande** : 49-C (quick win) → 49-A (coeur) → 49-B (capabilities)

---

## 49-A : First-Run Hardware-Aware + Model Download

### Lecture obligatoire
- `docs/phases/PHASE-49/analysis.md` sections 2.1, 2.2, 9
- `llm-provider/api/hardware.py` — detection hardware existante
- `llm-provider/api/model_registry.py` — catalogue de ~50 modeles avec VRAM requirements
- `llm-provider/api/server.py` — endpoints existants
- `packages/maestro-code/components/ProviderSetupScreen.ts` — flow actuel
- `packages/maestro-sidecar/src/sidecar.ts` — comment le Python server est lance

### Ce que cette sous-phase fait

#### A1. Fix Python server pour CPU-only
1. Dans `api/server.py`, endpoint `/v1/models/compatible` : passer `use_system_ram=True` quand `gpu.available == False`
2. Dans `api/hardware.py`, `get_compatible_models()` : utiliser `ram.available_gb` comme fallback quand VRAM = 0
3. Ajouter un champ `estimated_tokens_per_sec` dans les resultats de `/v1/models/recommended` pour indiquer la vitesse attendue (CPU = ~2-5 tok/s, GPU = ~30-100 tok/s)

#### A2. Exposer les endpoints manquants dans LLM-Provider .NET

`LocalLLMProvider` parle deja au Python server. Il faut ajouter les methodes manquantes et les exposer via l'API existante :

1. **`LocalLLMProvider.GetSystemCapabilitiesAsync()`** — appelle Python `/v1/system/capabilities`
2. **`LocalLLMProvider.GetRecommendedModelsAsync()`** — appelle Python `/v1/models/recommended`
3. **Verifier que `LoadModelAsync`** est deja expose — sinon ajouter l'endpoint

Ajouter dans `ModelsEndpoints.cs` (ou equivalent) :
- `GET /api/v1/system/capabilities` — retourne le hardware
- `GET /api/v1/models/recommended` — retourne les modeles filtres par hardware
- `POST /api/v1/models/download` — declenche le telechargement (si pas deja expose)

Ce n'est PAS un proxy special — c'est le pattern normal de LLM-Provider : `LocalLLMProvider` parle au Python, l'API .NET expose les resultats.

#### A3. Enrichir le ProviderSetupScreen

Le flow actuel (select → configure) devient :

```
detect-hardware → select-providers → configure-providers → select-model → download-model → select-agent
```

**Ecran 1 — Hardware Detection** (NOUVEAU, avant la selection de providers) :
```
┌────────────────────────────────────────────────────┐
│             Welcome to Maestro                      │
│                                                      │
│  Detecting your hardware...                          │
│                                                      │
│  GPU:  NVIDIA GeForce RTX 4070 (12.0 GB VRAM)      │
│  RAM:  32.0 GB (24.2 GB available)                  │
│  CUDA: 12.1                                          │
│                                                      │
│  ✓ Your machine can run local AI models!             │
│                                                      │
│  [Enter] Continue                                    │
└────────────────────────────────────────────────────┘
```

Si pas de GPU :
```
│  GPU:  None detected                                 │
│  RAM:  16.0 GB (12.1 GB available)                  │
│                                                      │
│  ⚠ No GPU detected. Local models will run on CPU    │
│    (slower, ~2-5 tokens/sec for small models).       │
│    Cloud providers recommended for best experience.  │
```

**Ecran 2 — Provider Selection** (existant, ENRICHI) :
- Si GPU detecte : `[4] Local (Python FastAPI)` est **pre-selectionne**
- Si pas de GPU mais RAM > 8GB : `[4] Local (CPU — slow)` est propose mais pas pre-selectionne
- Si RAM < 8GB et pas de GPU : `[4] Local` est grise avec "(insufficient RAM)"

**Ecran 3 — Model Selection** (NOUVEAU, apres configure) :
Apparait SEULEMENT si le provider local est selectionne.
```
┌────────────────────────────────────────────────────────┐
│  Choose a model to download                             │
│                                                          │
│  Recommended for your hardware (12 GB VRAM):            │
│                                                          │
│  > [1] Qwen2.5-Coder-1.5B    3.0 GB  ~50 tok/s  *Rec* │
│    [2] deepseek-coder-1.3b    2.5 GB  ~45 tok/s        │
│    [3] deepseek-coder-6.7b   13.0 GB  ~25 tok/s        │
│                                                          │
│  Lightweight:                                            │
│    [4] smollm2-1.7b           1.1 GB  ~80 tok/s        │
│    [5] distilgpt2              0.3 GB  ~120 tok/s       │
│                                                          │
│  [Enter] Download selected    [S] Skip for now          │
└────────────────────────────────────────────────────────┘
```

- Les modeles sont filtres par `/v1/models/recommended`
- Les modeles deja telecharges sont exclus (checker `/v1/models` pour les loaded)
- Max 5 modeles affiches (3 recommandes + 2 lightweight)
- Les modeles selectionnes par la config maestro-assistant sont exclus

**Ecran 4 — Download Progress** (NOUVEAU) :
```
┌────────────────────────────────────────────────────┐
│  Downloading Qwen2.5-Coder-1.5B...                 │
│                                                      │
│  ████████████████░░░░░░░░░░░░  52%  1.6 / 3.0 GB   │
│                                                      │
│  This may take a few minutes depending on your       │
│  internet connection.                                │
│                                                      │
│  [Esc] Cancel                                        │
└────────────────────────────────────────────────────┘
```

Note : `/v1/models/load` est synchrone. On ne peut pas avoir un vrai progress bar sans modifier le Python server. **Solution pragmatique** : afficher un spinner avec le message "Downloading..." et le nom du modele. Le progress bar est un indicateur indetermine (animation). Quand l'appel retourne, on passe a l'ecran suivant. Si ca depasse 5 minutes, afficher "Still downloading... large models can take 10+ minutes."

**Ecran 5 — Agent Selection** (NOUVEAU) :
```
┌────────────────────────────────────────────────────────────┐
│  Choose your Maestro assistant                              │
│                                                              │
│  > [1] Full Assistant                                       │
│        ✓ Conversation  ✓ Tool-calling  ✓ Orchestration      │
│        Requires: Cloud provider (Claude Code or Azure)      │
│                                                              │
│    [2] Compact Assistant                                     │
│        ✓ Conversation  ✓ Basic tools                        │
│        ✗ Structured output  ✗ Orchestration                 │
│        Works with: Your local model                         │
│        ⚠ CPU-only: responses will be slow (~2-5 tok/s)     │  ← seulement si CPU
│                                                              │
│  [Enter] Confirm                                             │
└────────────────────────────────────────────────────────────┘
```

Si l'utilisateur n'a qu'un provider local → pre-selectionner [2].
Si l'utilisateur a un provider cloud + local → pre-selectionner [1].
Le choix set `_activeAgent` dans la session.

#### A4. Wiring dans App.ts
1. Passer les infos hardware au `ProviderSetupScreen`
2. Apres le setup, appeler `saveProviders()` avec la config enrichie
3. Si un modele a ete telecharge, s'assurer que le Python server l'a charge
4. Set `_activeAgent` selon le choix de l'utilisateur

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `llm-provider/api/server.py` | Modifier — fix CPU-only compat, ajouter `estimated_tokens_per_sec` |
| `llm-provider/api/hardware.py` | Modifier — fallback RAM quand VRAM=0 |
| `llm-provider/dotnet/src/LLMProvider.Web/` | Modifier — 3 endpoints proxy |
| `packages/maestro-code/components/ProviderSetupScreen.ts` | Modifier significativement — 5 ecrans |
| `packages/maestro-code/components/HardwareDetectScreen.ts` | CREER — ecran detection hardware |
| `packages/maestro-code/components/ModelSelectScreen.ts` | CREER — ecran selection + download modele |
| `packages/maestro-code/components/AgentSelectScreen.ts` | CREER — ecran selection agent |
| `packages/maestro-code/App.ts` | Modifier — wiring des nouveaux ecrans dans le setup flow |

### Verification
```bash
# 1. Python server fix CPU
curl http://localhost:8000/v1/system/capabilities
# Resultat : GPU, CPU, RAM details

curl http://localhost:8000/v1/models/recommended
# Resultat : modeles filtres par hardware avec estimated_tokens_per_sec

# 2. Proxy .NET
curl http://localhost:5010/api/v1/system/capabilities
# Resultat : hardware (GPU, VRAM, RAM, CUDA)

# 3. Type check
cd packages/maestro-code && npx tsc --noEmit

# 4. Tests
cd packages/maestro-code && npm test

# 5. Test first-run complet
# Supprimer .maestro/, lancer maestro code, completer setup, envoyer un message
```

### Checkpoint
```markdown
## 49-A : First-Run Hardware-Aware
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Python CPU-only fix** : (oui/non)
**Endpoints LLM-Provider .NET** : (oui/non — capabilities, recommended, download)
**Hardware detect screen** : (oui/non)
**Model select screen** : (oui/non)
**Agent select screen** : (oui/non)
**Download flow** : (oui/non)
**tsc --noEmit** : PASS/FAIL
**npm test** : X/Y tests pass
**Test first-run** : [resultat]
```

---

## 49-B : Modele de capacites agent

### Lecture obligatoire
- `docs/phases/PHASE-49/analysis.md` section 4 (49-B)
- `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json`
- `content/system/blocks/system/maestro-assistant-compact/maestro-assistant-compact.agent.block.json`
- `packages/maestro-cli/adapt-optimize.ts` — `measureFitness` existant

### Ce que cette sous-phase fait

#### B1. Schema de capacites

Ajouter dans les block JSON :

```json
{
  "metadata": {
    "capabilities": {
      "conversation": { "supported": true, "confidence": 1.0 },
      "tool-calling": { "supported": true, "confidence": 0.95 },
      "structured-output": { "supported": true, "confidence": 0.9 },
      "multi-step-reasoning": { "supported": false, "confidence": null },
      "code-generation": { "supported": false, "confidence": null }
    },
    "requirements": {
      "minContextLength": 8192,
      "minParametersB": 1.3,
      "estimatedVRAM_GB": 2.5,
      "compatibleProviders": ["local", "claudeCode", "azure", "azureInference"]
    },
    "performanceProfile": {
      "expectedTokensPerSec": { "gpu": 50, "cpu": 3 },
      "maxIterations": 5,
      "contextWindow": 8192
    }
  }
}
```

Stocker les resultats de tests dans `.maestro/capabilities/<block-id>/<model-id>.json` :

```json
{
  "blockId": "system:maestro-assistant-compact",
  "modelId": "Qwen/Qwen2.5-Coder-1.5B-Instruct",
  "testedAt": "2026-03-04T15:30:00Z",
  "device": "cuda",
  "results": {
    "conversation": { "passed": 3, "total": 3, "supported": true },
    "tool-calling": { "passed": 1, "total": 3, "supported": false },
    "structured-output": { "passed": 0, "total": 3, "supported": false }
  },
  "performanceMeasured": {
    "avgTokensPerSec": 48.2,
    "avgLatencyMs": 1230
  }
}
```

#### B2. Tests de capacite (3 par categorie)

Creer dans `content/system/tests/capabilities/` :

| Capacite | Test 1 | Test 2 | Test 3 |
|----------|--------|--------|--------|
| `conversation` | "Explain what Maestro does in 3 sentences" → coherent response | "Summarize this text: [200 words]" → accurate summary | "What is 2+2? Answer in one word." → "4" or "Four" |
| `tool-calling` | Prompt with JSON tool schema, ask to call `file-read` → valid JSON with tool name | Ask to call `step-complete` with a message → valid tool call format | Ask to call 2 tools sequentially → both valid |
| `structured-output` | "Return a JSON object with fields: name, age, city" → parseable JSON | "List 3 items as a JSON array" → parseable array | "Return {\"status\": \"ok\", \"count\": N}" → exact format match |

Chaque test est execute 3 fois. Majorite gagne (2/3 = supported).

#### B3. CLI command

```bash
maestro capabilities test <block-id> [--model <model-id>]
```

- Sans `--model` : teste le modele configure dans le block
- Avec `--model` : teste un modele specifique
- Affiche les resultats en temps reel
- Sauvegarde dans `.maestro/capabilities/`

#### B4. Affichage TUI

Dans `AgentPanel.ts`, sous le status bar :
```
Agent: system:maestro-assistant-compact (local — Qwen2.5-Coder-1.5B)
[conv ✓] [tools ✗] [struct ✗]  ~48 tok/s
```

Dans `ModelsScreen.ts`, dans la liste de modeles :
```
> ✓ Qwen2.5-Coder-1.5B    local   [conv ✓] [tools ✗]  ~48 tok/s
```

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json` | Modifier — ajouter capabilities + requirements |
| `content/system/blocks/system/maestro-assistant-compact/maestro-assistant-compact.agent.block.json` | Modifier — ajouter capabilities + requirements |
| `content/system/tests/capabilities/` | CREER — 9 fichiers de test (3 par capacite) |
| `packages/maestro-cli/cli.ts` | Modifier — ajouter commande `capabilities test` |
| `packages/maestro-code/components/AgentPanel.ts` | Modifier — afficher capabilities |
| `packages/maestro-code/components/ModelsScreen.ts` | Modifier — afficher capabilities par modele |

### Verification
```bash
# 1. Schema valide
cat content/system/blocks/system/maestro-assistant-compact/maestro-assistant-compact.agent.block.json | jq .metadata.capabilities

# 2. CLI command
node index.js capabilities test system:maestro-assistant-compact
# Resultat : resultats de tests avec pass/fail par capacite

# 3. Fichier de resultats cree
ls .maestro/capabilities/

# 4. Type check + tests
cd packages/maestro-code && npx tsc --noEmit && npm test
```

### Checkpoint
```markdown
## 49-B : Modele de capacites
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Schema capabilities** : (oui/non)
**Blocks mis a jour** : (oui/non, lesquels)
**Tests de capacite** : (X fichiers crees)
**CLI command** : (oui/non)
**TUI affichage** : (oui/non)
**tsc --noEmit** : PASS/FAIL
**npm test** : X/Y tests pass
```

---

## 49-C : Restauration metriques provider

### Lecture obligatoire
- `packages/provider-monitor/src/` — l'ancien monitor (MetricsTab, QueueTab, ModelsTab)
- `packages/provider-monitor/src/api-client.ts` — types de donnees
- `packages/maestro-code/components/ModelsScreen.ts` — page actuelle
- `llm-provider/api/hardware.py` — pour les infos hardware

### Ce que cette sous-phase fait

#### C1. Ajouter les appels API dans ModelsScreen

Nouveaux appels (via le `apiClient` qui parle au backend, qui parle au LLM-Provider) :
- `getLLMStats()` → `/api/v1/stats` (StatisticsSnapshot)
- `getLLMQueueStats()` → `/api/v1/stats/queue` (QueueStatistics)
- `getLLMPerformance()` → `/api/v1/stats/performance` (PerformanceProfile[])
- `getLLMSwitchDecisions()` → `/api/v1/stats/switching/decisions` (SwitchEvent[])
- `getLocalCapabilities()` → `/api/v1/local/capabilities` (SystemCapabilities — si 49-A fait)

Si ces methodes n'existent pas encore dans le SDK client, les ajouter dans `packages/maestro-client/`.

#### C2. Enrichir le layout ModelsScreen

Passer de 3 panels a 5 :

```
┌─ MODELS ──────────────────────────────────────────────────────────────────┐
│ Row 1:                                                                     │
│  ┌─ STATUS ──────────┐  ┌─ METRICS ─────────────┐  ┌─ QUEUE ──────────┐  │
│  │ ● Online           │  │ Reqs: 142 (2 err)      │  │ Depth: 0         │  │
│  │ GPU: RTX 4070      │  │ Tokens: 12.4K/32.8K    │  │ Avg Wait: 0ms    │  │
│  │ VRAM: 8.2/12 GB    │  │ P50: 230ms P95: 890ms  │  │ Active: sonnet   │  │
│  │ RAM: 24/32 GB      │  │ Error rate: 1.4%        │  │ Switch: 2m ago   │  │
│  └────────────────────┘  └────────────────────────┘  └──────────────────┘  │
│                                                                             │
│ Row 2: PROVIDERS (existant, inchange)                                      │
│  ┌─ PROVIDERS ─────────────────────────────────────────────────────────┐   │
│  │ ✓ Claude Code  ✓ Local (FastAPI)        [R] Reconfigure             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ Row 3: MODEL LIST (enrichi)                                                │
│  ┌─ AVAILABLE MODELS ──────────────────────────────────────────────────┐   │
│  │ > ✓ claude-sonnet-4-6     cloud   [conv✓ tools✓ struct✓]  (active)  │   │
│  │   ✓ Qwen2.5-Coder-1.5B   local   [conv✓ tools✗]  ~48 tok/s        │   │
│  │     mistral-7b            local   not downloaded    [D] Download     │   │
│  │                                                                      │   │
│  │  [Enter] Select  [D] Download  [R] Reconfigure  [T] Test            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### C3. Panel Metriques (NOUVEAU)

Composant `MetricsPanel` :
- Requests : total, errors, error rate
- Tokens : prompt tokens, completion tokens, total
- Latency : P50, P95, P99
- Rafraichissement : toutes les 5 secondes

#### C4. Panel Queue (NOUVEAU)

Composant `QueuePanel` :
- Queue depth
- Average wait time
- Active model
- Last switch decision (time + target + reason)
- Rafraichissement : toutes les 5 secondes

#### C5. Download depuis la page Models

Touche `[D]` sur un modele non telecharge :
1. Appeler `/api/v1/local/models/download` (proxy .NET → Python)
2. Afficher spinner "Downloading {model}..."
3. Au retour, rafraichir la liste de modeles
4. Si erreur, afficher le message d'erreur en rouge

#### C6. Hardware dans le panel Status

Enrichir `ModelStatusPanel` :
- GPU name + VRAM (total/used)
- RAM (total/available)
- CUDA version
- Source : `/api/v1/local/capabilities` (si provider local actif)

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-client/index.ts` | Modifier — ajouter methodes stats/queue/perf/capabilities |
| `packages/maestro-code/components/ModelsScreen.ts` | Modifier significativement — layout 5 panels |
| `packages/maestro-code/components/MetricsPanel.ts` | CREER — panel metriques |
| `packages/maestro-code/components/QueuePanel.ts` | CREER — panel queue |

### Verification
```bash
# 1. Endpoints stats accessibles
curl http://localhost:5010/api/v1/stats
curl http://localhost:5010/api/v1/stats/queue
curl http://localhost:5010/api/v1/stats/performance

# 2. Type check
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-client && npx tsc --noEmit

# 3. Tests
cd packages/maestro-code && npm test

# 4. Test visuel — lancer maestro code, aller sur la page Models
# Verifier que les metriques s'affichent et se rafraichissent
```

### Checkpoint
```markdown
## 49-C : Restauration metriques provider
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**SDK methods ajoutees** : (oui/non, lesquelles)
**Panel Metriques** : (oui/non)
**Panel Queue** : (oui/non)
**Hardware dans Status** : (oui/non)
**Download depuis Models** : (oui/non)
**tsc --noEmit** : PASS/FAIL
**npm test** : X/Y tests pass
```

---

## Definition of Done

### 49-A (First-Run)
- [ ] Python server : CPU-only retourne des modeles compatibles (RAM fallback)
- [ ] Python server : `estimated_tokens_per_sec` dans les recommandations
- [ ] LLM-Provider .NET : endpoints capabilities, recommended, download exposes via LocalLLMProvider
- [ ] TUI : ecran hardware detection avec GPU/RAM/CUDA
- [ ] TUI : provider selection pre-selectionne local si GPU detecte
- [ ] TUI : ecran selection modele (3-5 recommandes, filtres par hardware)
- [ ] TUI : ecran download avec indicateur de progression
- [ ] TUI : ecran selection agent (full vs compact)
- [ ] CPU-only : message clair "slow, ~2-5 tok/s"
- [ ] `tsc --noEmit` passe, tous les tests passent
- [ ] Test first-run : supprimer `.maestro/`, lancer, completer, envoyer un message

### 49-B (Capabilities)
- [ ] Schema `metadata.capabilities` + `requirements` + `performanceProfile` documente
- [ ] `maestro-assistant` et `maestro-assistant-compact` : capabilities remplies
- [ ] 9 tests de capacite (3 par categorie : conversation, tool-calling, structured-output)
- [ ] `maestro capabilities test <block-id>` fonctionne et sauvegarde dans `.maestro/capabilities/`
- [ ] Capabilities affichees dans AgentPanel (tags colores)
- [ ] Capabilities affichees dans ModelsScreen (par modele)

### 49-C (Metriques)
- [ ] SDK : methodes stats, queue, performance, switching ajoutees
- [ ] Page Models : panel Metriques (requests, tokens, latency P50/P95/P99)
- [ ] Page Models : panel Queue (depth, wait, switch)
- [ ] Page Models : hardware dans Status (GPU, VRAM, RAM)
- [ ] Page Models : download modele avec touche [D]
- [ ] Tous les panels se rafraichissent automatiquement (5s)

### NOT in scope
- Framework de benchmark generique
- Auto-adapt au first-run (Phase 50)
- Pool de modeles simultanes
- Refactoring de `adapt-optimize.ts`
- Logs du provider-monitor
- Optimisation inference CPU (quantization GGML)
- Streaming progress reel du download (amelioration future)
- Integration adapt pipeline dans le TUI (Phase 50)

---

## Anti-patterns

- Ne PAS copier/coller du code du provider-monitor — re-implementer dans le style maestro-code
- Ne PAS creer un benchmark framework — 3 tests simples par capacite, pas plus
- Ne PAS bloquer le setup si aucun provider — proposer CPU-only ou guider vers un provider cloud
- Ne PAS modifier l'architecture workflow/block au-dela de ce qui est documente
- Ne PAS hardcoder des noms de modeles dans le TUI — tout vient des endpoints API
- Ne PAS ignorer le timeout de `/v1/models/load` — documenter que ca peut prendre 10+ minutes

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-49/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 49: hardware-aware setup, agent capabilities, provider metrics restoration"
- Ajouter : "Python server auto-starts via PythonServerHostedService (AutoStart=true) — non-fatal failure"
- Ajouter : "CPU-only: use_system_ram=True fallback, ~2-5 tok/s warning"
- Ajouter : "Capabilities stored in .maestro/capabilities/<block-id>/<model-id>.json"
- Ajouter : "ModelsScreen enriched with MetricsPanel + QueuePanel from provider-monitor data"
- Mettre a jour : Current Project State avec Phase 49
