# Phase 19 — LLM Integration + Chat

## Vue d'ensemble

Phase 19 comble le fossé critique entre le LLM-Provider (qui possède déjà la détection hardware, 60+ modèles, vérification de compatibilité) et Maestro qui n'exposait rien de tout cela. L'API client déclarait `getLLMHealth()`, `listLLMModels()`, `getLLMStatus()` vers des endpoints `/api/provider/*` qui **n'existaient pas** côté backend.

Phase 19 = 3 axes : **endpoints LLM** (proxy backend vers Python) + **Chat** (CLI + Frontend) + **Configuration centralisée**.

---

## Ce qui a été implémenté

### 1. Backend — Service LLM Provider

**Problème** : `ILLMGateway` gère l'inférence (send/stream). Il manquait un service pour les opérations d'administration : santé, modèles, hardware.

**Solution** : Nouvelle interface `ILLMProviderService` + implémentation `LLMProviderService`.

| Fichier | Rôle |
|---------|------|
| `Application/Interfaces/ILLMProviderService.cs` | Contrat — 7 méthodes async |
| `Application/DTOs/LLMDtos.cs` | 18 records (Health, Capabilities, GPU/CPU/RAM, Models, etc.) |
| `Infrastructure/LLMGateway/LLMProviderService.cs` | Implémentation HTTP vers Python API (localhost:8000) |

Le service utilise `JsonNamingPolicy.SnakeCaseLower` (identique à `LLMProviderGateway`) et lance `LLMProviderUnavailableException` quand le Python API est injoignable.

### 2. Backend — ProviderController (8 endpoints)

> **Note** : Renommé de `LLMController` → `ProviderController` et routes de `/api/provider/*` → `/api/provider/*` pour suivre la convention Phase 18. Voir `COMMAND-CHANGES.md`.

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/provider/health` | GET | Santé du LLM Provider (status, modèle actif, device, CUDA) |
| `/api/provider/status` | GET | Alias de health (compatibilité API client) |
| `/api/provider/capabilities` | GET | Hardware complet (GPU, CPU, RAM, CUDA, PyTorch) |
| `/api/provider/models` | GET | Modèles compatibles avec le hardware (+ filtre `?category=`) |
| `/api/provider/models/local` | GET | Modèles déjà téléchargés localement |
| `/api/provider/models/registry` | GET | Registre complet (60+ modèles, + filtre `?category=`) |
| `/api/provider/models/switch` | POST | Changer le modèle actif (`{ modelId, use8bit }`) |
| `/api/provider/models/load` | POST | Charger un modèle en mémoire (`{ modelId, use8bit }`) |

Tous les endpoints retournent **503** avec message explicite si le LLM Provider n'est pas lancé.

### 3. Backend — ChatController (2 endpoints)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/chat/completions` | POST | Complétion synchrone (retourne la réponse complète) |
| `/api/chat/stream` | POST | Streaming SSE (`text/event-stream`, format `data: {chunk}\n\n`) |

Format de requête :
```json
{
  "messages": [{ "role": "user", "content": "Bonjour" }],
  "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
  "temperature": 0.7,
  "maxTokens": 512
}
```

Le streaming utilise `ILLMGateway.StreamAsync()` et envoie chaque chunk en SSE. Le client frontend peut utiliser `fetch` + `ReadableStream` ou `EventSource`.

### 4. CLI — Configuration centralisée

**Nouveau fichier** : `maestro-cli/config.ts`

Stocke la configuration dans `~/.maestro/config.json` :
```json
{
  "backendUrl": "http://localhost:5000",
  "apiKey": "mst_...",
  "llmProvider": { "url": "http://localhost:8000", "defaultModel": "..." },
  "azure": { "endpoint": "...", "apiKey": "...", "deployment": "..." }
}
```

Fonctions exportées : `readConfig()`, `writeConfig()`, `updateConfig()`, `getBackendUrl()`, `getApiKey()`.

### 5. CLI — Commande `maestro models`

```
maestro models                     → Liste les modèles compatibles avec le hardware
maestro models local               → Modèles en cache local
maestro models registry [--cat X]  → Registre complet (60+ modèles)
maestro models load <model-id>     → Charger un modèle en mémoire GPU
maestro models switch <model-id>   → Changer le modèle actif
maestro models info                → Infos hardware (GPU, VRAM, CPU, RAM)
```

