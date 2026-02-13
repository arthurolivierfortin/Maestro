# Maestro — Roadmap V1 → V4

## Vue d'ensemble

| Version | Nom | Objectif |
|---------|-----|----------|
| **V1** | **Fondations techniques** | L'app fonctionne, se télécharge, les modèles sont accessibles, le CLI est global |
| **V2** | **Frontend & Templates vivants** | Refonte frontend, templates partagés (CLI, Monitor Maestro, Monitor LLM-Provider), navigation, widgets, style |
| **V3** | **Valeur utilisateur** | Workflows out-of-the-box, ajustements de fonctionnalités manquantes, expérience premier jour |
| **V4** | **Plateforme cloud** | Subscriptions, auth GitHub, catalogue partagé, Maestro Cloud, modèles hébergés Azure |

```
V1 (Technique)          V2 (UI/Templates)         V3 (Contenu)            V4 (Cloud)
─────────────────── → ─────────────────────── → ──────────────────── → ───────────────────
LLM intégration         Refonte frontend          Code Review workflow    Auth GitHub/OAuth
Chat/Playground         Template partagé CLI      Generate README         Subscriptions
Azure config            Template Monitor          Generate Tests          Catalogue partagé
LLMController           Template LLM-Monitor      Refactor suggestions    Maestro Cloud
Sécurité locale         Navigation/routing        Commit message v2       Modèles hébergés
Packaging Electron      Widgets réutilisables     Doc generation          Multi-utilisateurs
CLI global (npm)        Polishing & style         Ajustements UX          Paiement (Stripe)
Setup wizard (CLI)      Pages dynamiques          Guided tours            API publique
Config centralisée      Shared theme complet      Sample repos            Rate limiting
Permissions H/A         Monitors "vivants"        Feedback intégré        Analytics
```

---

## V1 — Fondations techniques

> **But** : Un utilisateur télécharge Maestro, l'installe, voit ses modèles, configure un provider, chatte avec un LLM, et peut utiliser le CLI depuis n'importe quel terminal.

### Phase 19 — Intégration LLM complète + Chat

**Objectif** : L'utilisateur voit ses modèles et peut interagir avec eux.

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **LLMController** (backend) | Proxy vers LLM-Provider : health, models, compatible, capabilities, switch, load |
| 2 | **Page Models** (frontend minimal) | Afficher hardware (GPU/VRAM/RAM), modèles compatibles avec badges, cache local, chargement 1-clic |
| 3 | **Chat/Playground** (frontend) | Page chat avec streaming WebSocket, sélection de modèle, paramètres (temp, max tokens) |
| 4 | **`maestro chat`** (CLI) | Chat interactif en terminal, sélection de modèle |
| 5 | **`maestro models`** (CLI) | Lister modèles compatibles, locaux, chargés — exposer le registre LLM-Provider |
| 6 | **Configuration Azure** | UI pour endpoint + API key + deployment + "Tester connexion" |
| 7 | **Config centralisée** | `~/.maestro/config.json` — providers, API keys, modèle par défaut, URLs |
| 8 | **Config modèle custom** | `~/.maestro/models.json` — l'utilisateur ajoute des modèles au registre |

**Dépendance** : Le LLM-Provider doit tourner (local) ou Azure doit être configuré.

### Phase 20 — Sécurité & Permissions

**Objectif** : L'app est sécurisée pour distribution, humain et agent sont différenciés.

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **API Key locale** | Générée au premier lancement, stockée dans `~/.maestro/config.json` |
| 2 | **Auth middleware** (backend) | `Authorization: Bearer <key>` sur toutes les routes API |
| 3 | **CLI auth** | Le CLI lit la clé depuis le config et l'envoie automatiquement |
| 4 | **Permissions Humain vs Agent** | Humain = clé principale (full access), Agent = clé de session (scope limité) |
| 5 | **Localhost binding** | Backend écoute sur `127.0.0.1` par défaut, pas `0.0.0.0` |
| 6 | **Agent session scope** | Un agent ne peut accéder qu'à sa propre session, pas aux autres |
| 7 | **Audit log** | Logger qui a fait quoi (humain/agent, quelle session, quelle commande) |

