# Phase 49 — Analyse approfondie et suggestions

> **Date**: 2026-03-04
> **Auteur**: Claude (analyse critique demandee)
> **Input**: `docs/phases/PHASE-49/request.md`

---

## 1. Reformulation structuree de la demande

La requete couvre **5 axes distincts** qui s'entremelent dans le texte. Les voici separes :

| # | Axe | Resume |
|---|-----|--------|
| 1 | **First-run flow avec detection hardware** | A la premiere ouverture, montrer les capacites GPU/RAM de la machine, proposer des modeles compatibles a telecharger |
| 2 | **Telechargement de modeles locaux depuis le TUI** | L'utilisateur choisit quel modele installer, Maestro lance le download via le provider local |
| 3 | **Modele de capacites par agent** | Definir formellement quelles fonctionnalites un agent supporte (conversation, tool-calling, structured output) selon le modele sous-jacent |
| 4 | **Restauration des metriques du provider-monitor** | Le provider-monitor avait des metriques riches (queue, latence P50/P95/P99, switch decisions, performance profiles) qui ont ete perdues dans la migration vers maestro-code |
| 5 | **Lien avec adapt/optimize** | Le modele de capacites alimente le pipeline `maestro adapt` pour proposer automatiquement la meilleure configuration selon le hardware |

---

## 2. Etat actuel — Ce qui existe deja

### 2.1 Infrastructure backend (LLM-Provider Python + .NET)

**Bonne nouvelle : la plupart de l'infrastructure backend existe deja.**

| Fonctionnalite | Endpoint | Statut |
|----------------|----------|--------|
| Detection hardware (CUDA, GPU, device) | `GET /health` sur Python server | **Existe** — retourne `cuda_available`, `cuda_device_name`, `device` |
| Liste des modeles recommandes | `GET /v1/available-models` sur Python server | **Existe** — retourne `recommended_coding_models[]` et `lightweight_models[]` avec `size_gb`, `context_length`, `recommended` |
| Telechargement/chargement d'un modele | `POST /v1/models/load` sur Python server | **Existe** — prend un HuggingFace model ID + `use_8bit` flag |
| Switch de modele actif | `POST /v1/switch-model` sur Python server | **Existe** |
| Metriques detaillees | `GET /api/v1/stats`, `/stats/queue`, `/stats/performance`, `/stats/switching/decisions` | **Existe** dans LLM-Provider .NET |
| Liste des modeles disponibles | `GET /api/v1/models` | **Existe** — avec `capabilities[]`, `contextLength`, `isAvailable` |

**Ce qui n'existe PAS** :
- `LocalLLMProvider` (.NET) ne call pas encore `/v1/system/capabilities` ni `/v1/models/recommended` du Python — il faut ajouter les methodes et exposer via l'API .NET (pattern normal, pas un proxy special)
- L'endpoint Python `/health` ne retourne que le minimum (cuda bool + device name). Le **vrai** hardware est dans `/v1/system/capabilities` (VRAM, RAM, CPU, CUDA version) — mais cette route n'est pas encore appelee par le .NET
- Le `@maestro/client` SDK n'a pas de methodes pour hardware/recommended/download
- Le Python `get_compatible_models()` retourne 0 modeles sans GPU (bug: `use_system_ram` pas wire)

### 2.2 TUI (maestro-code)

| Composant | Ce qu'il fait | Ce qu'il manque |
|-----------|---------------|-----------------|
| `ProviderSetupScreen` | Selection de providers (4 options), config sequentielle | Zero detection hardware, zero proposition de modele, zero info sur les capacites de la machine |
| `ModelsScreen` | 3 panels (status, providers, liste modeles), navigation j/k, selection Enter | Pas de metriques (queue, latence, perf profiles), pas de download, pas de capacites |
| Commande `/agent` | Switch entre agent variants (`system:maestro-assistant` / `system:maestro-assistant-compact`) | **Existe** (Phase 48) — fonctionnel |
| Dynamic blockRef | `{{_activeAgent}}` dans le workflow, `ResolveTemplate` dans `EntryPointExecutor` | **Existe** (Phase 48) — fonctionnel |