### 6. CLI — Commande `maestro chat`

Chat interactif en ligne de commande :
```
maestro chat                        → Chat avec le modèle actif
maestro chat --model <id>           → Chat avec un modèle spécifique
maestro chat --system "Tu es..."    → Prompt système personnalisé
maestro chat --temperature 0.3      → Contrôle de la température
```

Commandes en session : `/exit`, `/clear`, `/model <id>`.

### 7. CLI — Commande `maestro setup`

Assistant de configuration qui :
1. Vérifie le backend
2. Vérifie le LLM Provider
3. Affiche le hardware (GPU, VRAM, RAM)
4. Liste les modèles compatibles
5. Écrit `~/.maestro/config.json`
6. Teste le chat avec un message de vérification

### 8. Frontend — Page Chat (`/chat`)

- **ChatPage** : Page principale avec sélecteur de modèle
- **ChatPanel** : Liste de messages + input
- **ChatMessage** : Bulle de message (user/assistant) avec curseur de streaming
- **ChatInput** : Zone de texte (Enter = envoyer, Shift+Enter = nouvelle ligne, bouton Stop)
- **ModelSelector** : Dropdown qui charge les modèles depuis `/api/provider/models`
- **useChat** : Hook React gérant l'état, le streaming SSE avec fallback synchrone

### 9. Frontend — Page Settings (`/settings`)

- **SettingsPage** : Conteneur de paramètres
- **LLMConfigPanel** : Configuration du LLM Provider local + Azure OpenAI optionnel
  - Bouton "Test Connection" vers `/api/provider/health`
  - Champs Azure : endpoint, API key, deployment

### 10. Frontend — Enrichissement Models

- **SystemInfoTab** : Utilise maintenant `/api/provider/capabilities` pour afficher le vrai hardware (GPU, VRAM, CPU, RAM) au lieu de "Coming Soon"
- **localModelService** : Route via le proxy backend (`/api/provider/health`) avant de tomber en fallback direct vers le LLM Provider
- **Navigation** : Lien "Chat" ajouté dans la barre de navigation

### 11. API Client partagé