### Phase 21 — Packaging & Distribution

**Objectif** : L'utilisateur télécharge un .exe, installe, et ça marche.

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Build Electron production** | Windows .exe via NSIS (config electron-builder déjà existante) |
| 2 | **Backend embarqué** | Electron spawne le backend .NET, gère son cycle de vie |
| 3 | **LLM-Provider optionnel** | L'app fonctionne sans (Azure/cloud), guide intégré pour installer le local |
| 4 | **First-run init** | Créer `~/.maestro/`, copier content/system/, générer API key |
| 5 | **npm publish CLI** | `npm install -g @maestro-ai/cli` → `maestro` disponible globalement |
| 6 | **CLI auto-discover** | Le CLI trouve le backend via `~/.maestro/config.json` ou fallback localhost:5000 |
| 7 | **`maestro setup`** (CLI) | Wizard : détecter hardware → montrer modèles → configurer provider |
| 8 | **`maestro init`** (CLI) | Initialiser un repo : créer `.maestro/`, configurer workspace |
| 9 | **Sanity checks** | Au lancement : vérifier backend, LLM status, espace disque, afficher warnings |

### Phase 22 — Stabilisation V1

**Objectif** : Tout fonctionne de bout en bout, les erreurs sont gérées.

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Tests d'intégration** | Scénario complet : install → setup → create session → run workflow → results |
| 2 | **Error handling** | Messages humains pour les erreurs courantes (LLM down, modèle trop gros, etc.) |
| 3 | **Health dashboard** (minimal) | Statut de chaque service dans le CLI (`maestro health --verbose`) |
| 4 | **`maestro logs`** | Voir les dernières erreurs et events |
| 5 | **Doc d'installation** | Guide step-by-step Windows (seul OS pour V1) |
| 6 | **Getting Started** | Guide "5 minutes" : installer → setup → premier chat → premier workflow |
| 7 | **Bug fixes** | Issues trouvées pendant les tests |

### Ce que V1 ne touche PAS

| Domaine | Raison |
|---------|--------|
| Refonte frontend | → V2 |
| Polish/style UI | → V2 |
| Navigation avancée | → V2 |
| Workflows out-of-the-box | → V3 |
| Guided tours / onboarding riche | → V3 |
| Sample repos | → V3 |
| Subscriptions / auth cloud | → V4 |
| Multi-utilisateurs | → V4 |

### Livrable V1

L'utilisateur peut :
- Télécharger un `.exe` Windows et installer Maestro
- Lancer `maestro setup` → détecter son hardware → voir les modèles compatibles
- Configurer Azure OpenAI OU utiliser un modèle local
- Chatter avec un modèle (frontend + CLI)
- Créer une session à partir d'un template existant
- Exécuter un workflow et voir les résultats
- Utiliser `maestro` depuis n'importe quel terminal
- Les permissions différencient humain vs agent

---

## V2 — Frontend & Templates vivants

> **But** : L'interface (frontend web, CLI, Monitor Maestro, Monitor LLM-Provider) est professionnelle, cohérente, et extensible via des templates de pages/widgets.

### Principes V2

1. **Template partagé** : Un système de layout commun pour CLI, Monitor Maestro, Monitor LLM-Provider, et Frontend web
2. **Pages dynamiques** : Ajouter une page = ajouter un fichier de config, pas du code
3. **Widgets réutilisables** : Les mêmes widgets (health, metrics, charts, lists) marchent partout
4. **Navigation unifiée** : Même structure de navigation dans tous les contextes
5. **"Vivant"** : Temps réel, animations subtiles, états de chargement, transitions

