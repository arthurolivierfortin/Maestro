# Phase 19 — Changements de commandes

## Contexte

Suite à la convention définie en Phase 18 (ADR "Everything is a Block"), les commandes ont été restructurées pour séparer clairement :

- **`provider`** : gestion du service LLM Provider (santé, hardware, statut)
- **`models`** : gestion du catalogue de modèles (liste, local, registre, chargement, switch)
- **`llm`** : alias déprécié → redirige vers `provider`

---

## Nouvelles commandes

### `provider` — Service LLM Provider

| Commande | Description |
|----------|-------------|
| `maestro provider` | Affiche le statut du provider (santé + modèle actif) |
| `maestro provider health` | Alias de `maestro provider` |
| `maestro provider status` | Alias de `maestro provider` |
| `maestro provider capabilities` | Affiche les capacités hardware (GPU, CPU, RAM, CUDA) |

### `models` — Catalogue de modèles

| Commande | Description |
|----------|-------------|
| `maestro models` | Liste les modèles compatibles avec le hardware |
| `maestro models list` | Alias de `maestro models` |
| `maestro models local` | Liste les modèles téléchargés localement |
| `maestro models registry [--cat X]` | Liste le registre complet (60+ modèles) |
| `maestro models load <model-id> [--8bit]` | Charge un modèle en mémoire |
| `maestro models switch <model-id> [--8bit]` | Change le modèle actif |

### `chat` — Chat interactif

| Commande | Description |
|----------|-------------|
| `maestro chat` | Démarre une session de chat interactive |
| `maestro chat --model <id>` | Chat avec un modèle spécifique |
| `maestro chat --system <prompt>` | Chat avec un prompt système |
| `maestro chat --temperature 0.7` | Température de génération |
| `maestro chat --max-tokens 512` | Limite de tokens |

Commandes in-session : `/exit`, `/clear`, `/model <id>`

### `setup` — Assistant de configuration

| Commande | Description |
|----------|-------------|
| `maestro setup` | Lance l'assistant qui vérifie backend, provider, hardware, modèles |

---

## Commandes supprimées

| Ancienne commande | Remplacement |
|-------------------|--------------|
| `maestro models info` | `maestro provider capabilities` |

---

## Commandes dépréciées

| Ancienne commande | Remplacement | Note |
|-------------------|--------------|------|
| `maestro llm` | `maestro provider` | Affiche un avertissement puis redirige |

---

## Changements d'API (routes backend)

Toutes les routes ont été renommées de `/api/llm/*` vers `/api/provider/*` :

| Ancienne route | Nouvelle route | Méthode |
|----------------|----------------|---------|
| `GET /api/llm/health` | `GET /api/provider/health` | GET |
| `GET /api/llm/status` | `GET /api/provider/status` | GET |
| `GET /api/llm/capabilities` | `GET /api/provider/capabilities` | GET |
| `GET /api/llm/models` | `GET /api/provider/models` | GET |
| `GET /api/llm/models/local` | `GET /api/provider/models/local` | GET |
| `GET /api/llm/models/registry` | `GET /api/provider/models/registry` | GET |
| `POST /api/llm/models/switch` | `POST /api/provider/models/switch` | POST |
| `POST /api/llm/models/load` | `POST /api/provider/models/load` | POST |

Les routes de chat restent inchangées :

| Route | Méthode | Description |
|-------|---------|-------------|
| `POST /api/chat/completions` | POST | Chat synchrone |
| `POST /api/chat/stream` | POST | Chat streaming SSE |

---

## Fichiers modifiés

### Backend
- `Controllers/LLMController.cs` → renommé `Controllers/ProviderController.cs`
  - Classe `LLMController` → `ProviderController`
  - Route `api/llm` → `api/provider`

### CLI
- `maestro-cli/cli.ts` — Nouveau bloc `provider`, alias `llm` déprécié, `models info` supprimé

### Frontend
- `frontend/src/services/chatService.ts` — `/api/llm/*` → `/api/provider/*`
- `frontend/src/services/localModelService.ts` — `/api/llm/*` → `/api/provider/*`
- `frontend/src/components/settings/LLMConfigPanel.tsx` — `/api/llm/*` → `/api/provider/*`
- `frontend/src/components/Models/SystemInfoTab.tsx` — `/api/llm/*` → `/api/provider/*`

### Shared
- `shared/api-client.js` — Toutes les 8 méthodes LLM utilisent `/api/provider/*`

---

## Cohérence avec Phase 18

La taxonomie suit le principe "Everything is a Block" de Phase 18 :

```
provider          → le service d'infrastructure (health, capabilities)
models            → le catalogue de données (list, load, switch)
chat              → l'interaction utilisateur
```

Le `provider` est le service. Les `models` sont les ressources qu'il gère. Le `chat` est l'interface utilisateur pour l'inférence.