7 nouvelles méthodes dans `shared/api-client.js` :
- `getLLMCapabilities()`, `getLocalModels()`, `getRegistryModels(category)`
- `switchModel(modelId, use8bit)`, `loadModel(modelId, use8bit)`
- `chatCompletion(messages, options)`
- `listLLMModels(category)` amélioré avec filtre

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Frontend    │────▶│  Backend     │────▶│  LLM-Provider  │
│  React       │     │  C# .NET     │     │  Python/FastAPI │
│              │     │              │     │                │
│  /chat       │     │ LLMController│     │ /health        │
│  /settings   │     │ ChatController│    │ /v1/models/*   │
│  /models     │     │              │     │ /v1/generate   │
│              │     │ LLMProvider- │     │ /v1/system/*   │
│  chatService │────▶│ Service      │────▶│                │
│  useChat     │     │              │     │                │
└─────────────┘     └──────────────┘     └────────────────┘

┌─────────────┐
│  CLI         │
│  maestro-cli │
│              │
│  models      │──── via api-client ──── /api/provider/*
│  chat        │──── via api-client ──── /api/chat/*
│  setup       │──── via api-client ──── /api/provider/* + /api/chat/*
└─────────────┘
```

**Principe** : Le frontend et le CLI ne parlent **jamais** directement au LLM-Provider Python. Tout passe par le backend C# qui fait proxy. Cela permet d'ajouter auth, logging, et rate-limiting à un seul endroit.

---

## Comment tester

### Prérequis

Les 3 services doivent tourner :

```powershell
# Terminal 1 — Démarrer tous les services
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1
```

Ou manuellement :

```powershell
# Terminal 1 — LLM Provider (Python)
cd C:\LLM-Provider
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Backend (.NET)
cd C:\Meastro\backend\src\Maestro.Api
dotnet run --urls http://localhost:5000

# Terminal 3 — Frontend (Vite)
cd C:\Meastro\frontend
npm run dev
```

### Test 1 — Vérification de build

```powershell
# Backend (doit compiler sans erreur)
cd C:\Meastro\backend
dotnet build

# Frontend (doit compiler sans erreur TypeScript)
cd C:\Meastro\frontend
npx tsc --noEmit
npx vite build

# Tests backend (93/93 doivent passer)
cd C:\Meastro\backend
dotnet test
```

### Test 2 — Endpoints LLM (curl ou navigateur)

```bash
# Santé du LLM Provider
curl http://localhost:5000/api/provider/health
# Réponse attendue : { "status": "healthy", "activeModel": "...", "device": "cuda", ... }

# Hardware
curl http://localhost:5000/api/provider/capabilities
# Réponse attendue : { "gpu": { "name": "...", "vramTotalGb": ... }, "cpu": {...}, "ram": {...} }

# Modèles compatibles
curl http://localhost:5000/api/provider/models
# Réponse attendue : { "hardware": {...}, "summary": {...}, "models": [...] }

# Modèles locaux
curl http://localhost:5000/api/provider/models/local
# Réponse attendue : { "count": N, "models": [...] }

# Registre complet
curl http://localhost:5000/api/provider/models/registry
# Réponse attendue : { "count": 60+, "categories": [...], "models": [...] }

# Filtrer par catégorie
curl "http://localhost:5000/api/provider/models?category=code"
curl "http://localhost:5000/api/provider/models/registry?category=chat"
```

### Test 3 — Chat API

```bash
# Complétion synchrone
curl -X POST http://localhost:5000/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Dis bonjour en une phrase."}]}'
# Réponse attendue : { "content": "...", "model": "...", "totalTokens": N }

# Streaming SSE
curl -X POST http://localhost:5000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Raconte une blague."}]}' \
  --no-buffer
# Réponse attendue : data: {"content":"..."}\n\n ... data: [DONE]\n\n
```

### Test 4 — Charger / Changer de modèle

```bash
# Charger un modèle
curl -X POST http://localhost:5000/api/provider/models/load \
  -H "Content-Type: application/json" \
  -d '{"modelId":"HuggingFaceTB/SmolLM2-1.7B-Instruct"}'

# Changer de modèle actif
curl -X POST http://localhost:5000/api/provider/models/switch \
  -H "Content-Type: application/json" \
  -d '{"modelId":"HuggingFaceTB/SmolLM2-1.7B-Instruct"}'
```

### Test 5 — CLI models

```bash
cd C:\Meastro\maestro-cli

# Liste des modèles compatibles avec infos hardware
node index.js models

# Modèles en cache local
node index.js models local

# Registre complet
node index.js models registry

# Filtrer par catégorie
node index.js models --category code

# Infos hardware détaillées
node index.js models info

# Charger un modèle
node index.js models load HuggingFaceTB/SmolLM2-1.7B-Instruct

# Changer de modèle
node index.js models switch HuggingFaceTB/SmolLM2-1.7B-Instruct
```

### Test 6 — CLI chat

```bash
cd C:\Meastro\maestro-cli

# Chat interactif (taper un message, appuyer Entrée)
node index.js chat

# Chat avec modèle spécifique
node index.js chat --model HuggingFaceTB/SmolLM2-1.7B-Instruct

# Chat avec prompt système
node index.js chat --system "Tu es un expert Python. Réponds en français."

# Commandes en session :
#   /clear  — Effacer la conversation
#   /model deepseek-ai/deepseek-coder-1.3b-instruct  — Changer de modèle
#   /exit   — Quitter
```

### Test 7 — CLI setup

```bash
cd C:\Meastro\maestro-cli

# Lance l'assistant de configuration
node index.js setup

# Vérifie :
# ✓ Backend connecté
# ✓ LLM Provider connecté
# ✓ Hardware détecté (GPU, VRAM, RAM)
# ✓ Modèles compatibles listés
# ✓ Config sauvegardée dans ~/.maestro/config.json
# ✓ Test de chat réussi
```

### Test 8 — Frontend Chat (`http://localhost:5173/chat`)

1. Ouvrir `http://localhost:5173/chat` dans le navigateur
2. Vérifier que le lien **"Chat"** apparaît dans la barre de navigation
3. Le **sélecteur de modèle** doit charger la liste depuis `/api/provider/models`
4. Taper un message et appuyer Entrée
5. Vérifier que la réponse apparaît (streaming avec curseur clignotant)
6. Tester le bouton **"Stop"** pendant la génération
7. Tester le bouton **"Clear conversation"**
8. Changer de modèle via le sélecteur et renvoyer un message

### Test 9 — Frontend Settings (`http://localhost:5173/settings`)

1. Ouvrir `http://localhost:5173/settings`
2. Section **"Local LLM Provider"** : cliquer "Test Connection"
3. Doit afficher "Connected! Status: healthy, Model: ..."
4. Section **"Azure OpenAI"** : remplir les champs (fonctionnel en V2)

### Test 10 — Frontend Models enrichi (`http://localhost:5173/models`)

1. Ouvrir `http://localhost:5173/models`
2. Onglet **"System Info"** : doit maintenant afficher le vrai hardware
   - GPU (nom, VRAM total/libre, CUDA)
   - CPU (nom, cœurs)
   - RAM (total/disponible)
   - Modèles recommandés basés sur le hardware
3. Si le LLM Provider n'est pas lancé, affiche le fallback cloud (Claude, GPT-4o)

### Test 11 — Gestion d'erreur (LLM Provider éteint)

```bash
# Arrêter le LLM Provider, puis :
curl http://localhost:5000/api/provider/health
# Réponse attendue : 503 { "error": "LLM Provider is not running..." }

curl -X POST http://localhost:5000/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
# Réponse attendue : 503 { "error": "LLM Provider is not running..." }

node index.js models
# Réponse attendue : message d'erreur lisible
```

### Test 12 — Mode JSON (pour agents)

```bash
cd C:\Meastro\maestro-cli

# Sortie structurée JSON
node index.js models --json
node index.js models info --json
node index.js models local --json
```

---

## Fichiers créés / modifiés

### Nouveaux fichiers (15)

| Fichier | Lignes | Description |
|---------|--------|-------------|
| `Application/Interfaces/ILLMProviderService.cs` | 15 | Interface service LLM |
| `Application/DTOs/LLMDtos.cs` | 210 | 18 records DTO |
| `Infrastructure/LLMGateway/LLMProviderService.cs` | 130 | Implémentation HTTP |
| `Api/Controllers/LLMController.cs` | 135 | 8 endpoints REST |
| `Api/Controllers/ChatController.cs` | 130 | Chat sync + SSE streaming |
| `maestro-cli/config.ts` | 65 | Configuration centralisée |
| `frontend/src/services/chatService.ts` | 130 | Service chat + LLM API |
| `frontend/src/hooks/useChat.ts` | 115 | Hook React chat |
| `frontend/src/pages/ChatPage.tsx` | 25 | Page chat |
| `frontend/src/pages/ChatPage.scss` | 195 | Styles chat |
| `frontend/src/components/Chat/ChatPanel.tsx` | 65 | Panneau messages |
| `frontend/src/components/Chat/ChatMessage.tsx` | 30 | Bulle message |
| `frontend/src/components/Chat/ChatInput.tsx` | 60 | Zone de saisie |
| `frontend/src/components/Chat/ModelSelector.tsx` | 80 | Sélecteur modèle |
| `frontend/src/pages/SettingsPage.tsx` | 17 | Page paramètres |
| `frontend/src/pages/SettingsPage.scss` | 95 | Styles paramètres |
| `frontend/src/components/settings/LLMConfigPanel.tsx` | 95 | Config LLM + Azure |

### Fichiers modifiés (6)

| Fichier | Modification |
|---------|-------------|
| `Api/Program.cs` | +2 lignes : DI `ILLMProviderService` |
| `maestro-cli/cli.ts` | +280 lignes : commandes models/chat/setup + routing |
| `shared/api-client.js` | +35 lignes : 7 nouvelles méthodes API |
| `frontend/src/router.tsx` | +20 lignes : routes /chat et /settings |
| `frontend/src/components/layout/TopBar.tsx` | +6 lignes : lien Chat |
| `frontend/src/components/Models/SystemInfoTab.tsx` | ~40 lignes modifiées : utilise /api/provider/capabilities |
| `frontend/src/services/localModelService.ts` | +5 lignes : proxy via backend |

---

## Principes respectés

- **Generic infrastructure, specific content** : Aucune logique spécifique à un type de session. Les endpoints sont génériques.
- **CLI-first** : Toutes les opérations passent par le CLI ou l'API REST.
- **No silent failures** : 503 explicite quand le LLM Provider est down, pas de données fake.
- **Proxy pattern** : Frontend → Backend → LLM Provider. Jamais de connexion directe frontend → Python.
- **Séparation admin/inférence** : `ILLMProviderService` (admin) vs `ILLMGateway` (inférence). Deux interfaces, deux responsabilités.