### Phase 23 — Template partagé & Infrastructure UI

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Shared layout system** | Template de page avec header, sidebar, content area, status bar — partagé entre frontend et TUI |
| 2 | **Widget registry** | Système d'enregistrement de widgets (health, metrics, chart, list, log, progress) |
| 3 | **Page registry** | Système pour déclarer des pages par config (route, layout, widgets, data sources) |
| 4 | **Navigation framework** | Sidebar/tabs configurable, breadcrumbs, context-aware navigation |
| 5 | **Data binding** | Widgets se connectent à des sources de données (API, SignalR, session variables) |
| 6 | **Shared component library** | Buttons, cards, badges, tables, inputs — design system cohérent |

### Phase 24 — Monitors "vivants"

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Monitor Maestro** (TUI) | Refonte avec le template partagé : pages dynamiques, widgets temps réel |
| 2 | **Monitor LLM-Provider** (TUI) | Nouveau monitor pour le LLM-Provider : modèles, GPU, inférences en cours, métriques |
| 3 | **CLI amélioré** | Sortie formatée, couleurs cohérentes, spinners, progress bars |
| 4 | **Temps réel** | SignalR/WebSocket pour toutes les données qui changent (sessions, exécutions, métriques) |
| 5 | **Status bar** | Info constante : backend health, LLM actif, session en cours, VRAM usage |

### Phase 25 — Refonte Frontend Web

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Design system** | Couleurs, typographie, spacing, composants — cohérent avec le thème partagé |
| 2 | **Dashboard** | Page d'accueil redesignée : quick actions, sessions en cours, health, métriques |
| 3 | **Session detail** | Page unifiée : progression visuelle, logs, artifacts, métriques |
| 4 | **Models page** | Refonte visuelle : cards par catégorie, hardware overlay, configuration provider |
| 5 | **Chat page** | Polishing : historique, conversations, paramètres avancés, markdown rendering |
| 6 | **Block catalog** | Vue grille/liste, filtres, recherche, preview de blocks |
| 7 | **Settings** | Page centralisée : LLM, providers, chemins, thème, keybindings |
| 8 | **Responsive** | Minimum 1280x720, adaptation pour écrans plus petits |
| 9 | **Loading/Error/Empty states** | Spinners, skeletons, messages d'erreur contextuels, empty states guides |
| 10 | **Animations** | Transitions de page, apparitions subtiles, feedback visuel |

### Livrable V2

- Frontend web professionnel et cohérent
- Monitor Maestro TUI avec pages dynamiques et widgets temps réel
- Monitor LLM-Provider TUI dédié
- CLI avec sortie formatée et cohérente
- Template partagé permettant d'ajouter des pages/widgets par config
- Tout est "vivant" — temps réel, animations, états visuels

---

## V3 — Valeur utilisateur

> **But** : Un nouvel utilisateur a de la valeur dès le jour 1. Des workflows prêts à l'emploi, des ajustements de fonctionnalités, et une expérience guidée.

### Phase 26 — Workflows out-of-the-box

| # | Workflow | Description | Blocks existants utilisés |
|---|----------|-------------|--------------------------|
| 1 | **Code Review** | Analyse un diff Git → produit un rapport de review | git-diff, file-read, llm-generate |
| 2 | **Generate README** | Analyse un repo → génère un README.md | directory-list, file-read, project-structure, llm-generate |
| 3 | **Generate Tests** | Analyse un fichier → génère des tests unitaires | file-read, code-extractor, llm-generate, file-write |
| 4 | **Refactor Suggestions** | Analyse du code → propose des refactors | code-search, file-read, llm-generate |
| 5 | **Documentation** | Analyse une API/module → génère la doc | project-structure, code-extractor, llm-generate, file-write |
| 6 | **Commit Message v2** | Améliore gen-commit pour supporter tous les providers | git-diff, git-status, llm-generate |

Chaque workflow = **template JSON + block JSON uniquement**. Zéro changement C#.