### 2.3 Adapt/Optimize (`packages/maestro-cli/adapt-optimize.ts`)

| Fonctionnalite | Statut |
|----------------|--------|
| `extractManifest` — extraction des modeles requis d'un block | **Existe** |
| `detectModels` — matching fuzzy des modeles disponibles vs requis | **Existe** |
| `measureFitness` — mesure de fitness via sandbox + git worktrees | **Existe** |
| `maestroAdapt` — substitution de modeles + test automatise | **Existe** |
| `maestroOptimize` — strategies (model-downgrade, temperature-tuning) | **Existe** |
| `withBlockVariant` — creation de variants temporaires pour tests | **Existe** |
| Integration avec le TUI | **N'existe PAS** |
| Integration avec le first-run flow | **N'existe PAS** |

### 2.4 Blocks maestro-assistant

| Block | Modele | Capacites implicites |
|-------|--------|---------------------|
| `system:maestro-assistant` | `claude-sonnet-4-6` (cloud) | Conversation complete, tool-calling, structured output, 30 iterations, 32K contexte |
| `system:maestro-assistant-compact` | `local` (n'importe quel modele local charge) | Conversation basique, tool-calling simplifie, 5 iterations, 8K contexte |

**Ce qui n'existe PAS dans les blocks** :
- Aucun champ `metadata.capabilities` formel (ex: `["conversation", "tool-calling", "structured-output"]`)
- Aucun champ `metadata.requirements` (ex: `{ minVRAM: "4GB", minParameters: "7B", minContextLength: 8192 }`)
- Le fitness calculator (`fitness-calculator.js`) a des model profiles avec VRAM/RAM mais c'est un script standalone, pas integre dans le systeme de blocks

### 2.5 Provider Monitor (l'ancien — `packages/provider-monitor/`)

L'ancien monitor avait :

| Panel | Contenu | Present dans maestro-code ? |
|-------|---------|----------------------------|
| **Metrics** | Total requests, errors, error rate, tokens (prompt/completion/total), latence P50/P95/P99 | **Non** |
| **Models** | Modeles par provider, statut, context length, capabilities, perf profiles | **Partiellement** (liste + statut seulement) |
| **Queue** | Active model, queue depth, avg wait, depth-by-model, switch decisions (10 dernieres) | **Non** |
| **Logs** | 200 dernieres lignes, color-coded par level | **Non** |

---

## 3. Analyse critique

### 3.1 La demande est ENORME pour une seule phase

La requete couvre 5 axes distincts. Une bonne partie de l'infrastructure existe deja (Python endpoints, `LocalLLMProvider`, adapt-optimize). Le travail reel est :

1. **Detection hardware** — `LocalLLMProvider` doit appeler `/v1/system/capabilities` (existe deja cote Python) + ecran TUI
2. **Download de modeles** — `LocalLLMProvider.LoadModelAsync` existe, l'exposer + ecran TUI
3. **Modele de capacites** — Schema dans les blocks + 9 tests simples (3x3 capacites) + affichage TUI
4. **Restauration des metriques** — Les endpoints stats existent deja dans LLM-Provider .NET, c'est du TUI
5. **CPU-only** — Fix `use_system_ram` dans le Python server + avertissement dans le TUI

**Le decoupage en 3 sous-phases de 2-3 jours** respecte la regle "max 3 jours par sous-phase". L'integration adapt est reportee en Phase 50 pour eviter le scope creep.

### 3.2 Le risque de "catherdrale" est eleve

La strategic analysis dit : "Arrete de construire la cathedrale. Livre la chapelle." Le modele de capacites + les tests automatises + l'integration adapt est exactement le type de feature qui peut absorber des semaines sans delivrer de valeur visible.

### 3.3 Ce qui a vraiment de la valeur pour l'utilisateur

Si je me mets a la place d'un nouvel utilisateur qui installe Maestro pour la premiere fois :

1. **Critique** : Je ne tombe pas dans un ecran vide sans savoir quoi faire. Le setup me guide.
2. **Critique** : Si j'ai un GPU, je peux telecharger un modele et commencer a utiliser Maestro GRATUITEMENT en 5 minutes.
3. **Important** : Je comprends ce que mon modele peut et ne peut pas faire AVANT de le choisir.
4. **Nice-to-have** : Je vois des metriques detaillees sur les performances de mes modeles.
5. **Future** : Le systeme optimise automatiquement mes agents selon mon hardware.

### 3.4 Le provider local DEVRAIT toujours etre propose

La requete dit "le provider local devrait toujours etre setup". C'est correct. Actuellement, le `ProviderSetupScreen` demande a l'utilisateur de CHOISIR ses providers. Mais le local devrait etre une option par defaut car :
- C'est gratuit
- Ca fonctionne sans compte/API key
- Ca permet de tester Maestro immediatement
- C'est le differenciateur de Maestro vs Claude Code/Cursor

**Probleme** : Le Python server local n'est pas toujours disponible. Il faut CUDA. Un utilisateur sans GPU ne peut pas l'utiliser. Donc "toujours setup" = "toujours propose si hardware compatible".

### 3.5 Le modele de capacites est un design problem, pas un code problem

La requete decrit quelque chose d'ambitieux : "un genre de model d'agent avec des tests qui specifie les capacites necessaire". C'est fondamentalement un **benchmark framework** pour LLMs. Ca existe dans l'industrie (LMSYS, HumanEval, MMLU) et c'est des projets de plusieurs mois.

Pour Maestro, on a besoin d'une version minimaliste :
- 3-5 tests par capacite (conversation, tool-calling, structured output)
- Chaque test = un prompt + un critere de reussite
- Le systeme execute les tests contre un modele et determine les capacites
- Le resultat est stocke et affiche

Ca ressemble a ce que `measureFitness` fait deja, mais specialise pour les capacites agent plutot que pour la qualite de code.

---

## 4. Proposition : Decoupage en 3 sous-phases

### Phase 49-A : First-Run Hardware-Aware (3 jours max)

**Objectif** : L'utilisateur arrive, voit ses capacites, telecharge un modele, et commence a utiliser Maestro.

**Livrable visible** : Un flow first-run qui detecte le hardware, propose des modeles, et en telecharge un.

#### Taches :

| # | Tache | Effort | Fichiers |
|---|-------|--------|----------|
| A1 | Ajouter detection VRAM/RAM au Python server (`GET /v1/hardware`) | 2h | `llm-provider/python/` |
| A2 | Ajouter methodes a `LocalLLMProvider` + endpoints dans l'API .NET existante | 3h | `llm-provider/dotnet/` |
| A3 | Enrichir `ProviderSetupScreen` avec un ecran hardware | 4h | `ProviderSetupScreen.ts` |
| A4 | Ajouter ecran de selection/download de modele | 4h | Nouveau: `ModelDownloadScreen.ts` |
| A5 | Proposer le local par defaut si GPU detecte | 1h | `App.ts`, `ProviderSetupScreen.ts` |
| A6 | Tests + verification | 2h | Tests unitaires + manual test |

#### Flow propose :

```
Premiere ouverture de maestro code
  │
  ├─ Ecran 1: "Bienvenue dans Maestro"
  │   Detection hardware en cours...
  │   ┌────────────────────────────────────┐
  │   │  Hardware Detected                  │
  │   │  GPU: NVIDIA RTX 4070 (12GB VRAM)  │
  │   │  RAM: 32 GB                         │
  │   │  CUDA: Available (12.1)             │
  │   │                                     │
  │   │  You can run local AI models!       │
  │   │  [Enter] Continue setup             │
  │   └────────────────────────────────────┘
  │
  ├─ Ecran 2: Provider Selection (existant, ENRICHI)
  │   Providers pre-selectionnes selon hardware:
  │   - [x] Local (Python FastAPI) ← auto-selectionne si GPU
  │   - [ ] Claude Code (CLI)
  │   - [ ] Azure OpenAI
  │   - [ ] Azure AI Inference
  │
  ├─ Ecran 3: "Choose a Local Model" (NOUVEAU)
  │   ┌────────────────────────────────────────────────┐
  │   │  Recommended for your GPU (12GB VRAM):          │
  │   │                                                  │
  │   │  > [1] deepseek-coder-6.7b    (4.2 GB) *Rec*   │
  │   │    [2] codellama-7b            (4.5 GB)          │
  │   │    [3] mistral-7b-instruct     (4.8 GB)          │
  │   │                                                  │
  │   │  Lightweight (any GPU):                          │
  │   │    [4] smollm2-1.7b            (1.1 GB)          │
  │   │    [5] phi-2                    (1.8 GB)          │
  │   │                                                  │
  │   │  [Enter] Download selected                       │
  │   │  [S] Skip — I'll set up models later             │
  │   └────────────────────────────────────────────────┘
  │
  ├─ Ecran 4: Download en cours
  │   ┌────────────────────────────────────────┐
  │   │  Downloading deepseek-coder-6.7b...    │
  │   │  ████████████░░░░░░░░  58%  2.4 GB     │
  │   │                                         │
  │   │  This may take a few minutes.           │
  │   └────────────────────────────────────────┘
  │
  └─ Ecran 5: Agent selection (NOUVEAU mais simple)
      ┌────────────────────────────────────────────────┐
      │  Choose your Maestro assistant:                  │
      │                                                  │
      │  > [1] Full Assistant (cloud model required)     │
      │        Conversation + Tools + Orchestration      │
      │        Requires: Claude Code or Azure provider   │
      │                                                  │
      │    [2] Compact Assistant (local model)            │
      │        Conversation + Basic Tools                 │
      │        Works with your downloaded model           │
      │                                                  │
      │  [Enter] Confirm                                  │
      └────────────────────────────────────────────────┘
```

#### Decisions de design :

1. **Le local est PROPOSE par defaut si GPU detecte, mais pas force**. L'utilisateur peut decocher.
2. **Un seul modele a telecharger au premier lancement**. Pas une liste de courses. Keep it simple.
3. **L'ecran de download peut etre `Skip`** — l'utilisateur peut configurer plus tard depuis la page Models.
4. **L'agent selection est binaire** : full (cloud) ou compact (local). Pas de matrice de capacites complexe au premier lancement.

---

### Phase 49-B : Modele de capacites agent (3 jours max)

**Objectif** : Un schema formel de capacites dans les blocks, avec des tests automatises simples.

**Livrable visible** : Sur la page Models ou dans `/agent`, l'utilisateur voit clairement "cet agent peut faire X mais pas Y".

#### Taches :

| # | Tache | Effort | Fichiers |
|---|-------|--------|----------|
| B1 | Designer le schema `metadata.capabilities` et `metadata.requirements` | 2h | Schema design + doc |
| B2 | Ajouter les champs aux blocks existants (`maestro-assistant`, `maestro-assistant-compact`) | 1h | Block JSONs |
| B3 | Creer des tests de capacite simples (3-5 prompts par capacite) | 4h | Nouveaux sandboxes/checkpoints |
| B4 | Integrer `measureFitness` pour tester les capacites | 3h | `adapt-optimize.ts` ou nouveau module |
| B5 | Afficher les capacites dans le TUI (page Models ou AgentPanel) | 3h | `ModelsScreen.ts`, `AgentPanel.ts` |
| B6 | CLI command `maestro capabilities test <block-id>` | 2h | `cli.ts` |

#### Schema propose :

```json
{
  "metadata": {
    "capabilities": {
      "conversation": true,
      "tool-calling": true,
      "structured-output": true,
      "multi-step-reasoning": false,
      "code-generation": false
    },
    "requirements": {
      "minContextLength": 8192,
      "minParametersB": 3,
      "estimatedVRAM_GB": 4,
      "providers": ["local", "claudeCode", "azure"]
    },
    "testedWith": [
      { "model": "deepseek-coder-6.7b", "capabilities": { "conversation": true, "tool-calling": false }, "date": "2026-03-04" },
      { "model": "claude-sonnet-4-6", "capabilities": { "conversation": true, "tool-calling": true, "structured-output": true }, "date": "2026-03-04" }
    ]
  }
}
```

#### Tests de capacite (5 categories) :

| Capacite | Test | Critere de reussite |
|----------|------|---------------------|
| `conversation` | "Explique ce que fait Maestro en 3 phrases" | Reponse coherente, pas de hallucination |
| `tool-calling` | Prompt avec tool schema JSON, demander d'appeler un tool | La reponse contient un JSON valide avec le bon tool name |
| `structured-output` | Demander une reponse en format JSON specifique | JSON parseable conforme au schema |
| `multi-step-reasoning` | Probleme necessitant 3+ etapes logiques | Resultat correct |
| `code-generation` | Generer une fonction simple + test | Code compilable/executable |

#### Affichage TUI :

```
Agent: system:maestro-assistant-compact (local)
Capabilities: [conversation] [basic-tools]    Missing: [structured-output] [orchestration]
```

---

### Phase 49-C : Restauration metriques provider (2-3 jours max)

**Objectif** : La page Models montre les metriques riches que le provider-monitor avait.

**Livrable visible** : La page Models ressemble au provider-monitor avec les donnees importantes.

#### Taches :

| # | Tache | Effort | Fichiers |
|---|-------|--------|----------|
| C1 | Ajouter les appels API stats/queue/performance au `ModelsScreen` | 2h | `ModelsScreen.ts` |
| C2 | Creer un panel Metriques (requests, tokens, latence) | 3h | Nouveau composant ou enrichir `ModelsScreen.ts` |
| C3 | Creer un panel Queue (depth, wait, switch decisions) | 2h | Meme |
| C4 | Ajouter download de modele depuis la page Models | 2h | `ModelsScreen.ts` |
| C5 | Ajouter les capacites par modele dans la liste | 1h | `ModelsScreen.ts` |

#### Layout propose :

```
┌─ MODELS ──────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌─ STATUS ──────────┐  ┌─ METRICS ─────────────┐  ┌─ QUEUE ──────────┐  │
│  │ ● Online           │  │ Requests: 142 (2 err)  │  │ Depth: 0         │  │
│  │ GPU: RTX 4070      │  │ Tokens: 45.2K          │  │ Avg Wait: 0ms    │  │
│  │ VRAM: 12GB         │  │ P50: 230ms             │  │ Active: sonnet   │  │
│  │ Active: deepseek   │  │ P95: 890ms             │  │                  │  │
│  │                    │  │ P99: 1.2s              │  │ Last switch:     │  │
│  └────────────────────┘  └────────────────────────┘  │ 2m ago → local   │  │
│                                                       └──────────────────┘  │
│  ┌─ AVAILABLE MODELS ──────────────────────────────────────────────────────┐ │
│  │  > ✓ claude-sonnet-4-6     cloud   [conv] [tools] [struct] (active)    │ │
│  │    ✓ deepseek-coder-6.7b   local   [conv] [tools]                      │ │
│  │      mistral-7b-instruct   local   [conv]            [D] Download      │ │
│  │      smollm2-1.7b          local   [conv]            [D] Download      │ │
│  │                                                                         │ │
│  │  [Enter] Select  [D] Download  [R] Reconfigure  [T] Test capabilities  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dependances et ordre d'execution

```
Phase 48 (DONE — dynamic blockRef, maestro-assistant-compact)
  │
  ├─► Phase 49-A : First-Run Hardware-Aware
  │     Prerequis : Python server endpoints (hardware + available-models proxy)
  │     Livrable : Setup flow complet avec detection + download
  │
  ├─► Phase 49-C : Restauration metriques (PEUT commencer en parallele de 49-A)
  │     Prerequis : Endpoints stats existent deja dans LLM-Provider .NET
  │     Livrable : Page Models enrichie
  │
  └─► Phase 49-B : Modele de capacites (APRES 49-A, car depend du schema)
        Prerequis : Schema de capacites designe, modeles locaux telechargeables
        Livrable : Capabilities visibles + testables
```

**49-A et 49-C sont independants** et pourraient etre faits en parallele.
**49-B depend de 49-A** car il faut d'abord pouvoir telecharger des modeles pour les tester.

---

## 6. Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Le Python server local ne demarre pas sur toutes les machines | Elevee | Le first-run flow echoue pour les utilisateurs sans Python/CUDA | Detecter l'absence de Python/CUDA AVANT de proposer le local. Graceful fallback : "Local models require Python + CUDA. Skip?" |
| Le download de modele prend trop longtemps / echoue | Elevee | Frustration utilisateur, premiere impression ruinee | Progress bar, possibilite d'annuler, resume si possible, message clair sur la taille |
| Les tests de capacites sont fragiles (LLM non-deterministe) | Moyenne | Un modele est marque comme "capable" alors qu'il ne l'est pas | Executer chaque test 3 fois, majorite gagne. Seuil de confiance. |
| Le schema de capacites est trop rigide ou trop vague | Moyenne | Inutilisable pour les variants utilisateur | Commencer avec 3 capacites seulement (conversation, tool-calling, structured-output). Iterer. |
| Scope creep vers un benchmark framework complet | Elevee | La phase depasse 3 jours, on retombe dans le cycle | Definition of Done stricte. Les tests de capacites sont 3-5 prompts, PAS un benchmark generique. |
| Le provider-monitor code est CJS/ancien, difficile a porter | Faible | Temps perdu a adapter du code ancien | Ne PAS copier le code du provider-monitor. Re-implementer les panels dans le style maestro-code existant. Utiliser les memes appels API. |

---

## 7. Ce que je recommande de NE PAS FAIRE dans cette phase

| Feature tentante | Pourquoi non |
|------------------|-------------|
| **Framework de benchmark generique** | C'est un produit entier. 3-5 tests cibles par capacite suffisent. |
| **Auto-adapt au first-run** | Trop ambitieux. Le first-run propose, l'utilisateur choisit. L'adapt automatique = Phase 50+. |
| **Support multi-modele simultane** | Un seul modele local charge a la fois. Le switch existe deja. Pas de pool de modeles. |
| **UI de gestion de l'espace disque** | Overkill. Montrer la taille du modele avant download. C'est suffisant. |
| **Streaming du download avec resume** | HuggingFace Hub gere ca. Juste wrapper l'appel et afficher le progres. |
| **Refactoring de adapt-optimize.ts** | Le fichier a `@ts-nocheck` et c'est un probleme connu. Mais ca marche. Pas le moment de refactorer. |
| **Porter les logs du provider-monitor** | Les logs sont debug-only. Pas de valeur pour un utilisateur normal. |

---

## 8. Coherence avec la vision Maestro

### 8.1 Alignement avec les principes

| Principe | Alignement de Phase 49 |
|----------|----------------------|
| **"Remplacer un gros LLM par des petits specialises"** | **Fort** — Le modele de capacites permet a l'utilisateur de comprendre ce que chaque modele peut faire. Le first-run propose des modeles adaptes au hardware. |
| **"Self-improvement via fitness"** | **Moyen** — Les tests de capacites SONT du fitness. Mais le loop complet (test → adapt → save) n'est pas dans cette phase. |
| **"CLI-first"** | **Fort** — `maestro capabilities test <block-id>` est une commande CLI. Le TUI l'utilise. |
| **"No user left behind"** | **Fort** — C'est LE coeur de la phase. Que l'utilisateur ait un RTX 4090 ou un laptop sans GPU, il peut utiliser Maestro. |
| **"Generic infrastructure, specific content"** | **Fort** — Le schema de capacites est dans le block JSON (contenu), pas dans le C# (infra). |

### 8.2 Alignement avec la strategic analysis

| Regle V1 | Respect |
|-----------|---------|
| Max 3 jours par sous-phase | **Oui** — 3 sous-phases de 2-3 jours |
| Chaque phase livre quelque chose de visible | **Oui** — 49-A: setup flow, 49-B: capabilities UI, 49-C: metriques |
| Pas de refactoring cosmetique | **Attention requise** — la tentation de "bien faire" le schema de capacites peut absorber du temps |
| Dogfooding profond | **A planifier** — apres 49-A, faire le first-run flow de A a Z sur une machine avec GPU |

### 8.3 Ce que cette phase debloque pour le futur

```
Phase 49 (cette phase)
  │
  ├─► Phase 50 : maestro adapt integration TUI
  │     L'utilisateur peut lancer `adapt` depuis le TUI
  │     Le systeme teste automatiquement ses modeles
  │     et propose la meilleure configuration
  │
  ├─► Phase 50+ : Agent Creator
  │     Creer un agent custom en specifiant les capacites voulues
  │     Le systeme selectionne le meilleur modele pour chaque capacite
  │
  └─► Phase 50+ : Catalogue communautaire
        Les blocks publies incluent leurs capabilities
        Un utilisateur peut filtrer "blocks compatibles avec mon hardware"
```

---

## 9. Questions resolues

1. **Le Python server local demarre-t-il automatiquement ?** **OUI — deja fait.**
   Le sidecar lance LLM-Provider .NET → `PythonServerHostedService` (IHostedService, `AutoStart=true`) lance automatiquement `python -m uvicorn api.server:app --port 8000`. L'echec est non-fatal (les autres providers continuent). Donc le Python server est DEJA auto-lance. Ce qui manque : que `LocalLLMProvider` (.NET) appelle les routes Python (`/v1/system/capabilities`, `/v1/models/recommended`) et les expose via l'API .NET existante — c'est le pattern normal, pas un proxy special. Le SDK client (`@maestro/client`) a aussi besoin des methodes correspondantes.

2. **Combien de modeles proposer au first-run ?** **3-5 modeles recommandes** filtres par le hardware detecte, en excluant les modeles deja telecharges par la selection du maestro-assistant. Le endpoint reel a utiliser est `/v1/models/recommended` (PAS `/v1/available-models` qui est statique et obsolete). Le `model_registry.py` contient ~50 modeles avec `vram_fp16_gb`, `vram_int8_gb`, `vram_int4_gb` — on filtre par VRAM disponible.

3. **Que faire si l'utilisateur n'a NI GPU NI API key cloud ?** **(c) Proposer un modele CPU-only.**
   Le Python server supporte deja le CPU (fallback automatique dans `ModelManager.load()`). Le probleme : `get_compatible_models()` retourne 0 modeles quand VRAM=0 car `use_system_ram` n'est pas wire. **Fix necessaire** : activer `use_system_ram=True` dans `/v1/models/compatible` quand `gpu.available == False`, pour utiliser la RAM comme fallback. Afficher clairement dans le TUI : "CPU-only mode — inference will be slow (~2-5 tokens/sec)" avec le token rate estime.

4. **Ou stocker les resultats de tests de capacites ?** **(b) `.maestro/capabilities/<block-id>/<model-id>.json`.**
   C'est le plus coherent avec la philosophie Maestro : les blocks sont du contenu (`content/`), les resultats de tests sont des donnees utilisateur (`.maestro/`). Les blocks gardent leurs `metadata.capabilities` statiques (ce que l'agent est CONCU pour), et `.maestro/capabilities/` stocke les resultats TESTES par modele. Ca permet a un utilisateur de tester son propre modele contre un block sans modifier le block JSON.

5. **Ecran de download separe ou dans la page Models ?** **Les deux.**
   First-run flow = ecran dedie integre dans le setup (apres provider selection, avant agent selection). Ensuite, la page Models permet de telecharger des modeles additionnels avec la touche `[D]`. Le composant de download est reutilise entre les deux contextes.

---

## 10. Definition of Done proposee

### 49-A (First-Run)
- [ ] Le Python server expose `GET /v1/hardware` avec GPU name, VRAM, RAM, CUDA version
- [ ] Le LLM-Provider .NET proxie les endpoints hardware + available-models + model-load
- [ ] Le first-run flow detecte le hardware et l'affiche
- [ ] Le first-run flow propose des modeles compatibles avec le hardware
- [ ] L'utilisateur peut telecharger un modele depuis le first-run flow
- [ ] Si pas de GPU, le flow propose uniquement les providers cloud
- [ ] Le local provider est pre-selectionne si GPU detecte
- [ ] `tsc --noEmit` passe, tous les tests passent
- [ ] Test manuel : supprimer `.maestro/`, lancer maestro code, completer le setup, envoyer un message

### 49-B (Capabilities)
- [ ] Schema `metadata.capabilities` + `metadata.requirements` documente
- [ ] `maestro-assistant` et `maestro-assistant-compact` ont les champs remplis
- [ ] 3-5 tests par capacite existent comme sandbox checkpoints
- [ ] `maestro capabilities test <block-id>` fonctionne
- [ ] Les capacites sont affichees dans le TUI (AgentPanel ou ModelsScreen)
- [ ] Un utilisateur peut voir "cet agent supporte conversation + tools mais pas structured-output"

### 49-C (Metriques)
- [ ] La page Models affiche : requests, tokens, latence P50/P95/P99
- [ ] La page Models affiche : queue depth, switch decisions
- [ ] Les capacites par modele sont visibles dans la liste
- [ ] Le download de modele est possible depuis la page Models (pas seulement first-run)
- [ ] Info hardware visible (GPU, VRAM) dans le panel Status

### NOT in scope
- Framework de benchmark generique
- Auto-adapt au first-run
- Pool de modeles simultanes
- Refactoring de `adapt-optimize.ts`
- Logs du provider-monitor
- Optimisation inference CPU (quantization avancee, GGML) — le mode CPU basique suffit
- Integration Cantante (Phase 46)
- Catalogue communautaire (Phase 50+)

---

## 11. Estimation de temps

| Sous-phase | Effort estime | Complexite |
|------------|---------------|------------|
| 49-A | 3-4 jours | Elevee (Python + .NET + TUI, 3 couches) |
| 49-B | 2-3 jours | Moyenne (design + implementation + tests) |
| 49-C | 2-3 jours | Faible (endpoints existent, c'est du TUI) |
| **Total** | **7-10 jours** | |

**Risque de depassement** : 49-A a le plus de risque car il touche 3 couches (Python, .NET, TypeScript). Si le Python server pose probleme (dependencies, CUDA detection sur differentes machines), ca peut doubler.

**Recommandation** : Commencer par 49-C (le plus simple, valeur immediate) pour avoir un quick win, puis 49-A, puis 49-B.

---

## 12. Conclusion

Phase 49 est la phase qui fait passer Maestro de "un outil pour developpeurs qui savent deja ce qu'est un LLM provider" a "un outil que n'importe qui peut installer et utiliser". C'est une phase pivot.

Le danger est de vouloir tout faire d'un coup. Le modele de capacites avec tests automatises est seduisant mais peut facilement absorber 2-3 semaines. La detection hardware + download de modeles est le coeur de la valeur : **un utilisateur arrive, voit son GPU, telecharge un modele, et commence a parler avec un agent local gratuit en 5 minutes**. Tout le reste est secondaire.

Si je devais choisir UNE SEULE chose a livrer dans cette phase, ce serait 49-A : le first-run flow avec detection hardware et download de modele. C'est ca qui transforme Maestro d'un projet pour early adopters en un produit.
