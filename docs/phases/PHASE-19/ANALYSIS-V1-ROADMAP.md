# Phase 19 — Analyse & Roadmap vers Maestro V1

## Table des matières
1. [Analyse de votre plan](#1-analyse-de-votre-plan)
2. [Définition de la V1 — Ce qu'elle DOIT faire](#2-définition-de-la-v1)
3. [Ce qui existe déjà](#3-ce-qui-existe-déjà)
4. [Ce qui manque — Analyse par domaine](#4-ce-qui-manque)
5. [Phases proposées vers la V1](#5-phases-proposées)
6. [Risques et recommandations](#6-risques-et-recommandations)

---

## 1. Analyse de votre plan

### Ce qui est solide dans votre vision

**Le modèle "télécharger et utiliser" est la bonne cible.** Maestro est actuellement un projet de développeur — il faut `dev-start.ps1`, connaître les ports, comprendre les templates JSON. La V1 doit transformer ça en : télécharger → installer → ouvrir → utiliser.

**L'idée du cercle d'utilisateurs beta est excellente.** C'est la meilleure façon de découvrir ce qui manque avant d'investir dans des features cloud. Mieux vaut 5 utilisateurs réels qu'une roadmap théorique.

### Ce qui nécessite clarification

**1. Le chat avec les modèles — Scope à définir**

Vous proposez deux choses distinctes :
- **Chat simple** : Parler avec un modèle pour le tester (comme un playground). C'est rapide à implémenter — un composant frontend + appel au LLM Gateway.
- **Agent interne type Claude Code** : Un agent qui utilise le CLI à votre place. C'est un projet majeur en soi — il faut un loop agent (plan → execute → observe → adapt), la gestion de contexte, des guardrails de sécurité.

**Recommandation V1** : Implémenter le chat/playground. L'agent interne est une feature post-V1 qui nécessite sa propre phase de design.

**2. Les subscriptions — Trop tôt pour la V1**

Les subscriptions impliquent :
- Authentification (OAuth/GitHub)
- Base de données utilisateurs (cloud)
- Gestion de plans (free/pro/enterprise)
- Paiement (Stripe ou autre)
- Catalogue partagé (hébergé)
- Modèles hébergés Azure (infrastructure cloud)

C'est un pivot de "application locale" vers "plateforme SaaS". Pour la V1 beta avec un cercle restreint, c'est prématuré et risqué. Ça ajouterait 3-4 mois de travail sur des sujets non-core (auth, paiement, infra cloud).

**Recommandation V1** : Authentification locale simple (clé API ou login local) pour différencier utilisateur humain vs agent. Les subscriptions sont une V2.

**3. Permissions utilisateur vs agent — À implémenter**

Le concept d'`Authority` (Human vs Agent) existe déjà dans les sessions. Il faut l'étendre :
- **Humain via CLI** : Accès complet (créer sessions, modifier variables, supprimer)
- **Agent via CLI** : Accès restreint (exécuter des commandes dans sa session, pas de suppression, pas d'accès aux autres sessions)

C'est aligné avec la philosophie Maestro et implémentable sans infrastructure cloud.

**4. Installer l'app — Faisable, mais stratégie à choisir**

Trois options de distribution :
| Option | Complexité | UX utilisateur |
|--------|-----------|----------------|
| **Electron** (déjà configuré) | Moyenne | Excellent — un .exe, tout inclus |
| **CLI + Backend séparés** | Simple | Bon pour devs, mauvais pour non-devs |
| **Docker** (déjà configuré) | Simple | Bon si Docker déjà installé |

**Recommandation V1** : Electron pour le frontend + backend embarqué. CLI installable séparément via npm (`npm install -g @maestro/cli`).

---

## 2. Définition de la V1

### La V1 DOIT permettre à un utilisateur de :

| # | Capability | Détail |
|---|-----------|--------|
| 1 | **Installer en 1 clic** | Télécharger un .exe (Windows) ou .dmg (Mac), installer, lancer |
| 2 | **Voir le dashboard** | Page d'accueil avec état du système, sessions récentes, actions rapides |
| 3 | **Créer une session à partir d'un template** | Choisir un template (Foundry, Compliance, etc.), configurer, démarrer |
| 4 | **Lier un repo** | Attacher un dossier Git comme workspace ou repo de session |
| 5 | **Exécuter un workflow** | Lancer un entry point et voir le progrès en temps réel |
| 6 | **Monitorer l'exécution** | TUI (terminal) OU web UI — progression, logs, arbres d'exécution |
| 7 | **Voir les résultats** | Artifacts générés, métriques, rapports |
| 8 | **Explorer les blocks** | Catalogue de blocks disponibles (agents, tools, workflows) |
| 9 | **Tester un modèle** | Chat/playground pour envoyer des prompts et voir les réponses |
| 10 | **Utiliser le CLI depuis n'importe où** | `maestro health`, `maestro session create`, etc. depuis n'importe quel terminal |

### La V1 ne DOIT PAS inclure :

| Feature | Raison du report |
|---------|-----------------|
| Subscriptions/paiement | Infrastructure cloud non nécessaire pour beta fermée |
| Catalogue partagé (cloud) | Pas de base de données multi-utilisateurs pour V1 |
| Agent interne (type Claude Code) | Projet majeur en soi, post-V1 |
| Modèles hébergés Azure | Infrastructure cloud, coûts récurrents, scaling |
| Multi-utilisateurs | V1 = single-user local |
| Support mobile | Desktop et CLI suffisent |

---

## 3. Ce qui existe déjà

### Prêt (✅)

| Domaine | État |
|---------|------|
| **Backend API** | 25 controllers, REST complet, SignalR temps réel |
| **Frontend Web** | 40+ pages, React + TypeScript + Vite |
| **CLI** | 50+ commandes, TypeScript, JSON mode |
| **TUI Monitor** | Ink-based, 27 composants, thème partagé |
| **Blocks** | 80+ blocks système (tools, agents, workflows) |
| **Templates** | 4 templates de session prêts à utiliser |
| **Workflows** | for-each, while, phase, conditional — tout fonctionne |
| **LLM-Provider** | Projet complet : 60+ modèles, détection hardware, Azure provider, registre, streaming |
| **Electron** | Configuration electron-builder pour Win/Mac/Linux |
| **Docker** | 4 docker-compose variantes |
| **Documentation** | 179 fichiers markdown, guides utilisateur et agent |

### Partiellement prêt (⚠️)

| Domaine | Ce qui manque |
|---------|---------------|
| **Electron packaging** | Jamais testé en production — le backend doit se lancer depuis Electron |
| **CLI global** | Pas publié sur npm, pas de `maestro` global |
| **Frontend UX** | Pages fonctionnelles mais pas polies pour un nouvel utilisateur |
| **LLM intégration** | LLM-Provider a tout, mais Maestro n'expose pas les features (pas de LLMController, UI limitée) |
| **Cross-platform** | Scripts PowerShell Windows-centric, quelques chemins hardcodés |

### Manquant (❌)

| Domaine | Description |
|---------|-------------|
| **Setup wizard** | Aucun onboarding — l'utilisateur est perdu |
| **Chat/Playground** | Aucune interface pour tester des prompts |
| **Auth** | Zéro authentification, même basique |
| **Permissions CLI** | Pas de distinction humain vs agent en pratique |
| **Error UX** | Erreurs techniques exposées directement |
| **Configuration UI** | Pas d'UI pour configurer modèles, ports, chemins |
| **LLM cloud providers** | Azure existe dans LLM-Provider .NET mais pas exposé. Pas de OpenAI/Anthropic direct. |
| **Installer production** | L'installeur Electron n'a jamais été buildé pour distribution |
| **Auto-update** | Configuré mais pas connecté à un serveur de mises à jour |
| **Telemetry opt-in** | Aucune façon de savoir comment les utilisateurs utilisent l'app |

---

## 4. Ce qui manque — Analyse par domaine

### 4.1 Installation & Distribution

**Problème** : Actuellement, lancer Maestro nécessite de cloner le repo, installer les dépendances, et exécuter `dev-start.ps1`. Un utilisateur normal ne peut pas faire ça.

**Ce qu'il faut** :
1. **Installer Electron** : Build l'app Electron qui embarque le backend .NET et le frontend
2. **First Run Setup** : Au premier lancement, configurer :
   - Dossier de données (`~/.maestro/` ou `AppData/Maestro/`)
   - Copier `content/system/` vers le dossier utilisateur
   - Vérifier les prérequis (Node.js pour le CLI, optionnel)
3. **CLI séparé** : Publier `@maestro/cli` sur npm pour `npm install -g @maestro/cli`
4. **LLM-Provider** : Soit embarqué (lourd ~2GB), soit optionnel avec guide d'installation

**Décision clé** : Le LLM-Provider est le plus gros obstacle. Options :
- **A) Embarquer** : L'installer silencieusement, télécharger les modèles au premier lancement (~2-5 GB)
- **B) Optionnel** : L'app fonctionne sans LLM local, l'utilisateur configure un provider cloud
- **C) Hybrid** : Proposer les deux — petit modèle embarqué + support API cloud

**Recommandation** : Option C. Embarquer SmolLM2-360M (petit) pour le "out of the box", supporter OpenAI/Anthropic API pour les utilisateurs qui veulent plus de puissance.

### 4.2 Onboarding & First-Time UX

**Problème** : Un nouvel utilisateur qui ouvre l'app ne sait pas quoi faire. Pas de wizard, pas de guide intégré.

**Ce qu'il faut** :
1. **Welcome Screen** : Expliquer ce qu'est Maestro en 3 phrases
2. **Setup Wizard** (3 étapes) :
   - Configurer le LLM (local ou API key)
   - Choisir un template de démarrage
   - Optionnel : Lier un repo
3. **Quick Actions** : Sur le dashboard, des boutons clairs :
   - "Nouvelle session Foundry" → template foundry-default
   - "Tester mes modèles" → template compliance-tester
   - "Explorer les blocks" → catalogue
4. **Guided Tour** : Tooltips sur les premières interactions
5. **Sample Repo** : Inclure un petit repo d'exemple pour que l'utilisateur puisse tester immédiatement

### 4.3 Chat / Playground LLM

**Problème** : L'utilisateur ne peut pas tester un modèle sans créer une session et lancer un workflow.

**Ce qu'il faut** :
1. **Page Chat** dans le frontend :
   - Sélection du modèle (dropdown)
   - Zone de saisie du prompt
   - Affichage de la réponse en streaming
   - Historique de conversation (session-based)
   - Paramètres (temperature, max tokens, system prompt)
2. **API endpoint** : `POST /api/chat/completions` qui proxie vers le LLM Gateway
3. **CLI** : `maestro chat [--model <id>]` pour un chat interactif en terminal

**Estimation** : Feature de taille moyenne — 1 page frontend, 1 controller, 1 service.

### 4.4 LLM — Exposer ce qui existe + Azure + Configuration utilisateur

**Situation réelle** : Le LLM-Provider (`C:\LLM-Provider\`) est un projet sophistiqué avec un **registre de 60+ modèles**, de la **détection hardware** (GPU/VRAM/RAM), du **model compatibility checking**, et un **Azure OpenAI provider** déjà implémenté en .NET. Le problème n'est pas "il faut tout construire" mais "Maestro n'expose pas ces features".

#### Ce qui existe dans le LLM-Provider et que Maestro ne montre pas :

| Feature LLM-Provider | Endpoint | Exposé dans Maestro? |
|---|---|---|
| Détection GPU/VRAM/RAM | `GET /v1/system/capabilities` | **Non** |
| 60+ modèles avec VRAM specs | `GET /v1/models/registry` | **Non** |
| Modèles compatibles hardware | `GET /v1/models/compatible` | **Non** |
| Modèles recommandés | `GET /v1/models/recommended` | **Non** |
| Scan cache local HuggingFace | `GET /v1/models/local` | **Non** |
| Stats du cache | `GET /v1/models/cache-stats` | **Non** |
| Switch modèle sans restart | `POST /v1/switch-model` | **Partiel** (gateway, pas d'UI) |
| Azure OpenAI (.NET) | `AzureLLMProvider.cs` | **Non** |
| Streaming WebSocket | `WS /v1/stream` | **Non** (retourne en bloc) |
| Quantization 8-bit | `use_8bit` param | **Non configurable** |

#### Ce qu'il faut implémenter dans Maestro :

**A) Backend — `LLMController` manquant (priorité 1)**

L'API client (`shared/api-client.js`) appelle déjà `/api/llm/health`, `/api/llm/models`, `/api/llm/status` — mais aucun controller ne les implémente. Il faut :

```
GET  /api/llm/health              → proxy vers LLM-Provider /health
GET  /api/llm/models              → proxy vers /v1/models + /v1/models/registry
GET  /api/llm/models/compatible   → proxy vers /v1/models/compatible
GET  /api/llm/models/local        → proxy vers /v1/models/local
GET  /api/llm/system/capabilities → proxy vers /v1/system/capabilities
POST /api/llm/switch-model        → proxy vers /v1/switch-model
POST /api/llm/models/load         → proxy vers /v1/models/load
```

**B) Frontend — Page "Models" enrichie (priorité 2)**

L'utilisateur doit voir, **dès le premier lancement** :
1. **Hardware de sa machine** : GPU, VRAM, RAM → données de `/v1/system/capabilities`
2. **Modèles compatibles** : Filtrés par hardware → `/v1/models/compatible`
   - Badge vert "Peut tourner" / orange "Quantization requise" / rouge "Trop gros"
   - VRAM estimé par précision (FP16, INT8, INT4)
3. **Modèles déjà téléchargés** : Cache local → `/v1/models/local`
4. **Chargement en 1 clic** : Sélectionner → charger → actif
5. **Catégories** : Code, Chat, Reasoning, Tool Use (données du registre)

**C) Azure OpenAI — Configuration (priorité 2)**

L'`AzureLLMProvider` existe dans le .NET du LLM-Provider. Il faut :
1. **Page de configuration Azure** dans le frontend Maestro :
   - Endpoint URL (`https://{resource}.openai.azure.com/`)
   - API Key
   - Deployment name
   - Bouton "Tester la connexion"
2. **Sélection de provider** dans les workflows : "Utiliser Azure" vs "Utiliser local"
3. **Persistence** de la config dans `~/.maestro/config.json`

**D) Configuration personnalisée de modèles (priorité 3)**

Pour que l'utilisateur puisse ajouter ses propres modèles :
1. **Ajouter un modèle custom** : ID HuggingFace + paramètres (context length, template, VRAM)
2. **Fichier de config utilisateur** : `~/.maestro/models.json` qui étend le registre
3. **Import de modèle** : Pointer vers un .gguf ou un dossier local

**E) Maestro Cloud Provider — V2 (pas V1)**

- L'utilisateur paie un abonnement → utilise des modèles hébergés sur Azure par Maestro
- Nécessite : auth, subscriptions, infrastructure Azure, API gateway
- **Clairement V2** — on prépare l'interface (dropdown "Provider: Local / Azure / Maestro Cloud") mais le backend cloud n'est pas pour la V1

#### Stratégie LLM pour la V1 :

```
Tier 1 (V1.0) : Modèles locaux via LLM-Provider
  → Exposer hardware detection, model registry, compatibility
  → L'utilisateur voit ce que sa machine peut faire
  → Switch de modèle en 1 clic

Tier 2 (V1.0) : Azure OpenAI (BYOK — Bring Your Own Key)
  → L'utilisateur configure son propre Azure endpoint
  → Le provider .NET existe déjà, juste besoin de l'UI de config

Tier 3 (V1.1) : OpenAI / Anthropic direct (BYOK)
  → Ajouter OpenAIProvider et AnthropicProvider dans le LLM-Provider .NET
  → L'utilisateur entre sa clé API, sélectionne le provider

Tier 4 (V2) : Maestro Cloud
  → Modèles hébergés par Maestro sur Azure
  → Nécessite subscriptions, auth, infrastructure
```

### 4.5 Sécurité & Permissions

**Problème** : Zéro auth. N'importe qui sur le réseau local peut appeler l'API.

**Ce qu'il faut pour V1** (minimum) :
1. **API Key locale** : Générée au premier lancement, stockée dans `~/.maestro/config.json`
2. **CLI auth** : Le CLI envoie la clé dans le header `Authorization: Bearer <key>`
3. **Agent vs Humain** :
   - Humain : Clé principale, accès complet
   - Agent : Clé de session, scope limité à sa session
4. **Localhost binding** : Backend écoute sur `127.0.0.1` uniquement (pas `0.0.0.0`)

**Ce qui peut attendre V2** :
- OAuth/GitHub login
- Multi-utilisateurs
- Rôles (admin/user/agent)
- Rate limiting

### 4.6 Frontend — Polish & UX

**Problème** : Les pages existent mais manquent de cohérence et de polish pour un utilisateur non-technique.

**Ce qu'il faut** :
1. **Navigation cohérente** : Sidebar simplifiée avec les actions principales
2. **Dashboard amélioré** :
   - Santé du système (backend, LLM, espace disque)
   - Sessions en cours avec progrès
   - Actions rapides contextuelles
3. **Session detail** : Page unifiée montrant :
   - Progrès visuel (barre de progression + phases)
   - Logs en temps réel
   - Artifacts produits
   - Métriques de fitness
4. **Block catalog** : Vue grille/liste avec filtres, recherche, et preview
5. **Settings page** : Configuration centralisée (LLM, chemins, thème, keybindings)
6. **Responsive** : Supporter au minimum 1280x720
7. **Loading states** : Spinners, skeletons, messages d'attente
8. **Error pages** : 404, erreur de connexion, service indisponible

### 4.7 CLI — Global Access

**Problème** : Le CLI est dans `maestro-cli/` et nécessite `node index.js`. Un utilisateur veut taper `maestro` de n'importe où.

**Ce qu'il faut** :
1. **npm publish** : Publier `@maestro-ai/cli` sur npm
2. **`bin` entry** : Déjà configuré (`"maestro": "./index.js"`) — juste besoin de publish
3. **Auto-discover backend** : Le CLI doit trouver le backend automatiquement :
   - Config locale (`~/.maestro/config.json` avec `backendUrl`)
   - Ou fallback `localhost:5000`
4. **Repo context** : Quand lancé depuis un repo, auto-détecter si un workspace/session est lié
5. **`maestro init`** : Commande pour initialiser un repo (crée `.maestro/`, configure le workspace)
6. **`maestro setup`** : Commande pour le premier setup (configurer LLM, API keys, etc.)

### 4.8 Workflows utilisateur — Out-of-the-box Value

**Problème** : Les templates existants sont orientés "training de modèles" et "compliance testing". Un nouvel utilisateur veut de la valeur immédiate.

**Ce qu'il faut** : Des workflows que n'importe quel développeur peut utiliser dès le jour 1 :

| Workflow | Description | Valeur immédiate |
|----------|-------------|-----------------|
| **Code Review** | Analyser un diff Git et produire un review | Oui — chaque dev fait des PRs |
| **Generate README** | Analyser un repo et générer un README | Oui — tout le monde en a besoin |
| **Generate Tests** | Analyser un fichier et générer des tests unitaires | Oui — tâche courante |
| **Refactor Suggestions** | Analyser du code et proposer des refactors | Oui — amélioration continue |
| **Commit Message** | Générer un message de commit à partir du diff | Déjà existe (gen-commit) |
| **Documentation** | Générer de la documentation d'API | Oui — tâche souvent négligée |

Ces workflows utilisent les blocks existants (git-diff, file-read, code-search, llm-generate) et sont créés en JSON uniquement — zéro changement C#.

### 4.9 Documentation utilisateur

**Problème** : La documentation est extensive mais orientée développeur/architecture. Un utilisateur final a besoin de guides simples.

**Ce qu'il faut** :
1. **Guide d'installation** : Step-by-step pour chaque OS
2. **Getting Started** (5 minutes) : Installer → premier workflow → voir les résultats
3. **User Manual** : Référence des fonctionalités accessible depuis l'app
4. **FAQ** : Questions courantes
5. **In-app help** : `maestro help <command>` amélioré avec exemples

### 4.10 Stabilité & Error Handling

**Problème** : L'app assume que tout fonctionne. En production, les choses cassent.

**Ce qu'il faut** :
1. **Health dashboard** : Statut de chaque service avec auto-diagnostic
2. **Graceful degradation** :
   - Backend down → Frontend affiche "Connexion perdue, reconnexion..."
   - LLM down → Sessions en attente, pas de crash
3. **Error messages humains** : "Le modèle n'a pas pu être chargé" au lieu de "CUDA device error"
4. **Logs accessibles** : `maestro logs` pour voir les dernières erreurs
5. **Auto-recovery** : Reconnexion SignalR automatique (déjà partiellement en place)

---

## 5. Phases proposées vers la V1

### Phase 19 — Fondations V1 : Intégration LLM complète + Chat + Config
**Objectif** : L'utilisateur voit ses modèles, configure ses providers, et peut chatter

- [ ] **LLMController** dans le backend Maestro — proxy vers LLM-Provider (health, models, compatible, capabilities, switch, load)
- [ ] **Page Models enrichie** — hardware de la machine, modèles compatibles (badge vert/orange/rouge), cache local, chargement 1-clic
- [ ] **Configuration Azure** — UI pour entrer endpoint + API key + deployment, "Tester connexion"
- [ ] **Chat/Playground** — Page frontend + streaming (WebSocket) + sélection de modèle/provider
- [ ] `maestro chat [--model <id>]` — Chat interactif en CLI
- [ ] `maestro models` — Lister modèles compatibles, locaux, et chargés (expose le registre LLM-Provider)
- [ ] **Configuration centralisée** — `~/.maestro/config.json` (providers, API keys, modèle par défaut)
- [ ] `maestro setup` — Wizard CLI : détecter hardware → montrer modèles compatibles → configurer provider
- [ ] **Config modèle custom** — `~/.maestro/models.json` pour ajouter des modèles au registre

### Phase 20 — Sécurité & Permissions
**Objectif** : L'app est sécurisée pour un usage local

- [ ] API Key locale générée au premier lancement
- [ ] Auth middleware dans le backend (Bearer token)
- [ ] CLI auth (envoie la clé automatiquement)
- [ ] Permission model : Humain (full) vs Agent (scoped)
- [ ] Localhost binding par défaut
- [ ] Session-scoped agent keys

### Phase 21 — Packaging & Installation
**Objectif** : L'utilisateur télécharge et installe en 1 clic

- [ ] Build Electron production (Windows .exe via NSIS)
- [ ] Backend embarqué dans Electron (ou lancé comme service)
- [ ] First-run setup wizard (dans l'app)
- [ ] Content directory initialization automatique
- [ ] npm publish du CLI (`@maestro-ai/cli`)
- [ ] LLM-Provider optionnel avec guide intégré
- [ ] Build Mac (.dmg) et Linux (.AppImage) si ressources

### Phase 22 — UX & Onboarding
**Objectif** : Un nouvel utilisateur comprend et utilise l'app en 5 minutes

- [ ] Welcome screen redesign
- [ ] Setup wizard (LLM → template → repo)
- [ ] Dashboard amélioré (quick actions, health, sessions en cours)
- [ ] Session detail page unifiée
- [ ] Settings page centralisée
- [ ] Loading states, error states, empty states
- [ ] Navigation simplifiée

### Phase 23 — Workflows Utilisateur
**Objectif** : L'utilisateur a de la valeur dès le jour 1

- [ ] Template "Code Review" (analyse diff → rapport)
- [ ] Template "Generate README" (analyse repo → README.md)
- [ ] Template "Generate Tests" (analyse code → tests)
- [ ] Améliorer gen-commit pour supporter API cloud
- [ ] Quick-start depuis le dashboard ("Reviewer mon dernier commit")
- [ ] Documentation utilisateur finale

### Phase 24 — Stabilisation & Beta
**Objectif** : L'app est prête pour le cercle d'utilisateurs

- [ ] Bug fixes issus du test interne
- [ ] Error handling et messages utilisateur
- [ ] Health dashboard
- [ ] `maestro logs` et diagnostics
- [ ] Guide d'installation final
- [ ] FAQ et troubleshooting
- [ ] Feedback form intégré (pour les beta users)
- [ ] Telemetry opt-in basique

---

## 6. Risques et recommandations

### Risque 1 : Le LLM-Provider est un mur d'adoption

**Impact** : Élevé. Si l'utilisateur doit installer Python + CUDA + télécharger des modèles, 90% abandonneront.

**Mitigation** : Priorité absolue au support des API cloud (OpenAI/Anthropic). Le LLM local devient optionnel, pas requis.

### Risque 2 : Electron + Backend .NET = complexité de packaging

**Impact** : Moyen. Electron doit spawner un process .NET, gérer son cycle de vie, et survivre aux crashes.

**Mitigation** : Tester tôt. Faire un POC de packaging Electron + backend avant de polir le reste. Si trop complexe, considérer une distribution "CLI + web" sans Electron.

### Risque 3 : Scope creep des subscriptions

**Impact** : Élevé. Ajouter auth + paiement + cloud catalog avant la V1 repousse la release de 3-4 mois.

**Mitigation** : Reporter les subscriptions à V2. La V1 est 100% locale, gratuite, sans compte. Les subscriptions arrivent quand il y a des utilisateurs qui en demandent.

### Risque 4 : Cross-platform non testé

**Impact** : Moyen. Scripts PowerShell, chemins Windows, LLM-Provider Python — tout est Windows-centric.

**Mitigation** : La V1 cible Windows uniquement. Mac/Linux en V1.1 après le premier feedback.

### Risque 5 : Pas assez de workflows "out of the box"

**Impact** : Élevé. Un utilisateur qui télécharge l'app et ne sait pas quoi en faire la désinstalle.

**Mitigation** : Minimum 3 workflows utilisables immédiatement (Code Review, Generate README, Commit Message). Les templates doivent marcher avec un API cloud, pas seulement le LLM local.

---

## Mon avis sur votre plan

### Ce que je soutiens fortement

1. **L'app téléchargeable** — C'est la bonne direction. Maestro est trop mature pour rester un "clone & run".
2. **Le cercle beta** — Feedback réel > spéculation. Faites une V1 minimale et itérez.
3. **Le CLI global** — `maestro` depuis n'importe quel terminal est essentiel pour les développeurs.
4. **Le chat avec les modèles** — C'est la feature d'engagement la plus naturelle.

### Ce que je recommande de reporter

1. **Les subscriptions** — C'est un projet cloud à part entière. Reporter à V2.
2. **L'agent interne type Claude Code** — Fantastique comme vision, mais c'est 1-2 mois de dev. Reporter à V2.
3. **Les modèles hébergés Azure** — Infrastructure cloud, coûts récurrents, scaling. Reporter après les subscriptions.
4. **Le catalogue partagé** — Nécessite une DB cloud, des API publiques, de la modération. V2+.

### L'ordre de priorité que je recommande

```
1. Intégration LLM complète (exposer LLM-Provider)  ← Le LLM-Provider a tout, Maestro ne montre rien
2. Config Azure + Chat/Playground                    ← Engagement immédiat + provider cloud existant
3. Sécurité locale (API key)                        ← Nécessaire avant distribution
4. Packaging Electron                               ← Le livrable
5. Onboarding (setup wizard)                        ← L'utilisateur comprend quoi faire
6. Workflows prêts à l'emploi                       ← La valeur immédiate
7. Polish et stabilisation                          ← La qualité
```

La bonne nouvelle : le LLM-Provider a **déjà** la détection hardware, le registre de 60+ modèles, la compatibilité par VRAM, et le provider Azure. Le travail de Phase 19 est principalement de l'**intégration** (LLMController + UI) plutôt que de la construction from scratch.

L'utilisateur doit pouvoir :
1. Ouvrir Maestro → voir "Votre GPU : RTX 3060, 12GB VRAM"
2. Voir les modèles compatibles avec son hardware, par catégorie
3. Charger un modèle local en 1 clic OU configurer Azure
4. Chatter avec le modèle pour le tester
5. Utiliser ce modèle dans ses workflows

---

## Résumé

La V1 de Maestro devrait être :
- **Local-first** (fonctionne 100% offline avec modèles locaux)
- **Cloud-ready** (Azure BYOK dès V1, OpenAI/Anthropic en V1.1, Maestro Cloud en V2)
- **Single-user** (pas de multi-tenancy)
- **Windows first** (Mac/Linux en V1.1)
- **Hardware-aware** (montre à l'utilisateur ce que sa machine peut faire)
- **3+ workflows prêts** (code review, readme, commit message)
- **Installeur 1-clic** (Electron ou CLI via npm)
- **Sécurisé** (API key locale, localhost only)
- **Self-documenting** (setup wizard, in-app help)

Estimation totale : **6 phases (19-24)**, focus sur valeur utilisateur plutôt que infrastructure cloud.