### Phase 27 — Ajustements de fonctionnalités

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Onboarding riche** | Guided tour au premier lancement (tooltips sur les actions principales) |
| 2 | **Quick actions contextuelles** | "Reviewer mon dernier commit", "Générer un README pour ce repo" |
| 3 | **Sample repos** | Petit repo inclus pour tester les workflows immédiatement |
| 4 | **Template marketplace local** | Explorer et installer des templates depuis un catalogue local |
| 5 | **Feedback intégré** | Formulaire dans l'app pour remonter les problèmes aux beta users |
| 6 | **`maestro run <workflow>` amélioré** | Raccourcis : `maestro review`, `maestro readme`, `maestro test-gen` |
| 7 | **Rapport d'utilisation** | `maestro stats` — combien de workflows lancés, temps gagné estimé |
| 8 | **Ajustements UX** | Basés sur le feedback des V1/V2 beta users |

### Phase 28 — Stabilisation V3

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Test de chaque workflow** | Sur différents repos (JS, Python, C#, Go) avec différents modèles |
| 2 | **Qualité des outputs** | Ajuster les prompts et templates pour des résultats de qualité |
| 3 | **Documentation workflows** | Guide pour chaque workflow : quand l'utiliser, quoi configurer, exemples |
| 4 | **Performance** | Optimiser les workflows lents (paralléliser quand possible) |
| 5 | **Telemetry opt-in** | Données anonymes sur l'utilisation des workflows |

### Livrable V3

- 6+ workflows prêts à l'emploi pour tout développeur
- Quick actions depuis le dashboard et le CLI
- Onboarding guidé pour les nouveaux utilisateurs
- Raccourcis CLI (`maestro review`, `maestro readme`)
- Sample repo pour tester immédiatement
- Feedback loop avec les beta users

---

## V4 — Plateforme cloud

> **But** : Maestro devient une plateforme avec comptes, subscriptions, catalogue partagé, et modèles hébergés.

### Phase 29 — Authentification & Comptes

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **OAuth GitHub** | Login via GitHub (OAuth2 flow) |
| 2 | **Base de données utilisateurs** | PostgreSQL ou CosmosDB (Azure) |
| 3 | **Profil utilisateur** | Nom, avatar, bio, blocks publiés, workflows partagés |
| 4 | **Token management** | JWT tokens, refresh tokens, session management |
| 5 | **RBAC** | Rôles : Free user, Pro user, Admin |

### Phase 30 — Subscriptions

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Plans** | Free (local only) / Pro (catalogue + cloud models) / Enterprise (team features) |
| 2 | **Paiement** | Stripe integration |
| 3 | **Feature gating** | Activer/désactiver features selon le plan |
| 4 | **Usage tracking** | Compteur d'appels API, tokens consommés, storage utilisé |
| 5 | **Dashboard billing** | Factures, usage, upgrade/downgrade |

### Phase 31 — Catalogue partagé & Maestro Cloud

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Catalogue cloud** | DB de blocks publiés par les utilisateurs |
| 2 | **Publish workflow** | Depuis l'app → publier un block/workflow au catalogue |
| 3 | **Browse & install** | Chercher, filtrer, installer des blocks communautaires |
| 4 | **Maestro Cloud LLM** | Modèles hébergés sur Azure, accessibles via subscription Pro |
| 5 | **API Gateway** | Rate limiting, quotas, cost tracking pour les modèles cloud |
| 6 | **Modération** | Review des blocks publiés (auto + manuel) |

### Phase 32 — Enterprise & Multi-utilisateurs

| # | Tâche | Détail |
|---|-------|--------|
| 1 | **Teams** | Organisations, membres, rôles |
| 2 | **Shared workspaces** | Collaboration en temps réel |
| 3 | **Private catalog** | Blocks partagés dans une organisation uniquement |
| 4 | **SSO** | SAML/OIDC pour entreprises |
| 5 | **Audit trail** | Logs d'activité pour compliance |

### Livrable V4

- Login GitHub, profil utilisateur
- Plans Free/Pro/Enterprise avec Stripe
- Catalogue partagé de blocks et workflows
- Modèles LLM hébergés par Maestro (Azure)
- Features communautaires (publish, browse, install)
- Multi-utilisateurs et teams (Enterprise)

---

## Timeline visuelle

```
        V1                    V2                   V3                    V4
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ Phase 19     │     │ Phase 23     │     │ Phase 26     │     │ Phase 29     │
  │ LLM + Chat   │     │ Templates    │     │ Workflows    │     │ Auth/Comptes │
  ├──────────────┤     ├──────────────┤     ├──────────────┤     ├──────────────┤
  │ Phase 20     │     │ Phase 24     │     │ Phase 27     │     │ Phase 30     │
  │ Sécurité     │     │ Monitors     │     │ Ajustements  │     │ Subscriptions│
  ├──────────────┤     ├──────────────┤     ├──────────────┤     ├──────────────┤
  │ Phase 21     │     │ Phase 25     │     │ Phase 28     │     │ Phase 31     │
  │ Packaging    │     │ Frontend web │     │ Stabilisation│     │ Catalogue    │
  ├──────────────┤     └──────────────┘     └──────────────┘     ├──────────────┤
  │ Phase 22     │                                                │ Phase 32     │
  │ Stabilisation│                                                │ Enterprise   │
  └──────────────┘                                                └──────────────┘

  ← Téléchargeable →   ← Professionnel →    ← Utile jour 1 →   ← Plateforme  →
    Beta fermée           UI refaite           Workflows prêts     Cloud + SaaS
```

---

## Décisions de scope par version

| Feature | V1 | V2 | V3 | V4 |
|---------|:--:|:--:|:--:|:--:|
| LLM local (modèles compatibles, hardware) | X | | | |
| Azure BYOK | X | | | |
| Chat/Playground | X | | | |
| CLI global (`npm install -g`) | X | | | |
| Sécurité locale (API key) | X | | | |
| Packaging Electron (.exe) | X | | | |
| `maestro setup` wizard | X | | | |
| Permissions Humain vs Agent | X | | | |
| OpenAI/Anthropic BYOK | X* | | | |
| Template partagé (pages/widgets) | | X | | |
| Monitor LLM-Provider (TUI) | | X | | |
| Refonte frontend (design system) | | X | | |
| Navigation avancée | | X | | |
| Animations, loading states | | X | | |
| Code Review workflow | | | X | |
| Generate README workflow | | | X | |
| Generate Tests workflow | | | X | |
| Guided tours / onboarding riche | | | X | |
| Quick actions contextuelles | | | X | |
| `maestro review`, `maestro readme` | | | X | |
| Auth GitHub | | | | X |
| Subscriptions (Stripe) | | | | X |
| Catalogue partagé | | | | X |
| Maestro Cloud LLM | | | | X |
| Multi-utilisateurs | | | | X |

*X\* = si le temps le permet en V1, sinon V1.1*

---

## Risques par version

### V1
| Risque | Impact | Mitigation |
|--------|--------|------------|
| Electron + Backend .NET = complexité | Élevé | POC de packaging tôt (Phase 21) |
| LLM-Provider installation compliquée | Moyen | Azure comme alternative, guide intégré |
| Windows-only | Faible | V1 cible explicitement Windows |

### V2
| Risque | Impact | Mitigation |
|--------|--------|------------|
| Template partagé trop ambitieux | Élevé | Commencer par 3 widgets, itérer |
| 3 monitors à maintenir | Moyen | Shared component library réduit la duplication |
| Breaking changes frontend | Moyen | V2 est une refonte, pas un patch |

### V3
| Risque | Impact | Mitigation |
|--------|--------|------------|
| Qualité des outputs LLM | Élevé | Tester avec plusieurs modèles et repos |
| Workflows trop spécifiques | Moyen | Rester générique (JS, Python, C#, Go) |
| Prompts fragiles | Moyen | Eval criteria + fitness tracking existants |

### V4
| Risque | Impact | Mitigation |
|--------|--------|------------|
| Infrastructure cloud coûteuse | Élevé | Commencer petit (Azure Functions) |
| Modération du catalogue | Moyen | Auto-scan + review queue |
| Sécurité multi-tenant | Élevé | Audit sécurité avant lancement |
